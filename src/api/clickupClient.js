const BASE_URL = 'https://api.clickup.com/api/v2'

export async function fetchViewTasks(viewId, token) {
  const tasks = []
  let page = 0
  let lastPage = false

  while (!lastPage) {
    const url = `${BASE_URL}/view/${viewId}/task?page=${page}`
    const res = await fetch(url, {
      headers: { Authorization: token },
    })

    if (!res.ok) {
      throw new Error(`ClickUp API error ${res.status}: ${await res.text()}`)
    }

    const body = await res.json()
    tasks.push(...body.tasks)
    lastPage = body.last_page ?? true
    page += 1
  }

  return tasks
}
