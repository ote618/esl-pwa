/**
 * ESL PWA — audio (Model B)
 *
 * Model B, ratified 2026-08-18: one file per clip. Playback is "play this
 * file". There are no cue points, no offsets, no seeking, and no narration
 * track to seek into. If you find yourself reaching for currentTime here,
 * something upstream has gone wrong.
 *
 * THE CONTRACT
 *   clip(id, role) returns a URL or null.
 *
 *   NULL IS A NORMAL ANSWER. A one-beat entry — the four letter names and the
 *   three U3- words — has a "sound" clip and nothing else. clip(id, 'word1')
 *   returning null for those seven entries is the data being correct, not a
 *   missing file. Callers branch on it; they do not report it.
 *
 * IDs are opaque here too. The clip table is keyed by the whole id. Nothing
 * below parses "LTR-", "U2-" or "U3-".
 */

import registry from './registry.js'

const ROLES = ['sound', 'word1', 'word2']

/* id -> { role: url }, built once from what the generator already resolved. */
const URLS = new Map()
for (const container of Object.values(registry.groups)) {
  const dir = container.media.audio.dir
  for (const item of container.items) {
    const byRole = {}
    for (const role of ROLES) {
      const file = item.audio.clips[role]
      if (file) byRole[role] = encodeURI(dir + file)
    }
    URLS.set(item.id, byRole)
  }
}

/**
 * The URL for one clip, or null when the entry has no such clip.
 * Null for an unknown id too — asking about nothing is not an error either.
 */
export function clip (id, role) {
  return URLS.get(id)?.[role] ?? null
}

/** The roles this entry actually has, in playback order. One or three. */
export function roles (id) {
  const byRole = URLS.get(id)
  return byRole ? ROLES.filter(r => byRole[r]) : []
}

export function hasClip (id, role) {
  return clip(id, role) !== null
}

/* ------------------------------------------------------------------ *
 * PLAYBACK
 *
 * One element, reused. A child taps faster than audio loads, and two
 * overlapping voices teaching two different sounds is worse than silence,
 * so starting a clip always stops the one before it.
 * ------------------------------------------------------------------ */

let el = null
let gen = 0
let timer = null
let watchdog = null

function element () {
  if (!el && typeof Audio !== 'undefined') {
    el = new Audio()
    el.preload = 'auto'
  }
  return el
}

function clearTimers () {
  if (timer) { clearTimeout(timer); timer = null }
  if (watchdog) { clearTimeout(watchdog); watchdog = null }
}

/**
 * iOS will not play audio that a user gesture did not start, and the first
 * tap a child makes is on a letter, not on a play button. Prime the element
 * silently on the first gesture so that tap is not the one that gets eaten.
 * Safe to call repeatedly; it does its work once.
 */
let unlocked = false
export function unlock () {
  if (unlocked) return
  const a = element()
  if (!a) return
  const first = URLS.values().next().value
  const src = first && (first.sound || Object.values(first)[0])
  if (!src) return
  const restore = a.volume
  a.volume = 0
  a.src = src
  const started = a.play()
  const finish = () => {
    a.pause()
    a.removeAttribute('src')
    a.load()
    a.volume = restore
    unlocked = true
  }
  if (started && typeof started.then === 'function') started.then(finish).catch(() => { a.volume = restore })
  else finish()
}

export function isUnlocked () {
  return unlocked
}

export function stop () {
  gen++
  clearTimers()
  const a = element()
  if (!a) return
  a.pause()
  a.removeAttribute('src')
  a.load()
}

/**
 * The playback core, shared by play() and playSequence().
 *
 * It does NOT bump the generation. That distinction is the whole point: a
 * sequence starts one generation and plays several clips inside it, so only
 * something *else* starting audio can cancel it. Bumping here made a sequence
 * cancel itself on its own second beat.
 *
 * Resolves true only if the clip reached its end.
 *
 * The watchdog is not belt-and-braces. Before the element is unlocked, iOS can
 * leave a play() neither started nor errored, and a sequence would sit on beat
 * one forever. It resolves to the real duration as soon as metadata arrives,
 * so a clip that plays normally is never cut short.
 */
function playClip (src, mine) {
  const a = element()
  if (!a || !src) return Promise.resolve(false)

  clearTimers()
  a.pause()
  a.src = src

  return new Promise(resolve => {
    let settled = false
    const done = ok => {
      if (settled) return
      settled = true
      if (mine === gen) clearTimers()
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('error', onErr)
      a.removeEventListener('loadedmetadata', onMeta)
      resolve(ok)
    }
    const onEnd = () => done(true)
    const onErr = () => done(false)
    const onMeta = () => {
      if (settled || mine !== gen) return
      if (!isFinite(a.duration) || a.duration <= 0) return
      clearTimeout(watchdog)
      watchdog = setTimeout(() => done(true), a.duration * 1000 + 320)
    }
    a.addEventListener('ended', onEnd)
    a.addEventListener('error', onErr)
    a.addEventListener('loadedmetadata', onMeta)

    watchdog = setTimeout(() => done(false), 1300)

    const started = a.play()
    if (started && typeof started.catch === 'function') {
      started.then(() => { unlocked = true }).catch(() => done(false))
    }
  })
}

/**
 * Play one clip. Resolves true only if it actually reached the end.
 *
 * Never throws and never rejects. A blocked autoplay, a 404, a clip the entry
 * does not have — all end the same way: quietly, with nothing playing. A child
 * tapping a button should never meet an error state; the worst case is silence.
 */
export function play (id, role = 'sound') {
  const src = clip(id, role)
  if (!src) { stop(); return Promise.resolve(false) }
  gen++
  return playClip(src, gen)
}

/**
 * Walk a list of clips in order — the sound, then its two words.
 *
 * `steps` is [{ id, role }]. `onStep` is called with each index as it starts
 * and with null when the walk ends, so the caller can move a highlight without
 * this file knowing anything about the DOM.
 *
 * Steps whose clip does not exist are skipped, not failed: hand a one-beat
 * entry a three-beat sequence and it simply plays its one clip. The indexes
 * passed to `onStep` are indexes into the ORIGINAL `steps`, so a caller's
 * highlight lines up with what it asked for, not with what survived.
 */
export function playSequence (steps, onStep = () => {}) {
  gen++
  const mine = gen
  clearTimers()
  const live = steps
    .map((s, i) => ({ ...s, at: i, src: clip(s.id, s.role) }))
    .filter(s => s.src)

  return new Promise(resolve => {
    let i = 0
    const step = async () => {
      if (mine !== gen) return resolve(false)
      if (i >= live.length) { onStep(null); return resolve(true) }
      const it = live[i]
      onStep(it.at)
      await playClip(it.src, mine)
      if (mine !== gen) return resolve(false)
      i++
      // A beat of silence between clips. Run together they read as one word.
      timer = setTimeout(step, 200)
    }
    step()
  })
}

export default { clip, roles, hasClip, play, playSequence, stop, unlock, isUnlocked }
