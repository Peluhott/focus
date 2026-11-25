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
    ai_enabled: ws.aiEnabled,
    goals: goals.map((g) => g.serialize()),
    projects: projects.map((p) => p.serialize()),
    todos: todos.map((t) => t.serialize()),
    notes: notes.map((n) => n.serialize()),
  }
}

/**
 * GET /export (session only): "Export all" for both workspaces in one JSON
 * file (designhandoff WORK-MODE.md → Export). Project files are listed by
 * name and size; the files themselves stay in storage.
 */
export default class ExportController {
  async show({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const workspaces = await Workspace.query().where('user_id', user.id)
    const byKind = (kind: 'personal' | 'work') => workspaces.find((w) => w.kind === kind)
    const personal = byKind('personal')
    const work = byKind('work')
    const now = DateTime.now()
    response.header(
      'content-disposition',
      `attachment; filename="focus-export-${now.toISODate()}.json"`
    )
    return {
      exported_at: now.toISO(),
      settings: { focus_limit: user.focusLimit, timer_minutes: user.timerMinutes },
      personal: personal ? await dump(personal) : null,
      work: work ? await dump(work) : null,
    }
  }
}
