const TRIGGER_URL = import.meta.env.VITE_TRIGGER_URL

function statusIcon(task) {
  if (!task.ready) return ':hourglass_flowing_sand:'
  return task.deployType === 'post-deployment setup' ? ':warning:' : ':white_check_mark:'
}

function buildDeploymentMessage(deployDate, byClient) {
  const lines = [`:rocket: Deployment plan for ${deployDate ?? 'TBD'}`, '']
  for (const [client, tasks] of Object.entries(byClient)) {
    lines.push(`*${client}*`)
    for (const task of tasks) {
      const assignee = task.assignee ? ` @${task.assignee.name.split(' ')[0]}` : ''
      const label = task.ready ? task.deployType : task.status
      lines.push(`- ${task.name} — ${statusIcon(task)} ${label}${assignee}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export async function triggerClickUpRefresh() {
  if (!TRIGGER_URL) return false
  const res = await fetch(`${TRIGGER_URL}/refresh`, { method: 'POST' })
  if (res.status === 429) return 'cooldown'
  return res.ok
}

export async function dispatchDeployment(deployDate, byClient) {
  if (!TRIGGER_URL) {
    alert('Trigger endpoint not configured yet — Slack dispatch is not wired up.')
    return false
  }
  const text = buildDeploymentMessage(deployDate, byClient)
  const res = await fetch(`${TRIGGER_URL}/dispatch-deployment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, deployDate }),
  })
  if (res.status === 409) {
    alert('Already published for this deploy date (checked server-side).')
    return false
  }
  if (!res.ok) throw new Error(`dispatch-deployment failed: ${res.status}`)
  return true
}

export async function remind(task, kind) {
  if (!TRIGGER_URL) {
    alert('Trigger endpoint not configured yet — Remind is not wired up.')
    return false
  }
  const person = kind === 'reviewer' ? task.reviewer : task.assignee
  if (!person?.email) {
    alert(`No ${kind} email found for this task.`)
    return false
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
  if (res.status === 429) {
    alert('Already reminded for this task in the last 24h (checked server-side).')
    return false
  }
  if (!res.ok) throw new Error(`nudge failed: ${res.status}`)
  return true
}
