#!/usr/bin/env node
/**
 * Deploy the current working tree to the public staging URL.
 *
 *   npm run deploy:staging
 *
 * THE FLOW THIS EXISTS FOR
 *   push a branch -> npm run deploy:staging -> open it on a phone ->
 *   if it holds up, merge to main -> production deploys itself from git.
 *
 * Staging is a SEPARATE Vercel project, deployed by CLI, with no git
 * connection. That is deliberate: it is public with no login, so a phone or
 * a colleague can open it. The `esl-pwa` project's branch previews are behind
 * Vercel Authentication and 302 for everyone who is not signed in, which is
 * exactly what makes them useless for testing on a handset.
 *
 * It is NOT production. Nothing here touches esl-pwa.vercel.app; only a merge
 * to main does that.
 *
 * The project is still named "esl-pwa-mockup" — it used to host the static
 * design mockup. Renaming it would change the URL, and a stable URL is the
 * point, so the name is stale on purpose.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const STAGING = {
  projectId: 'prj_B8mW8QZvLhTFEKLl6B4SkHbHnF3M',
  orgId: 'team_bM5VghGjv5v0KCneVjD8L1ur',
  projectName: 'esl-pwa-mockup',
  url: 'https://esl-pwa-mockup.vercel.app'
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts })

const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim().length > 0

console.log(`\n--- STAGING ---`)
console.log(`  branch ${branch} @ ${sha}${dirty ? '  (UNCOMMITTED CHANGES — staging will not match any commit)' : ''}`)

console.log('\n  building...')
run('npm', ['run', 'build:data'], { stdio: 'pipe' })
run('npm', ['run', 'build'], { stdio: 'pipe' })

const dist = path.join(ROOT, 'dist')
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('  FAILED — dist/index.html does not exist after build.')
  process.exit(1)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'esl-staging-'))
fs.cpSync(dist, path.join(tmp, 'public'), { recursive: true })
/* Staging is a static upload, so the repo's vercel.json is not read by Vercel
 * here. Carry its headers over — the long Cache-Control on /audio and /img is
 * what stands in for the service-worker media cache, and a staging test that
 * does not exercise it is not a test of what production does. */
const repoCfg = fs.existsSync(path.join(ROOT, 'vercel.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) : {}
fs.writeFileSync(path.join(tmp, 'vercel.json'), JSON.stringify({ outputDirectory: 'public', framework: null, ...(repoCfg.headers && { headers: repoCfg.headers }) }, null, 2))
fs.mkdirSync(path.join(tmp, '.vercel'))
fs.writeFileSync(path.join(tmp, '.vercel', 'project.json'), JSON.stringify(STAGING, null, 2))

const files = execFileSync('find', [path.join(tmp, 'public'), '-type', 'f'], { encoding: 'utf8' }).trim().split('\n').length
console.log(`  deploying ${files} files to ${STAGING.projectName}...`)
/* The CLI's exit code is not the verdict — the probes below are. A non-zero
 * exit here (a hint the CLI prints, a flaky upload) used to abort the script
 * with an undecoded Buffer dump. Show what it said and let the probes decide. */
try {
  execFileSync('vercel', ['deploy', '--prod', '--yes'], { cwd: tmp, stdio: 'pipe', encoding: 'utf8' })
} catch (e) {
  const said = ((e.stdout || '') + (e.stderr || '')).trim()
  console.log(`  vercel deploy exited ${e.status ?? '?'}${said ? ':\n' + said.split('\n').map(l => '    ' + l).join('\n') : ''}`)
  console.log('  continuing to verification — the probes decide, not the exit code')
}
fs.rmSync(tmp, { recursive: true, force: true })

/* A deploy that reports success and serves a 404 is the failure mode that
 * matters. Check the things a child actually loads, not just the root. */
const probes = ['/', '/manifest.webmanifest', '/audio/group1/LTR-A-NAME_sound__A_name.mp3',
  '/audio/group6/LTR-Z-S1_sound__Z_sound_z.mp3', '/img/Group%201%20A-D/apple.webp', '/icons/icon-192.png']
console.log('\n  verifying (signed out):')
let bad = 0
for (const p of probes) {
  const code = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', STAGING.url + p], { encoding: 'utf8' }).trim()
  if (code !== '200') bad++
  console.log(`    ${code === '200' ? 'ok  ' : 'FAIL'} ${code}  ${p}`)
}
console.log(`\n  ${bad === 0 ? 'OK' : 'FAILED'} — ${STAGING.url}\n`)
process.exit(bad === 0 ? 0 : 1)
