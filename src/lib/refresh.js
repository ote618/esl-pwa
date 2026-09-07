/**
 * Applying a release, not just finding one.
 *
 * main.jsx already asks the browser to LOOK for a new worker on launch and
 * whenever the app comes back to the front. That half worked. What was
 * missing is the other half: a service worker cannot rewrite JavaScript that
 * is already running, so the session that discovers a release keeps running
 * the old one and the new build only appears on the NEXT launch.
 *
 * For a child — or a parent who will never be told to clear a cache, and
 * should never have to be — "open it twice" is not a release mechanism. So
 * the page reloads itself. The only question is when.
 *
 * NEVER MID-ACTIVITY. A reload part-way through a lesson video, a night's
 * homework or a penalty kick is worse than a stale build: the child loses what
 * they were doing and nothing on screen explains why. So a pending reload
 * waits for a moment where nothing is lost:
 *
 *   1. the app is sitting on the grid, or
 *   2. the app has just been backgrounded — reload behind their back, and
 *      what they come back to is simply the new version
 *
 * Anything a screen has saved lives in localStorage and survives a reload;
 * only the current screen is lost, which is why "on the grid" counts as free.
 */

/* Was this page already under a worker when it loaded? If not, the first
 * controllerchange is just the very first registration claiming the page —
 * that is not a release, and reloading on it would make every first visit
 * load twice for nothing. */
const hadController = typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  !!navigator.serviceWorker.controller

let pending = false   // a new worker has taken over; the running code is stale
let safe = true       // nothing on screen would be lost by reloading now
let done = false      // one reload per session, whatever happens

function apply () {
  if (!pending || !safe || done) return
  done = true
  location.reload()
}

/**
 * Called by App on every view change. Anything that is not the grid — a
 * letter, a lesson, a game — is a place a child is in the middle of.
 */
export function setSafe (isSafe) {
  safe = isSafe
  apply()
}

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return
    pending = true
    apply()
  })

  // Backgrounded with a release waiting: reload now, unseen. This is the path
  // that catches a child who is deep in something and then puts the phone
  // down — by the time they look again it is the new build, nothing interrupted.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pending && !done) {
      done = true
      location.reload()
    }
  })
}
