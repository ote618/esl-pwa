import { useEffect, useState } from 'react'
import { play, stop } from '../lib/audio.js'

/**
 * Pass 2 — escucha y escribe.
 *
 * THE SCREEN IS: the item number, `repetir`, `atrás`, `siguiente`. Nothing else.
 *
 *   No word. No letter. No image. No greyed hint. No first letter.
 *   No reveal on tap. No answer after a wrong attempt — there is no attempt to
 *   be wrong. Nothing here captures, checks, stores, marks or displays what the
 *   child writes, and nothing in progress tracking records it.
 *
 * THIS WILL LOOK LIKE A BUG TO ANYONE WHO HAS NOT READ THIS COMMENT. It is not.
 * Ratified F-15, Master 2026-08-11. The teacher collects the paper; it is the
 * only record of what a child can produce unaided, and an app that showed the
 * answer — even once, even greyed, even after a mistake — would destroy it.
 *
 * THE OPPOSITE RULE LIVES NEXT DOOR. In game mode the correct answer SHOULD be
 * revealed after a wrong pick (F-16). Different surface, different chat. Do not
 * unify them, and do not extract a shared component from this one and
 * RecognisePass: the first refactor that gives them a common "current item"
 * object is the one that leaks a reveal into here.
 *
 * WHICH IS WHY THIS COMPONENT IS HANDED `ids`, NOT ITEMS.
 * It has no labels, no words and no images to render — not by policy, but
 * because they were never passed in. There is nothing here to leak.
 */
export default function WritePass ({ ids, onDone }) {
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(false)

  const total = ids.length
  const id = ids[at]

  const say = () => {
    if (!id) return
    setPlaying(true)
    play(id, 'sound').then(() => setPlaying(false))
  }

  // The clip plays itself when the item comes up, and `repetir` is unlimited.
  // The delay lets the number paint first so the sound lands with it.
  useEffect(() => {
    const t = setTimeout(say, 260)
    return () => { clearTimeout(t); stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, id])

  const last = at === total - 1

  return (
    <section className="screen active" id="screen-write">
      <div className="topbar">
        <span />
        <span className="chip">Parte 2 · escucha y escribe</span>
      </div>

      <div className="pips">
        {ids.map((_, k) => (
          <span key={k} className={'pip' + (k < at ? ' done' : k === at ? ' now' : '')} />
        ))}
      </div>

      <div className="bare">
        <div className="barecount">
          <div>
            <span className="num">{at + 1}</span>
            <span className="of">de {total}</span>
          </div>
        </div>

        <button className={'repeat' + (playing ? ' playing' : '')} onClick={say}>
          <Repeat />
          repetir
        </button>

        <div className="navrow">
          <button className="nav" disabled={at === 0} onClick={() => { stop(); setAt(a => Math.max(0, a - 1)) }}>
            atrás
          </button>
          <button
            className="nav"
            onClick={() => { stop(); last ? onDone() : setAt(a => a + 1) }}
          >
            {last ? 'terminar' : 'siguiente'}
          </button>
        </div>

        <p className="barenote">nada que copiar</p>
      </div>
    </section>
  )
}

function Repeat () {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
    </svg>
  )
}
