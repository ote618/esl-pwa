/**
 * Tiro Libre — set pieces where the goal is the answer.
 *
 * ONE FILE, on purpose: this chat owns src/games/TiroLibre.jsx and nothing
 * else on the games branch. Engine, level plan, progress and styles all live
 * here so no other file has to move for this game to exist.
 *
 * Two taps per kick. Tap 1 picks a lettered zone — that is the phonics.
 * Tap 2 stops the meter in the green — that is the football. Pure functions
 * decide what happened; the component only shows it.
 *
 * Content is never hardcoded. A level names a POOL — a shape filter over the
 * group's registry entries — so Group 2 arrives without touching this file.
 *
 * Every timed step runs on setTimeout, never on an audio `ended` event. A
 * blocked clip must never leave the ball hanging in the air.
 */
import { useEffect, useRef, useState } from 'react'
import { groups } from '../lib/registry.js'
import { play, playSequence, stop, hasClip } from '../lib/audio.js'
import { gameLevels, recordGameLevel } from '../lib/progress.js'
import { Speaker } from '../components/Icons.jsx'

/* ================================================================== *
 * ENGINE — pure functions, no DOM, no audio
 * ================================================================== */

/* Sweep duration per pass of the meter, ms. The player picks one. */
const SWEEP = { slow: 1500, medium: 1100, fast: 800 }

/**
 * Where a stop lands relative to the green band.
 *   p    — meter position, 0..1, band centred at 0.5
 *   band — band width, 0..1
 * Returns { quality, drift }.
 *   centre — middle third of the band: beats a keeper who guessed right
 *   clean  — inside the band: goes where aimed
 *   edge   — outer fifth of the band: still in, drifts one zone that way
 *   scuff  — outside: keeper collects, no zone reached
 */
function judgeStop (p, band) {
  const half = band / 2
  const d = p - 0.5
  if (Math.abs(d) > half) return { quality: 'scuff', drift: 0 }
  if (Math.abs(d) <= half / 3) return { quality: 'centre', drift: 0 }
  if (Math.abs(d) >= half * 0.8) return { quality: 'edge', drift: d < 0 ? -1 : 1 }
  return { quality: 'clean', drift: 0 }
}

/**
 * Where the keeper goes.
 *   mode    — 'still' (stays home), 'random' (ignores the aim), 'half' (50 % reads it)
 *   aim     — the zone the child picked
 *   zones   — zone count (3 or 6)
 *   lenient — true after one save on this prompt: he never lands on the aim again
 *   rng     — 0..1, injected so tests are deterministic
 * A 3-zone goal's home is the centre. In a 6-zone goal (2 rows x 3), the
 * keeper covers a column: he goes to the low zone of that column.
 */
function keeperDive ({ mode, aim, zones, lenient = false, rng = Math.random }) {
  const cols = 3
  const home = zones === 3 ? 1 : 4
  let zone
  if (mode === 'still') zone = home
  else if (mode === 'half' && rng() < 0.5) zone = aim
  else zone = Math.floor(rng() * zones)
  if (lenient && zone === aim) zone = (aim + 1) % cols + (zones === 6 && aim >= cols ? cols : 0)
  return zone
}

/** Slide a zone one column left or right, staying on its row. Never wraps. */
function driftZone (zone, drift, zones) {
  const cols = 3
  const row = Math.floor(zone / cols)
  const col = Math.min(cols - 1, Math.max(0, (zone % cols) + drift))
  return row * cols + col
}

/**
 * The verdict.
 *   'goal'    — right letter, keeper beaten
 *   'blocked' — right letter, keeper got it            costs no ball
 *   'missed'  — right letter, the kick went wide       costs no ball
 *   'wrong'   — wrong letter                           costs a ball
 *
 * A wrong zone is information, not a kick to be beaten: the ball goes into the
 * zone the child CHOSE — never a drifted one — so the letter they are shown is
 * the letter they picked, big, in the net.
 */
function resolveKick ({ aim, answer, stop, keeper, zones }) {
  const { quality, drift } = judgeStop(stop.p, stop.band)

  // THE LETTER DECIDES THE LIFE. THE KICK ONLY DECIDES THE GOAL.
  //
  // This used to be the other way round, and it punished the child for the
  // half of the game that is not the lesson. Three ways a right answer cost a
  // ball: a scuffed meter never even looked at the letter; a keeper who
  // guessed right took one; and — worst — an edge kick that DRIFTED one zone
  // came back as 'wrong', so a child who read the net correctly was told
  // "Esa es la B" about a letter they had not chosen. The phonics is the
  // question. The football is the reward for answering it, not a second
  // question they can fail.
  if (aim !== answer) return { outcome: 'wrong', landed: aim, quality }

  if (quality === 'scuff') return { outcome: 'missed', landed: null, quality }
  const landed = driftZone(aim, drift, zones)
  if (landed !== answer) return { outcome: 'missed', landed, quality }
  if (keeper !== landed) return { outcome: 'goal', landed, quality }
  return { outcome: quality === 'centre' ? 'goal' : 'blocked', landed, quality }
}

/** Points for one kick. Ball bonus is paid at level end. */
function pointsFor (outcome, quality) {
  if (outcome !== 'goal') return 0
  return 100 + (quality === 'centre' ? 50 : 0)
}

/* ================================================================== *
 * LEVEL PLAN — pools, never words
 * ================================================================== */

const GAME_ID = 'tirolibre'

const PLAYERS = [
  // Nicknames and numbers are PROVISIONAL — T rules them (open decision 1).
  { id: 'p19', shirt: 19, nick: 'El Rayo', sweep: 'slow', bandBonus: 0, readBonus: 0, unlockedAt: 0 }
]

/**
 * `zones` is how many letters the net shows, and a level can only be played
 * in a group whose pool can fill it — see canFill(). Nothing here is flagged
 * built or unbuilt any more: the DATA decides where a level exists, which is
 * the same rule the pools already follow.
 *
 * Level 4 asks for 3, not 6. Words are scarce — the six groups carry 3, 1, 3,
 * 2, 0 and 2 of them — so six zones is a net that can never be filled, and
 * even three only works where there are three. It shows up in G1 and G3 and
 * says why everywhere else.
 */
const LEVELS_PER_SET = [
  { n: 1, kind: 'pen', title: 'Los nombres', sub: 'Escucha el nombre. Patea a la letra.', pool: { shape: 'name' }, ask: '¿Qué letra es?', zones: 3, band: 0.56, keeper: 'still', rounds: 5, balls: 3 },
  { n: 2, kind: 'pen', title: 'Los sonidos', sub: 'Escucha el sonido. Patea a la letra.', pool: { shape: 'sound' }, ask: '¿De qué letra es este sonido?', zones: 3, band: 0.50, keeper: 'random', rounds: 5, balls: 3 },
  { n: 3, kind: 'free', title: 'Las sílabas', sub: 'Escucha la sílaba. Patea a la sílaba.', pool: { shape: 'combination' }, ask: '¿Qué sílaba escuchaste?', zones: 6, band: 0.46, keeper: 'random', rounds: 5, balls: 3 },
  { n: 4, kind: 'free', title: 'Las palabras', sub: 'Escucha la palabra. Patea al dibujo.', pool: { kind: 'words' }, ask: '¿Qué palabra escuchaste?', zones: 3, band: 0.44, keeper: 'random', rounds: 5, balls: 3, needs: 'palabras' },
  { n: 5, kind: 'shootout', title: 'Tanda de penales', sub: 'Todo junto. Al mejor de 5.', pool: { shape: '*' }, ask: '¿Cuál escuchaste?', zones: 3, band: 0.42, keeper: 'half', rounds: 3, balls: 5 }
]

const PITCHES = {
  1: { name: 'Cancha del barrio', ground: '#7a5a3a', grass: '#8d6b45' }
}

/** The set for a group: Set N is letter-group N. */
function setFor (group) {
  const n = group.number
  return {
    id: `S${n}`,
    number: n,
    group,
    pitch: PITCHES[n] ?? PITCHES[1],
    levels: LEVELS_PER_SET.map(l => ({ ...l, id: `S${n}-L${l.n}` }))
  }
}

/**
 * What a level can ask about, normalised into UNITS.
 *
 * A unit is one question: a clip to play, a label to put on the net, and
 * sometimes a picture to put there instead. Levels 1, 2, 3 and 5 ask about
 * registry entries. Level 4 asks about the words nested INSIDE them.
 *
 * That distinction is the whole of level 4. `shape: 'word'` is eleven entries
 * in the entire course — at, an, am, egg, if, in, it, on, ox, up, us — and
 * four of the six groups have fewer than three, so a words level built on
 * them cannot exist in most of the course. But every sound and combination
 * entry carries words[] with real English words, each with its own recorded
 * clip and its own image: 225 of them, 34 to 41 per group. The words were
 * always there. They were just not the thing `shape: 'word'` names.
 *
 * Only units with a playable clip — a level that has nothing to say has
 * nothing to ask.
 */
function unitsFor (group, level) {
  if (level.pool.kind === 'words') {
    const out = []
    for (const it of group.items) {
      (it.words || []).forEach((w, i) => {
        const role = 'word' + (i + 1)
        if (hasClip(it.id, role) && w.imageSrc) {
          out.push({ key: `${it.id}:${role}`, id: it.id, role, label: w.text, image: w })
        }
      })
    }
    // The same word can be taught under two letters. One net, one apple.
    const seen = new Set()
    return out.filter(u => seen.has(u.label) ? false : seen.add(u.label))
  }
  const want = level.pool.shape
  return group.items
    .filter(it => (want === '*' || it.shape === want) && hasClip(it.id, 'sound'))
    .map(it => ({ key: it.id, id: it.id, role: 'sound', label: it.label, entry: it }))
}

/**
 * Build one kick: a target entry and what the zones say.
 *
 * Distractors are distinct by LABEL — by what is actually painted on the net.
 * A-corta and A-larga are both "A" there, and a net with two As is a question
 * with two answers; the same goes for two nets reading "ba".
 *
 * This used to dedupe by LETTER, which is the same rule only for as long as a
 * zone shows a letter. On the syllables level a zone shows "ba", and "ba" and
 * "be" are two different answers that happen to share a B — the letter rule
 * threw one of them away and left a six-zone net with three syllables on it.
 * Group 1 has fifteen distinct syllables. It was never short of content.
 */
function makeKick (pool, level, avoidKey = null, rng = Math.random) {
  const candidates = pool.filter(it => it.key !== avoidKey)
  const target = pick(candidates.length ? candidates : pool, rng)
  const others = shuffle(pool.filter(it => it.label !== target.label), rng)
  const distinct = []
  for (const it of others) {
    if (distinct.length >= level.zones - 1) break
    if (!distinct.some(d => d.label === it.label)) distinct.push(it)
  }
  const zones = shuffle([target, ...distinct], rng)
  return { target, zones, answer: zones.indexOf(target) }
}

/**
 * Can this group fill this level's net?
 *
 * A level is not "built" or "unbuilt" — it exists wherever its pool can put a
 * distinct label on every zone, and it does not exist where it cannot. Group 5
 * carries no words at all, so level 4 is not a thing that is coming there; it
 * is a thing that is not there, and the map says so.
 */
function canFill (pool, level) {
  return new Set(pool.map(it => it.label)).size >= level.zones
}

function pick (arr, rng) { return arr[Math.floor(rng() * arr.length)] }
function shuffle (arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/* ================================================================== *
 * PROGRESS — through lib/progress.js, which is the only writer of storage
 *
 * This file used to keep its own jar under its own key. It does not any more:
 * Slice 2 established that exactly one module touches storage, so that "what
 * does the app remember about a child?" has one answer in one place, and a
 * test enforces it. A game is not an exception to that.
 * ================================================================== */

function levelState (id) {
  return gameLevels(GAME_ID)[id] ?? { done: false, best: 0 }
}

function recordWin (id, score) {
  recordGameLevel(GAME_ID, id, score)
}

/**
 * A reviewer is not a player. Someone checking whether level 2 is any good
 * should not have to score five goals first, on a phone, at the difficulty
 * that is itself the thing under review.
 *
 * ?abierto opens every BUILT level. It cannot open an unbuilt one — there is
 * nothing behind those to look at, and a net drawn with fewer letters than it
 * has zones would read as a bug rather than as an unfinished level.
 *
 * Not a cheat a child finds: it lives in the URL, is never linked, and the
 * progress it bypasses is still recorded normally.
 */
const REVIEW = typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('abierto')

/** Level N+1 opens on N. Level 1 is always open. */
function isOpen (set, level) {
  if (level.n === 1 || REVIEW) return true
  const prev = set.levels.find(l => l.n === level.n - 1)
  return prev ? levelState(prev.id).done : false
}

/** What the map says under a level's name, and whether it can be tapped. */
function levelStatus (set, level) {
  const pool = unitsFor(set.group, level)
  if (!canFill(pool, level)) {
    return { open: false, why: `Este grupo no tiene ${level.needs || 'contenido'} todavía` }
  }
  if (!isOpen(set, level)) return { open: false, why: 'Gana el nivel anterior' }
  return { open: true, why: level.sub }
}

/* ================================================================== *
 * SCREENS
 * ================================================================== */

export default function TiroLibre ({ group: groupProp, onBack }) {
  // GamesScreen may not pass a group yet. Default to the first populated one.
  const group = groupProp ?? groups()[0]
  const set = setFor(group)
  useStyles()
  const [level, setLevel] = useState(null)

  if (level) {
    return (
      <Level
        key={level.id}
        set={set}
        level={level}
        player={PLAYERS[0]}
        onExit={() => { stop(); setLevel(null) }}
        onNext={() => {
          stop()
          // Walk forward past any level this group has no content for, so a
          // group with no words goes 3 -> 5 instead of into a dead end.
          const nxt = set.levels.find(l =>
            l.n > level.n && canFill(unitsFor(set.group, l), l)
          )
          setLevel(nxt ?? null)
        }}
      />
    )
  }

  return (
    <section className="screen active tl" id="screen-tirolibre">
      <div className="topbar">
        {onBack && <button className="back" onClick={onBack}>← Volver</button>}
        <span className="chip">Grupo {group.number} · {group.letters.join(' ')}</span>
      </div>
      <div className="pagehead">
        <p className="eyebrow">Tiro libre</p>
        <h1 className="lede">{set.pitch.name}</h1>
      </div>

      <ol className="tl-map">
        {set.levels.map(l => {
          const st = levelState(l.id)
          const { open, why } = levelStatus(set, l)
          return (
            <li key={l.id}>
              <button
                className={'tl-lv' + (open ? '' : ' off') + (st.done ? ' done' : '')}
                aria-disabled={open ? undefined : 'true'}
                onClick={open ? () => setLevel(l) : undefined}
              >
                <span className="tl-lvn">{l.n}</span>
                <span className="tl-lvt">
                  <b>{l.title}</b>
                  <small>{why}</small>
                </span>
                {st.done && <span className="tl-lvs">{st.best}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------------ */

const T = { runup: 520, flight: 620, result: 1500, resultWrong: 2100 }

function Level ({ set, level, player, onExit, onNext }) {
  const pool = unitsFor(set.group, level)
  const band = Math.min(0.9, level.band + player.bandBonus)

  // phase: aim | meter | flight | result | won | lost
  const [phase, setPhase] = useState('aim')
  const [kick, setKick] = useState(() => makeKick(pool, level))
  const [aim, setAim] = useState(null)
  const [goals, setGoals] = useState(0)
  const [balls, setBalls] = useState(level.balls)
  const [score, setScore] = useState(0)
  const [verdict, setVerdict] = useState(null) // { outcome, landed, quality, keeper }
  const [savedOnce, setSavedOnce] = useState(false)
  const timers = useRef([])

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // The prompt plays as the kick opens. A tap opened this level, so the
  // element is unlocked; if it is not, the speaker button is right there.
  useEffect(() => {
    if (phase === 'aim') play(kick.target.id, kick.target.role)
  }, [kick, phase])

  const hear = () => play(kick.target.id, kick.target.role)

  const chooseZone = i => {
    if (phase !== 'aim' && phase !== 'meter') return
    setAim(i)
    // Choosing is SILENT. The playback of what they picked belongs after the
    // kick, not on the tap — a net that speaks as it is touched can be
    // auditioned option by option until the right one gives itself away.
    if (phase === 'aim') { stop(); setPhase('meter') }
  }

  const strike = p => {
    if (phase !== 'meter' || aim === null) return
    const keeper = keeperDive({ mode: level.keeper, aim, zones: level.zones, lenient: savedOnce })
    const v = resolveKick({ aim, answer: kick.answer, stop: { p, band }, keeper, zones: level.zones })
    setVerdict({ ...v, keeper })
    setPhase('flight')

    later(() => {
      setPhase('result')
      const pts = pointsFor(v.outcome, v.quality)
      // Now the ball has been struck, say what they picked. After the kick,
      // never before it: this is a read-back of the answer they committed to,
      // not a preview they could have shopped around for.
      const chosen = kick.zones[aim]
      if (v.outcome === 'goal') {
        setScore(s => s + pts)
        // The English voice says what was scored. An entry says its sound and
        // then a word, if it has one; a word unit is already the word, and
        // saying it twice is not a reward.
        const t = kick.target
        const steps = t.image
          ? [{ id: t.id, role: t.role }]
          : [{ id: t.id, role: 'sound' }, ...(hasClip(t.id, 'word1') ? [{ id: t.id, role: 'word1' }] : [])]
        playSequence(steps)
      } else {
        // Not a goal: play the chosen option on its own. On a wrong answer
        // that is the child hearing the letter they actually picked, while
        // the net greys it out — the same fact told twice, once per sense.
        play(chosen.id, chosen.role)
      }
      later(() => advance(v), v.outcome === 'wrong' ? T.resultWrong : T.result)
    }, T.runup + T.flight)
  }

  const advance = v => {
    setVerdict(null)
    setAim(null)
    if (v.outcome === 'goal') {
      const g = goals + 1
      setGoals(g)
      setSavedOnce(false)
      if (g >= level.rounds) {
        const total = score + pointsFor(v.outcome, v.quality) + balls * 200
        recordWin(level.id, total)
        setScore(total)
        setPhase('won')
        return
      }
      setKick(makeKick(pool, level, kick.target.key))
      setPhase('aim')
      return
    }
    // Missed or blocked: the letter was RIGHT, so the ball is not taken. Same
    // prompt again — a good letter with a bad kick is not a reason to move on,
    // and it is not a reason to be punished either. Only a wrong letter costs.
    if (v.outcome !== 'wrong') {
      if (v.outcome === 'blocked') setSavedOnce(true)
      setPhase('aim')
      return
    }
    const b = balls - 1
    setBalls(b)
    if (b <= 0) { setPhase('lost'); return }
    setPhase('aim')
  }

  const restart = () => {
    stop()
    setGoals(0); setBalls(level.balls); setScore(0); setSavedOnce(false)
    setVerdict(null); setAim(null)
    setKick(makeKick(pool, level))
    setPhase('aim')
  }

  const wrongLabel = verdict?.outcome === 'wrong' ? kick.zones[verdict.landed].label : null
  // A net of pictures has no big letter to paint in the goal — the word goes
  // under the pitch instead, where Verdict already says it.
  const wrongOnNet = verdict?.outcome === 'wrong' && !kick.zones[verdict.landed]?.image
    ? wrongLabel : null

  return (
    <section className="screen active tl" id="screen-tirolibre-level">
      <div className="topbar">
        <button className="back" onClick={onExit}>← Salir</button>
        <span className="chip">Nivel {level.n} · {level.title}</span>
      </div>

      <div className="tl-hud">
        <span className="tl-balls" aria-label={`${balls} balones`}>
          {Array.from({ length: level.balls }, (_, i) => (
            <i key={i} className={i < balls ? '' : 'gone'} />
          ))}
        </span>
        <span className="tl-goals">
          {Array.from({ length: level.rounds }, (_, i) => (
            <b key={i} className={i < goals ? 'in' : ''} />
          ))}
        </span>
        <span className="tl-score">{score}</span>
      </div>

      <Pitch
        pitch={set.pitch}
        zones={kick.zones}
        zoneCount={level.zones}
        aim={aim}
        phase={phase}
        verdict={verdict}
        wrongLabel={wrongOnNet}
        onZone={chooseZone}
      />

      <div className="tl-under">
        {phase === 'aim' && (
          <div className="tl-say">
            <button className="tl-hear" onClick={hear} aria-label="Escuchar otra vez">
              <Speaker />
            </button>
            <span>{level.ask}</span>
          </div>
        )}
        {phase === 'meter' && <Meter band={band} sweep={SWEEP[player.sweep]} onStop={strike} />}
        {phase === 'flight' && <p className="tl-cue">…</p>}
        {phase === 'result' && <Verdict verdict={verdict} label={wrongLabel} target={kick.target} />}
        {phase === 'won' && (
          <div className="tl-end">
            <b>¡Ganaste!</b>
            <span>{score} puntos · {balls} {balls === 1 ? 'balón' : 'balones'} de sobra</span>
            <div>
              <button className="enter" onClick={onNext}>Siguiente nivel</button>
              <button className="back" onClick={onExit}>Al mapa</button>
            </div>
          </div>
        )}
        {phase === 'lost' && (
          <div className="tl-end">
            <b>Sin balones</b>
            <span>{goals} de {level.rounds} goles</span>
            <div>
              <button className="enter" onClick={restart}>Otra vez</button>
              <button className="back" onClick={onExit}>Al mapa</button>
            </div>
          </div>
        )}
      </div>

      <p className="tl-player">#{player.shirt} {player.nick}</p>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function Verdict ({ verdict, label, target }) {
  if (!verdict) return null
  if (verdict.outcome === 'goal') {
    // The English voice is already saying the word (playSequence, above). Put
    // the picture with it: the reward for a goal is the thing being taught,
    // not just a number. A name entry has no words and simply shows none.
    const word = target.image ?? target.entry?.words?.[0]
    return (
      <div className="tl-won">
        <p className="tl-cue goal">¡GOL!{verdict.quality === 'centre' ? ' +150' : ' +100'}</p>
        {word && (
          <span className="tl-goalword">
            <img src={word.imageSrc} alt="" width={word.imageW} height={word.imageH} />
            <b>{word.text}</b>
          </span>
        )}
      </div>
    )
  }
  if (verdict.outcome === 'wrong') {
    return <p className="tl-cue wrong">Esa es la <b>{label}</b></p>
  }
  // Right letter, no goal. Lead with the letter being right, because that is
  // the part the child is being taught and the part they got. Then say what
  // the ball did, so "why no goal?" has an answer on screen.
  return (
    <p className="tl-cue saved">
      <b>¡Letra correcta!</b>
      <span>
        {verdict.outcome === 'blocked'
          ? 'La atajó el portero. Inténtalo otra vez.'
          : 'El tiro se fue fuera. Inténtalo otra vez.'}
      </span>
    </p>
  )
}

/**
 * One bar, one tap. The needle sweeps left to right and back; the child
 * stops it in the green. The band is drawn to scale so the target is the
 * thing on screen, not a number.
 */
function Meter ({ band, sweep, onStop }) {
  const [p, setP] = useState(0)
  const raf = useRef(0)
  const t0 = useRef(performance.now())
  const pos = useRef(0)

  useEffect(() => {
    const tick = now => {
      const x = ((now - t0.current) % (sweep * 2)) / sweep
      pos.current = x <= 1 ? x : 2 - x
      setP(pos.current)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [sweep])

  const halt = () => { cancelAnimationFrame(raf.current); onStop(pos.current) }

  return (
    <button className="tl-meter" onClick={halt} aria-label="Patear">
      <span className="tl-band" style={{ left: `${(0.5 - band / 2) * 100}%`, width: `${band * 100}%` }}>
        <i style={{ left: `${100 / 3}%`, width: `${100 / 3}%` }} />
      </span>
      <span className="tl-needle" style={{ left: `${p * 100}%` }} />
      <span className="tl-mlabel">¡Patea!</span>
    </button>
  )
}

/* ------------------------------------------------------------------ */

/* Goal-mouth geometry in SVG units. Zones are HTML buttons laid over it. */
const G = { w: 360, h: 300, gx: 40, gy: 40, gw: 280, gh: 130 }
const LINE = 176 // where the keeper's boots sit

function zoneCentre (i, count) {
  const cols = 3
  const rows = count / cols
  const cw = G.gw / cols
  const rh = G.gh / rows
  return {
    x: G.gx + (i % cols) * cw + cw / 2,
    y: G.gy + Math.floor(i / cols) * rh + rh / 2
  }
}

function Pitch ({ pitch, zones, zoneCount, aim, phase, verdict, wrongLabel, onZone }) {
  const spot = { x: G.w / 2, y: 262 }
  const home = zoneCentre(zoneCount === 3 ? 1 : 4, zoneCount)
  const flying = phase === 'flight' || phase === 'result'
  const showResult = phase === 'result'

  // Ball: penalty spot -> the landed zone, or into the keeper's gloves on a scuff.
  // Ball: penalty spot -> the zone it reached. A scuff reaches no zone at all,
  // and it is a MISS, not a save — so it sails wide of the post and over, not
  // into the keeper's gloves. The picture has to agree with the words: a child
  // told "el tiro se fue fuera" must not watch the keeper catch it.
  let ball = spot
  if (flying && verdict) {
    ball = verdict.landed === null
      ? { x: G.gx + G.gw + 26, y: G.gy - 18 }
      : zoneCentre(verdict.landed, zoneCount)
  }
  // Keeper: on his line until the flight, then under his dive zone. His line
  // is inside the goal mouth, so he does share space with the lowest row of
  // zones — the zone tiles sit in front of him and carry a backdrop and a
  // text shadow so a label on his shirt still reads. Six zones halves the row
  // height and made that stop being theoretical.
  const keeperZone = flying && verdict ? zoneCentre(verdict.keeper, zoneCount) : home
  const keeper = { x: keeperZone.x, y: LINE }
  const caught = showResult && verdict?.outcome === 'blocked'

  return (
    // NOT --ground/--grass. A pitch's colours are set on this element, so any
    // name used here shadows the same name on every descendant — and --grass is
    // a Slice 1 design token. Naming them that turned .tl-zone.hit, which is
    // meant to flash the token green when a goal goes in, the colour of the
    // pitch's dirt. Prefixed so a pitch can never repaint a token again.
    <div className="tl-pitch" style={{ '--tl-ground': pitch.ground, '--tl-grass': pitch.grass }}>
      <svg viewBox={`0 0 ${G.w} ${G.h}`} aria-hidden="true">
        <rect width={G.w} height={G.h} fill="var(--pitch)" />
        <rect y="172" width={G.w} height={G.h - 172} fill="var(--tl-ground)" />
        <rect y="172" width={G.w} height="6" fill="var(--tl-grass)" />
        {/* net */}
        <rect x={G.gx} y={G.gy} width={G.gw} height={G.gh} fill="rgba(241,250,238,.06)" />
        <g stroke="rgba(241,250,238,.28)" strokeWidth="1">
          {Array.from({ length: 13 }, (_, i) => <line key={'v' + i} x1={G.gx + i * 23.3} y1={G.gy} x2={G.gx + i * 23.3} y2={G.gy + G.gh} />)}
          {Array.from({ length: 7 }, (_, i) => <line key={'h' + i} x1={G.gx} y1={G.gy + i * 21.6} x2={G.gx + G.gw} y2={G.gy + i * 21.6} />)}
        </g>
        {/* posts */}
        <rect x={G.gx - 6} y={G.gy - 6} width="6" height={G.gh + 8} fill="var(--chalk)" />
        <rect x={G.gx + G.gw} y={G.gy - 6} width="6" height={G.gh + 8} fill="var(--chalk)" />
        <rect x={G.gx - 6} y={G.gy - 6} width={G.gw + 12} height="6" fill="var(--chalk)" />
        {/* six-yard line + spot */}
        <rect x={G.gx - 20} y="178" width={G.gw + 40} height="3" fill="rgba(241,250,238,.5)" />
        <circle cx={spot.x} cy={spot.y} r="4" fill="rgba(241,250,238,.55)" />

        {/* the letter the net says, when it is the wrong one */}
        {showResult && wrongLabel && (
          <text x={ball.x} y={ball.y - 18} textAnchor="middle" className="tl-netletter">{wrongLabel}</text>
        )}

        <Keeper x={keeper.x} y={keeper.y} diving={flying && verdict?.keeper !== (zoneCount === 3 ? 1 : 4)} caught={caught} />

        <g className={'tl-ball' + (flying ? ' fly' : '')} style={{ transform: `translate(${ball.x}px, ${ball.y}px)` }}>
          <circle r="11" fill="var(--chalk)" stroke="var(--navy)" strokeWidth="2" />
          <path d="M-4-6l4 3 4-3M-8 2h5l3 5M8 2h-5l-3 5" fill="none" stroke="var(--navy)" strokeWidth="2" />
        </g>

        {showResult && verdict?.outcome === 'goal' && <Coins x={ball.x} y={ball.y} />}
      </svg>

      <div className={'tl-zones z' + zoneCount} style={{ left: `${G.gx / G.w * 100}%`, top: `${G.gy / G.h * 100}%`, width: `${G.gw / G.w * 100}%`, height: `${G.gh / G.h * 100}%` }}>
        {zones.map((z, i) => (
          <button
            key={z.key}
            className={'tl-zone' + (z.image ? ' pic' : '') + (aim === i ? ' aim' : '') + (showResult && verdict?.landed === i ? (verdict.outcome === 'goal' ? ' hit' : verdict.outcome === 'wrong' ? ' miss' : '') : '')}
            disabled={phase !== 'aim' && phase !== 'meter'}
            onClick={() => onZone(i)}
            aria-label={`Zona ${z.label}`}
          >
            {z.image
              ? <img src={z.image.imageSrc} alt={z.label} width={z.image.imageW} height={z.image.imageH} />
              : z.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* An original keeper: blocky, numbered, nobody's likeness. */
function Keeper ({ x, y, diving, caught }) {
  return (
    <g className={'tl-keeper' + (diving ? ' dive' : '')} style={{ transform: `translate(${x}px, ${y - 8}px)` }}>
      <rect x="-14" y="-40" width="28" height="30" rx="3" fill="#FF6B35" />
      <rect x="-9" y="-56" width="18" height="18" rx="4" fill="#E8B48A" />
      <rect x="-9" y="-58" width="18" height="6" rx="2" fill="#3A2415" />
      <rect x="-26" y="-38" width="12" height="9" rx="3" fill="#FF6B35" />
      <rect x="14" y="-38" width="12" height="9" rx="3" fill="#FF6B35" />
      <rect x="-30" y="-40" width="10" height="10" rx="2" fill="#F1FAEE" />
      <rect x="20" y="-40" width="10" height="10" rx="2" fill="#F1FAEE" />
      <rect x="-13" y="-10" width="11" height="18" rx="2" fill="#14213D" />
      <rect x="2" y="-10" width="11" height="18" rx="2" fill="#14213D" />
      <text y="-19" textAnchor="middle" fontSize="14" fontWeight="800" fill="#F1FAEE" fontFamily="Nunito,sans-serif">1</text>
      {caught && <circle cy="-26" r="11" fill="#F1FAEE" stroke="#14213D" strokeWidth="2" />}
    </g>
  )
}

function Coins ({ x, y }) {
  const n = 8
  return (
    <g className="tl-coins">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="6"
            fill="var(--yellow)"
            stroke="#b39100"
            strokeWidth="1.5"
            style={{ '--dx': `${Math.cos(a) * 60}px`, '--dy': `${Math.sin(a) * 60 - 30}px` }}
          />
        )
      })}
    </g>
  )
}

/* ================================================================== *
 * STYLES — injected once; Slice 1 tokens; every class tl- prefixed
 * ================================================================== */
const CSS = `
/* Tiro Libre — on the Slice 1 tokens from alphabet.css. All classes tl-
 * prefixed so nothing here can restyle the alphabet screens. */

/* ---- map ---- */
.tl-map{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.tl-lv{
  width:100%;display:flex;align-items:center;gap:14px;text-align:left;
  background:var(--chalk);color:var(--navy);border:4px solid var(--navy);border-radius:22px;
  padding:12px 16px;min-height:72px;box-shadow:0 5px 0 var(--shadow);cursor:pointer;
  font-family:'Nunito',sans-serif;transition:transform .07s,box-shadow .07s;
}
.tl-lv:active{transform:translateY(4px);box-shadow:0 1px 0 var(--shadow)}
.tl-lv.off{background:transparent;color:var(--dim);border:2px dashed var(--line);box-shadow:none;cursor:default}
.tl-lv:focus-visible{outline:3px solid var(--chalk);outline-offset:3px}
.tl-lvn{
  flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;
  background:var(--navy);color:var(--chalk);font-family:'Baloo 2',cursive,sans-serif;font-weight:800;font-size:22px;
}
.tl-lv.off .tl-lvn{background:transparent;border:2px dashed var(--line);color:var(--dim)}
.tl-lv.done .tl-lvn{background:var(--yellow);color:var(--navy)}
.tl-lvt{display:flex;flex-direction:column;flex:1;min-width:0}
.tl-lvt b{font-family:'Baloo 2',cursive,sans-serif;font-weight:800;font-size:20px;line-height:1.1}
.tl-lvt small{font-size:12px;font-weight:700;margin-top:2px}
.tl-lvs{font-family:'Baloo 2',cursive,sans-serif;font-weight:800;font-size:18px;color:var(--grass)}

/* ---- hud ---- */
.tl-hud{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;min-height:28px}
.tl-balls{display:flex;gap:6px}
.tl-balls i{width:18px;height:18px;border-radius:50%;background:var(--chalk);border:3px solid var(--navy);display:block}
.tl-balls i.gone{background:transparent;border:2px dashed var(--line);opacity:.7}
.tl-goals{display:flex;gap:5px}
.tl-goals b{width:22px;height:10px;border-radius:5px;background:rgba(241,250,238,.18);display:block}
.tl-goals b.in{background:var(--yellow)}
.tl-score{font-family:'Baloo 2',cursive,sans-serif;font-weight:800;font-size:22px;color:var(--yellow);min-width:44px;text-align:right}

/* ---- pitch ---- */
.tl-pitch{position:relative;width:100%;border-radius:22px;overflow:hidden;border:4px solid var(--navy);
  box-shadow:0 5px 0 var(--shadow);background:var(--pitch)}
.tl-pitch svg{display:block;width:100%;height:auto}
.tl-ball{transition:transform .62s cubic-bezier(.2,.7,.3,1)}
.tl-ball.fly circle{animation:tl-spin .62s linear}
@keyframes tl-spin{to{transform:rotate(1turn)}}
.tl-keeper{transition:transform .38s cubic-bezier(.3,.6,.4,1) .18s}
.tl-keeper.dive{transform-origin:center}
.tl-netletter{font-family:'Baloo 2',cursive,sans-serif;font-weight:800;font-size:56px;fill:#7d8f89;
  paint-order:stroke;stroke:var(--navy);stroke-width:4px}
.tl-coins circle{animation:tl-burst .9s ease-out forwards}
@keyframes tl-burst{
  0%{transform:translate(0,0);opacity:1}
  100%{transform:translate(var(--dx),var(--dy));opacity:0}
}

/* zones: HTML buttons over the goal mouth, so they are real touch targets */
.tl-zones{position:absolute;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:3px}
.tl-zones.z6{grid-template-rows:repeat(2,1fr)}
.tl-zone{
  border:3px solid rgba(241,250,238,.55);border-radius:12px;background:rgba(20,33,61,.35);
  color:var(--chalk);font-family:'Nunito',sans-serif;font-weight:800;font-size:clamp(30px,10vw,44px);
  padding:0;cursor:pointer;min-height:44px;transition:background .12s,border-color .12s,transform .12s;
  /* The keeper stands ON his line, which is inside the goal mouth — he is
   * behind these tiles and a label can land on his shirt. The backdrop and
   * the shadow are what keep it readable when it does. */
  text-shadow:0 2px 6px rgba(20,33,61,.95);
}
/* Six zones halves the cell height and the labels are syllables, not single
 * letters — 44px of type in a 47px box overflows. Size to the net it is in. */
.tl-zones.z6 .tl-zone{font-size:clamp(17px,5.4vw,26px);border-width:2px;border-radius:9px;
  background:rgba(20,33,61,.6)}
/* A picture zone.
 *
 * The image needs an opaque ground to read against the net, but a tile that
 * is opaque edge to edge hides the keeper standing behind it — and watching
 * where he goes is half the game. So the TILE stays see-through and only the
 * picture itself is opaque, sitting in the top of the cell. The keeper shows
 * below it, exactly as he does behind a letter. */
.tl-zone.pic{background:rgba(20,33,61,.22);padding:4px;display:flex;align-items:flex-start;justify-content:center}
.tl-zone.pic img{width:100%;height:64%;object-fit:contain;display:block;
  background:var(--chalk);border:2px solid var(--navy);border-radius:10px;padding:3px}
.tl-zone.pic.aim{background:rgba(255,214,10,.55)}
.tl-zone.pic.aim img{border-color:var(--navy)}
.tl-zone.pic.hit{background:rgba(45,106,79,.75)}
.tl-zone.pic.miss{background:rgba(20,33,61,.55);border-style:dashed;border-color:var(--line)}
.tl-zone.pic.miss img{opacity:.4;filter:grayscale(1)}
.tl-zone:disabled{cursor:default}
.tl-zone.aim{background:var(--yellow);color:var(--navy);border-color:var(--navy);transform:scale(1.04)}
.tl-zone.hit{background:var(--grass);color:var(--chalk);border-color:var(--chalk)}
/* A wrong choice is greyed out, not lit up. Orange read as an alarm; grey
 * reads as "not this one", which is what actually happened. The tile keeps
 * its text transparent so the big letter behind it shows through — that
 * letter is greyed too, see .tl-netletter. */
.tl-zone.miss{background:rgba(20,33,61,.55);border-color:var(--line);border-style:dashed;color:transparent;opacity:.75}
.tl-zone:focus-visible{outline:3px solid var(--chalk);outline-offset:2px}

/* ---- under the pitch ---- */
.tl-under{min-height:92px;display:flex;align-items:center;justify-content:center;margin-top:14px}
.tl-say{display:flex;align-items:center;gap:14px;font-weight:800;font-size:17px}
.tl-hear{
  width:64px;height:64px;border-radius:50%;background:var(--yellow);color:var(--navy);border:none;
  box-shadow:0 4px 0 #b39100;display:grid;place-items:center;cursor:pointer;flex:none;
}
.tl-hear svg{width:32px;height:32px}
.tl-hear:active{transform:translateY(3px);box-shadow:0 1px 0 #b39100}

.tl-meter{
  position:relative;width:100%;height:72px;border-radius:18px;border:4px solid var(--navy);
  background:var(--chalk);overflow:hidden;padding:0;cursor:pointer;box-shadow:0 5px 0 var(--shadow);
}
.tl-band{position:absolute;top:0;bottom:0;background:#52B788}
.tl-band i{position:absolute;top:0;bottom:0;background:#2D6A4F}
.tl-needle{position:absolute;top:0;bottom:0;width:8px;margin-left:-4px;background:var(--navy);border-radius:4px}
.tl-mlabel{position:absolute;inset:0;display:grid;place-items:center;font-family:'Baloo 2',cursive,sans-serif;
  font-weight:800;font-size:24px;color:var(--navy);pointer-events:none;text-shadow:0 0 6px var(--chalk)}

.tl-won{display:flex;flex-direction:column;align-items:center;gap:8px}
.tl-goalword{display:flex;align-items:center;gap:10px;animation:tl-pop .3s cubic-bezier(.2,1.6,.4,1)}
.tl-goalword img{width:56px;height:56px;object-fit:contain;background:var(--chalk);
  border:3px solid var(--navy);border-radius:14px;padding:3px}
.tl-goalword b{font-family:'Baloo 2',cursive,sans-serif;font-weight:800;font-size:26px;color:var(--chalk)}

.tl-cue{margin:0;font-family:'Baloo 2',cursive,sans-serif;font-weight:800;font-size:30px;text-align:center;line-height:1.1}
.tl-cue.goal{color:var(--yellow);animation:tl-pop .3s cubic-bezier(.2,1.6,.4,1)}
.tl-cue.wrong{color:var(--chalk);font-size:24px}
.tl-cue.wrong b{color:#FF6B35;font-size:34px}
.tl-cue.saved{color:var(--chalk);display:flex;flex-direction:column;align-items:center;gap:4px}
.tl-cue.saved b{color:var(--yellow);font-size:26px}
.tl-cue.saved span{font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;color:var(--dim);line-height:1.25}
@keyframes tl-pop{from{transform:scale(.4)}to{transform:scale(1)}}

.tl-end{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.tl-end b{font-family:'Baloo 2',cursive,sans-serif;font-weight:800;font-size:30px;color:var(--yellow)}
.tl-end span{font-weight:800}
.tl-end div{display:flex;gap:10px;margin-top:8px}

.tl-player{margin:18px 0 0;text-align:center;font-size:12px;font-weight:800;color:var(--dim)}

@media (prefers-reduced-motion:reduce){
  .tl-ball,.tl-keeper{transition-duration:.01s}
  .tl-ball.fly circle,.tl-coins circle,.tl-cue.goal{animation:none}
}
`

let styled = false
function useStyles () {
  useEffect(() => {
    if (styled || typeof document === 'undefined') return
    const el = document.createElement('style')
    el.id = 'tirolibre-css'
    el.textContent = CSS
    document.head.appendChild(el)
    styled = true
  }, [])
}
