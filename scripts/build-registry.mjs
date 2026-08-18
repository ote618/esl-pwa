#!/usr/bin/env node
/**
 * ESL PWA — registry generator
 * Contract: claude/ESL_PWA_Data_Contract.md v2 · ID convention: claude/MEMO_to_Master_ID_Convention.md
 * Story: P0-E2-S8 — 8 letter groups + 5 tail units, IDs preserved, group/part as fields.
 *
 * THREE RULES THIS FILE ENFORCES
 *  1. IDs are opaque. `U2-` and `U3-` are frozen tokens inherited from the stood-down
 *     nine-unit structure. Nothing here parses a prefix to infer a group, part or unit.
 *     Group and part are DECLARED fields, read from data/group1_entries.json.
 *  2. No runtime string matching. Upstream aliases resolve here, at build time.
 *  3. An unresolvable join FAILS the build. It is never skipped.
 *
 * Usage:
 *   node scripts/build-registry.mjs                     production build
 *   node scripts/build-registry.mjs --fixtures          also build the shape fixtures
 *   node scripts/build-registry.mjs --require-manifest  fail if the asset manifest is absent
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const P = {
  entries:  path.join(ROOT, 'data', 'group1_entries.json'),
  cues:     path.join(ROOT, 'data', 'Group1_Cue_Points.csv'),
  fixture:  path.join(ROOT, 'data', 'fixtures', 'unit_fixture_per_item.json'),
  manifest: path.join(ROOT, 'data', 'asset_manifest.json'),
  out:      path.join(ROOT, 'out', 'esl_unit_registry.json'),
  outFix:   path.join(ROOT, 'out', 'fixtures', 'esl_unit_registry.fixture.json')
}

const argv = new Set(process.argv.slice(2))
const WANT_FIXTURES    = argv.has('--fixtures')
const REQUIRE_MANIFEST = argv.has('--require-manifest')

const errors = [], warnings = [], notes = []
const fail = m => errors.push(m)
const warn = m => warnings.push(m)
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'))

/* ------------------------------------------------------------------ *
 * TOP-LEVEL STRUCTURE — the Alphabet Waterfall.
 * Eight letter groups then five tail units. Ratified 2026-08-11; the
 * nine phonetic units are stood down.
 *
 * Only G1 has data. G2–G8 and U9–U13 are declared so the structure is
 * representable and so `gating.current` has somewhere legal to point —
 * their letter membership is NOT invented here.
 * ------------------------------------------------------------------ */
const STRUCTURE = [
  { id: 'G1', number: 1, kind: 'letter-group' },
  { id: 'G2', number: 2, kind: 'letter-group' },
  { id: 'G3', number: 3, kind: 'letter-group' },
  { id: 'G4', number: 4, kind: 'letter-group' },
  { id: 'G5', number: 5, kind: 'letter-group' },
  { id: 'G6', number: 6, kind: 'letter-group' },
  { id: 'G7', number: 7, kind: 'letter-group' },
  { id: 'G8', number: 8, kind: 'letter-group' },
  { id: 'U9',  number: 9,  kind: 'tail-unit' },
  { id: 'U10', number: 10, kind: 'tail-unit' },
  { id: 'U11', number: 11, kind: 'tail-unit' },
  { id: 'U12', number: 12, kind: 'tail-unit' },
  { id: 'U13', number: 13, kind: 'tail-unit' }
]

/* ------------------------------------------------------------------ *
 * ENTRY SHAPES — F-24.
 *
 * There are no spoken anchors in the audio; the anchor phrase belongs to
 * the video. A name entry is ONE beat. A sound or combination entry is
 * THREE — sound, word1, word2.
 *
 * `clip()` returns null for a clip a shape does not have, and null is a
 * normal answer, not an error. Absent cues are OMITTED from the data —
 * not null, not zero.
 * ------------------------------------------------------------------ */
const SHAPES = {
  name:        { beats: 1, cues: [],                 clips: ['name'] },
  word:        { beats: 1, cues: [],                 clips: ['word'] },
  sound:       { beats: 3, cues: ['word1', 'word2'], clips: ['sound', 'word1', 'word2'] },
  combination: { beats: 3, cues: ['word1', 'word2'], clips: ['sound', 'word1', 'word2'] }
}
const ALL_CLIPS = ['name', 'word', 'sound', 'word1', 'word2']

/**
 * The whole playback contract, in one function. Both audio modes.
 * Returns { [clip]: {src, from, to} | null }.
 */
function clipsFor (item, container) {
  const a = container.media.audio
  const src = a.mode === 'per-item-file' ? a.dir + item.id + a.ext : a.src
  const base = item.audio.start          // 0 in per-item mode; narration offset otherwise
  const c = item.audio.cues
  const at = k => base + c[k]
  const win = (from, to) => ({ src, from: +from.toFixed(3), to: +to.toFixed(3) })
  const first = base + c.start
  const last = base + item.audio.end

  const out = Object.fromEntries(ALL_CLIPS.map(k => [k, null]))
  switch (item.shape) {
    case 'name': out.name = win(first, last); break
    case 'word': out.word = win(first, last); break
    default:
      out.sound = win(first, at('word1'))
      out.word1 = win(at('word1'), at('word2'))
      out.word2 = win(at('word2'), last)
  }
  return out
}

const imageId = w => w.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const TAKE_SUFFIX = /_take\d+$/   // "superseded takes are <ID>_takeN; the bare ID is always live"

/* ------------------------------------------------------------------ *
 * CUE POINTS — data/Group1_Cue_Points.csv
 *
 * NOTE ON THE `anchor` COLUMN: it is a start-of-speech offset (0.08–0.20 s),
 * not an anchor phrase — there are no spoken anchors in these files. It is
 * emitted as `cues.start` so no surface mistakes it for a playable anchor.
 * ------------------------------------------------------------------ */
function readCues () {
  const lines = fs.readFileSync(P.cues, 'utf8').trim().split(/\r?\n/)
  const head = lines[0].split(',').map(s => s.trim())
  const rows = lines.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [head[i], v.trim()])))
  const live = new Map(), takes = []
  for (const r of rows) {
    if (TAKE_SUFFIX.test(r.id)) { takes.push(r); continue }
    if (live.has(r.id)) fail(`V4  cue table has ${r.id} twice`)
    live.set(r.id, r)
  }
  // V11 — a superseded take must have a live bare ID, or the "bare ID is live" rule is a lie.
  for (const t of takes) {
    const bare = t.id.replace(TAKE_SUFFIX, '')
    if (!live.has(bare)) fail(`V11 superseded take "${t.id}" has no live bare ID "${bare}"`)
    else notes.push(`superseded take ${t.id} ignored; ${bare} is live`)
  }
  return live
}

/* ------------------------------------------------------------------ *
 * BUILD GROUP 1
 * ------------------------------------------------------------------ */
function buildGroup1 () {
  const src = read(P.entries)
  const cues = readCues()
  const consumed = new Set()

  const items = src.entries.map(e => {
    const row = cues.get(e.id)
    if (!row) { fail(`V1  entry "${e.id}" has no row in the cue table`); return null }
    consumed.add(e.id)

    // V12 — filename is the entry ID. There is no mapping table and none should exist.
    const expected = e.id + src.group.media.audio.ext
    if (row.file !== expected) fail(`V12 ${e.id}: audio file is "${row.file}", expected "${expected}"`)

    const shape = SHAPES[e.shape]
    if (!shape) { fail(`V8  ${e.id}: unknown shape "${e.shape}"`); return null }

    // Absent cues are OMITTED, not null and not zero.
    const cueOut = { start: Number(row.anchor) }
    for (const k of shape.cues) {
      if (row[k] === '' || row[k] == null) { fail(`V8  ${e.id}: shape "${e.shape}" needs cue ${k}, cue table is empty`); continue }
      cueOut[k] = Number(row[k])
    }
    for (const k of ['word1', 'word2']) {
      if (!shape.cues.includes(k) && row[k] !== '' && row[k] != null) {
        fail(`V8  ${e.id}: shape "${e.shape}" has ${shape.beats} beat(s) but the cue table supplies ${k}`)
      }
    }

    const words = (e.words || []).map(w => ({ text: w.text, imageId: imageId(w.text), es: w.es ?? null }))
    return {
      id: e.id,
      legacyKeys: e.legacyKeys || [],
      group: src.group.id,          // DECLARED, never parsed from the ID
      part: e.part,                 // DECLARED, never parsed from the ID
      shape: e.shape,
      beats: shape.beats,
      label: e.label,
      letter: e.letter,
      variant: e.variant ?? null,
      anchor: e.anchor,             // F-28 — per entry, not per group
      set: e.set ?? 'P',            // taught set for G1 is not yet decided — see notes
      risk: e.risk ?? null,
      spanishGuide: e.spanishGuide ?? null,
      cognate: e.cognate ?? null,
      // Declared when the entry table says so; otherwise derived. Kept declarable so
      // V5 stays a live check rather than dead code, and so P0-E3 can set "spanish"
      // or "none" per entry without a code change.
      support: e.support ?? (words.length ? 'image' : 'none'),
      words,
      audio: { start: 0, end: Number(row.duration), cues: cueOut },
      playable: e.playable !== false,
      verified: true
    }
  }).filter(Boolean)

  // V2 — every cue row is consumed. An orphan row means a dropped entry.
  for (const id of cues.keys()) {
    if (!consumed.has(id)) fail(`V2  orphan cue row "${id}" — no entry consumes it`)
  }

  return {
    ...src.group,
    kind: 'letter-group',
    parts: { 1: 'el nombre', 2: 'los sonidos', 3: 'las combinaciones', 4: 'palabras' },
    itemCount: src.entries.length,
    items
  }
}

/* ------------------------------------------------------------------ *
 * FIXTURE — per-item shape coverage, reserved UF- namespace (P0-E2-S3)
 * ------------------------------------------------------------------ */
function buildFixtureUnit () {
  const src = read(P.fixture)
  const unit = { ...src.unit, kind: 'fixture' }
  unit.items = src.items.map(raw => {
    const shape = SHAPES[raw.shape] || SHAPES.combination
    const cueOut = { start: 0.2 }
    for (const k of shape.cues) if (typeof raw.cues[k] === 'number') cueOut[k] = raw.cues[k]
    return {
      id: raw.id, legacyKeys: raw.legacyKeys, group: 'UF', part: 3,
      shape: SHAPES[raw.shape] ? raw.shape : 'combination',
      beats: shape.beats, label: raw.label, letter: null, variant: raw.variant,
      anchor: raw.anchor, set: raw.set, risk: raw.risk,
      spanishGuide: raw.spanishGuide, cognate: raw.cognate, support: raw.support,
      words: raw.words, audio: { start: 0, end: raw.audioDuration, cues: cueOut },
      playable: raw.playable !== false,
      ...(raw.suppressedReason && { suppressedReason: raw.suppressedReason }),
      verified: true
    }
  })
  unit.itemCount = unit.items.length
  return unit
}

/* ================================================================== *
 * VALIDATORS
 * ================================================================== */
const IPA = /[ɑɒæəɜɪʊʌθðʃʒŋɹɾʔˈˌː]/
let MANIFEST_PRESENT = false
let UNVERIFIED_IMAGE_IDS = new Set()

function validate (containers, { productionBuild }) {
  const allIds = new Set(), legacyIndex = new Map(), imageIds = new Set()

  for (const c of Object.values(containers)) {
    // V3 — declared itemCount matches reality.
    if (c.itemCount !== c.items.length) fail(`V3  ${c.id}: itemCount ${c.itemCount} != items.length ${c.items.length}`)

    for (const it of c.items) {
      // V4 — no ID twice, across every container.
      if (allIds.has(it.id)) fail(`V4  duplicate id ${it.id}`)
      allIds.add(it.id)

      for (const k of it.legacyKeys) {
        if (!legacyIndex.has(k)) legacyIndex.set(k, [])
        legacyIndex.get(k).push(it.id)
      }

      // V10 — group and part are declared fields, present on every entry.
      if (!it.group) fail(`V10 ${it.id}: no declared group`)
      if (typeof it.part !== 'number') fail(`V10 ${it.id}: no declared part`)
      if (it.group !== c.id) fail(`V10 ${it.id}: declares group "${it.group}" but sits in "${c.id}"`)

      // V5 — empty words only when support is "none".
      if (!it.words.length && it.support !== 'none') fail(`V5  ${it.id}: empty words but support is "${it.support}"`)
      for (const w of it.words) {
        if (w.imageId) imageIds.add(w.imageId)
        if (it.support === 'spanish' && !w.es) fail(`V5  ${it.id}: support "spanish" but word "${w.text}" has no es`)
      }

      // V8 — cues monotonic and shape-correct.
      const shape = SHAPES[it.shape]
      if (!shape) { fail(`V8  ${it.id}: unknown shape "${it.shape}"`); continue }
      const dur = +(it.audio.end - it.audio.start).toFixed(3)
      const seq = [it.audio.cues.start, ...shape.cues.map(k => it.audio.cues[k])]
      if (seq.some(v => typeof v !== 'number')) fail(`V8  ${it.id}: missing cue(s) for shape "${it.shape}"`)
      else if (!(seq.every((v, i) => i === 0 || seq[i - 1] < v) && seq[seq.length - 1] < dur)) {
        fail(`V8  ${it.id}: cues not monotonic — ${seq.join(' < ')} < dur ${dur}`)
      }
      // Absent cues must be OMITTED, not null or zero.
      for (const k of ['word1', 'word2']) {
        if (!shape.cues.includes(k) && k in it.audio.cues) {
          fail(`V8  ${it.id}: shape "${it.shape}" must omit cue "${k}", found ${it.audio.cues[k]}`)
        }
      }

      // V9 — fixture namespace never ships.
      if (productionBuild && (it.id.startsWith('UF-') || c.kind === 'fixture')) fail(`V9  ${it.id}: fixture ID in a production build`)
    }
  }

  // V1 — every legacyKey resolves to exactly one item.
  for (const [k, ids] of legacyIndex) if (ids.length > 1) fail(`V1  legacyKey "${k}" resolves to ${ids.length} items: ${ids.join(', ')}`)

  // V6 — no IPA anywhere.
  for (const s of JSON.stringify(Object.values(containers)).match(/"[^"]*"/g) || []) {
    if (IPA.test(s)) fail(`V6  IPA character in ${s}`)
  }

  // V7 — every imageId exists in the asset manifest.
  UNVERIFIED_IMAGE_IDS = new Set([...UNVERIFIED_IMAGE_IDS, ...imageIds])
  if (fs.existsSync(P.manifest)) {
    const man = new Set(read(P.manifest).images || [])
    for (const id of imageIds) if (!man.has(id)) fail(`V7  imageId "${id}" referenced but absent from the asset manifest`)
    MANIFEST_PRESENT = true; UNVERIFIED_IMAGE_IDS = new Set()
    notes.push(`V7 enforced against ${man.size} manifest entries`)
  }
}

/** Mode parity — a surface must never be able to tell the two audio modes apart. */
function assertModeParity (containers) {
  const OFFSET = 1234.567
  let checked = 0
  for (const c of Object.values(containers)) {
    for (const it of c.items) {
      const asIs = clipsFor(it, c)
      const other = c.media.audio.mode === 'per-item-file'
        ? { mode: 'narration-offsets', src: '/assets/audio/PARITY/narration.m4a' }
        : { mode: 'per-item-file', dir: '/assets/audio/PARITY/', ext: '.m4a' }
      const shift = other.mode === 'narration-offsets' ? OFFSET : 0
      const twinC = { ...c, media: { ...c.media, audio: other } }
      const twin = { ...it, audio: { ...it.audio, start: shift } }
      const alt = clipsFor(twin, twinC)
      for (const n of ALL_CLIPS) {
        const a = asIs[n], b = alt[n]
        if ((a === null) !== (b === null)) { fail(`PARITY ${it.id}.${n}: present in one mode, null in the other`); continue }
        if (!a) continue
        const rel = x => +(x.from - (x === a ? it.audio.start : twin.audio.start)).toFixed(3)
        if (+(a.from - it.audio.start).toFixed(3) !== +(b.from - twin.audio.start).toFixed(3) ||
            +(a.to - a.from).toFixed(3) !== +(b.to - b.from).toFixed(3)) {
          fail(`PARITY ${it.id}.${n}: modes are NOT interchangeable`)
        }
        checked++
      }
    }
  }
  return checked
}

/* ------------------------------------------------------------------ *
 * BUILD
 * ------------------------------------------------------------------ */
const g1 = buildGroup1()
const production = { G1: g1 }
validate(production, { productionBuild: true })
const parity = assertModeParity(production)

// SHAPE — a shape must expose exactly the clips it declares, and no others.
for (const c of Object.values(production)) {
  for (const it of c.items) {
    const got = clipsFor(it, c), want = SHAPES[it.shape].clips
    for (const n of ALL_CLIPS) {
      if (want.includes(n) && !got[n]) fail(`SHAPE ${it.id}: shape "${it.shape}" should expose "${n}"`)
      if (!want.includes(n) && got[n]) fail(`SHAPE ${it.id}: shape "${it.shape}" must return null for "${n}"`)
    }
  }
}

let fixtureUnit = null
if (WANT_FIXTURES) {
  fixtureUnit = buildFixtureUnit()
  validate({ UF: fixtureUnit }, { productionBuild: false })
  assertModeParity({ UF: fixtureUnit })
}

if (!MANIFEST_PRESENT) {
  const msg = `V7 NOT ENFORCED — data/asset_manifest.json does not exist. ${UNVERIFIED_IMAGE_IDS.size} imageId(s) unverified. Blocked on P0-E3 (F-04).`
  if (REQUIRE_MANIFEST) fail(msg.replace('NOT ENFORCED', 'FAILED')); else warn(msg)
}

const out = {
  schemaVersion: 3,
  structureVersion: 'alphabet-waterfall',
  contractVersion: 'ESL_PWA_Data_Contract.md v2 + MEMO_to_Master_ID_Convention.md',
  generatedFrom: 'Group1_Entry_Table.md + Group1_Cue_Points.csv',
  idConvention: {
    note: 'IDs are opaque. U2- and U3- are frozen tokens from the stood-down nine-unit structure and do NOT mean Unit 2 or Unit 3. Never parse a prefix. Group and part are fields.',
    patterns: ['LTR-<letter>-NAME', 'LTR-<letter>-S<n>', 'U2-<syllable>', 'U3-<word>']
  },
  gating: { current: 'G1', releaseDay: 'friday', allowPrior: true },
  structure: STRUCTURE.map(s => ({ ...s, populated: !!production[s.id] })),
  groups: production
}

console.log('--- BUILD ---')
notes.forEach(n => console.log('  NOTE  ' + n))
warnings.forEach(w => console.log('  WARN  ' + w))
if (errors.length) {
  errors.forEach(e => console.log('  ERROR ' + e))
  console.log(`\nFAILED — ${errors.length} error(s). No output written.`)
  process.exit(1)
}
fs.mkdirSync(path.dirname(P.out), { recursive: true })
fs.writeFileSync(P.out, JSON.stringify(out, null, 2))
const byPart = g1.items.reduce((a, i) => (a[i.part] = (a[i.part] || 0) + 1, a), {})
const byShape = g1.items.reduce((a, i) => (a[i.shape] = (a[i.shape] || 0) + 1, a), {})
console.log(`  OK    G1: ${g1.items.length} entries · parts ${JSON.stringify(byPart)} · shapes ${JSON.stringify(byShape)}`)
console.log(`  OK    ${parity} clip windows checked for audio-mode parity`)
console.log(`  OK    structure: ${STRUCTURE.length} containers declared, ${STRUCTURE.filter(s => production[s.id]).length} populated`)
if (fixtureUnit) {
  fs.mkdirSync(path.dirname(P.outFix), { recursive: true })
  fs.writeFileSync(P.outFix, JSON.stringify({ schemaVersion: 3, fixture: true, groups: { UF: fixtureUnit } }, null, 2))
  console.log(`  OK    UF fixture: ${fixtureUnit.items.length} entries`)
}
console.log(`  OK    ${warnings.length} warning(s), 0 error(s)`)
