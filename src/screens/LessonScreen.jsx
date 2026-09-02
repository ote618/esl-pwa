import { LessonIcon } from '../components/Icons.jsx'

/**
 * Screen 3 — the week's lesson.
 *
 * Placeholders, deliberately. The video, the homework and the games are not
 * in Slice 1; the screen exists so the route and the shape are real.
 */
const CARDS = [
  ['video', 'Video', 'La lección de la semana'],
  ['tarea', 'Tarea', 'Para practicar en casa'],
  ['juegos', 'Juegos', 'Juega con las letras']
]

export default function LessonScreen ({ group, onBack }) {
  return (
    <section className="screen active" id="screen-lesson">
      <div className="topbar">
        <button className="back" onClick={onBack}>← Volver</button>
        <span className="chip">Grupo {group.number} · {group.letters.join(' ')}</span>
      </div>

      <div className="pagehead">
        <h1 className="lede">Grupo {group.number}</h1>
      </div>

      <div className="lessons">
        {CARDS.map(([key, title, sub]) => (
          <button className="lesson" key={key}>
            <LessonIcon name={key} />
            <span>
              <span className="lt">{title}</span>
              <span className="ls">{sub}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="soon">
        Aquí vivirán el video de la semana, la tarea y los juegos del grupo.
      </p>
    </section>
  )
}
