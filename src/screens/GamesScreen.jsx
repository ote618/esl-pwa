import { lazy, Suspense, useState } from 'react'
import { groups } from '../lib/registry.js'
import { stop } from '../lib/audio.js'
import TiroLibre from '../games/TiroLibre.jsx'

/**
 * The games shelf.
 *
 * One list, one entry per game. A game is a component that takes
 * { group, onBack } and owns everything else about itself — its own screens,
 * its own progress, its own styles. Adding a game is adding a line here.
 *
 * Reached from the week's lesson, so the group arrives with the child: a
 * game is played in the letters that lesson just taught. The fallback to the
 * first populated group is a safety net for a caller that hands over nothing —
 * the /juegos URL, which nobody arrives at from a lesson — not a route anyone
 * takes on purpose.
 *
 * Súper Sonidos ignores the group: it carries its own map of sets and lets a
 * child pick, so the shelf's group is simply not its question. It is also
 * lazy, because its canvas engine and its stylesheet — which repaints <html>
 * dark — have no business loading for a child who never opens it.
 */
const SuperSonidos = lazy(() => import('../games/super-sonidos/SuperSonidos.jsx'))

const GAMES = [
  { id: 'tiro-libre', label: 'Tiro Libre', sub: 'Tira a puerta y acierta la letra', component: TiroLibre },
  { id: 'super-sonidos', label: 'Súper Sonidos', sub: 'Corre, salta y golpea las cajas', component: SuperSonidos }
]

export default function GamesScreen ({ group: groupProp, onBack }) {
  const group = groupProp ?? groups()[0]
  const [open, setOpen] = useState(null)

  if (open) {
    const Game = open.component
    return (
      <Suspense fallback={null}>
        <Game group={group} onBack={() => { stop(); setOpen(null) }} />
      </Suspense>
    )
  }

  return (
    <section className="screen active" id="screen-games">
      <div className="topbar">
        {onBack && <button className="back" onClick={onBack}>← Volver</button>}
        <span className="chip">Grupo {group.number} · {group.letters.join(' ')}</span>
      </div>

      <div className="pagehead">
        <p className="eyebrow">Grupo {group.number}</p>
        <h1 className="lede">Juegos</h1>
      </div>

      <div id="games">
        {GAMES.map(g => (
          <div key={g.id} className="groupsec">
            <div className="grouphead">
              <span className="gname">
                {g.label}<small>{g.sub}</small>
              </span>
              <button className="enter" onClick={() => { stop(); setOpen(g) }}>
                Jugar →
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
