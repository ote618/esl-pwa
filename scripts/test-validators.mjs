#!/usr/bin/env node
/**
 * Negative tests for the registry generator.
 * Each case breaks one rule on purpose and asserts the build refuses it.
 * A validator nobody has watched fail is a validator nobody knows is wired up.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

function run (mutate, flags = ['--fixtures']) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eslgen-'))
  fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true })
  fs.mkdirSync(path.join(tmp, 'data', 'fixtures'), { recursive: true })
  for (const [from, to] of [
    ['scripts/build-registry.mjs', 'scripts/build-registry.mjs'],
    ['data/group1_entries.json', 'data/group1_entries.json'],
    ['data/Group1_Cue_Points.csv', 'data/Group1_Cue_Points.csv'],
    ['data/fixtures/unit_fixture_per_item.json', 'data/fixtures/unit_fixture_per_item.json']
  ]) fs.copyFileSync(path.join(ROOT, from), path.join(tmp, to))

  const f = {
    entries: () => JSON.parse(fs.readFileSync(path.join(tmp, 'data/group1_entries.json'), 'utf8')),
    cues:    () => fs.readFileSync(path.join(tmp, 'data/Group1_Cue_Points.csv'), 'utf8').trim().split('\n'),
    script:  () => fs.readFileSync(path.join(tmp, 'scripts/build-registry.mjs'), 'utf8'),
    setEntries:  d => fs.writeFileSync(path.join(tmp, 'data/group1_entries.json'), JSON.stringify(d, null, 1)),
    setCues:     l => fs.writeFileSync(path.join(tmp, 'data/Group1_Cue_Points.csv'), l.join('\n') + '\n'),
    setScript:   s => fs.writeFileSync(path.join(tmp, 'scripts/build-registry.mjs'), s),
    setManifest: d => fs.writeFileSync(path.join(tmp, 'data/asset_manifest.json'), JSON.stringify(d, null, 1))
  }
  mutate(f)

  let stdout = '', code = 0
  try { stdout = execFileSync('node', [path.join(tmp, 'scripts/build-registry.mjs'), ...flags], { encoding: 'utf8' }) }
  catch (e) { code = e.status; stdout = (e.stdout || '') + (e.stderr || '') }
  const wrote = fs.existsSync(path.join(tmp, 'out', 'esl_unit_registry.json'))
  fs.rmSync(tmp, { recursive: true, force: true })
  return { code, stdout, wrote }
}

const CASES = [
  ['V1  an entry with no cue row fails (never skips the entry)', 'V1', f => {
    f.setCues(f.cues().filter(l => !l.startsWith('U2-DU,')))
  }],
  ['V1  a legacyKey resolving to two entries fails', 'V1', f => {
    const d = f.entries(); d.entries[0].legacyKeys = ['dup']; d.entries[1].legacyKeys = ['dup']; f.setEntries(d)
  }],
  ['V2  an orphan cue row fails (an orphan means a dropped entry)', 'V2', f => {
    const l = f.cues(); l.push('U2-ZZ,U2-ZZ.m4a,3.0,0.2,1.0,2.0,zz,0,1'); f.setCues(l)
  }],
  ['V3  itemCount != items.length fails', 'V3', f => {
    f.setScript(f.script().replace('itemCount: src.entries.length,', 'itemCount: src.entries.length + 1,'))
  }],
  ['V4  a duplicate ID fails', 'V4', f => {
    const d = f.entries(); d.entries[1].id = d.entries[0].id; f.setEntries(d)
  }],
  ['V5  empty words with support != "none" fails', 'V5', f => {
    const d = f.entries(); d.entries[0].support = 'image'; f.setEntries(d) // LTR-A-NAME has no words
  }],
  ['V6  an IPA character anywhere fails', 'V6', f => {
    const d = f.entries(); d.entries[4].spanishGuide = 'æ'; f.setEntries(d)
  }],
  ['V7  an imageId absent from the manifest fails', 'V7', f => {
    f.setManifest({ images: ['apple'] })
  }],
  ['V8  non-monotonic cues fail (catches a bad cut point)', 'V8', f => {
    f.setCues(f.cues().map(l => l.startsWith('U2-BA,') ? 'U2-BA,U2-BA.m4a,4.185,0.2,3.13,1.66,ba/bat/bag,33.86,38.05' : l))
  }],
  ['V8  a cue past the end of the file fails', 'V8', f => {
    f.setCues(f.cues().map(l => l.startsWith('U2-BA,') ? 'U2-BA,U2-BA.m4a,4.185,0.2,1.66,99.0,ba/bat/bag,33.86,38.05' : l))
  }],
  ['V8  a 1-beat entry given word cues fails (F-24, at build time)', 'V8', f => {
    f.setCues(f.cues().map(l => l.startsWith('LTR-A-NAME,') ? 'LTR-A-NAME,LTR-A-NAME.m4a,1.106,0.2,0.5,0.8,A,1.22,2.32' : l))
  }],
  ['V8  a 3-beat entry missing a word cue fails', 'V8', f => {
    f.setCues(f.cues().map(l => l.startsWith('U2-DU,') ? 'U2-DU,U2-DU.m4a,3.501,0.2,1.47,,du/duck/dust,88.91,92.41' : l))
  }],
  ['V9  a fixture ID reaching a production build fails', 'V9', f => {
    f.setScript(f.script().replace('const production = { G1: g1 }', 'const production = { G1: g1, UF: buildFixtureUnit() }'))
  }],
  ['V10 an entry with no declared part fails (no inferring part from the ID)', 'V10', f => {
    const d = f.entries(); d.entries[0].part = 'three'; f.setEntries(d)
  }],
  ['V11 a superseded take with no live bare ID fails', 'V11', f => {
    f.setCues(f.cues().filter(l => !l.startsWith('U2-CE,')))
  }],
  ['V12 an audio filename that is not <id>.m4a fails (no mapping table)', 'V12', f => {
    f.setCues(f.cues().map(l => l.startsWith('U2-CO,') ? l.replace('U2-CO.m4a', 'track_22.m4a') : l))
  }],
  ['PARITY  a mode-dependent clip window fails', 'PARITY', f => {
    f.setScript(f.script().replace("out.sound = win(first, at('word1'))",
      "out.sound = win(first, at('word1') + (a.mode === 'per-item-file' ? 0.5 : 0))"))
  }],
  ['SHAPE  a name entry exposing word1 fails', 'SHAPE', f => {
    f.setScript(f.script().replace("name:        { beats: 1, cues: [],                 clips: ['name'] },",
      "name:        { beats: 1, cues: [],                 clips: ['name', 'word1'] },"))
  }]
]

console.log('--- NEGATIVE TESTS: does a broken build actually fail? ---\n')
let pass = 0, failed = 0
const control = run(() => {})
if (control.code !== 0) { console.log('  FAIL  control: unmutated build exited ' + control.code); console.log(control.stdout); failed++ }
else { console.log('  ok    control — unmutated build is green'); pass++ }

for (const [name, tag, mutate] of CASES) {
  const r = run(mutate)
  if (r.code !== 0 && r.stdout.includes('ERROR ' + tag) && !r.wrote) { console.log(`  ok    ${name}`); pass++ }
  else {
    failed++
    console.log(`  FAIL  ${name}`)
    console.log(`          exit ${r.code}${r.stdout.includes('ERROR ' + tag) ? '' : `, no "ERROR ${tag}"`}${r.wrote ? ', AND IT WROTE OUTPUT' : ''}`)
    console.log('          ' + r.stdout.split('\n').filter(l => l.includes('ERROR')).slice(0, 2).join('\n          '))
  }
}
console.log(`\n${pass} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
