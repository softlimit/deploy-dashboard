import { useEffect, useState } from 'react'
import { dispatchDeployment, remind } from './dispatch.js'

const TABS = ['Deployment', 'In Revision', 'In Review Q/A']

function statusLabel(task) {
  if (!task.ready) return { icon: '⏳', label: task.status }
  if (task.deployType === 'post-deployment setup') return { icon: '⚠️', label: task.deployType }
  return { icon: '✅', label: task.deployType }
}

function DeploymentTab({ deployment }) {
  const { deployDate, clients: byClient } = deployment
  const [sending, setSending] = useState(false)

  async function handleDispatch() {
    setSending(true)
    try {
      await dispatchDeployment(deployDate)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="tab-toolbar">
        <h1>Deployment plan — {deployDate ?? 'TBD'}</h1>
        <button onClick={handleDispatch} disabled={sending}>
          {sending ? 'Publishing…' : 'Publish'}
        </button>
      </div>
      {Object.entries(byClient).map(([client, tasks]) => (
        <section key={client}>
          <h2>{client}</h2>
          <ul>
            {tasks.map((task) => {
              const { icon, label } = statusLabel(task)
              return (
                <li key={task.url}>
                  <a href={task.url} target="_blank" rel="noreferrer">
                    {task.name}
                  </a>
                  {' — '}
                  {icon} {label}
                  {task.assignee ? ` @${task.assignee.name.split(' ')[0]}` : ''}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

function RemindTab({ title, data, personKind }) {
  const { clients: byClient } = data
  const [sendingUrl, setSendingUrl] = useState(null)

  async function handleRemind(task) {
    setSendingUrl(task.url)
    try {
      await remind(task, personKind)
    } finally {
      setSendingUrl(null)
    }
  }

  const empty = Object.keys(byClient).length === 0

  return (
    <>
      <h1>{title}</h1>
      {empty && <p>No tasks found.</p>}
      {Object.entries(byClient).map(([client, tasks]) => (
        <section key={client}>
          <h2>{client}</h2>
          <ul>
            {tasks.map((task) => {
              const person = personKind === 'reviewer' ? task.reviewer : task.assignee
              return (
                <li key={task.url} className="task-row">
                  <span>
                    <a href={task.url} target="_blank" rel="noreferrer">
                      {task.name}
                    </a>
                    {person ? ` — ${person.name}` : ''}
                  </span>
                  <button onClick={() => handleRemind(task)} disabled={sendingUrl === task.url}>
                    {sendingUrl === task.url ? 'Reminding…' : 'Remind'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState(TABS[0])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`data.json: ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <>
      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}softlimit-logo-dark.svg`} alt="Softlimit" />
        <span>Tasks Triage Dashboard</span>
      </header>
      <nav className="tab-nav">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <main>
        {error && (
          <p>
            Couldn't load data.json ({error}). Run <code>npm run build:data</code> first.
          </p>
        )}
        {!error && !data && <p>Loading…</p>}
        {data && tab === 'Deployment' && <DeploymentTab deployment={data.deployment} />}
        {data && tab === 'In Revision' && (
          <RemindTab title="In Revision" data={data.inRevision} personKind="assignee" />
        )}
        {data && tab === 'In Review Q/A' && (
          <RemindTab title="In Review Q/A" data={data.inReview} personKind="reviewer" />
        )}
      </main>
    </>
  )
}
