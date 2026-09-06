import { useState } from 'react'
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
 * The group is whatever the caller was already looking at. A game that is
 * handed nothing falls back to the first populated group on its own, so this
 * screen never has to know which groups are live.
 */
const GAMES = [
  { id: 'tiro-libre', label: 'Tiro Libre', component: TiroLibre }
]

export default function GamesScreen ({ group: groupProp, onBack }) {
  const group = groupProp ?? groups()[0]
  const [open, setOpen] = useState(null)

  if (open) {
    const Game = open.component
    return <Game group={group} onBack={() => { stop(); setOpen(null) }} />
  }

  return (
    <section className="screen active" id="screen-games">
      <div className="topbar">
        {onBack && <button className="back" onClick={onBack}>← Volver</button>}
        <span className="chip">Grupo {group.number} · {group.letters.join(' ')}</span>
      </div>

      <div className="pagehead">
        <p className="eyebrow">English con Fútbol</p>
        <h1 className="lede">Juegos</h1>
      </div>

      <div id="games">
        {GAMES.map(g => (
          <div key={g.id} className="groupsec">
            <div className="grouphead">
              <span className="gname">{g.label}</span>
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
