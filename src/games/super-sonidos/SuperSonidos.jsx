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
 */
export default function SuperSonidos ({ testMode = false, showTail = false }) {
  const root = useRef(null)

  useEffect(() => {
    // Shell-only builds proxy media from production, the same way the rest of
    // the app does. Set before the script starts: it reads this once.
    window.SS_MEDIA_BASE = import.meta.env.VITE_MEDIA_BASE || ''

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
      <div className={'supersonidos' + (testMode ? ' test' : '')} ref={root}>
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
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="k" id="left">◀</button>
            <button className="k" id="right">▶</button>
          </div>
          <button className="k" id="jump">SALTA</button>
        </div>
        <div id="note">POC · voz del navegador — el audio real del registro se conecta por ID de entrada</div>
      </div>
    </>
  )
}
