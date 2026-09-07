import { useEffect, useState } from 'react'
import GridScreen from './screens/GridScreen.jsx'
import LetterScreen from './screens/LetterScreen.jsx'
import LessonScreen from './screens/LessonScreen.jsx'
import TareaScreen from './screens/TareaScreen.jsx'
import GamesScreen from './screens/GamesScreen.jsx'
import { stop, unlock } from './lib/audio.js'
import { setSafe } from './lib/refresh.js'
import './styles/alphabet.css'

/**
 * Slice 1 — the alphabet. Slice 2 — the homework. And the games.
 *
 * Five screens now, one at a time, back through history so the Android back
 * button lands where a child expects. Every screen change stops the audio;
 * a clip still talking over the next screen is the worst bug here.
 *
 * Tarea and the games hang off the same lesson but take opposite things from
 * it. Tarea carries NO group: tonight's set is built from `gating.current`
 * inside the screen, not from whichever lesson the tap came through — see the
 * note at the top of TareaScreen.jsx. A game carries the group, because it is
 * played in the letters that lesson just taught.
 *
 * A game owns its own screens, so this file never learns what any of them are.
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
          onOpenTarea={() => go({ name: 'tarea' })}
          onOpenGames={() => go({ name: 'games', group: view.group })}
        />
      )}
      {view.name === 'games' && (
        <GamesScreen group={view.group} onBack={back} />
      )}
      {view.name === 'tarea' && <TareaScreen onBack={back} />}
    </div>
  )
}
