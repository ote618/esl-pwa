#!/usr/bin/env node
/**
 * ESL PWA — registry generator
 * Contract: claude/ESL_PWA_Data_Contract.md v2 · ID convention: claude/MEMO_to_Master_ID_Convention.md
 * Story: P0-E2-S8 — 8 letter groups + 5 tail units, IDs preserved, group/part as fields.
 *
 * AUDIO MODEL B — ratified 2026-08-18. One file per clip. Press play.
 *   Every clip is its own MP3 under /audio/group1/. There are no cue points,
 *   no offsets, no seeking, and no narration track to seek into. `clip(id, role)`
 *   returns a file or null. Null is a normal answer, not an error.
 *   The clip table is src/data/group1_clips.json — the same file the app loads
 *   and the one verified serving 200 in production (P0-E3-S2).
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
  // Every data/groupN_entries.json is built; its clip index is
  // src/data/<key>_clips.json. Both live outside data/ on purpose — the clip
  // table is the one the app loads, and a second copy would drift.
  dataDir:   path.join(ROOT, 'data'),
  srcData:   path.join(ROOT, 'src', 'data'),
  publicDir: path.join(ROOT, 'public'),
  fixture:  path.join(ROOT, 'data', 'fixtures', 'unit_fixture_per_item.json'),
  manifest: path.join(ROOT, 'data', 'asset_manifest.json'),
  imageLookup: path.join(ROOT, 'data', 'images', 'image_lookup.json'),
  out:      path.join(ROOT, 'out', 'esl_unit_registry.json'),
  outFix:   path.join(ROOT, 'out', 'fixtures', 'esl_unit_registry.fixture.json')
}

const argv = new Set(process.argv.slice(2))
const WANT_FIXTURES    = argv.has('--fixtures')
const REQUIRE_MANIFEST = argv.has('--require-manifest')

/* Every data/groupN_entries.json is built. Adding a group is a data change,
 * not a code change — drop the entry table and clip index in and it builds.
 * Its clip index is src/data/<key>_clips.json; both are required. */
const GROUP_KEYS = fs.readdirSync(path.join(ROOT, 'data'))
  .filter(f => /^group\d+_entries\.json$/.test(f))
  .map(f => f.replace('_entries.json', ''))
  .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))

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
 * The one-beat clip role is "sound", not "name"/"word". That is not a
 * preference: the shipped files are LTR-A-NAME_sound.mp3 and U3-AT_sound.mp3,
 * the filename IS the ID, and files are never renamed. The role vocabulary
 * follows the audio, not the other way round.
 * ------------------------------------------------------------------ */
const SHAPES = {
  name:        { beats: 1, clips: ['sound'] },
  word:        { beats: 1, clips: ['sound'] },
  sound:       { beats: 3, clips: ['sound', 'word1', 'word2'] },
  combination: { beats: 3, clips: ['sound', 'word1', 'word2'] }
}
const ALL_CLIPS = ['sound', 'word1', 'word2']

/**
 * The whole playback contract, in one function.
 * Returns { [clip]: {src} | null }. No from, no to — there is nothing to seek.
 */
function clipsFor (item, container) {
  const dir = container.media.audio.dir
  const out = Object.fromEntries(ALL_CLIPS.map(k => [k, null]))
  for (const k of ALL_CLIPS) {
    const file = item.audio.clips[k]
    if (file) out[k] = { src: dir + file }
  }
  return out
}

const imageId = w => w.toLowerCase().replace(/[^a-z0-9]+/g, '-')
// <id>_<role>__<descriptor><ext>, e.g. LTR-A-S1_word1__A_word_apple.mp3
const CLIP_FILE = /^(.+?)_(sound|word1|word2)__([A-Za-z0-9_]+)(\.[a-z0-9]+)$/
const TAKE_SUFFIX = /_take\d+$/   // "superseded takes are <ID>_takeN; the bare ID is always live"

/* ------------------------------------------------------------------ *
 * CLIP TABLE — src/data/group1_clips.json
 *
 * Shape: { "<entryID>": { "sound": "<file>", "word1": "<file>", "word2": "<file>" } }
 * Roles a shape does not have are OMITTED — not null, not "".
 * ------------------------------------------------------------------ */
function readClips (key) {
  const raw = read(path.join(P.srcData, `${key}_clips.json`))
  const live = new Map()
  for (const [id, rec] of Object.entries(raw)) {
    // V11 — a superseded take must never reach the index. The bare ID is what ships.
    if (TAKE_SUFFIX.test(id)) {
      const bare = id.replace(TAKE_SUFFIX, '')
      fail(`V11 superseded take "${id}" is present in the clip index; only the live bare ID "${bare}" may ship`)
      continue
    }
    if (live.has(id)) fail(`V4  clip index has ${id} twice`)
    for (const [role, file] of Object.entries(rec)) {
      if (!ALL_CLIPS.includes(role)) fail(`V8  ${id}: unknown clip role "${role}"`)
      if (typeof file !== 'string' || !file) fail(`V8  ${id}.${role}: empty clip filename — absent roles must be omitted`)
    }
    live.set(id, rec)
  }
  return live
}

/* ------------------------------------------------------------------ *
 * BUILD GROUP 1
 * ------------------------------------------------------------------ */
function buildGroup (key) {
  const src = read(path.join(P.dataDir, `${key}_entries.json`))
  // An entry table with no clip index is an unresolvable join, not a crash.
  const clipPath = path.join(P.srcData, `${key}_clips.json`)
  if (!fs.existsSync(clipPath)) {
    fail(`V1  ${key}: data/${key}_entries.json exists but src/${key.replace(/^/, 'data/')}_clips.json does not`)
    return null
  }
  const clips = readClips(key)
  const consumed = new Set()
  const ext = src.group.media.audio.ext

  const items = src.entries.map(e => {
    const rec = clips.get(e.id)
    if (!rec) { fail(`V1  entry "${e.id}" has no record in the clip index`); return null }
    consumed.add(e.id)

    const shape = SHAPES[e.shape]
    if (!shape) { fail(`V8  ${e.id}: unknown shape "${e.shape}"`); return null }

    // V8 — the clip set must match the shape exactly. Missing is a failure; extra is a failure.
    for (const k of shape.clips) {
      if (!rec[k]) fail(`V8  ${e.id}: shape "${e.shape}" needs clip "${k}", clip index omits it`)
    }
    for (const k of ALL_CLIPS) {
      if (!shape.clips.includes(k) && rec[k]) {
        fail(`V8  ${e.id}: shape "${e.shape}" has ${shape.beats} beat(s) but the clip index supplies "${k}"`)
      }
    }

    // V12 — filename is <id>_<clip>__<descriptor><ext>. The ID and role are the
    // join key; the descriptor after "__" is the human-readable tail the recording
    // session named the take with (A_word_apple, B_syllable_ba). There is no
    // mapping table and none should exist — the filename IS the ID.
    const words = (e.words || []).map(w => ({ text: w.text, imageId: imageId(w.text), es: w.es ?? null }))
    const clipOut = {}
    for (const k of ALL_CLIPS) {
      if (!rec[k]) continue
      const m = CLIP_FILE.exec(rec[k])
      if (!m || m[1] !== e.id || m[2] !== k || m[4] !== ext) {
        fail(`V12 ${e.id}.${k}: audio file is "${rec[k]}", expected "${e.id}_${k}__<descriptor>${ext}"`)
      } else if (k !== 'sound') {
        // V15 — a word clip's descriptor ends in the word it says, which is the
        // same word the image file is named after. Audio and image are companions
        // by that word: U2-BA_word1__B_word_bat.mp3 <-> bat.webp. A clip that says
        // one word under an entry that shows another must not ship.
        const w = words[k === 'word1' ? 0 : 1]
        const said = m[3].split('_').pop().toLowerCase()
        if (!w) fail(`V15 ${e.id}.${k}: clip "${rec[k]}" but the entry has no ${k}`)
        else if (said !== w.imageId) fail(`V15 ${e.id}.${k}: clip says "${said}" but the word/image is "${w.imageId}" (${rec[k]})`)
      }
      clipOut[k] = rec[k]
    }
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
      audio: { mode: 'per-clip-file', clips: clipOut },
      playable: e.playable !== false,
      verified: true
    }
  }).filter(Boolean)

  // V2 — every clip record is consumed. An orphan record means a dropped entry.
  for (const id of clips.keys()) {
    if (!consumed.has(id)) fail(`V2  orphan clip record "${id}" — no entry consumes it`)
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
 * FIXTURE — per-clip shape coverage, reserved UF- namespace (P0-E2-S3)
 *
 * The fixture has no real audio on disk, so its clip table is derived from
 * the shape using the same <id>_<clip><ext> rule the real index obeys. That
 * keeps the fixture exercising the identical code path without inventing files.
 * ------------------------------------------------------------------ */
function buildFixtureUnit () {
  const src = read(P.fixture)
  const unit = { ...src.unit, kind: 'fixture' }
  const ext = unit.media.audio.ext
  unit.items = src.items.map(raw => {
    const shape = SHAPES[raw.shape] || SHAPES.combination
    const clipOut = {}
    for (const k of shape.clips) clipOut[k] = `${raw.id}_${k}${ext}`
    return {
      id: raw.id, legacyKeys: raw.legacyKeys, group: 'UF', part: 3,
      shape: SHAPES[raw.shape] ? raw.shape : 'combination',
      beats: shape.beats, label: raw.label, letter: null, variant: raw.variant,
      anchor: raw.anchor, set: raw.set, risk: raw.risk,
      spanishGuide: raw.spanishGuide, cognate: raw.cognate, support: raw.support,
      words: raw.words, audio: { mode: 'per-clip-file', clips: clipOut },
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

      // V8 — the emitted clip set matches the shape. Absent roles are OMITTED, not null.
      const shape = SHAPES[it.shape]
      if (!shape) { fail(`V8  ${it.id}: unknown shape "${it.shape}"`); continue }
      for (const k of shape.clips) {
        if (typeof it.audio.clips[k] !== 'string') fail(`V8  ${it.id}: shape "${it.shape}" missing clip "${k}"`)
      }
      for (const k of ALL_CLIPS) {
        if (!shape.clips.includes(k) && k in it.audio.clips) {
          fail(`V8  ${it.id}: shape "${it.shape}" must omit clip "${k}", found ${it.audio.clips[k]}`)
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

/**
 * V13 — every clip the registry promises exists on disk.
 *
 * Model B makes this checkable, which the offset model never was: the registry
 * names whole files, and whole files either deploy or they don't. This is the
 * check that would have caught the .m4a/.mp3 split had it been possible to run.
 */
function assertClipFilesExist (containers) {
  let checked = 0
  for (const c of Object.values(containers)) {
    if (c.kind === 'fixture') continue          // fixture audio is synthetic; no files to find
    for (const it of c.items) {
      for (const k of ALL_CLIPS) {
        const file = it.audio.clips[k]
        if (!file) continue
        const dir = c.media.audio.dir.replace(/^\/+/, '')
        if (!fs.existsSync(path.join(P.publicDir, dir, file))) {
          fail(`V13 ${it.id}.${k}: clip index names "${file}" but public/${dir}${file} does not exist`)
        }
        checked++
      }
    }
  }
  return checked
}

/**
 * V14 — every word image resolves to a file that exists on disk.
 *
 * The join happens HERE, at build time, because of rule 2: no runtime string
 * matching. The app is handed a finished `imageSrc` and never builds a path.
 *
 * Two traps this closes:
 *  - group.media.imageBase says "/assets/img/". Nothing has ever been served
 *    from there. The shipped images live at /img/<folder>/<file>, and the
 *    folder is the join's answer, not a string the app can guess. imageBase
 *    is left untouched and unused.
 *  - The folders contain SPACES ("Group 1 A-D"). A raw space in a src is the
 *    classic works-on-mac-404s-in-production bug, so the path is percent-
 *    encoded once, here, and the app emits it verbatim.
 */
function resolveImages (containers) {
  const look = read(P.imageLookup)
  let resolved = 0
  for (const c of Object.values(containers)) {
    if (c.kind === 'fixture') continue        // fixture images are synthetic
    for (const it of c.items) {
      for (const w of it.words) {
        if (!w.imageId) continue
        const rec = look[w.imageId]
        if (!rec) {
          fail(`V14 ${it.id}: imageId "${w.imageId}" has no record in data/images/image_lookup.json`)
          continue
        }
        if (!fs.existsSync(path.join(P.publicDir, rec.path))) {
          fail(`V14 ${it.id}: image_lookup names "${rec.path}" but public/${rec.path} does not exist`)
          continue
        }
        w.imageSrc = encodeURI('/' + rec.path)
        w.imageW = rec.w
        w.imageH = rec.h
        resolved++
      }
    }
  }
  return resolved
}

/* ------------------------------------------------------------------ *
 * BUILD
 * ------------------------------------------------------------------ */
const production = {}
for (const key of GROUP_KEYS) { const g = buildGroup(key); if (g) production[g.id] = g }
validate(production, { productionBuild: true })
const filesChecked = assertClipFilesExist(production)
const imagesResolved = resolveImages(production)

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
}

if (!MANIFEST_PRESENT) {
  const msg = `V7 NOT ENFORCED — data/asset_manifest.json does not exist. ${UNVERIFIED_IMAGE_IDS.size} imageId(s) unverified. Blocked on P0-E3 (F-04).`
  if (REQUIRE_MANIFEST) fail(msg.replace('NOT ENFORCED', 'FAILED')); else warn(msg)
}

const out = {
  schemaVersion: 4,
  structureVersion: 'alphabet-waterfall',
  contractVersion: 'ESL_PWA_Data_Contract.md v2 + MEMO_to_Master_ID_Convention.md',
  generatedFrom: GROUP_KEYS.map(k => `data/${k}_entries.json + src/data/${k}_clips.json`).join(', '),
  audioModel: {
    id: 'B',
    mode: 'per-clip-file',
    note: 'One file per clip. Playback is "play this file", never "seek to this offset". There are no cue points. clip(id, role) returns null when the role is absent.'
  },
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
for (const g of Object.values(production)) {
  const byPart = g.items.reduce((a, i) => (a[i.part] = (a[i.part] || 0) + 1, a), {})
  const byShape = g.items.reduce((a, i) => (a[i.shape] = (a[i.shape] || 0) + 1, a), {})
  console.log(`  OK    ${g.id}: ${g.items.length} entries · parts ${JSON.stringify(byPart)} · shapes ${JSON.stringify(byShape)}`)
}
console.log(`  OK    audio model B — ${filesChecked} clip files named and present on disk`)
console.log(`  OK    images: ${imagesResolved} word image(s) joined and present on disk`)
console.log(`  OK    structure: ${STRUCTURE.length} containers declared, ${STRUCTURE.filter(s => production[s.id]).length} populated`)
if (fixtureUnit) {
  fs.mkdirSync(path.dirname(P.outFix), { recursive: true })
  fs.writeFileSync(P.outFix, JSON.stringify({ schemaVersion: 4, fixture: true, groups: { UF: fixtureUnit } }, null, 2))
  console.log(`  OK    UF fixture: ${fixtureUnit.items.length} entries`)
}
console.log(`  OK    ${warnings.length} warning(s), 0 error(s)`)
