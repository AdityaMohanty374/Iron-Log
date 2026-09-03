import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { defineCustomElements as jeepSqlite } from 'jeep-sqlite/loader'
import App from './App.jsx'
import './index.css'

// jeep-sqlite provides an in-browser SQLite implementation (via IndexedDB)
// so the app runs and can be tested with `npm run dev` in a normal browser.
// On a real Android build (Capacitor.getPlatform() === 'android') this is
// skipped entirely and the native SQLite plugin is used instead.
async function bootstrap() {
  if (Capacitor.getPlatform() === 'web') {
    jeepSqlite(window)
    await customElements.whenDefined('jeep-sqlite')
    const jeepEl = document.createElement('jeep-sqlite')
    document.body.appendChild(jeepEl)
    await jeepEl.componentOnReady()
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()
