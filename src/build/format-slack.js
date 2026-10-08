import { readFileSync } from 'fs'

const { deployDate, clients: byClient } = JSON.parse(readFileSync('data/data.json', 'utf8'))

const lines = [`:rocket: Deployment plan for ${deployDate ?? 'TBD'}`, '']

for (const [client, tasks] of Object.entries(byClient)) {
  lines.push(`*${client}*`)
  for (const task of tasks) {
    const assignee = task.assignee ? ` @${task.assignee}` : ''
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
