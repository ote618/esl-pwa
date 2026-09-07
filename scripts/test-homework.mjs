#!/usr/bin/env node
/**
 * Tests for the Slice 2 set builder — src/lib/homework.js.
 *
 * The acceptance test for this slice is "nothing is specific to a letter
 * group": point gating.current at any populated group and every night rebuilds
 * correctly, with no code change. That is not something you can prove by
 * clicking, so it is proved here — every night, of every group, every run.
 *
 * homework.js imports JSON the way the app does, which Node will not resolve
 * without an import attribute, so the module is bundled with esbuild (already a
 * vite dependency) and imported from the bundle. That means these tests run
 * against the REAL registry and the REAL data/homework.json, not a fixture.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eslhw-'))
const bundle = path.join(tmp, 'homework.mjs')
execFileSync(path.join(ROOT, 'node_modules/.bin/esbuild'), [
  path.join(ROOT, 'src/lib/homework.js'),
  '--bundle', '--format=esm', '--platform=neutral', '--log-level=warning',
  '--outfile=' + bundle
])
const HW = await import('file://' + bundle)

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'out/esl_unit_registry.json'), 'utf8'))
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/homework.json'), 'utf8'))
const gatingFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/gating.json'), 'utf8'))
const rows = registry.structure
const groupOf = id => registry.groups[id] ?? null
const NIGHTS = ['friday', 'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday']

let pass = 0, failed = 0
const ok = (name, cond, detail = '') => {
  if (cond) { console.log('  ok    ' + name); pass++ }
  else { console.log('  FAIL  ' + name + (detail ? '\n          ' + detail : '')); failed++ }
}
const build = (current, weekday, extra = {}) => HW.buildNight({
  weekday, nights: config.nights, current, rows, groupOf, weekIndex: 2900, ...extra
})

const POPULATED = rows.filter(r => r.populated).map(r => r.id)
const EMPTY_ROWS = rows.filter(r => !r.populated).map(r => r.id)

/* ================================================================== *
 * THE CONFIG ITSELF
 * ================================================================== */
console.log('--- CONFIG: is data/homework.json sane? ---\n')

const NEW_RULES = ['third-1', 'thirds-1-2', 'all', 'weakest-third', 'none']
const CUM_RULES = ['none', 'lastWeek', 'twoWeeksBack']
const ORDERS = ['taught', 'shuffled']

ok('all seven nights are declared',
  NIGHTS.every(d => config.nights[d]), NIGHTS.filter(d => !config.nights[d]).join(', '))

for (const day of NIGHTS) {
  const n = config.nights[day] || {}
  if (n.mode === 'game') {
    ok(`${day}: game mode carries a target and decay weights`,
      typeof n.items === 'number' && n.decay && typeof n.decay.thisWeek === 'number')
    continue
  }
  ok(`${day}: new/cumulative/order/items are all recognised values`,
    NEW_RULES.includes(n.new) && CUM_RULES.includes(n.cumulative) &&
    ORDERS.includes(n.order) && Number.isInteger(n.items) && n.items > 0,
    JSON.stringify(n))
}

ok('gating.current in data/gating.json names a declared row',
  rows.some(r => r.id === gatingFile.current), gatingFile.current)

/* ================================================================== *
 * THE CUT
 * ================================================================== */
console.log('\n--- THIRDS: the cut lives in one function ---\n')

for (const n of [0, 1, 2, 3, 24, 25, 26, 28]) {
  const b = HW.thirdBounds(n)
  const parts = HW.thirdsOf(Array.from({ length: n }, (_, i) => i))
  ok(`n=${n}: the three thirds partition the list exactly (${parts.map(p => p.length).join('/')})`,
    b[0] === 0 && b[3] === n && b[0] <= b[1] && b[1] <= b[2] && b[2] <= b[3] &&
    parts.reduce((a, p) => a + p.length, 0) === n &&
    parts.flat().join(',') === Array.from({ length: n }, (_, i) => i).join(','))
}

/* ================================================================== *
 * EVERY GROUP, EVERY NIGHT — the acceptance test
 * ================================================================== */
console.log('\n--- EVERY GROUP × EVERY NIGHT: no code change, no crash ---\n')

for (const id of POPULATED) {
  const seen = []
  let bad = ''
  for (const day of NIGHTS) {
    let night
    try { night = build(id, day) } catch (e) { bad = `${day} threw: ${e.message}`; break }
    const ids = night.items.map(i => i.id)
    if (new Set(ids).size !== ids.length) { bad = `${day} repeated an entry`; break }
    const known = new Set(Object.values(registry.groups).flatMap(g => g.items.map(i => i.id)))
    if (!ids.every(i => known.has(i))) { bad = `${day} invented an entry id`; break }
    if (night.groupId !== id) { bad = `${day} built for ${night.groupId}, not ${id}`; break }
    seen.push(`${day.slice(0, 3)}:${night.mode === 'game' ? 'juego' : ids.length}`)
  }
  ok(`${id} produces a valid seven-night week — ${seen.join(' ')}`, !bad, bad)
}

for (const id of EMPTY_ROWS) {
  let bad = ''
  for (const day of NIGHTS) {
    try {
      const night = build(id, day)
      if (night.items.length !== 0) { bad = `${day} produced ${night.items.length} items from an empty group`; break }
    } catch (e) { bad = `${day} threw: ${e.message}`; break }
  }
  ok(`${id} is declared and empty — it degrades, it does not crash`, !bad, bad)
}

ok('an undeclared group id degrades rather than throwing',
  (() => { try { return build('G99', 'friday').items.length === 0 } catch { return false } })())

/* ================================================================== *
 * THE NIGHTS THEMSELVES, ON THE GROUP THE CLASS IS ACTUALLY ON
 * ================================================================== */
console.log(`\n--- THE WEEK ON ${gatingFile.current} (the group the class is on) ---\n`)

const CUR = gatingFile.current
const curRow = rows.find(r => r.id === CUR)
const curItems = groupOf(CUR)?.items ?? []
const prevRow = rows.find(r => r.number === curRow.number - 1)
const prevItems = prevRow?.populated ? groupOf(prevRow.id).items : []
const [t1, t2, t3] = HW.thirdsOf(curItems)

const fri = build(CUR, 'friday')
ok(`friday is the first third in declared order (${fri.items.length} items, target ${fri.target})`,
  fri.items.map(i => i.id).join(',') === t1.map(i => i.id).join(','))
ok('friday draws nothing cumulative',
  fri.items.every(i => i.group === CUR))

const sat = build(CUR, 'saturday')
ok(`saturday is thirds 1-2 then last week to target (${sat.items.length} items)`,
  sat.items.slice(0, t1.length + t2.length).map(i => i.id).join(',') === t1.concat(t2).map(i => i.id).join(',') &&
  sat.items.length === Math.min(config.nights.saturday.items, t1.length + t2.length + prevItems.length))
ok('saturday\'s top-up comes from last week and nowhere else',
  sat.items.slice(t1.length + t2.length).every(i => i.group === prevRow?.id))

const sun = build(CUR, 'sunday')
ok(`sunday is the whole group first, then last week to target (${sun.items.length} items)`,
  sun.items.slice(0, curItems.length).map(i => i.id).join(',') === curItems.map(i => i.id).join(',') &&
  sun.items.length === Math.min(config.nights.sunday.items, curItems.length + prevItems.length))

const mon = build(CUR, 'monday')
const tue = build(CUR, 'tuesday')
ok(`monday draws its target (${mon.items.length} of ${config.nights.monday.items})`,
  mon.items.length === Math.min(config.nights.monday.items, curItems.length + prevItems.length))
ok('monday and tuesday do not shuffle alike — consecutive nights differ',
  mon.items.map(i => i.id).join(',') !== tue.items.map(i => i.id).join(','))
ok('monday is not in declared order (it is shuffled)',
  mon.items.map(i => i.id).join(',') !== curItems.slice(0, mon.items.length).map(i => i.id).join(','))

const wed = build(CUR, 'wednesday')
const hasTwoBack = rows.find(r => r.number === curRow.number - 2)?.populated
ok(`wednesday runs ${wed.items.length} items` +
   (hasTwoBack ? ' with two-weeks-back available' : ' — short, because there is no two-weeks-back yet'),
  hasTwoBack
    ? wed.items.length === config.nights.wednesday.items
    : wed.items.length === t3.length || wed.items.length === t1.length || wed.items.length === t2.length)
ok('wednesday with no history still produces a night (the week-one path)',
  wed.items.length > 0)

const thu = build(CUR, 'thursday')
ok('thursday is game mode and carries no items — it hands off to Juegos',
  thu.mode === 'game' && thu.items.length === 0)

/* Wednesday on a group that DOES have two-weeks-back must top up. */
const withTwo = rows.find(r => r.populated && r.number >= 3 && rows.find(x => x.number === r.number - 2)?.populated)
if (withTwo) {
  const w = build(withTwo.id, 'wednesday')
  const twoBack = rows.find(x => x.number === withTwo.number - 2)
  ok(`wednesday on ${withTwo.id} tops up from ${twoBack.id} to ${w.items.length} items`,
    w.items.length === config.nights.wednesday.items &&
    w.items.some(i => i.group === twoBack.id))
  ok(`wednesday on ${withTwo.id} never draws from last week (only two weeks back)`,
    w.items.every(i => i.group === withTwo.id || i.group === twoBack.id))
}

/* G1 has no last week at all. Every night must simply be shorter. */
ok('G1 has no last week — saturday is the two thirds and nothing else',
  (() => {
    const g1 = build('G1', 'saturday')
    return g1.items.every(i => i.group === 'G1')
  })())

/* ================================================================== *
 * DETERMINISM
 * ================================================================== */
console.log('\n--- DETERMINISM: the same night twice is the same night ---\n')

for (const day of ['friday', 'monday', 'wednesday']) {
  ok(`${day} built twice is identical`,
    build(CUR, day).items.map(i => i.id).join(',') === build(CUR, day).items.map(i => i.id).join(','))
}
ok('a different week reshuffles monday',
  build(CUR, 'monday').items.map(i => i.id).join(',') !==
  build(CUR, 'monday', { weekIndex: 2901 }).items.map(i => i.id).join(','))
ok('a different group reshuffles monday',
  POPULATED.length < 2 ||
  build(POPULATED[0], 'monday').items.map(i => i.id).join(',') !==
  build(POPULATED[1], 'monday').items.map(i => i.id).join(','))

/* ================================================================== *
 * WEAKEST THIRD
 * ================================================================== */
console.log('\n--- WEAKEST THIRD: progress steers it, silently ---\n')

const weakIs = n => {
  // Everything perfect except third n, which is answered wrong every time.
  const target = HW.thirdsOf(curItems)[n]
  const ids = new Set(target.map(i => i.id))
  return build(CUR, 'wednesday', { accuracy: id => (ids.has(id) ? 0.1 : 0.95) })
}
for (const n of [0, 1, 2]) {
  const night = weakIs(n)
  const want = new Set(HW.thirdsOf(curItems)[n].map(i => i.id))
  ok(`third ${n + 1} being weakest makes wednesday the third-${n + 1} night`,
    night.items.filter(i => i.group === CUR).every(i => want.has(i.id)) &&
    night.items.filter(i => i.group === CUR).length === want.size)
}
ok('a third with no history is unranked, not treated as zero',
  (() => {
    const first = HW.thirdsOf(curItems)[0]
    const ids = new Set(first.map(i => i.id))
    // Third 1 unseen, third 2 poor, third 3 good -> third 2 is the weakest KNOWN.
    const second = new Set(HW.thirdsOf(curItems)[1].map(i => i.id))
    const night = build(CUR, 'wednesday', {
      accuracy: id => (ids.has(id) ? null : second.has(id) ? 0.2 : 0.9)
    })
    return night.items.filter(i => i.group === CUR).every(i => second.has(i.id))
  })())

/* ================================================================== *
 * PASS 1 CHOICES
 * ================================================================== */
console.log('\n--- PASS 1: word pictures wherever the entry has words ---\n')

const pool = Object.values(registry.groups).flatMap(g => g.items)
const withWords = pool.filter(i => (i.words || []).length > 0)
const withoutWords = pool.filter(i => (i.words || []).length === 0)

ok(`${withWords.length} of ${pool.length} entries carry words (the picture questions)`,
  withWords.length > 0 && withoutWords.length > 0)
ok('every word on every entry already resolves to an image',
  withWords.every(i => i.words.every(w => typeof w.imageSrc === 'string' && w.imageSrc)),
  withWords.filter(i => i.words.some(w => !w.imageSrc)).map(i => i.id).join(', '))

let picBad = ''
for (const item of withWords) {
  const c = HW.choicesFor(item, { pool, seed: 12345 })
  const mine = new Set(item.words.map(w => w.text))
  if (c.kind !== 'picture') { picBad = `${item.id} got ${c.kind} choices`; break }
  if (c.options.length !== 4) { picBad = `${item.id} got ${c.options.length} choices`; break }
  if (!c.options.every(o => o.imageSrc)) { picBad = `${item.id} has a choice with no image`; break }
  if (!mine.has(c.correct)) { picBad = `${item.id}: correct "${c.correct}" is not one of its own words`; break }
  if (!c.options.some(o => o.key === c.correct)) { picBad = `${item.id}: the correct card is not on screen`; break }
  const wrong = c.options.filter(o => o.key !== c.correct)
  if (wrong.some(o => mine.has(o.key))) {
    picBad = `${item.id}: a distractor is one of this entry's own words (${wrong.filter(o => mine.has(o.key)).map(o => o.key)})`
    break
  }
  if (new Set(c.options.map(o => o.key)).size !== 4) { picBad = `${item.id} shows the same word twice`; break }
}
ok(`all ${withWords.length} word-bearing entries make a valid four-picture question`, !picBad, picBad)

let txtBad = ''
for (const item of withoutWords) {
  const c = HW.choicesFor(item, { pool, seed: 12345 })
  if (c.kind !== 'text') { txtBad = `${item.id} got ${c.kind} choices`; break }
  if (c.options.length !== 4) { txtBad = `${item.id} got ${c.options.length} choices`; break }
  if (c.correct !== item.label) { txtBad = `${item.id}: correct is "${c.correct}", label is "${item.label}"`; break }
  if (!c.options.some(o => o.key === c.correct)) { txtBad = `${item.id}: the answer is not among the choices`; break }
  if (new Set(c.options.map(o => o.key)).size !== 4) { txtBad = `${item.id} shows the same label twice`; break }
}
ok(`all ${withoutWords.length} entries without words make a valid four-text question`, !txtBad, txtBad)

/* The whole point of the ruling: two sounds of the same letter must not
 * produce the same question. */
const gSounds = pool.filter(i => i.shape === 'sound' && i.letter === 'G')
if (gSounds.length >= 2) {
  const [a, b] = gSounds.map(i => HW.choicesFor(i, { pool, seed: 12345 }))
  ok('the two G sounds ask different questions (the reason pictures were ruled in)',
    a.correct !== b.correct && a.options.map(o => o.key).join(',') !== b.options.map(o => o.key).join(','),
    `${a.correct} vs ${b.correct}`)
}

ok('choices are stable for the same item and seed',
  JSON.stringify(HW.choicesFor(withWords[0], { pool, seed: 7 })) ===
  JSON.stringify(HW.choicesFor(withWords[0], { pool, seed: 7 })))

/* A pool with almost nothing in it must still answer, just with fewer cards. */
ok('a starved pool yields fewer choices rather than throwing',
  (() => {
    try {
      const c = HW.choicesFor(withWords[0], { pool: [withWords[0]], seed: 1 })
      return c.options.length >= 1 && c.options.some(o => o.key === c.correct)
    } catch { return false }
  })())

/* ================================================================== *
 * F-15 — THE PASS 2 GUARANTEE, CHECKED IN THE SOURCE
 *
 * "The app does not capture, check, store, mark or display anything the child
 * writes." That is a promise about code that does not exist, and the only way
 * to keep a promise like that from eroding is to fail a test when it does.
 * ================================================================== */
console.log('\n--- F-15: pass 2 shows nothing and stores nothing ---\n')

const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8')
const files = fs.existsSync(path.join(ROOT, 'src/screens/WritePass.jsx'))

if (!files) {
  ok('src/screens/WritePass.jsx exists', false, 'not written yet')
} else {
  const write = src('src/screens/WritePass.jsx')
  const body = write.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  // Anything that could put the answer on screen.
  const leaks = [
    ['item.label', /\.label\b/],
    ['item.words', /\.words\b/],
    ['imageSrc', /imageSrc/],
    ['an <img> tag', /<img\b/],
    ['a text input', /<input\b|<textarea\b|contentEditable/i],
    ['item.letter', /\.letter\b/],
    ['item.spanishGuide', /spanishGuide/]
  ]
  for (const [what, re] of leaks) {
    ok(`WritePass.jsx never references ${what}`, !re.test(body),
      (body.match(re) || []).join(' '))
  }
  ok('WritePass.jsx does not import progress — nothing from pass 2 is recorded',
    !/from\s+['"].*progress(\.js)?['"]/.test(body))
  ok('WritePass.jsx does not touch storage directly',
    !/localStorage|sessionStorage|indexedDB/.test(body))
}

// The strongest form of the F-15 guarantee is structural: WritePass is handed
// ids, so there is nothing in scope for it to leak. Assert the call site.
if (fs.existsSync(path.join(ROOT, 'src/screens/TareaScreen.jsx'))) {
  const t = src('src/screens/TareaScreen.jsx')
  const call = (t.match(/<WritePass[\s\S]*?\/>/) || [''])[0]
  ok('TareaScreen hands WritePass ids, never items',
    /\bids=/.test(call) && !/\bitems=/.test(call), call.replace(/\s+/g, ' '))
}

// One writer, and only one.
const srcFiles = []
;(function walk (dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(jsx?|mjs)$/.test(e.name)) srcFiles.push(p)
  }
})(path.join(ROOT, 'src'))

// Comments are stripped first: homework.js's header promises it touches no
// localStorage, and that promise must not read as a violation of itself.
const stripComments = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
// Modules allowed storage of their own, and the key each one owns. The rule
// this enforces is that esl_progress_v1 has exactly ONE writer; it is not that
// nothing else may persist anything. Súper Sonidos is a self-contained game
// that arrived with its own key and keeps a child's level progress under it,
// which is no business of the homework's. Anything NOT on this list that
// reaches for localStorage is the thing worth failing over, so the list is
// explicit and short on purpose — adding to it should take an argument.
const OWN_STORAGE = new Map([
  ['src/lib/progress.js', 'esl_progress_v1'],
  ['src/games/super-sonidos/game.js', 'supersonidos_v1']
])
const rel = p => path.relative(ROOT, p).split(path.sep).join('/')
const touchers = srcFiles.filter(p => /localStorage|esl_progress_v1/.test(stripComments(fs.readFileSync(p, 'utf8'))))

const strays = touchers.filter(p => !OWN_STORAGE.has(rel(p)))
ok('only declared modules touch storage',
  strays.length === 0,
  strays.map(rel).join(', '))

// Each declared module keeps to its own key.
for (const [file, key] of OWN_STORAGE) {
  const full = srcFiles.find(p => rel(p) === file)
  if (!full) continue
  const others = [...OWN_STORAGE.values()].filter(k => k !== key)
  const text = stripComments(fs.readFileSync(full, 'utf8'))
  ok(`${file} uses only ${key}`,
    text.includes(key) && !others.some(k => text.includes(k)),
    file)
}

const progressWriters = touchers.filter(p => stripComments(fs.readFileSync(p, 'utf8')).includes('esl_progress_v1'))
ok('esl_progress_v1 is written from exactly one module',
  progressWriters.length === 1 && progressWriters[0].endsWith('lib/progress.js'),
  progressWriters.map(rel).join(', '))

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${pass} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
