const TRIGGER_URL = import.meta.env.VITE_TRIGGER_URL

export async function dispatchDeployment(deployDate) {
  if (!TRIGGER_URL) {
    alert('Trigger endpoint not configured yet — Slack dispatch is not wired up.')
    return
  }
  const res = await fetch(`${TRIGGER_URL}/dispatch-deployment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deployDate }),
  })
  if (!res.ok) throw new Error(`dispatch-deployment failed: ${res.status}`)
}

export async function nudge(task, kind) {
  if (!TRIGGER_URL) {
    alert('Trigger endpoint not configured yet — Nudge is not wired up.')
    return
  }
  const person = kind === 'reviewer' ? task.reviewer : task.assignee
  if (!person?.email) {
    alert(`No ${kind} email found for this task.`)
    return
  }
  const res = await fetch(`${TRIGGER_URL}/nudge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskName: task.name,
      taskUrl: task.url,
      client: task.client,
      kind,
      email: person.email,
      name: person.name,
    }),
  })
  if (!res.ok) throw new Error(`nudge failed: ${res.status}`)
}
