import { useEffect, useRef } from 'react'
import { startSuperSonidos } from './game.js'
import './SuperSonidos.css'

/**
 * SÚPER SONIDOS — the mount point.
 *
 * The game is a plain canvas script that owns its own DOM. React's job here is
 * to put the markup on the page, hand the script its root, and take everything
 * back down again — the loop, the listeners, the timers — when the route
 * changes. Nothing about the game is re-implemented in React, and no prop
 * change re-runs it: `testMode` and `showTail` are read once, at start, exactly
 * as the standalone file read the URL once at load.
 *
 * Progress lives under `supersonidos_v1` in localStorage, the same key the
 * standalone build used, so a child's progress survives this move.
 *
 * `onBack` is for when the game is MOUNTED rather than routed — the games
 * shelf hands each game { group, onBack } and swaps it in without changing the
 * URL, so there is no browser back button to lean on. Given the prop, the game
 * grows a way out; on its own route it does not need one and does not get one.
 */
export default function SuperSonidos ({ testMode = false, showTail = false, onBack }) {
  const root = useRef(null)

  useEffect(() => {
    // No media base is set here. The game's audio runs through src/lib/audio.js
    // now, which resolves clips from the registry exactly as the rest of the app
    // does — and the rest of the app has no VITE_MEDIA_BASE indirection at all.
    // A knob that nothing reads is worse than no knob: it implies a capability
    // the app does not have.

    // The game wants the whole page dark and unscrollable. Scoped to the time
    // it is mounted so the alphabet screens get their own page back.
    const lock = 'supersonidos-lock'
    document.documentElement.classList.add(lock)
    document.body.classList.add(lock)

    const stop = startSuperSonidos(root.current, { testMode, showTail })
    return () => {
      stop()
      document.documentElement.classList.remove(lock)
      document.body.classList.remove(lock)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {testMode && (
        <div className="supersonidos-testbanner">
          MODO PRUEBA — no es la versión para niños
        </div>
      )}
      {onBack && (
        <div className="supersonidos-backbar">
          <button type="button" onClick={onBack}>← Volver</button>
        </div>
      )}
      <div
        className={'supersonidos' + (testMode ? ' test' : '') + (onBack ? ' hasback' : '')}
        ref={root}
      >
        <div id="hud">
          <button id="menu">☰</button>
          <div id="prompt">—</div>
          <button id="say">🔊</button>
          <div className="pill" id="lives">♥♥♥</div>
          <div className="pill" id="score">0</div>
        </div>
        <div id="stage">
          <canvas id="cv" width="400" height="240"></canvas>
          <div id="over">
            <h1 id="ovh">¡GOL!</h1>
            <p id="ovp"></p>
            <div className="row">
              <button className="btn alt" id="ovmap">Mapa</button>
              <button className="btn" id="ovnext">Siguiente</button>
            </div>
          </div>
          <div id="screen"></div>
        </div>
        <div id="pad">
          <div className="cluster">
            <button className="k" id="left">◀</button>
            <button className="k" id="right">▶</button>
          </div>
          <div className="updown">
            <button className="k" id="up">▲</button>
            <button className="k" id="down">▼</button>
          </div>
        </div>
        <div id="note">POC · voz del navegador — el audio real del registro se conecta por ID de entrada</div>
      </div>
    </>
  )
}
