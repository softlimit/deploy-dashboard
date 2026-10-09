import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'fs'
import { fetchViewTasks } from '../api/clickupClient.js'

const DEPLOY_STATUSES = new Set(['ready for deploy', 'post deploy setup'])
const IN_REVISION_STATUSES = new Set(['in revision', 'in progress', 'ready for pr'])
const IN_REVIEW_STATUSES = new Set(['in review / qa', 'in client review / qa'])

function clientLabel(task) {
  const field = (task.custom_fields || []).find((f) => f.name === 'CLIENT')
  const options = field?.type_config?.options || []
  const selectedId = field?.value?.[0]
  return options.find((o) => o.id === selectedId)?.label || 'UNKNOWN'
}

const POST_DEPLOY_SETUP_TAG = 'post-deploy set up required'

function hasPostDeploySetupTag(task) {
  return (task.tags || []).some((tag) => tag.name === POST_DEPLOY_SETUP_TAG)
}

function needsPostDeploySetup(task) {
  return task.status.status === 'post deploy setup' || hasPostDeploySetupTag(task)
}

function deployType(task) {
  if (needsPostDeploySetup(task)) return 'post-deployment setup'
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

function remindRole(task) {
  if (IN_REVISION_STATUSES.has(task.status.status)) return 'assignee'
  if (IN_REVIEW_STATUSES.has(task.status.status)) return 'reviewer'
  return null
}

// Deploys always land on Monday, so "next deployment" is always the
// upcoming Monday (or today, if today is Monday) rather than whatever
// happens to be the earliest date present in the ClickUp view.
function nextMonday() {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday, 1 = Monday, ...
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7
  now.setUTCDate(now.getUTCDate() + daysUntilMonday)
  return now.toISOString().slice(0, 10)
}

function taskRecord(task) {
  const ready = DEPLOY_STATUSES.has(task.status.status)
  const deployed = task.status.status === 'deployed'
  return {
    name: task.name,
    url: task.url,
    client: clientLabel(task),
    status: task.status.status,
    deployDate: deployDate(task),
    ready,
    deployed,
    deployType: ready ? deployType(task) : null,
    needsPostDeploySetup: needsPostDeploySetup(task),
    remindRole: ready || deployed ? null : remindRole(task),
    assignee: assigneeInfo(task),
    reviewer: reviewerInfo(task),
  }
}

const token = process.env.CLICKUP_API_TOKEN
const deployViewId = process.env.CLICKUP_VIEW_ID

if (!deployViewId || !token) {
  console.error('Set CLICKUP_VIEW_ID and CLICKUP_API_TOKEN in .env first.')
  process.exit(1)
}

const rawTasks = await fetchViewTasks(deployViewId, token)
const tasks = rawTasks.map(taskRecord)

const availableDates = [...new Set(tasks.map((t) => t.deployDate).filter(Boolean))].sort()
const defaultDate = nextMonday()
const teamId = rawTasks[0]?.team_id
const viewUrl = teamId ? `https://app.clickup.com/${teamId}/v/l/${deployViewId}` : null

const output = { defaultDate, availableDates, viewUrl, tasks }
const json = JSON.stringify(output, null, 2)

mkdirSync('data', { recursive: true })
writeFileSync('data/data.json', json)

mkdirSync('src/frontend/public', { recursive: true })
writeFileSync('src/frontend/public/data.json', json)

console.log(`Fetched ${tasks.length} tasks across ${availableDates.length} deploy date(s) -> data/data.json`)
