const ALLOWED_ORIGIN = 'https://softlimit.github.io'
const GITHUB_REPO = 'softlimit/deploy-dashboard'

function withCors(res) {
  res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return res
}

const REMIND_COOLDOWN_SECONDS = 24 * 60 * 60
const REFRESH_COOLDOWN_SECONDS = 2 * 60

async function triggerGithubDispatch(eventType, clientPayload, env) {
  return fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'deploy-dashboard-trigger-worker',
    },
    body: JSON.stringify({ event_type: eventType, client_payload: clientPayload }),
  })
}

async function refresh(request, env) {
  const guardKey = 'refresh:last'
  if (await env.GUARD_KV.get(guardKey)) {
    return withCors(new Response('A refresh was already triggered recently, try again shortly', { status: 429 }))
  }

  const res = await triggerGithubDispatch('refresh', {}, env)
  if (!res.ok) {
    const body = await res.text()
    return withCors(new Response(`GitHub dispatch failed: ${res.status} ${body}`, { status: 502 }))
  }

  await env.GUARD_KV.put(guardKey, String(Date.now()), { expirationTtl: REFRESH_COOLDOWN_SECONDS })
  return withCors(new Response('ok'))
}

async function dispatchDeployment(request, env) {
  const { text, deployDate } = await request.json()
  if (!text) return withCors(new Response('Missing text', { status: 400 }))

  if (deployDate) {
    const guardKey = `publish:${deployDate}`
    if (await env.GUARD_KV.get(guardKey)) {
      return withCors(new Response('Already published for this date', { status: 409 }))
    }
  }

  const res = await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) return withCors(new Response(`Slack webhook failed: ${res.status}`, { status: 502 }))

  if (deployDate) await env.GUARD_KV.put(`publish:${deployDate}`, String(Date.now()))
  return withCors(new Response('ok'))
}

async function nudge(request, env) {
  const payload = await request.json()
  if (!payload.email || !payload.taskUrl) {
    return withCors(new Response('Missing email or taskUrl', { status: 400 }))
  }

  const guardKey = `remind:${payload.taskUrl}`
  if (await env.GUARD_KV.get(guardKey)) {
    return withCors(new Response('Already reminded for this task in the last 24h', { status: 429 }))
  }

  const res = await triggerGithubDispatch('nudge', payload, env)
  if (!res.ok) {
    const body = await res.text()
    return withCors(new Response(`GitHub dispatch failed: ${res.status} ${body}`, { status: 502 }))
  }

  await env.GUARD_KV.put(guardKey, String(Date.now()), { expirationTtl: REMIND_COOLDOWN_SECONDS })
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
      if (url.pathname === '/refresh') return await refresh(request, env)
    } catch (err) {
      return withCors(new Response(`Error: ${err.message}`, { status: 500 }))
    }
    return withCors(new Response('Not found', { status: 404 }))
  },
}
