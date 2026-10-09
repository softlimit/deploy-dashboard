# Deployment Dashboard

Replaces the weekly deployment plan that used to be copied by hand from a
ClickUp view into Slack. Live at:

**https://softlimit.github.io/deploy-dashboard/**

## What it does

Every Monday's deploy batch (and the surrounding revision/review work) lives
in one ClickUp view. This dashboard:

1. Pulls that view's tasks via the ClickUp API
2. Groups them by client, labels each by deploy readiness (ready to deploy,
   needs post-deployment setup, still in revision/review, or already
   deployed — color-coded yellow/pink/green on the page)
3. Lets you **Publish** the deployment plan to the dev Slack channel with
   one click, and **Remind** an individual task's assignee or reviewer via a
   direct Slack DM
4. Rebuilds automatically on a schedule (weekdays) and on-demand via the
   page's **Refresh** button

## Architecture

```
ClickUp API
   │
   ▼
GitHub Actions (refresh-and-deploy.yml)
   │  npm run build:data → data/data.json
   │  npm run build      → static React dashboard
   ▼
GitHub Pages (softlimit.github.io/deploy-dashboard)
   │
   │  Publish / Remind / Refresh button clicks
   ▼
Cloudflare Worker (deploy-dashboard-trigger)
   │  holds the Slack webhook + a GitHub token, never exposed to the browser
   ├─→ Slack Incoming Webhook (Publish → dev channel)
   └─→ GitHub repository_dispatch → Actions workflow (Remind DM / forced refresh)
            │
            ▼
       Slack Bot API (chat.postMessage as a real 1:1 DM)
```

The dashboard itself is a static site (Vite/React) — it has no backend of
its own. Anything that needs a secret (ClickUp token, Slack webhook, Slack
bot token, GitHub token) goes through either GitHub Actions secrets or the
Cloudflare Worker's secrets, never into the client bundle.

### Why a Worker at all?

A static GitHub Pages site can't safely hold the Slack webhook URL or make
authenticated GitHub API calls client-side. The Worker is a thin, public
endpoint whose *only* job is to relay two things:

- **Publish** → posts directly to the Slack webhook (holds `SLACK_WEBHOOK_URL`)
- **Remind** / **Refresh** → fires a `repository_dispatch` event on this repo
  using a narrowly-scoped GitHub token, which the matching GitHub Actions
  workflow picks up and executes (DM send or ClickUp re-pull) using secrets
  that live only in GitHub, never in the Worker or the browser

### Guards

- **Remind**: once per task per 24h, enforced server-side via Cloudflare KV
  (not just browser `localStorage` — works across devices/browsers)
- **Publish**: only enabled Friday afternoon/evening (≥ noon US Eastern)
  before the Monday deploy, and only once per deploy date — also enforced
  via KV, not just the UI
- **Refresh** (re-pulling ClickUp): capped to once per 2 minutes to avoid
  hammering the Actions workflow

## Repo layout

```
src/
  api/clickupClient.js       ClickUp "get view tasks" API wrapper
  build/build-data.js        fetch + shape ClickUp data -> data/data.json
  build/format-slack.js      CLI preview of the Publish Slack message
  build/send-nudge.js        sends one Remind DM (run inside the nudge.yml workflow)
  frontend/                  the Vite/React dashboard (App.jsx, dispatch.js, style.css)
worker/
  index.js                   Cloudflare Worker: /dispatch-deployment, /nudge, /refresh
  wrangler.toml
.github/workflows/
  refresh-and-deploy.yml     fetch ClickUp, build, deploy to Pages (schedule/push/manual/repository_dispatch)
  nudge.yml                  sends a Remind DM (repository_dispatch: nudge)
```

## Local development

```
npm install
cp .env.example .env
# fill in CLICKUP_API_TOKEN (ClickUp > Settings > Apps) and CLICKUP_VIEW_ID
npm run build:data   # pulls live ClickUp data -> data/data.json
npm run dev          # Vite dev server
npm run format:slack # preview the Publish message in the terminal
```

Deploying changes to the live site is just `git push` to `main` — the
GitHub Actions workflow handles rebuild + Pages deploy. Changes to
`worker/index.js` need a separate `cd worker && npx wrangler deploy`.

## Known trade-offs (worth revisiting)

- The Worker's GitHub token is currently a broad personal `gh auth token`
  rather than a narrowly-scoped, repo-specific PAT — fine for now, but
  should be swapped before this becomes a daily-use tool for the whole team.
- The ClickUp → client-code mapping (`CLIENT` custom field) and the
  post-deploy-setup detection (`post deploy setup` status OR the
  `post-deploy set up required` tag) are specific to how the team currently
  tags tasks; if that convention changes, `src/build/build-data.js` needs a
  matching update.
- No automated tests yet.
