/**
 * ESL PWA — the homework set builder (Slice 2).
 *
 * Pure. No DOM, no React, no localStorage. `buildNight()` is a function of its
 * arguments and nothing else, which is what makes "point gating.current at any
 * group and every night rebuilds correctly" a thing a test can assert rather
 * than a thing someone has to click through seven times.
 *
 * `nightFor()` at the bottom is the only impure thing here, and all it does is
 * hand buildNight the real registry, the real config and the real progress.
 *
 * THE RULES THIS FILE EXISTS TO KEEP
 *
 *  1. NOTHING IS SPECIFIC TO A LETTER GROUP. This week's group is
 *     `gating.current`, read as a field. It is never inferred, never parsed out
 *     of an ID, never hardcoded. Cumulative weeks are resolved by the structure
 *     row's DECLARED `number` — number−1 and number−2 — never by taking "G2",
 *     subtracting one and hoping "G1" exists.
 *
 *  2. RATIOS LIVE IN data/homework.json. Changing a night is a data edit.
 *     Nothing below knows that Friday is small or that Wednesday is the weakest
 *     third; it knows how to read a row.
 *
 *  3. DEGRADATION IS SILENT AND NORMAL. On G1 there is no last week. On G2
 *     there is no two-weeks-back. On G7 there are no entries at all. Every one
 *     of those shortens the night and none of them throws, returns an error, or
 *     produces anything the child can read as a fault. A thin pool is a short
 *     night. That is the whole handling.
 */

import registry, { gating, structure, group, item } from './registry.js'
import config from '../../data/homework.json'
import { accuracyOf } from './progress.js'

/* Sunday-first, because that is what Date#getDay() returns. */
export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export const DAY_NAMES_ES = {
  sunday: 'Domingo', monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado'
}

/** The weekday from the device clock. No picker, no server, no timezone maths. */
export function weekdayOf (date = new Date()) {
  return WEEKDAYS[date.getDay()]
}

/**
 * Which curriculum week a date falls in, counted from the Friday it started on.
 *
 * Only ever used as a seed ingredient, so its absolute value means nothing —
 * what matters is that Friday through Thursday share one number, so the whole
 * week's shuffles are drawn from one family, and next week's differ.
 *
 * Day 0 of the Unix epoch was a Thursday, so day 1 was a Friday.
 */
export function weekIndexOf (date = new Date()) {
  const days = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
  return Math.floor((days - 1) / 7)
}

/* ------------------------------------------------------------------ *
 * WHERE THE THIRDS CUT — one function, on purpose.
 *
 * Open question, not settled: this is the count split, cut at n/3 over the
 * declared order. The alternative under discussion is cutting on part
 * boundaries, which for Group 2 gives 10 / 8 / 8 instead of 9 / 8 / 9 and
 * keeps H's sound with the other five instead of orphaning it.
 *
 * Whichever wins, it changes HERE and nowhere else. Nothing downstream knows
 * how a third is measured; it is handed a slice.
 * ------------------------------------------------------------------ */
export function thirdBounds (n) {
  return [0, Math.round(n / 3), Math.round((2 * n) / 3), n]
}

export function thirdsOf (items) {
  const b = thirdBounds(items.length)
  return [items.slice(b[0], b[1]), items.slice(b[1], b[2]), items.slice(b[2], b[3])]
}

/* ------------------------------------------------------------------ *
 * SEEDED RANDOMNESS
 *
 * Two things have to be true at once and they pull against each other:
 * a night must look the same every time it is opened (a child who backs out
 * and comes back has not been handed a different homework), and two
 * consecutive nights must not shuffle alike. Both fall out of seeding on
 * (group, week, weekday) rather than on Math.random or on the clock.
 * ------------------------------------------------------------------ */
function hash (str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function rng (seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Fisher-Yates against a seeded stream. Never mutates its argument. */
export function shuffle (list, seed) {
  const r = rng(seed)
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The seed for one night. Different weekday, different seed — guaranteed. */
export function seedFor (groupId, weekIndex, weekday) {
  return hash(`${groupId}|${weekIndex}|${weekday}`)
}

/* ------------------------------------------------------------------ *
 * THE NEW POOL — this week's group, sliced by the night's rule.
 * ------------------------------------------------------------------ */
function newPool (items, rule, { accuracy, seed }) {
  const parts = thirdsOf(items)
  switch (rule) {
    case 'third-1':       return parts[0]
    case 'thirds-1-2':    return parts[0].concat(parts[1])
    case 'all':           return items.slice()
    case 'weakest-third': return weakestThird(parts, accuracy, seed)
    case 'none':          return []
    // An unknown rule is a typo in data/homework.json. It degrades to an empty
    // pool rather than throwing at a child; scripts/test-homework.mjs fails the
    // build's test run on it, which is where a typo should be caught.
    default:              return []
  }
}

/**
 * The third the class is worst at, by pass 1 accuracy.
 *
 * WITH NO HISTORY AT ALL, A RANDOM THIRD. That is the week-one path and it is
 * not a fallback in the apologetic sense — the first Wednesday a device ever
 * sees has nothing to rank, and it must still produce a night.
 *
 * A third with SOME history is ranked on what it has. A third with none is
 * left out of the ranking rather than treated as accuracy zero: unpractised is
 * not the same as failed, and calling it the weakest would make Wednesday
 * chase whatever the child happened to skip.
 */
function weakestThird (parts, accuracy, seed) {
  const scored = parts.map(part => {
    const known = part.map(it => accuracy(it.id)).filter(v => typeof v === 'number')
    return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null
  })
  if (scored.every(s => s === null)) return parts[Math.floor(rng(seed)() * parts.length)] || []
  let pick = 0, best = Infinity
  scored.forEach((s, i) => { if (s !== null && s < best) { best = s; pick = i } })
  return parts[pick]
}

/* ------------------------------------------------------------------ *
 * THE CUMULATIVE POOL — an earlier week, found by declared number.
 *
 * `lastWeek` is number − 1. `twoWeeksBack` is number − 2. Never "G2" minus one
 * character. A row that does not exist, is not populated, or somehow sits
 * ahead of current contributes nothing, and the night is that much shorter.
 * ------------------------------------------------------------------ */
const STEPS_BACK = { none: 0, lastWeek: 1, twoWeeksBack: 2 }

function cumulativePool (rule, currentRow, rows, groupOf) {
  const back = STEPS_BACK[rule] ?? 0
  if (!back || !currentRow) return []
  const row = rows.find(r => r.number === currentRow.number - back)
  if (!row || !row.populated) return []
  if (row.number >= currentRow.number) return []   // never ahead of the class
  return groupOf(row.id)?.items ?? []
}

/* ------------------------------------------------------------------ *
 * THE NIGHT
 * ------------------------------------------------------------------ */

/**
 * Build one night. Pure — everything it reads is an argument.
 *
 *   weekday    'friday' … 'thursday'
 *   nights     the `nights` block of data/homework.json
 *   current    the group id this week's class is on (gating.current)
 *   rows       the structure rows, each with a declared `number` and `populated`
 *   groupOf    id -> container, or null
 *   accuracy   id -> pass 1 accuracy 0..1, or null when never seen
 *   weekIndex  seed ingredient; see weekIndexOf
 *
 * Returns { mode, weekday, group, groupId, items, target }.
 *
 * HOW `items` IS SIZED. The night's `items` is a TARGET, and the two orders
 * spend it differently:
 *
 *   taught    the new pool ships whole, in declared order, and the cumulative
 *             pool tops it up toward the target. The new pool is never cut
 *             below itself — Friday's first third is nine entries against a
 *             target of eight, and silently dropping H's sound to hit a round
 *             number would drop taught material with nobody noticing.
 *
 *   shuffled  there is no must-cover set, so the target is a draw size: take
 *             the new pool (sampled if it overflows), top up from cumulative,
 *             then shuffle the result.
 *
 * NEW FIRST, CUMULATIVE FILLS THE REMAINDER, and an entry that appears in both
 * pools appears once.
 */
export function buildNight ({ weekday, nights, current, rows, groupOf, accuracy = () => null, weekIndex = 0 }) {
  const night = nights?.[weekday] ?? null
  const row = rows.find(r => r.id === current) ?? null
  const g = row ? groupOf(row.id) : null
  const base = { weekday, mode: night?.mode ?? 'lesson', group: g, groupId: current, target: night?.items ?? 0 }

  // Thursday hands off to Juegos. It carries no items on purpose — the game
  // builds its own set from the decay weights in the config, in another slice.
  if (!night || night.mode === 'game') return { ...base, mode: night?.mode ?? 'lesson', items: [] }

  // An unpopulated or undeclared current group is not an error. G7 and G8 are
  // declared and empty and the class reaches them in about five weeks.
  //
  // THE CUMULATIVE POOL TOPS A NIGHT UP; IT NEVER CONSTITUTES ONE. With no
  // entries for this week, the night is empty — not a full set of last week's
  // material wearing this week's name. A child handed twenty-six Group 6 items
  // under the heading Grupo 7 has done homework nobody assigned, and the only
  // signal that anything is wrong is a video that was never recorded. Silence
  // is the honest degradation here, and TareaScreen has a calm screen for it.
  const mine = g?.items ?? []
  if (mine.length === 0) return { ...base, items: [] }

  const seed = seedFor(current, weekIndex, weekday)

  const fresh = newPool(mine, night.new, { accuracy, seed })
  const older = cumulativePool(night.cumulative, row, rows, groupOf)
  const target = night.items ?? 0

  const seen = new Set()
  const out = []
  const push = it => { if (it && !seen.has(it.id)) { seen.add(it.id); out.push(it) } }

  if (night.order === 'shuffled') {
    const drawn = fresh.length > target ? shuffle(fresh, seed).slice(0, target) : fresh
    drawn.forEach(push)
    if (out.length < target) shuffle(older, seed ^ 0x9e3779b9).slice(0, target - out.length).forEach(push)
    return { ...base, items: shuffle(out, (seed + 0x51ed270b) >>> 0), target }
  }

  fresh.forEach(push)
  for (const it of older) {
    if (out.length >= target) break
    push(it)
  }
  return { ...base, items: out, target }
}

/* ------------------------------------------------------------------ *
 * PASS 1 CHOICES
 *
 * ASK THE DATA, NOT THE SHAPE NAME. An entry gets word pictures when it has
 * words with resolved images — `words.length > 0` — not when its shape happens
 * to be called "sound". 116 of the 153 entries carry two words each and every
 * one of those words resolves to an image the generator has already checked
 * onto disk; the other 37 are letter names and standalone words, which have no
 * pictures and get text.
 *
 * This is the point of the whole screen. With letter choices, G-fuerte and
 * G-suave both answered "G" and the item was unanswerable. With pictures,
 * gorilla stands against giant and the two are different questions.
 *
 * THE CORRECT CARD IS ONE OF THIS ENTRY'S OWN WORDS, and the three distractors
 * never include EITHER of them — so exactly one card on screen is right, and
 * the entry's second word cannot appear to contradict it.
 *
 * Distractors cross part boundaries: a Friday sounds item can show a syllable
 * word the child has not met. Left as-is deliberately — it is a wrong answer,
 * not a question. Flagged; do not "fix" without a ruling.
 */
export function choicesFor (item, { pool, seed = 0, count = 4 } = {}) {
  const others = pool.filter(x => x.id !== item.id)
  const mySeed = (seed ^ hash(item.id)) >>> 0
  const mine = (item.words || []).filter(w => w.imageSrc)

  if (mine.length > 0) {
    const right = shuffle(mine, mySeed)[0]
    const banned = new Set((item.words || []).map(w => w.text))
    const seen = new Set([right.text])
    const distractors = []
    for (const w of shuffle(dedupeWords(others), (mySeed * 3 + 11) >>> 0)) {
      if (banned.has(w.text) || seen.has(w.text)) continue
      seen.add(w.text)
      distractors.push(w)
      if (distractors.length === count - 1) break
    }
    const options = shuffle([right, ...distractors], (mySeed * 7 + 3) >>> 0)
      .map(w => ({ key: w.text, text: w.text, imageSrc: w.imageSrc }))
    return { kind: 'picture', options, correct: right.text }
  }

  // Text choices. Siblings from the same part read as a real question — four
  // letter names against each other — so they are preferred, and the pool
  // widens only when a part cannot supply three.
  const label = item.label
  const seen = new Set([label])
  const picks = []
  const take = list => {
    for (const x of list) {
      if (seen.has(x.label)) continue
      seen.add(x.label)
      picks.push(x.label)
      if (picks.length === count - 1) return true
    }
    return picks.length === count - 1
  }
  take(shuffle(others.filter(x => x.part === item.part), (mySeed * 3 + 11) >>> 0)) ||
    take(shuffle(others.filter(x => x.part !== item.part), (mySeed * 5 + 17) >>> 0))

  const options = shuffle([label, ...picks], (mySeed * 7 + 3) >>> 0)
    .map(t => ({ key: t, text: t }))
  return { kind: 'text', options, correct: label }
}

/** Every word with a resolved image across a list of entries, deduped by text. */
function dedupeWords (items) {
  const seen = new Set()
  const out = []
  for (const it of items) {
    for (const w of it.words || []) {
      if (!w.imageSrc || seen.has(w.text)) continue
      seen.add(w.text)
      out.push(w)
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * THE APP'S ENTRY POINT — the one impure function here.
 * ------------------------------------------------------------------ */

/**
 * Tonight's set, from the device clock and the shipped data.
 *
 * WHICH GROUP. `groupId` is the group the child is actually working in — the
 * one whose lesson they opened. It defaults to `gating.current` for a caller
 * that has no group in hand.
 *
 * This overrides the handoff's §3.2 ("this week's group = gating.current,
 * never inferred"). That rule made sense when the class had one open group:
 * tonight's homework was tonight's homework wherever you tapped. With all six
 * groups open it stopped making sense — opening Group 1's lesson handed the
 * child Group 6's homework, in letters they had not been taught that week.
 * Ruled 2026-09-08: the homework belongs to the lesson it hangs off.
 *
 * The cumulative pools still resolve by DECLARED number relative to the group
 * being played, so Group 1 has no last week and Group 3 reaches back to
 * Group 1 — the waterfall works from wherever the child stands in it.
 */
export function nightFor (date = new Date(), groupId = gating.current) {
  return buildNight({
    weekday: weekdayOf(date),
    nights: config.nights,
    current: groupId || gating.current,
    rows: structure(),
    groupOf: group,
    accuracy: accuracyOf,
    weekIndex: weekIndexOf(date)
  })
}

/**
 * The entries pass 1 may draw distractors from.
 *
 * Everything up to AND INCLUDING the group being played, and nothing beyond
 * it. A Group 1 night must not show `xylophone` as a wrong answer: the child
 * has never met the letter, the picture teaches them nothing, and it makes the
 * app look like it has lost track of where they are.
 *
 * Reaching BACK is fine and deliberate — a Group 3 night drawing a Group 1
 * word is a wrong answer about something already taught, which is the kind of
 * wrong answer worth having.
 *
 * Distractors still cross PART boundaries inside those groups: a Friday sounds
 * item can show a syllable word from later in the same group. Left as-is
 * deliberately — flagged, not a bug.
 */
export function distractorPool (groupId = gating.current) {
  const rows = structure()
  const here = rows.find(r => r.id === groupId) ?? rows.find(r => r.id === gating.current)
  if (!here) return []
  return rows
    .filter(r => r.populated && r.number <= here.number)
    .flatMap(r => registry.groups[r.id]?.items ?? [])
}

/**
 * Entries for a list of ids, in the order given, dropping any the registry
 * does not know. Used to restore an interrupted night from what was saved
 * rather than rebuilding it: `weakest-third` reads progress, and progress
 * moves as the child answers, so a rebuild half way through a night could
 * hand back a different set.
 */
export function itemsByIds (ids) {
  return (ids || []).map(id => item(id)).filter(Boolean)
}

export { config as homeworkConfig }
