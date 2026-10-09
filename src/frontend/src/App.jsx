import { useEffect, useState } from 'react'
import { dispatchDeployment, remind } from './dispatch.js'

function statusLabel(task) {
  if (task.ready) {
    return task.deployType === 'post-deployment setup'
      ? { icon: '⚠️', label: task.deployType }
      : { icon: '✅', label: task.deployType }
  }
  return { icon: '⏳', label: task.status }
}

function TaskRow({ task }) {
  const { icon, label } = statusLabel(task)
  const [sending, setSending] = useState(false)
  const person = task.remindRole === 'reviewer' ? task.reviewer : task.assignee

  async function handleRemind() {
    setSending(true)
    try {
      await remind(task, task.remindRole)
    } finally {
      setSending(false)
    }
  }

  return (
    <li className="task-row">
      <span>
        <a href={task.url} target="_blank" rel="noreferrer">
          {task.name}
        </a>
        {' — '}
        {icon} {label}
        {person ? ` ${task.ready ? '@' : '— '}${person.name.split(' ')[0]}` : ''}
      </span>
      {task.remindRole && (
        <button onClick={handleRemind} disabled={sending}>
          {sending ? 'Reminding…' : 'Remind'}
        </button>
      )}
    </li>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [date, setDate] = useState(null)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`data.json: ${res.status}`)
        return res.json()
      })
      .then((json) => {
        setData(json)
        setDate(json.defaultDate)
      })
      .catch((err) => setError(err.message))
  }, [])

  async function handlePublish() {
    setPublishing(true)
    try {
      await dispatchDeployment(date)
    } finally {
      setPublishing(false)
    }
  }

  const scheduled = data ? data.tasks.filter((t) => t.deployDate === date) : []
  const byClient = {}
  for (const task of scheduled) {
    byClient[task.client] ??= []
    byClient[task.client].push(task)
  }

  return (
    <>
      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}softlimit-logo-dark.svg`} alt="Softlimit" />
        <span>Tasks Triage Dashboard</span>
      </header>
      <main>
        {error && (
          <p>
            Couldn't load data.json ({error}). Run <code>npm run build:data</code> first.
          </p>
        )}
        {!error && !data && <p>Loading…</p>}
        {data && (
          <>
            <div className="tab-toolbar">
              <label>
                Deployment date{' '}
                <input type="date" value={date ?? ''} onChange={(e) => setDate(e.target.value)} />
              </label>
              <button onClick={handlePublish} disabled={publishing}>
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            </div>
            {scheduled.length === 0 && <p>No tasks scheduled for this date.</p>}
            {Object.entries(byClient).map(([client, clientTasks]) => (
              <section key={client}>
                <h2>{client}</h2>
                <ul>
                  {clientTasks.map((task) => (
                    <TaskRow key={task.url} task={task} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </main>
    </>
  )
}
