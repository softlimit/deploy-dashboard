import { useEffect, useState } from 'react'

const STORAGE_KEY = 'deploy-dashboard-unlocked'
const PASSPHRASE_HASH = '66beaa388fe7e53da5ebbb6d802e860119728e9e69625edc83c5d5d5315d77c6'

async function sha256(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function isUnlocked() {
  return sessionStorage.getItem(STORAGE_KEY) === 'true'
}

export default function PassphraseGate({ children }) {
  const [unlocked, setUnlocked] = useState(false)
  const [ready, setReady] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setUnlocked(isUnlocked())
    setReady(true)
  }, [])

  if (!ready) return null
  if (unlocked) return children

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if ((await sha256(value.trim())) === PASSPHRASE_HASH) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
      setUnlocked(true)
    } else {
      setError('Incorrect passphrase.')
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 320, margin: '80px auto', padding: 24 }}>
      <form onSubmit={handleSubmit}>
        <h1 style={{ fontSize: 20 }}>Deploy Dashboard</h1>
        <p style={{ fontSize: 13, color: '#666' }}>
          This is a basic deterrent, not real security — this page's code and data are both
          publicly reachable to anyone with the link.
        </p>
        <label htmlFor="passphrase">Enter passphrase to continue</label>
        <input
          id="passphrase"
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ display: 'block', width: '100%', margin: '8px 0' }}
        />
        {error && <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div>}
        <button type="submit">Unlock</button>
      </form>
    </div>
  )
}
