import { useEffect, useState } from 'react'
import GridScreen from './screens/GridScreen.jsx'
import LetterScreen from './screens/LetterScreen.jsx'
import LessonScreen from './screens/LessonScreen.jsx'
import GamesScreen from './screens/GamesScreen.jsx'
import { stop, unlock } from './lib/audio.js'
import { setSafe } from './lib/refresh.js'
import './styles/alphabet.css'

/**
 * Slice 1 — the alphabet, plus the way into the games.
 *
 * Screens, one at a time, back through history so the Android back button
 * lands where a child expects. Every screen change stops the audio; a clip
 * still talking over the next screen is the worst bug here.
 *
 * The games hang off the LESSON, not off the grid. A child arrives at a game
 * having just done that group's week, and the group they were working in is
 * the group the game is played in — which is why view.group travels from the
 * lesson into GamesScreen. A game owns its own screens, so this file never
 * learns what any of them are.
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

  // A release that arrived mid-lesson waits for the grid. Anywhere else is
  // somewhere a child is in the middle of. See lib/refresh.js.
  useEffect(() => { setSafe(view.name === 'grid') }, [view.name])

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
        <GridScreen
          onOpenLetter={(letter, group) => go({ name: 'letter', letter, group })}
          onOpenLesson={group => go({ name: 'lesson', group })}
        />
      )}
      {view.name === 'letter' && (
        <LetterScreen letter={view.letter} group={view.group} onBack={back} />
      )}
      {view.name === 'lesson' && (
        <LessonScreen
          group={view.group}
          onBack={back}
          onOpenGames={() => go({ name: 'games', group: view.group })}
        />
      )}
      {view.name === 'games' && (
        <GamesScreen group={view.group} onBack={back} />
      )}
    </div>
  )
}
