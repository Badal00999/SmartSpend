/**
 * Entry point – mounts the React tree into #root.
 * StrictMode surfaces side-effect bugs in development (double-invokes effects).
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
