import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/**
 * Keep the worker honest about releases.
 *
 * vite-plugin-pwa registers the worker and its `autoUpdate` worker calls
 * skipWaiting, but nothing asks the browser to LOOK for a new one. Left alone
 * browsers re-check sw.js roughly once a day, which on a release timed to a
 * Friday means a class can open Monday still running last week's app.
 *
 * So: check on launch, and again whenever the tab comes back to the front.
 * update() is cheap — a conditional request for one file — and a no-op when
 * nothing has changed.
 */
if ('serviceWorker' in navigator) {
  const check = () => navigator.serviceWorker.getRegistration()
    .then(reg => reg && reg.update())
    .catch(() => {})            // offline, or no worker yet — never surface this
  window.addEventListener('load', check)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
