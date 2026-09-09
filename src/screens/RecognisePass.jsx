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
 * A WRONG ANSWER DOES NOT END THE ROUND AND DOES NOT ADVANCE. The card greys
 * out and stays out, the verdict says "otra vez", and the same item is still
 * there with one fewer thing to try. A child leaves every item having got it
 * right; what the teacher needs to know about the ones that took three goes is
 * in progress, not on the screen.
 *
 * TAPPING A CARD PLAYS THE CARD. Whatever the child picks is spoken back to
 * them — the word on the picture, or the letter on the text choice — before
 * the verdict settles. Pick `goat` when the sound was /g/ and you hear "goat",
 * which is how the picture and the word become one thing. It is worth more on
 * a wrong answer than on a right one, so it happens on both.
 *
 * Choices are word pictures wherever the entry has words — ruled 2026-09-06 for
 * all six groups — and text otherwise. Which is which is decided by asking the
 * data (does this entry have words?), never by the shape's name. The build is
 * what guarantees every one of those words has an image on disk; see V14.
 */
export default function RecognisePass ({ items, pool, seed, startAt = 0, onAdvance = () => {}, onDone, onBack }) {
  const [at, setAt] = useState(Math.min(startAt, Math.max(0, items.length - 1)))
  const [playing, setPlaying] = useState(false)
  const [verdict, setVerdict] = useState(null)   // null | 'ok' | 'no'
  const [chosen, setChosen] = useState(null)     // the key of the card just tapped
  const [spent, setSpent] = useState([])         // keys already tried and wrong, this item
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
    setVerdict(null); setChosen(null); setSpent([]); setSettled(false)
    const t = setTimeout(say, 280)
    timers.current.push(t)
    return () => { clearTimeout(t); stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, item?.id])

  useEffect(() => () => { timers.current.forEach(clearTimeout); stop() }, [])

  const pick = opt => {
    if (settled || !choices || spent.includes(opt.key)) return
    const right = opt.key === choices.correct
    const first = !tried.current.has(item.id)
    tried.current.add(item.id)
    recordAnswer(item.id, right, first)

    setChosen(opt.key)
    if (right) setSettled(true)          // lock immediately; the clip takes a moment
    setVerdict(right ? 'ok' : 'no')

    // Say what they picked, then move on. `play` never rejects — a missing clip
    // resolves false — so the round advances whether or not audio worked.
    const say = opt.audio ? play(opt.audio.id, opt.audio.role) : Promise.resolve(false)
    say.then(() => {
      if (!right) {
        // Greyed out and out of play. The child tries again with one fewer
        // wrong card in front of them; nothing tells them WHICH one was right.
        setSpent(prev => (prev.includes(opt.key) ? prev : [...prev, opt.key]))
        setChosen(null)
        return
      }
      const t = setTimeout(() => {
        if (at < items.length - 1) { const next = at + 1; onAdvance(next); setAt(next) }
        else onDone()
      }, 320)
      timers.current.push(t)
    })
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
              (spent.includes(opt.key) ? ' spent' : '') +
              (chosen === opt.key ? (opt.key === choices.correct ? ' right' : ' wrong') : '')
            }
            aria-disabled={spent.includes(opt.key) ? 'true' : undefined}
            onClick={() => pick(opt)}
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
