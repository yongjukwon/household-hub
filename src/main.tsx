import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply a previously-persisted manual theme choice before the first paint;
// no stored value (or "auto") means follow the OS via prefers-color-scheme.
const storedTheme = localStorage.getItem('theme')
if (storedTheme === 'light' || storedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', storedTheme)
}

// Keyboard-aware viewport. The iOS soft keyboard shrinks the *visual* viewport
// but not dvh/vh (the layout viewport), so a full-height fixed dialog ends up
// partly hidden behind the keyboard. Mirror the visual viewport's height and
// top offset into CSS vars so dialogs can size/center to the space actually
// visible above the keyboard.
const vv = window.visualViewport
if (vv) {
  const syncViewport = () => {
    const root = document.documentElement.style
    root.setProperty('--vvh', `${vv.height}px`)
    root.setProperty('--vv-top', `${vv.offsetTop}px`)
  }
  vv.addEventListener('resize', syncViewport)
  vv.addEventListener('scroll', syncViewport)
  syncViewport()
}

// A lazily-imported route chunk failing to load is almost always a stale
// content hash after a deploy: the old app shell requests a filename that no
// longer exists, the SPA rewrite returns index.html, and the browser rejects
// "text/html" as a script. Recover by reloading once (throttled to avoid loops)
// to pick up the current asset manifest, instead of hard-crashing.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const key = 'chunk-reload-at'
  const last = Number(sessionStorage.getItem(key) ?? 0)
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(key, String(Date.now()))
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
