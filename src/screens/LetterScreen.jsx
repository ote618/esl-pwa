import { useEffect, useState, useRef } from 'react'
import { Speaker } from '../components/Icons.jsx'
import { play, playSequence, stop } from '../lib/audio.js'

/**
 * Screen 2 — one letter.
 *
 * The hero is the letter's name. Below it, one card per sound entry: a
 * speaker that walks sound -> word1 -> word2, and the two words on their own.
 *
 * Entries are selected by their DECLARED fields — part, letter, shape. No id
 * is parsed to work out what something is.
 */
export default function LetterScreen ({ letter, group, onBack }) {
  const [playing, setPlaying] = useState(null)   // 'hero' | `${id}:${at}`
  const heroRef = useRef(null)

  const name = group.items.find(it => it.part === 1 && it.shape === 'name' && it.letter === letter)
  const sounds = group.items.filter(it => it.part === 2 && it.shape === 'sound' && it.letter === letter)

  const playName = () => {
    if (!name) return
    setPlaying('hero')
    play(name.id, 'sound').then(() => setPlaying(null))
  }

  // Opening a letter says its name, the way the mockup does. The delay lets
  // the screen paint first so the sound lands with the letter, not before it.
  useEffect(() => {
    const t = setTimeout(playName, 280)
    return () => { clearTimeout(t); stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter])

  return (
    <section className="screen active" id="screen-letter">
      <div className="topbar">
        <button className="back" onClick={onBack}>← Volver</button>
        <span className="chip">Grupo {group.number} · {group.letters.join(' ')}</span>
      </div>

      <div id="letter-body">
        <button
          ref={heroRef}
          className={'hero' + (playing === 'hero' ? ' is-playing' : '')}
          onClick={playName}
        >
          <span className="glyph">{letter}</span>
          <span className="cue"><Speaker /> Escucha</span>
        </button>

        {sounds.length > 0 && (
          <>
            <p className="seclabel">{sounds.length > 1 ? 'Sus sonidos' : 'Su sonido'}</p>
            <div className="sounds">
              {sounds.map(entry => (
                <SoundCard
                  key={entry.id}
                  entry={entry}
                  labelled={group.id === 'G1'}
                  playing={playing}
                  setPlaying={setPlaying}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

const WORD_ROLES = ['word1', 'word2']

/**
 * `labelled` is G1-only on purpose.
 *
 * `variant` and `spanishGuide` are hand-authored curriculum for Group 1 and
 * DERIVED for G2-G6 — spanishGuide from the recorded `says` value, variant by
 * precedent — and both are awaiting curriculum sign-off. Showing a derived
 * pronunciation guide to a child as if it were taught content is worse than
 * showing none, so G2-G6 render unlabelled until someone signs them off.
 * Those groups are gated shut today, so nothing is currently reachable anyway.
 */
function SoundCard ({ entry, labelled, playing, setPlaying }) {
  const active = typeof playing === 'string' && playing.startsWith(entry.id + ':')
  const at = active ? Number(playing.split(':')[1]) : null

  const walk = () => {
    // Beat 0 is the sound, then one beat per word. playSequence drops any
    // step whose clip is absent, so a shorter entry just plays what it has.
    const steps = [{ id: entry.id, role: 'sound' }]
      .concat(entry.words.map((_, i) => ({ id: entry.id, role: WORD_ROLES[i] })))
    playSequence(steps, i => setPlaying(i === null ? null : `${entry.id}:${i}`))
  }

  const playWord = i => {
    setPlaying(`${entry.id}:${i + 1}`)
    play(entry.id, WORD_ROLES[i]).then(() => setPlaying(null))
  }

  return (
    <div className={'sound' + (active ? ' is-playing' : '')}>
      {labelled && (entry.variant || entry.spanishGuide) && (
        <p className="soundlabel">
          <span>{entry.variant ? `${entry.label} ${entry.variant}` : entry.label}</span>
          {entry.spanishGuide && <span className="guide">{entry.spanishGuide}</span>}
        </p>
      )}
      <button
        className={'speaker' + (at === 0 ? ' is-playing' : '')}
        aria-label="Escuchar el sonido y sus palabras"
        onClick={walk}
      >
        <Speaker />
      </button>

      <div className="words">
        {entry.words.map((w, i) => (
          <button
            key={w.text}
            className={'word' + (at === i + 1 ? ' is-playing' : '')}
            onClick={() => playWord(i)}
          >
            {/* imageSrc is resolved and percent-encoded by the generator.
                Nothing here builds a path.

                No width/height attributes: they map to a presentational
                height that beats the stylesheet's aspect-ratio: 1, which
                stretched every thumbnail into a full-height strip. The CSS
                reserves the box on its own. */}
            <img src={w.imageSrc} alt="" />
            <span>{w.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
