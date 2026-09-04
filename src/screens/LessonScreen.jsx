import { useEffect, useState } from 'react'
import { LessonIcon } from '../components/Icons.jsx'
import { stop } from '../lib/audio.js'

/**
 * Screen 3 — the week's lesson.
 *
 * The video is real; the homework and the games are still placeholders so
 * the route and the shape are honest about what exists.
 *
 * The video id is DECLARED on the group (group.media.video.id) by the entry
 * table. Null means the group has no video yet, and the screen says so — it
 * never invents one. The embed is a facade first: nothing from YouTube loads
 * until the child taps play, so an offline open still paints instantly, and
 * the iframe is youtube-nocookie with rel=0 so a lesson does not end on a
 * wall of unrelated suggestions.
 */
const CARDS = [
  ['tarea', 'Tarea', 'Para practicar en casa'],
  ['juegos', 'Juegos', 'Juega con las letras']
]

export default function LessonScreen ({ group, onBack }) {
  const vid = group.media?.video?.provider === 'youtube' ? group.media.video.id : null
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
        <VideoBox vid={vid} />
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

function VideoBox ({ vid }) {
  // 'facade' | 'playing' | 'offline' | 'blocked'
  const [state, setState] = useState(navigator.onLine ? 'facade' : 'offline')

  // If the frame never reports load (a viewer that forbids external frames),
  // fall back to a link rather than leaving a black rectangle a child cannot act on.
  useEffect(() => {
    if (state !== 'playing') return
    let loaded = false
    const onLoad = () => { loaded = true }
    const el = document.getElementById('lesson-video')
    el?.addEventListener('load', onLoad)
    const t = setTimeout(() => { if (!loaded) setState('blocked') }, 2600)
    return () => { clearTimeout(t); el?.removeEventListener('load', onLoad) }
  }, [state])

  if (!vid) {
    return (
      <div className="videobox">
        <div className="voff">
          <b>Todavía no hay video</b>
          <span>El video de este grupo se publica el día de la lección.</span>
        </div>
      </div>
    )
  }

  const start = () => {
    stop()
    setState(navigator.onLine ? 'playing' : 'offline')
  }

  return (
    <div className="videobox">
      {state === 'facade' && (
        <button className="facade" aria-label="Reproducir el video de la lección" onClick={start}>
          <span className="playbtn">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <span className="cap">Video de la semana</span>
        </button>
      )}
      {state === 'playing' && (
        <iframe
          id="lesson-video"
          src={`https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title="Video de la lección"
        />
      )}
      {(state === 'offline' || state === 'blocked') && (
        <div className="voff">
          <b>{state === 'blocked' ? 'No se puede mostrar aquí' : 'Sin conexión'}</b>
          <span>
            {state === 'blocked'
              ? 'Este visor no permite el video. Ábrelo en YouTube.'
              : 'El video necesita internet. Las letras y los sonidos sí funcionan sin conexión.'}
          </span>
          <a href={`https://www.youtube.com/watch?v=${vid}`} target="_blank" rel="noopener">Abrir en YouTube</a>
        </div>
      )}
    </div>
  )
}
