import { useEffect, useState } from 'react'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`data.json: ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <p style={{ fontFamily: 'sans-serif', padding: 24 }}>
        Couldn't load data.json ({error}). Run <code>npm run build:data</code> first.
      </p>
    )
  }

  if (!data) {
    return <p style={{ fontFamily: 'sans-serif', padding: 24 }}>Loading…</p>
  }

  const { deployDate, clients: byClient } = data

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>Deployment plan — {deployDate ?? 'TBD'}</h1>
      {Object.entries(byClient).map(([client, tasks]) => (
        <section key={client} style={{ marginBottom: 24 }}>
          <h2>{client}</h2>
          <ul>
            {tasks.map((task) => (
              <li key={task.url}>
                <a href={task.url} target="_blank" rel="noreferrer">
                  {task.name}
                </a>
                {' — '}
                {!task.ready ? '⏳' : task.deployType === 'post-deployment setup' ? '⚠️' : '✅'}{' '}
                {task.ready ? task.deployType : task.status}
                {task.assignee ? ` @${task.assignee}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
