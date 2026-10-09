const token = process.env.SLACK_BOT_TOKEN
const channel = process.env.SLACK_CHANNEL_ID
const deployDate = process.env.PUBLISH_DEPLOY_DATE
const viewUrl = process.env.PUBLISH_VIEW_URL
const byClient = JSON.parse(process.env.PUBLISH_BY_CLIENT || '{}')

if (!token || !channel) {
  console.error('Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID.')
  process.exit(1)
}

async function slack(method, params) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`${method} failed: ${json.error}`)
  return json
}

const slackIdByEmail = new Map()

async function mentionFor(email) {
  if (!email) return null
  if (slackIdByEmail.has(email)) return slackIdByEmail.get(email)
  try {
    const lookup = await slack('users.lookupByEmail', { email })
    slackIdByEmail.set(email, lookup.user.id)
    return lookup.user.id
  } catch {
    slackIdByEmail.set(email, null)
    return null
  }
}

const titleLink = viewUrl ? ` - ${viewUrl}` : ''
const lines = [`:rocket: Deployment plan for ${deployDate ?? 'TBD'}${titleLink}`, '']

for (const [client, tasks] of Object.entries(byClient)) {
  lines.push(`*${client}*`)
  for (const task of tasks) {
    const link = `<${task.url}|${task.name}>`
    if (task.needsPostDeploySetup) {
      const userId = await mentionFor(task.assignee?.email)
      const mention = userId ? ` <@${userId}>` : task.assignee ? ` @${task.assignee.name}` : ''
      lines.push(`- ${link} — :warning: post-deployment setup${mention}`)
    } else {
      lines.push(`- ${link} — :white_check_mark: no post-deployment setup required`)
    }
  }
  lines.push('')
}

const text = lines.join('\n')
await slack('chat.postMessage', { channel, text })

console.log(`Published deployment plan for ${deployDate} to channel ${channel}`)
