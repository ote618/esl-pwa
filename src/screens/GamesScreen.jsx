import { LessonIcon } from '../components/Icons.jsx'

/**
 * Screen — Juegos.
 *
 * The index the "Juegos" card on a lesson opens. Two tiles, and it tells the
 * truth about each: Súper Sonidos exists and opens; Tiro Libre is being built
 * on its own branch and is not in this build, so it gets the same "todavía no"
 * treatment a locked letter group gets rather than a link to a 404.
 *
 * WHEN TIRO LIBRE LANDS: replace that tile's body with a call to
 * onOpenGame('/juegos/tiro-libre') — or, if it arrives as a shelf that mounts
 * games in state rather than by route, keep that shelf and add Súper Sonidos
 * to it. Either shape works; what must not happen is two games indexes.
 *
 * Reuses .lesson / .lessons from the alphabet stylesheet on purpose — a games
 * list that looked like a different app would read as a different app.
 */
export default function GamesScreen ({ onBack, onOpenGame }) {
  return (
    <section className="screen active" id="screen-games">
      <div className="topbar">
        <button className="back" onClick={onBack}>← Volver</button>
        <span className="chip">Juegos</span>
      </div>

      <div className="pagehead">
        <p className="eyebrow">English con Fútbol</p>
        <h1 className="lede">Juegos</h1>
      </div>

      <div className="lessons">
        <button className="lesson" onClick={() => onOpenGame('/juegos/super-sonidos')}>
          <LessonIcon name="juegos" />
          <span>
            <span className="lt">Súper Sonidos</span>
            <span className="ls">Corre, salta y encuentra la letra</span>
          </span>
        </button>

        <button className="lesson soon-tile" aria-disabled="true">
          <LessonIcon name="juegos" />
          <span>
            <span className="lt">Tiro Libre</span>
            <span className="ls">Todavía no</span>
          </span>
        </button>
      </div>
    </section>
  )
}
