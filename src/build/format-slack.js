import { readFileSync } from 'fs'

const { defaultDate, tasks } = JSON.parse(readFileSync('data/data.json', 'utf8'))
const scheduled = tasks.filter((t) => t.deployDate === defaultDate)

const byClient = {}
for (const task of scheduled) {
  byClient[task.client] ??= []
  byClient[task.client].push(task)
}

const lines = [`:rocket: Deployment plan for ${defaultDate ?? 'TBD'}`, '']

for (const [client, clientTasks] of Object.entries(byClient)) {
  lines.push(`*${client}*`)
  for (const task of clientTasks) {
    const assignee = task.assignee ? ` @${task.assignee.name.split(' ')[0]}` : ''
    const icon = !task.ready
      ? ':hourglass_flowing_sand:'
      : task.deployType === 'post-deployment setup'
        ? ':warning:'
        : ':white_check_mark:'
    const label = task.ready ? task.deployType : task.status
    lines.push(`- ${task.name} — ${icon} ${label}${assignee}`)
  }
  lines.push('')
}

console.log(lines.join('\n'))
