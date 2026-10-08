import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import PassphraseGate from './PassphraseGate.jsx'
import './style.css'

createRoot(document.getElementById('root')).render(
  <PassphraseGate>
    <App />
  </PassphraseGate>,
)
