import { useEffect, useState } from 'react'
import GridScreen from './screens/GridScreen.jsx'
import LetterScreen from './screens/LetterScreen.jsx'
import LessonScreen from './screens/LessonScreen.jsx'
import GamesScreen from './screens/GamesScreen.jsx'
import { stop, unlock } from './lib/audio.js'
import './styles/alphabet.css'

/**
 * Slice 1 — the alphabet, plus the way into the games.
 *
 * Screens, one at a time, back through history so the Android back button
 * lands where a child expects. Every screen change stops the audio; a clip
 * still talking over the next screen is the worst bug here.
 *
 * The games shelf hangs off the grid and nothing else. A game owns its own
 * screens, so this file never learns what any of them are — it hands
 * GamesScreen the back button and stays out of the way.
 */
export default function App () {
  const [view, setView] = useState({ name: 'grid' })

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
    <div className="app">
      {view.name === 'grid' && (
        <>
          <GridScreen
            onOpenLetter={(letter, group) => go({ name: 'letter', letter, group })}
            onOpenLesson={group => go({ name: 'lesson', group })}
          />
          {/* The door to the games, at the foot of the grid rather than in
              it, so the alphabet screens stay exactly as Slice 1 shipped. */}
          <nav style={NAV}>
            <button className="enter" onClick={() => go({ name: 'games' })}>
              Juegos →
            </button>
          </nav>
        </>
      )}
      {view.name === 'letter' && (
        <LetterScreen letter={view.letter} group={view.group} onBack={back} />
      )}
      {view.name === 'lesson' && (
        <LessonScreen group={view.group} onBack={back} />
      )}
      {view.name === 'games' && (
        <GamesScreen onBack={back} />
      )}
    </div>
  )
}

/* One rule, one file. Not worth a class in alphabet.css for a single bar. */
const NAV = {
  padding: '0 18px calc(22px + env(safe-area-inset-bottom))',
  textAlign: 'center'
}
