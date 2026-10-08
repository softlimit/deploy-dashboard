import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'fs'
import { fetchViewTasks } from '../api/clickupClient.js'

const DEPLOY_STATUSES = new Set(['ready for deploy', 'post deploy setup'])

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

function assigneeHandle(task) {
  const name = task.assignees?.[0]?.username
  return name ? name.split(' ')[0] : null
}

function deployDate(task) {
  const field = (task.custom_fields || []).find((f) => f.name.trim() === 'Deployment/Send Date')
  return field?.value ? new Date(Number(field.value)).toISOString().slice(0, 10) : null
}

const viewId = process.env.CLICKUP_VIEW_ID
const token = process.env.CLICKUP_API_TOKEN

if (!viewId || !token) {
  console.error('Set CLICKUP_VIEW_ID and CLICKUP_API_TOKEN in .env first.')
  process.exit(1)
}

const tasks = await fetchViewTasks(viewId, token)

const today = new Date().toISOString().slice(0, 10)
const upcomingDates = [...new Set(tasks.map(deployDate).filter(Boolean))]
  .filter((d) => d >= today)
  .sort()
const targetDate = upcomingDates[0] ?? null

const scheduled = tasks.filter((t) => deployDate(t) === targetDate)

const byClient = {}
for (const task of scheduled) {
  const client = clientLabel(task)
  byClient[client] ??= []
  byClient[client].push({
    name: task.name,
    status: task.status.status,
    ready: DEPLOY_STATUSES.has(task.status.status),
    deployType: deployType(task),
    assignee: assigneeHandle(task),
    url: task.url,
  })
}

const output = { deployDate: targetDate, clients: byClient }
const json = JSON.stringify(output, null, 2)

mkdirSync('data', { recursive: true })
writeFileSync('data/data.json', json)

mkdirSync('src/frontend/public', { recursive: true })
writeFileSync('src/frontend/public/data.json', json)

console.log(`Found ${scheduled.length} tasks scheduled for ${targetDate} across ${Object.keys(byClient).length} clients -> data/data.json, src/frontend/public/data.json`)
