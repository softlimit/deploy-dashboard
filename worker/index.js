const ALLOWED_ORIGIN = 'https://softlimit.github.io'
const GITHUB_REPO = 'softlimit/deploy-dashboard'

function withCors(res) {
  res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return res
}

async function dispatchDeployment(request, env) {
  const { text } = await request.json()
  if (!text) return withCors(new Response('Missing text', { status: 400 }))

  const res = await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) return withCors(new Response(`Slack webhook failed: ${res.status}`, { status: 502 }))
  return withCors(new Response('ok'))
}

async function nudge(request, env) {
  const payload = await request.json()
  if (!payload.email) return withCors(new Response('Missing email', { status: 400 }))

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'deploy-dashboard-trigger-worker',
    },
    body: JSON.stringify({ event_type: 'nudge', client_payload: payload }),
  })
  if (!res.ok) {
    const body = await res.text()
    return withCors(new Response(`GitHub dispatch failed: ${res.status} ${body}`, { status: 502 }))
  }
  return withCors(new Response('ok'))
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))
    if (request.method !== 'POST') return withCors(new Response('Not found', { status: 404 }))

    const url = new URL(request.url)
    try {
      if (url.pathname === '/dispatch-deployment') return await dispatchDeployment(request, env)
      if (url.pathname === '/nudge') return await nudge(request, env)
    } catch (err) {
      return withCors(new Response(`Error: ${err.message}`, { status: 500 }))
    }
    return withCors(new Response('Not found', { status: 404 }))
  },
}
