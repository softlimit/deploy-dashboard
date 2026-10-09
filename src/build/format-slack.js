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
    const link = `<${task.url}|${task.name}>`
    if (task.needsPostDeploySetup) {
      const assignee = task.assignee ? ` @${task.assignee.name.split(' ')[0]}` : ''
      lines.push(`- ${link} — :warning: post-deployment setup${assignee}`)
    } else {
      lines.push(`- ${link} — :white_check_mark: no post-deployment setup required`)
    }
  }
  lines.push('')
}

console.log(lines.join('\n'))
