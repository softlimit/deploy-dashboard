import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'fs'
import { fetchViewTasks } from '../api/clickupClient.js'

const viewId = process.env.CLICKUP_VIEW_ID
const token = process.env.CLICKUP_API_TOKEN

if (!viewId || !token) {
  console.error('Set CLICKUP_VIEW_ID and CLICKUP_API_TOKEN in .env first.')
  process.exit(1)
}

const tasks = await fetchViewTasks(viewId, token)

mkdirSync('data', { recursive: true })
writeFileSync('data/raw-sample.json', JSON.stringify(tasks, null, 2))

console.log(`Fetched ${tasks.length} tasks, wrote data/raw-sample.json`)
if (tasks[0]) {
  console.log('\nTop-level keys on first task:')
  console.log(Object.keys(tasks[0]))
  console.log('\nCustom fields on first task:')
  console.log(JSON.stringify(tasks[0].custom_fields, null, 2))
}
