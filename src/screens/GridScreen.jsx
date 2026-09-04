import { groups, structure, group, isUnlocked } from '../lib/registry.js'

/**
 * Screen 1 — the alphabet.
 *
 * Populated groups get their letter tiles. Unpopulated ones get a row and
 * nothing else: the registry deliberately does not declare letter membership
 * for G2-G8, and inventing "E F G H" here to fill the grid would be the app
 * asserting curriculum it has not been given.
 */
export default function GridScreen ({ onOpenLetter, onOpenLesson }) {
  const live = new Set(groups().map(g => g.id))

  return (
    <section className="screen active" id="screen-grid">
      <div className="pagehead">
        <p className="eyebrow">English con Fútbol</p>
        <h1 className="lede">El alfabeto</h1>
      </div>

      <div id="groups">
        {structure().filter(s => s.kind === 'letter-group').map(row => {
          const g = live.has(row.id) ? group(row.id) : null
          const open = g ? isUnlocked(row.id) : false
          const sub = g ? g.letters.join(' ') : 'Pronto'

          return (
            <div key={row.id} className={'groupsec' + (open ? '' : ' locked')}>
              <div className="grouphead">
                <span className="gname">
                  Grupo {row.number}<small>{sub}</small>
                </span>
                <button
                  className={'enter' + (open ? '' : ' off')}
                  aria-disabled={open ? undefined : 'true'}
                  onClick={open ? () => onOpenLesson(g) : undefined}
                >
                  {open ? 'Entrar a la lección →' : 'Todavía no'}
                </button>
              </div>

              {g && (
                <div className="grid">
                  {g.letters.map(letter => (
                    <LetterTile
                      key={letter}
                      letter={letter}
                      live={open && hasLetter(g, letter)}
                      onOpen={() => onOpenLetter(letter, g)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="build">build {__BUILD__}</p>
    </section>
  )
}

/* A letter is openable when the group actually carries entries for it. */
function hasLetter (g, letter) {
  return g.items.some(it => it.letter === letter)
}

function LetterTile ({ letter, live, onOpen }) {
  // A locked tile wiggles rather than doing nothing, so a tap reads as
  // "not yet" instead of as a broken button.
  const nudge = e => {
    const el = e.currentTarget
    el.classList.remove('nudge')
    void el.offsetWidth
    el.classList.add('nudge')
  }
  return (
    <button
      className={'tile ' + (live ? 'live' : 'locked')}
      aria-disabled={live ? undefined : 'true'}
      onClick={live ? onOpen : nudge}
    >
      {letter}
    </button>
  )
}
