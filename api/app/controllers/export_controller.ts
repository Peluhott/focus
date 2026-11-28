import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Goal from '#models/goal'
import Note from '#models/note'
import Project from '#models/project'
import Todo from '#models/todo'
import Workspace from '#models/workspace'
import { inWs } from '#services/scoped'

/** One workspace's data, in each list's order. */
async function dump(ws: Workspace) {
  const [goals, projects, todos, notes] = await Promise.all([
    inWs(Goal, ws)
      .preload('subGoals', (q) => q.orderBy('position').orderBy('id'))
      .orderBy('position')
      .orderBy('id'),
    inWs(Project, ws)
      .preload('tasks', (q) => q.orderBy('position').orderBy('id'))
      .preload('files', (q) => q.orderBy('uploaded_at'))
      .orderBy('position')
      .orderBy('id'),
    inWs(Todo, ws).orderBy('position').orderBy('id'),
    inWs(Note, ws).orderBy('position').orderBy('id'),
  ])
  return {
    id: ws.id,
    name: ws.displayName,
    ai_enabled: ws.aiEnabled,
    focus_limit: ws.focusLimit,
    goals: goals.map((g) => g.serialize()),
    projects: projects.map((p) => p.serialize()),
    todos: todos.map((t) => t.serialize()),
    notes: notes.map((n) => n.serialize()),
  }
}

/**
 * GET /export (session only): "Export all", every workspace in one JSON
 * file, in the user's order. Project files are listed by name and size;
 * the files themselves stay in storage.
 */
export default class ExportController {
  async show({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const workspaces = await Workspace.ofUser(user.id)
    const now = DateTime.now()
    response.header(
      'content-disposition',
      `attachment; filename="focus-export-${now.toISODate()}.json"`
    )
    const dumps = []
    for (const ws of workspaces) dumps.push(await dump(ws))
    return {
      exported_at: now.toISO(),
      settings: { timer_minutes: user.timerMinutes },
      workspaces: dumps,
    }
  }
}
