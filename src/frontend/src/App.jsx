import { useEffect, useState } from 'react'
import { dispatchDeployment, remind, triggerClickUpRefresh } from './dispatch.js'

const REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000
const REMIND_STORAGE_PREFIX = 'remind-sent:'
const PUBLISH_STORAGE_PREFIX = 'publish-sent:'

function lastRemindTime(url) {
  const v = localStorage.getItem(REMIND_STORAGE_PREFIX + url)
  return v ? Number(v) : null
}

// "Noon" is evaluated in US Eastern time regardless of the viewer's own
// timezone, so the window is consistent no matter who opens the page.
function nowInEastern() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  const hour = get('hour')
  return { year: get('year'), month: get('month'), day: get('day'), hour: hour === 24 ? 0 : hour }
}

// Publish is only meant to go out once, Friday afternoon/night before the
// Monday deploy (deploy date minus 3 days, Eastern time >= noon).
function isPublishWindowOpen(deployDateStr) {
  if (!deployDateStr) return false
  const deploy = new Date(`${deployDateStr}T00:00:00`)
  const friday = new Date(deploy)
  friday.setDate(friday.getDate() - 3)
  const { year, month, day, hour } = nowInEastern()
  const sameDay = year === friday.getFullYear() && month === friday.getMonth() + 1 && day === friday.getDate()
  return sameDay && hour >= 12
}

function alreadyPublished(deployDateStr) {
  return localStorage.getItem(PUBLISH_STORAGE_PREFIX + deployDateStr) === 'true'
}

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
  const [lastSent, setLastSent] = useState(() => lastRemindTime(task.url))
  const person = task.remindRole === 'reviewer' ? task.reviewer : task.assignee
  const onCooldown = lastSent && Date.now() - lastSent < REMIND_COOLDOWN_MS

  async function handleRemind() {
    setSending(true)
    try {
      const sent = await remind(task, task.remindRole)
      if (sent) {
        localStorage.setItem(REMIND_STORAGE_PREFIX + task.url, String(Date.now()))
        setLastSent(Date.now())
      }
    } finally {
      setSending(false)
    }
  }

  const rowClass = task.deployed ? 'deployed' : task.ready ? 'ready' : task.remindRole ? 'pending' : ''

  return (
    <li className={`task-row ${rowClass}`}>
      <span>
        <a href={task.url} target="_blank" rel="noreferrer">
          {task.name}
        </a>
        {' — '}
        {icon} {label}
        {person ? ` ${task.ready ? '@' : '— '}${person.name.split(' ')[0]}` : ''}
      </span>
      {task.remindRole && (
        <button onClick={handleRemind} disabled={sending || onCooldown}>
          {sending ? 'Reminding…' : onCooldown ? 'Reminded' : 'Remind'}
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
  const [refreshing, setRefreshing] = useState(false)
  const [clientFilter, setClientFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  function loadData() {
    return fetch(`${import.meta.env.BASE_URL}data.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`data.json: ${res.status}`)
        return res.json()
      })
      .then((json) => {
        setData(json)
        setDate((prev) => prev ?? json.defaultDate)
        setError(null)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const triggered = await triggerClickUpRefresh()
      if (triggered === true) {
        alert('Triggered a fresh pull from ClickUp — takes about a minute. Click Refresh again shortly to see it.')
      } else if (triggered === 'cooldown') {
        alert('A ClickUp refresh was just triggered recently — showing the latest available snapshot for now.')
      }
      await loadData()
    } finally {
      setRefreshing(false)
    }
  }

  const scheduled = data ? data.tasks.filter((t) => t.deployDate === date) : []
  const clientOptions = [...new Set(scheduled.map((t) => t.client))].sort()
  const statusOptions = [...new Set(scheduled.map((t) => t.status))].sort()

  const filtered = scheduled.filter(
    (t) =>
      (clientFilter === 'all' || t.client === clientFilter) &&
      (statusFilter === 'all' || t.status === statusFilter),
  )

  const byClient = {}
  for (const task of filtered) {
    byClient[task.client] ??= []
    byClient[task.client].push(task)
  }

  const publishWindowOpen = isPublishWindowOpen(date)
  const publishDone = date ? alreadyPublished(date) : false

  async function handlePublish() {
    const fullByClient = {}
    for (const task of scheduled) {
      fullByClient[task.client] ??= []
      fullByClient[task.client].push(task)
    }
    setPublishing(true)
    try {
      const sent = await dispatchDeployment(date, fullByClient)
      if (sent) localStorage.setItem(PUBLISH_STORAGE_PREFIX + date, 'true')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}softlimit-logo-dark.svg`} alt="Softlimit" />
        <span>Deployment Dashboard</span>
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
            <p className="app-intro">
              Deployment-ready tasks, revisions, and reviews pulled from ClickUp, grouped by
              client, with one-click Slack follow-ups.
            </p>
            <p className="entry-count">
              Showing {filtered.length} of {scheduled.length} tasks across{' '}
              {Object.keys(byClient).length} clients for {date}
            </p>
            <div className="tab-toolbar">
              <span className="filters">
                <label>
                  Deployment date{' '}
                  <input type="date" value={date ?? ''} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label>
                  Client{' '}
                  <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
                    <option value="all">All clients</option>
                    {clientOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status{' '}
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All statuses</option>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </span>
              <span className="publish-controls">
                <button onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing || publishDone || !publishWindowOpen}
                >
                  {publishing ? 'Publishing…' : publishDone ? 'Published' : 'Publish'}
                </button>
                {!publishDone && !publishWindowOpen && (
                  <span className="publish-hint">
                    Opens Friday afternoon before this deploy date
                  </span>
                )}
              </span>
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
