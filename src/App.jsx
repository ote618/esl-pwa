import { lazy, Suspense, useEffect, useState } from 'react'
import GridScreen from './screens/GridScreen.jsx'
import LetterScreen from './screens/LetterScreen.jsx'
import LessonScreen from './screens/LessonScreen.jsx'
import GamesScreen from './screens/GamesScreen.jsx'
import TareaScreen from './screens/TareaScreen.jsx'
import { stop, unlock } from './lib/audio.js'
import { setSafe } from './lib/refresh.js'
import './styles/alphabet.css'

/**
 * Súper Sonidos is lazy on purpose. It carries its own canvas engine and a
 * stylesheet that repaints <html> and <body> dark; neither should be fetched,
 * parsed or injected on the alphabet route, which is what almost every open is.
 */
const SuperSonidos = lazy(() => import('./games/super-sonidos/SuperSonidos.jsx'))

/* Routes are compared without a trailing slash so /juegos and /juegos/ agree. */
const path = () => {
  const p = location.pathname.replace(/\/+$/, '')
  return p === '' ? '/' : p
}

/**
 * The app. Slice 1 — the alphabet. Slice 2 — the homework. And the games.
 *
 * Two layers of navigation, deliberately kept apart:
 *
 *   THE URL is the way IN from outside — /juegos, /juegos/super-sonidos and
 *   /game-testing can be opened cold, shared, and served by the SPA fallback.
 *   /game-testing in particular has to work from a pasted link.
 *
 *   INSIDE the app, the five screens are state, not paths, and the games shelf
 *   is one of them. That is deliberate and not an oversight: the shelf is
 *   handed the group the child was just working in, so Tiro Libre is played in
 *   the letters that lesson taught. A URL cannot carry that without inventing
 *   a path for every group, so in-app navigation stays in state and the URLs
 *   remain the outside door.
 *
 * Both listen for popstate. The alphabet's handler returns to its grid; the
 * router's re-reads the path and is a no-op when only a screen changed.
 * Every navigation stops the audio: a clip still talking over the next screen
 * is the worst bug here.
 *
 * Tarea carries no group. Tonight's set is built from `gating.current` inside
 * the screen, not from whichever lesson the tap came through — see the note at
 * the top of TareaScreen.jsx.
 */
export default function App () {
  const [route, setRoute] = useState(path)

  // iOS eats audio that no gesture started. Prime the element on the very
  // first touch so the tap that opens a letter is not the one that gets eaten.
  useEffect(() => {
    const go = () => unlock()
    addEventListener('touchstart', go, { once: true, passive: true })
    addEventListener('click', go, { once: true })
    return () => {
      removeEventListener('touchstart', go)
      removeEventListener('click', go)
    }
  }, [])

  // A release that arrived mid-game is as unwelcome as one that arrived
  // mid-lesson: a reload drops a child out of the level they are playing. Any
  // route other than the app itself is "in the middle of something"; the
  // app's own answer is finer-grained and lives in Screens below.
  useEffect(() => { if (route !== '/') setSafe(false) }, [route])

  useEffect(() => {
    const pop = () => { stop(); setRoute(path()) }
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, [])

  const back = () => history.back()

  if (route === '/juegos/super-sonidos') {
    return (
      <Suspense fallback={null}>
        <SuperSonidos testMode={false} showTail={false} />
      </Suspense>
    )
  }

  // Not linked from anywhere in the UI. Reached by URL only: every set and
  // every level is open, and ?tail=1 adds the six unrecorded tail sets.
  if (route === '/game-testing') {
    return (
      <Suspense fallback={null}>
        <SuperSonidos
          testMode
          showTail={new URLSearchParams(location.search).get('tail') === '1'}
        />
      </Suspense>
    )
  }

  // The shelf reached from outside, with no lesson behind it and so no group.
  // GamesScreen falls back to the first populated one.
  if (route === '/juegos') {
    return (
      <div className="app">
        <GamesScreen onBack={back} />
      </div>
    )
  }

  return (
    <div className="app">
      <Screens />
    </div>
  )
}

/** The alphabet, its homework and its games. Five screens, one at a time. */
function Screens () {
  const [view, setView] = useState({ name: 'grid' })

  useEffect(() => {
    const pop = () => { stop(); setView({ name: 'grid' }) }
    addEventListener('popstate', pop)
    history.replaceState({ s: 'grid' }, '')
    return () => removeEventListener('popstate', pop)
  }, [])

  // A release that arrived mid-lesson waits for the grid. Anywhere else is
  // somewhere a child is in the middle of. See lib/refresh.js.
  useEffect(() => { setSafe(view.name === 'grid') }, [view.name])

  const go = next => {
    stop()
    setView(next)
    scrollTo(0, 0)
    if (next.name !== 'grid') history.pushState({ s: next.name }, '')
  }

  const back = () => history.back()

  return (
    <>
      {view.name === 'grid' && (
        <GridScreen
          onOpenLetter={(letter, group) => go({ name: 'letter', letter, group })}
          onOpenLesson={group => go({ name: 'lesson', group })}
          onOpenGames={() => go({ name: 'games' })}
        />
      )}
      {view.name === 'letter' && (
        <LetterScreen letter={view.letter} group={view.group} onBack={back} />
      )}
      {view.name === 'lesson' && (
        <LessonScreen
          group={view.group}
          onBack={back}
          onOpenTarea={() => go({ name: 'tarea' })}
          onOpenGames={() => go({ name: 'games', group: view.group })}
        />
      )}
      {view.name === 'games' && (
        <GamesScreen group={view.group} onBack={back} />
      )}
      {view.name === 'tarea' && <TareaScreen onBack={back} />}
    </>
  )
}
