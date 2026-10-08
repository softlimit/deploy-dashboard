const token = process.env.SLACK_BOT_TOKEN
const email = process.env.NUDGE_EMAIL
const name = process.env.NUDGE_NAME
const taskName = process.env.NUDGE_TASK_NAME
const taskUrl = process.env.NUDGE_TASK_URL
const client = process.env.NUDGE_CLIENT
const kind = process.env.NUDGE_KIND

if (!token || !email) {
  console.error('Missing SLACK_BOT_TOKEN or NUDGE_EMAIL.')
  process.exit(1)
}

async function slack(method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`${method} failed: ${json.error}`)
  return json
}

const lookup = await slack('users.lookupByEmail', { email })
const userId = lookup.user.id

const im = await slack('conversations.open', { users: userId })
const channel = im.channel.id

const roleLabel = kind === 'reviewer' ? 'review' : 'finish'
const text = `:wave: Hey ${name?.split(' ')[0] ?? ''} — nudge on a ${client} task you need to ${roleLabel}: <${taskUrl}|${taskName}>`

await slack('chat.postMessage', { channel, text })

console.log(`Nudged ${name} (${email}) about "${taskName}"`)
