import { useEffect, useMemo, useState } from 'react'
import { nightFor, distractorPool, itemsByIds, seedFor, weekIndexOf, DAY_NAMES_ES } from '../lib/homework.js'
import { recordNight, saveSession, loadSession, clearSession } from '../lib/progress.js'
import { stop } from '../lib/audio.js'
import RecognisePass from './RecognisePass.jsx'
import WritePass from './WritePass.jsx'
import '../styles/tarea.css'

/**
 * Tarea — tonight's card and the entry point.
 *
 * A child opens this on any night, gets that night's set, and works through it:
 * pass 1 recognises in the app, pass 2 writes on paper. Six lesson nights.
 * Thursday hands off to Juegos and is built elsewhere.
 *
 * WHICH GROUP. The one whose lesson the child opened. Ruled 2026-09-08,
 * replacing the handoff's §3.2: that rule said the group is always
 * `gating.current`, which was right when one group was open and wrong the
 * moment six were — opening Group 1's lesson handed out Group 6's homework,
 * in letters nobody had taught that week. `gating.current` is still the
 * fallback for a caller with no group in hand.
 *
 * The night is built ONCE, on mount. Wednesday's set depends on progress, and
 * progress changes as the child answers — rebuilding mid-night would quietly
 * swap the homework out from under them.
 *
 * AN INTERRUPTED NIGHT RESUMES. A night is twenty-odd items over two passes;
 * before this, putting the phone down lost all of it and the child started
 * again at item one. Where they had got to is saved after every step and
 * offered back on the same day, in the same group. What is saved is a
 * position — never anything the child wrote. See progress.js.
 *
 * NO GREETING, NO NAME, NO STREAK, NO SCORE (F-21). Devices are shared. There
 * is nothing on any of these screens that a second child could pick up and read
 * as their own.
 */
export default function TareaScreen ({ group: playing, onBack }) {
  const today = dateKey()
  const night = useMemo(() => nightFor(new Date(), playing?.id), [playing])
  const pool = useMemo(() => distractorPool(night.groupId), [night])
  const seed = useMemo(() => seedFor(night.groupId, weekIndexOf(), night.weekday), [night])

  // A night already under way, for this group, today. Read once: re-reading it
  // as state changes would fight the state it is seeding.
  const saved = useMemo(
    () => loadSession({ date: today, group: night.groupId }),
    [today, night.groupId]
  )

  // The set is the SAVED one when resuming. Rebuilding it would re-run
  // weakest-third against progress the child has since moved.
  const items = useMemo(() => {
    const restored = saved ? itemsByIds(saved.ids) : []
    return restored.length ? restored : night.items
  }, [saved, night])

  // 'home' | 'p1' | 'bridge' | 'p2' | 'done'
  const [phase, setPhase] = useState('home')
  const [startAt, setStartAt] = useState(saved?.at ?? 0)

  useEffect(() => { stop() }, [phase])

  /* Every step writes the resume point. Cheap, and the alternative is losing a
   * night to a backgrounded tab. */
  const mark = (nextPhase, at = 0) => saveSession({
    date: today, group: night.groupId, weekday: night.weekday,
    ids: items.map(it => it.id), phase: nextPhase, at
  })

  const go = (next, at = 0) => {
    stop()
    setStartAt(at)
    setPhase(next)
    scrollTo(0, 0)
    if (next !== 'done') mark(next, at)
  }

  /* Pick up where they left off — or start clean if there is nothing saved. */
  const begin = () => {
    if (saved && (saved.phase === 'p2' || saved.phase === 'bridge')) return go(saved.phase, saved.phase === 'p2' ? saved.at : 0)
    return go('p1', saved?.phase === 'p1' ? saved.at : 0)
  }

  const finish = () => {
    // Night completion. Pass 1 accuracy was written item by item as it happened;
    // nothing from pass 2 is recorded, here or anywhere. The resume point goes
    // too — a finished night must never be offered back as unfinished.
    recordNight(today)
    clearSession()
    go('done')
  }

  const chip = night.group
    ? `Grupo ${night.group.number} · ${night.group.letters.join(' ')}`
    : 'Tarea'

  if (phase === 'p1') {
    return (
      <RecognisePass
        items={items}
        pool={pool}
        seed={seed}
        startAt={startAt}
        onAdvance={at => mark('p1', at)}
        onDone={() => go('bridge')}
        onBack={() => setPhase('home')}
      />
    )
  }

  // WritePass is handed IDS, not items. It has no labels, no words and no
  // images to render — not by policy, but because they were never passed in.
  // See the F-15 note at the top of WritePass.jsx before changing this line.
  if (phase === 'p2') {
    return (
      <WritePass
        ids={items.map(it => it.id)}
        startAt={startAt}
        onAdvance={at => mark('p2', at)}
        onDone={finish}
      />
    )
  }

  if (phase === 'bridge') {
    return (
      <section className="screen active" id="screen-bridge">
        <div className="topbar"><span /><span className="chip">Parte 1 lista</span></div>
        <div className="center">
          <span className="emblem"><Pencil /></span>
          <p className="big">Ahora tu papel</p>
          <p>Toma tu lápiz. Vas a escuchar los mismos sonidos y escribirlos.</p>
        </div>
        <button className="cta" onClick={() => go('p2', saved?.phase === 'p2' ? saved.at : 0)}>Ya tengo mi papel</button>
      </section>
    )
  }

  if (phase === 'done') {
    return (
      <section className="screen active" id="screen-done">
        <div className="topbar"><span /><span className="chip">{DAY_NAMES_ES[night.weekday]}</span></div>
        <div className="center">
          <span className="emblem"><Check /></span>
          <p className="big">¡Terminaste!</p>
          <p>Hiciste {items.length} {items.length === 1 ? 'ejercicio' : 'ejercicios'}. Entrega tu papel el viernes.</p>
        </div>
        <button className="cta ghost" onClick={onBack}>Volver</button>
      </section>
    )
  }

  /* ---- home ---- */

  // Thursday. The set lives in Juegos and is built by another slice; this
  // screen only says so, and says it as a destination rather than an absence.
  if (night.mode === 'game') {
    return (
      <section className="screen active" id="screen-tarea">
        <div className="topbar">
          <button className="back" onClick={onBack}>← Volver</button>
          <span className="chip">{DAY_NAMES_ES[night.weekday]}</span>
        </div>
        <div className="center">
          <span className="emblem game"><Ball /></span>
          <p className="big">Jueves es juego</p>
          <p>La tarea del jueves vive en <b>Juegos</b>, no aquí.</p>
        </div>
        <button className="cta ghost" onClick={onBack}>Volver</button>
      </section>
    )
  }

  // A group that carries no entries yet — G7 and G8 are declared and empty, and
  // the class reaches G7 in about five weeks. This is the degradation, and it
  // is calm on purpose: nothing here reads as a fault, because nothing is at
  // fault. There is simply no homework tonight.
  if (items.length === 0) {
    return (
      <section className="screen active" id="screen-tarea">
        <div className="topbar">
          <button className="back" onClick={onBack}>← Volver</button>
          <span className="chip">{DAY_NAMES_ES[night.weekday]}</span>
        </div>
        <div className="center">
          <span className="emblem"><Moon /></span>
          <p className="big">Hoy no hay tarea</p>
          <p>Descansa. Mira el video de la semana o juega con las letras.</p>
        </div>
        <button className="cta ghost" onClick={onBack}>Volver</button>
      </section>
    )
  }

  return (
    <section className="screen active" id="screen-tarea">
      <div className="topbar">
        <button className="back" onClick={onBack}>← Volver</button>
        <span className="chip">{chip}</span>
      </div>

      <p className="eyebrow">Tarea</p>

      <div className="nightcard">
        <p className="dayname">{DAY_NAMES_ES[night.weekday]}</p>
        <p className="meta">{items.length} ejercicios · 2 partes</p>
        <ul className="steps">
          <li><span className="n">1</span><span><b>Escucha y elige.</b> En el teléfono.</span></li>
          <li><span className="n two">2</span><span><b>Escucha y escribe.</b> En tu papel.</span></li>
        </ul>
      </div>

      <button className="cta" onClick={begin}>{saved ? 'Continuar' : 'Empezar'}</button>
    </section>
  )
}

/** Local calendar day. Never sent anywhere; it is a key in device-local storage. */
function dateKey (d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function Pencil () {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  )
}

function Check () {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
    </svg>
  )
}

function Ball () {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.2 3.4 2.5-1.3 4H9.9l-1.3-4L12 5.2zM5.2 10.9l2.6 1.9L6.6 17H5.5a8 8 0 0 1-.3-6.1zm3.3 8.4 1-3h5l1 3a8 8 0 0 1-7 0zm10-2.3H17.4l-1.2-4.2 2.6-1.9a8 8 0 0 1-.3 6.1z" />
    </svg>
  )
}

function Moon () {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.3 2a9 9 0 1 0 9.7 11.4A7.4 7.4 0 0 1 12.3 2z" />
    </svg>
  )
}
