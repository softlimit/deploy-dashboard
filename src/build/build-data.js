import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'fs'
import { fetchViewTasks } from '../api/clickupClient.js'

const DEPLOY_STATUSES = new Set(['ready for deploy', 'post deploy setup'])
const IN_REVISION_STATUSES = new Set(['in revision'])
const IN_REVIEW_STATUSES = new Set(['in review / qa', 'in client review / qa'])

function clientLabel(task) {
  const field = (task.custom_fields || []).find((f) => f.name === 'CLIENT')
  const options = field?.type_config?.options || []
  const selectedId = field?.value?.[0]
  return options.find((o) => o.id === selectedId)?.label || 'UNKNOWN'
}

function deployType(task) {
  if (task.status.status === 'post deploy setup') return 'post-deployment setup'
  if (task.status.status === 'ready for deploy') return 'no post-deployment setup required'
  return null
}

function personFromValue(value) {
  if (!value) return null
  if (value.email) return { name: value.username || value.name, email: value.email }
  const member = value.members?.[0]
  return member ? { name: member.username, email: member.email } : null
}

function assigneeInfo(task) {
  return personFromValue(task.assignees?.[0])
}

function reviewerInfo(task) {
  const field = (task.custom_fields || []).find((f) => f.name === 'Reviewer')
  return personFromValue(field?.value?.[0])
}

function deployDate(task) {
  const field = (task.custom_fields || []).find((f) => f.name.trim() === 'Deployment/Send Date')
  return field?.value ? new Date(Number(field.value)).toISOString().slice(0, 10) : null
}

function baseTaskRecord(task) {
  return {
    name: task.name,
    url: task.url,
    client: clientLabel(task),
    status: task.status.status,
    assignee: assigneeInfo(task),
    reviewer: reviewerInfo(task),
  }
}

function groupByClient(tasks) {
  const byClient = {}
  for (const task of tasks) {
    byClient[task.client] ??= []
    byClient[task.client].push(task)
  }
  return byClient
}

const token = process.env.CLICKUP_API_TOKEN
const deployViewId = process.env.CLICKUP_VIEW_ID
const triageViewId = process.env.CLICKUP_TRIAGE_VIEW_ID

if (!deployViewId || !token) {
  console.error('Set CLICKUP_VIEW_ID and CLICKUP_API_TOKEN in .env first.')
  process.exit(1)
}

const deployTasks = await fetchViewTasks(deployViewId, token)

const today = new Date().toISOString().slice(0, 10)
const upcomingDates = [...new Set(deployTasks.map(deployDate).filter(Boolean))]
  .filter((d) => d >= today)
  .sort()
const targetDate = upcomingDates[0] ?? null

const scheduled = deployTasks.filter((t) => deployDate(t) === targetDate)
const deployment = {
  deployDate: targetDate,
  clients: groupByClient(
    scheduled.map((t) => ({
      ...baseTaskRecord(t),
      ready: DEPLOY_STATUSES.has(t.status.status),
      deployType: deployType(t),
    })),
  ),
}

let inRevision = { clients: {} }
let inReview = { clients: {} }

if (triageViewId) {
  const triageTasks = await fetchViewTasks(triageViewId, token)
  const revisionTasks = triageTasks.filter((t) => IN_REVISION_STATUSES.has(t.status.status))
  const reviewTasks = triageTasks.filter((t) => IN_REVIEW_STATUSES.has(t.status.status))
  inRevision = { clients: groupByClient(revisionTasks.map(baseTaskRecord)) }
  inReview = { clients: groupByClient(reviewTasks.map(baseTaskRecord)) }
} else {
  console.warn('CLICKUP_TRIAGE_VIEW_ID not set - In Revision / In Review Q/A tabs will be empty.')
}

const output = { deployment, inRevision, inReview }
const json = JSON.stringify(output, null, 2)

mkdirSync('data', { recursive: true })
writeFileSync('data/data.json', json)

mkdirSync('src/frontend/public', { recursive: true })
writeFileSync('src/frontend/public/data.json', json)

console.log(
  `Deployment: ${scheduled.length} tasks for ${targetDate}. In Revision: ${
    Object.values(inRevision.clients).flat().length
  }. In Review Q/A: ${Object.values(inReview.clients).flat().length}. -> data/data.json`,
)
