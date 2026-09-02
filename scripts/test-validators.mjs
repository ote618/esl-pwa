#!/usr/bin/env node
/**
 * Negative tests for the registry generator — audio Model B.
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
  fs.mkdirSync(path.join(tmp, 'src', 'data'), { recursive: true })
  for (const [from, to] of [
    ['scripts/build-registry.mjs', 'scripts/build-registry.mjs'],
    ['data/group1_entries.json', 'data/group1_entries.json'],
    ['data/fixtures/unit_fixture_per_item.json', 'data/fixtures/unit_fixture_per_item.json'],
    ['src/data/group1_clips.json', 'src/data/group1_clips.json']
  ]) fs.copyFileSync(path.join(ROOT, from), path.join(tmp, to))
  // V13 reads real files off disk, so the harness needs them present.
  fs.cpSync(path.join(ROOT, 'public/audio/group1'), path.join(tmp, 'public/audio/group1'), { recursive: true })

  const f = {
    entries: () => JSON.parse(fs.readFileSync(path.join(tmp, 'data/group1_entries.json'), 'utf8')),
    clips:   () => JSON.parse(fs.readFileSync(path.join(tmp, 'src/data/group1_clips.json'), 'utf8')),
    script:  () => fs.readFileSync(path.join(tmp, 'scripts/build-registry.mjs'), 'utf8'),
    setEntries:  d => fs.writeFileSync(path.join(tmp, 'data/group1_entries.json'), JSON.stringify(d, null, 1)),
    setClips:    d => fs.writeFileSync(path.join(tmp, 'src/data/group1_clips.json'), JSON.stringify(d, null, 1)),
    setScript:   s => fs.writeFileSync(path.join(tmp, 'scripts/build-registry.mjs'), s),
    setManifest: d => fs.writeFileSync(path.join(tmp, 'data/asset_manifest.json'), JSON.stringify(d, null, 1)),
    rmAudio:     n => fs.rmSync(path.join(tmp, 'public/audio/group1', n)),
    tmp
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
  ['V1  an entry with no clip record fails (never skips the entry)', 'V1', f => {
    const d = f.clips(); delete d['U2-DU']; f.setClips(d)
  }],
  ['V1  a legacyKey resolving to two entries fails', 'V1', f => {
    const d = f.entries(); d.entries[0].legacyKeys = ['dup']; d.entries[1].legacyKeys = ['dup']; f.setEntries(d)
  }],
  ['V2  an orphan clip record fails (an orphan means a dropped entry)', 'V2', f => {
    const d = f.clips(); d['U2-ZZ'] = { sound: 'U2-ZZ_sound.mp3' }; f.setClips(d)
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
  ['V8  a 1-beat entry given a word clip fails (F-24, at build time)', 'V8', f => {
    const d = f.clips(); d['LTR-A-NAME'].word1 = 'LTR-A-NAME_word1.mp3'; f.setClips(d)
  }],
  ['V8  a 3-beat entry missing a clip fails', 'V8', f => {
    const d = f.clips(); delete d['U2-DU'].word2; f.setClips(d)
  }],
  ['V8  an unknown clip role fails', 'V8', f => {
    const d = f.clips(); d['U2-BA'].word3 = 'U2-BA_word3.mp3'; f.setClips(d)
  }],
  ['V8  an empty clip filename fails (absent roles are omitted, not blank)', 'V8', f => {
    const d = f.clips(); d['U2-BA'].word2 = ''; f.setClips(d)
  }],
  ['V1  a group entry table with no clip index fails (not a crash)', 'V1', f => {
    fs.copyFileSync(path.join(f.tmp, 'data/group1_entries.json'), path.join(f.tmp, 'data/group9_entries.json'))
  }],
  ['V9  a fixture ID reaching a production build fails', 'V9', f => {
    // Anchored on validate(), not on the group loop — the loop changes shape
    // whenever multi-group handling is touched, and a mutation that silently
    // stops matching turns this test green for the wrong reason.
    f.setScript(f.script().replace(
      'validate(production, { productionBuild: true })',
      'production.UF = buildFixtureUnit()\nvalidate(production, { productionBuild: true })'))
  }],
  ['V10 an entry with no declared part fails (no inferring part from the ID)', 'V10', f => {
    const d = f.entries(); d.entries[0].part = 'three'; f.setEntries(d)
  }],
  ['V11 a superseded take reaching the clip index fails', 'V11', f => {
    const d = f.clips(); d['U2-CE_take1'] = { sound: 'U2-CE_take1_sound.mp3' }; f.setClips(d)
  }],
  ['V12 an audio filename that is not <id>_<clip>.mp3 fails (no mapping table)', 'V12', f => {
    const d = f.clips(); d['U2-CO'].sound = 'track_22.mp3'; f.setClips(d)
  }],
  ['V12 an .m4a filename fails (the regression that split data from audio)', 'V12', f => {
    const d = f.clips(); d['U2-CO'].sound = 'U2-CO_sound.m4a'; f.setClips(d)
  }],
  ['V13 a clip named by the index but missing on disk fails', 'V13', f => {
    f.rmAudio('U2-BA_word1.mp3')
  }],
  ['SHAPE  a name entry exposing word1 fails', 'SHAPE', f => {
    f.setScript(f.script().replace("name:        { beats: 1, clips: ['sound'] },",
      "name:        { beats: 1, clips: ['sound', 'word1'] },"))
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
