import { lazy, Suspense, useEffect, useState } from 'react'
import GridScreen from './screens/GridScreen.jsx'
import LetterScreen from './screens/LetterScreen.jsx'
import LessonScreen from './screens/LessonScreen.jsx'
import GamesScreen from './screens/GamesScreen.jsx'
import { stop, unlock } from './lib/audio.js'
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
 * The app.
 *
 * Two layers of navigation, deliberately kept apart:
 *
 *   THE URL decides which app you are in — the alphabet, the games index, or a
 *   game. Those are real paths, so /juegos/super-sonidos and /game-testing can
 *   be opened cold, shared, and served by the SPA fallback.
 *
 *   WITHIN the alphabet, the three screens are state, not paths, exactly as
 *   before. They still push a history entry so the Android back button lands
 *   where a child expects.
 *
 * Both listen for popstate. The alphabet's handler returns to its grid; the
 * router's re-reads the path and is a no-op when only a screen changed.
 * Every navigation stops the audio: a clip still talking over the next screen
 * is the worst bug here.
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

  useEffect(() => {
    const pop = () => { stop(); setRoute(path()) }
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, [])

  const navigate = to => {
    stop()
    history.pushState({ r: to }, '', to)
    setRoute(path())
    scrollTo(0, 0)
  }

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

  if (route === '/juegos') {
    return (
      <div className="app">
        <GamesScreen onBack={back} onOpenGame={navigate} />
      </div>
    )
  }

  return (
    <div className="app">
      <Alphabet onOpenGames={() => navigate('/juegos')} />
    </div>
  )
}

/** Slice 1 — the alphabet. Three screens, one at a time. */
function Alphabet ({ onOpenGames }) {
  const [view, setView] = useState({ name: 'grid' })

  useEffect(() => {
    const pop = () => { stop(); setView({ name: 'grid' }) }
    addEventListener('popstate', pop)
    history.replaceState({ s: 'grid' }, '')
    return () => removeEventListener('popstate', pop)
  }, [])

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
        />
      )}
      {view.name === 'letter' && (
        <LetterScreen letter={view.letter} group={view.group} onBack={back} />
      )}
      {view.name === 'lesson' && (
        <LessonScreen group={view.group} onBack={back} onOpenGames={onOpenGames} />
      )}
    </>
  )
}
