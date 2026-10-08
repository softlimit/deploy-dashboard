# Deploy Dashboard

Automates the weekly deployment plan that used to be copied by hand from a
ClickUp view into Slack. Architecture is adapted from
[`bugherd-triage`](https://github.com/softlimit/bugherd-triage): a scheduled
pull from the source API, a build step that shapes the data, and a static
report published from the result. No Claude-escalation/dedup step here —
ClickUp task data is already clean, there's just a formatting step.

## Status: schema discovery

Before the build/format/frontend pieces can be finished, we need to see what
a real ClickUp task in the deploy view actually looks like — specifically
which fields carry:

- client/list name (e.g. `BIO`, `DRAKE`)
- the task title as it appears in the Slack message (e.g. `[UI Ext] Bioelements — verify <64kb`)
- deploy type: `:warning: app deployment`, `:warning: post-deployment setup`, or `:white_check_mark: no post-deployment setup required`
- the assignee shown as `@Renan` / `@Jahiker` / `@Celso` for warning rows

These are very likely ClickUp custom fields (dropdown + assignee), not
built-in task properties, so field IDs need to come from a live API call
rather than guessing.

### Run the inspection script

```
npm install
cp .env.example .env
# fill in CLICKUP_API_TOKEN (personal token from ClickUp > Settings > Apps)
# CLICKUP_VIEW_ID is pre-filled from the "next deployment" view URL
npm run inspect:view
```

This writes `data/raw-sample.json` (gitignored — may contain client task
details) and prints the custom field structure of the first task. Once we've
seen that shape, `src/build/build-data.js` and the Slack formatter can be
written against real field IDs instead of guesses.

## Planned pieces (not yet built)

- `src/build/build-data.js` — fetch view, group by client, shape into
  `data.json` for the frontend.
- `src/build/format-slack.js` — render the same grouped data as the
  `:rocket: Deployment plan for <date>` Slack message, optionally posting via
  `SLACK_WEBHOOK_URL` instead of copy/paste.
- `src/frontend/` — static dashboard (Vite/React) showing the current
  deploy plan and status, published to GitHub Pages.
- GitHub Actions workflow — scheduled refresh + Pages publish, same pattern
  as `bugherd-triage`'s `refresh-and-deploy.yml`.
- Optional Cloudflare Worker for an on-demand "Refresh now" button, same
  pattern as `bugherd-triage/worker/`.
