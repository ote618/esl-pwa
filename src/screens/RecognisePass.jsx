import { useEffect, useMemo, useRef, useState } from 'react'
import { play, stop } from '../lib/audio.js'
import { choicesFor } from '../lib/homework.js'
import { recordAnswer } from '../lib/progress.js'

/**
 * Pass 1 — escucha y elige.
 *
 * The sound plays. Four choices. Right or wrong, immediately. The speaker
 * replays as often as the child wants.
 *
 * A WRONG ANSWER DOES NOT END THE ROUND AND DOES NOT ADVANCE. The card flashes
 * red, the verdict says "otra vez", and the same item is still there. A child
 * leaves every item having got it right; what the teacher needs to know about
 * the ones that took three goes is in progress, not on the screen.
 *
 * Choices are word pictures wherever the entry has words — ruled 2026-09-06 for
 * all six groups — and text otherwise. Which is which is decided by asking the
 * data (does this entry have words?), never by the shape's name. The build is
 * what guarantees every one of those words has an image on disk; see V14.
 */
export default function RecognisePass ({ items, pool, seed, onDone, onBack }) {
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [verdict, setVerdict] = useState(null)   // null | 'ok' | 'no'
  const [chosen, setChosen] = useState(null)     // the key of the card just tapped
  const [settled, setSettled] = useState(false)  // the item is answered; ignore further taps

  // First attempts only reach progress. An item retried until it is right would
  // otherwise score 100% and Wednesday would never find a weak third.
  const tried = useRef(new Set())
  const timers = useRef([])

  const item = items[at]
  const choices = useMemo(
    () => (item ? choicesFor(item, { pool, seed }) : null),
    [item, pool, seed]
  )

  const say = () => {
    if (!item) return
    setPlaying(true)
    play(item.id, 'sound').then(() => setPlaying(false))
  }

  // The clip plays itself when the item comes up, then on demand for ever.
  useEffect(() => {
    setVerdict(null); setChosen(null); setSettled(false)
    const t = setTimeout(say, 280)
    timers.current.push(t)
    return () => { clearTimeout(t); stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, item?.id])

  useEffect(() => () => { timers.current.forEach(clearTimeout); stop() }, [])

  const pick = key => {
    if (settled || !choices) return
    const right = key === choices.correct
    const first = !tried.current.has(item.id)
    tried.current.add(item.id)
    recordAnswer(item.id, right, first)

    setChosen(key)
    if (!right) {
      setVerdict('no')
      const t = setTimeout(() => setChosen(null), 600)
      timers.current.push(t)
      return
    }

    setSettled(true)
    setVerdict('ok')
    const t = setTimeout(() => {
      if (at < items.length - 1) setAt(a => a + 1)
      else onDone()
    }, 720)
    timers.current.push(t)
  }

  if (!item || !choices) return null

  return (
    <section className="screen active" id="screen-recognise">
      <div className="topbar">
        <button className="back" onClick={onBack} aria-label="Volver">‹</button>
        <span className="chip">Parte 1 · escucha y elige</span>
      </div>

      <div className="pips">
        {items.map((_, k) => (
          <span key={k} className={'pip' + (k < at ? ' done' : k === at ? ' now' : '')} />
        ))}
      </div>

      <button
        className={'speakerbig' + (playing ? ' playing' : '')}
        onClick={say}
        aria-label="Escuchar otra vez"
      >
        <span className="disc"><SpeakerBig /></span>
        <span className="cap">Tocar para escuchar</span>
      </button>

      <div className="choices">
        {choices.options.map(opt => (
          <button
            key={opt.key}
            className={
              'choice' +
              (choices.kind === 'picture' ? ' pic' : '') +
              (chosen === opt.key ? (opt.key === choices.correct ? ' right' : ' wrong') : '')
            }
            onClick={() => pick(opt.key)}
          >
            {/* imageSrc is resolved and percent-encoded by the generator.
                Nothing here builds a path. No width/height attributes — they
                map to a presentational height that beats the stylesheet. */}
            {opt.imageSrc && <img src={opt.imageSrc} alt="" />}
            <span>{opt.text}</span>
          </button>
        ))}
      </div>

      <p className={'verdict' + (verdict ? ' ' + verdict : '')}>
        {verdict === 'ok' ? '¡Muy bien!' : verdict === 'no' ? 'Otra vez' : ''}
      </p>
    </section>
  )
}

function SpeakerBig () {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 2.2v2.1a7.8 7.8 0 0 1 0 15.4v2.1a9.9 9.9 0 0 0 0-19.6z" />
    </svg>
  )
}
