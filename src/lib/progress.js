/**
 * ESL PWA — progress. The ONE writer of esl_progress_v1.
 *
 * Device-local. No server, no login, no database, no sync. If this file is the
 * only thing that ever writes the key, then "what does the app remember about a
 * child?" has one answer in one place, and that is the point.
 *
 * WHAT GOES IN
 *   Pass 1 accuracy per entry id, and which nights were completed. That is all.
 *
 * WHAT NEVER GOES IN — F-15, ratified Master 2026-08-11
 *   Anything from pass 2. Nothing the child writes is captured, checked,
 *   stored, marked or displayed. There is no field here for it, deliberately:
 *   the paper is the only record of what a child can produce unaided, and the
 *   teacher collects the paper.
 *
 * WHAT IT IS NEVER USED FOR — F-21
 *   Devices are shared. A phone is a family's, not a child's. So there is no
 *   greeting, no name, no streak, no "welcome back", no badge and no score:
 *   nothing a second child picks up and reads as their own. This data steers
 *   Wednesday's weakest third silently and is never rendered.
 *
 * Every read and write is wrapped. Private browsing, a full quota and a
 * storage-blocking setting all throw on plain access, and a child meeting an
 * exception because a counter could not be saved would be the worst possible
 * trade. Storage failing means the app forgets, and forgetting is survivable:
 * Wednesday falls back to a random third, which is the week-one path anyway.
 */

const KEY = 'esl_progress_v1'
const VERSION = 1

const EMPTY = { v: VERSION, items: {}, nights: {} }

function load () {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY, items: {}, nights: {} }
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.v !== VERSION) return { ...EMPTY, items: {}, nights: {} }
    return {
      v: VERSION,
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
      nights: parsed.nights && typeof parsed.nights === 'object' ? parsed.nights : {}
    }
  } catch {
    return { ...EMPTY, items: {}, nights: {} }
  }
}

function save (state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* forgetting is survivable */ }
}

/**
 * One pass 1 answer.
 *
 * `first` is whether this was the child's FIRST attempt at the item tonight.
 * Only first attempts count toward accuracy: a wrong answer does not end the
 * round, so an item retried until it is right would otherwise score 100% and
 * Wednesday would never find a weak third.
 */
export function recordAnswer (entryId, correct, first = true) {
  if (!entryId || !first) return
  const state = load()
  const rec = state.items[entryId] || { n: 0, ok: 0 }
  rec.n += 1
  if (correct) rec.ok += 1
  state.items[entryId] = rec
  save(state)
}

/** A night finished. The date key is the caller's; nothing here reads a clock. */
export function recordNight (dateKey) {
  if (!dateKey) return
  const state = load()
  state.nights[dateKey] = (state.nights[dateKey] || 0) + 1
  save(state)
}

/**
 * Pass 1 accuracy for one entry, 0..1, or null when it has never been seen.
 *
 * Null is a real answer, not a zero. `weakest-third` distinguishes them: a
 * third nobody has attempted is unranked, not failed.
 */
export function accuracyOf (entryId) {
  const rec = load().items[entryId]
  return rec && rec.n > 0 ? rec.ok / rec.n : null
}

/** Every accuracy at once, for a caller that is about to ask about a whole group. */
export function allAccuracy () {
  const items = load().items
  const out = {}
  for (const [id, rec] of Object.entries(items)) {
    if (rec && rec.n > 0) out[id] = rec.ok / rec.n
  }
  return out
}

/* ------------------------------------------------------------------ *
 * GAMES — a second key, deliberately not this one.
 *
 * A game needs to remember which levels are beaten so the next one can open.
 * That is not pass 1 accuracy and it is not a night completed, so it does not
 * belong in esl_progress_v1: that key's header promises exactly two things,
 * and a promise you extend quietly is not a promise.
 *
 * It lives here anyway, because the rule this module exists to enforce is
 * "one file writes storage", and that rule is worth more than the convenience
 * of a game keeping its own jar. One file, two keys, each saying what it is.
 *
 * F-21 STILL APPLIES AND IS NOT SETTLED HERE. Devices are shared, and a best
 * score is exactly the kind of thing a second child reads as their own. This
 * module stores it; whether a screen should ever SHOW it is a call for T, not
 * a thing to decide by writing a getter. Tiro Libre's level map currently
 * shows one.
 * ------------------------------------------------------------------ */

const GAMES_KEY = 'esl_games_v1'

function loadGames () {
  try {
    const parsed = JSON.parse(localStorage.getItem(GAMES_KEY))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** What a game remembers: { [levelId]: { done, best } }. Never null. */
export function gameLevels (gameId) {
  const all = loadGames()
  return (all[gameId] && typeof all[gameId] === 'object') ? all[gameId] : {}
}

/** One level beaten. Keeps the better score; never lowers one. */
export function recordGameLevel (gameId, levelId, score = 0) {
  if (!gameId || !levelId) return
  const all = loadGames()
  const game = (all[gameId] && typeof all[gameId] === 'object') ? all[gameId] : {}
  const prev = game[levelId] || { done: false, best: 0 }
  game[levelId] = { done: true, best: Math.max(prev.best || 0, score) }
  all[gameId] = game
  try { localStorage.setItem(GAMES_KEY, JSON.stringify(all)) } catch { /* forgetting is survivable */ }
}

/** Used by nothing in the UI. Here so a device can be handed on clean. */
export function reset () {
  try { localStorage.removeItem(KEY); localStorage.removeItem(GAMES_KEY) } catch { /* nothing to do */ }
}

export default { recordAnswer, recordNight, accuracyOf, allAccuracy, gameLevels, recordGameLevel, reset }
