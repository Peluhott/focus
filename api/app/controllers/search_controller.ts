import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { ApiScope } from '#middleware/scope_middleware'

/** Results per group (SEARCH.md). */
const PER_GROUP = 4

type Item = {
  type: 'todo' | 'goal' | 'project' | 'task' | 'file' | 'note' | 'calendar'
  id: number
  title: string
  sub: string | null
  /** Where the web app opens it. */
  todo_id?: number
  goal_id?: number
  project_id?: number
  note_id?: number
  /** Goals: true when it's in the archived section (archived or completed). */
  archived?: boolean
  date?: string
}

type Group = { key: string; label: string; items: Item[] }

/** `%`, `_` and `\` in the query match themselves. */
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** A short piece of `text` around the first match, for the sub-line. */
function snippet(text: string, q: string, size = 70): string | null {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  const at = flat.toLowerCase().indexOf(q.toLowerCase())
  if (at < 0) return flat.length > size ? `${flat.slice(0, size)}…` : flat
  const start = Math.max(0, at - 24)
  const end = Math.min(flat.length, start + size)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}

const short = (date: string) => DateTime.fromISO(date).toFormat('LLL d')

/**
 * GET /search?q= (SEARCH.md): the ⌘K palette across the request's
 * workspace. Groups: To-dos, Goals, Projects (and their tasks), Files,
 * Notes and Calendar (dated to-dos, project due dates, open task due
 * dates), up to 4 each, title matches first. An API key only gets the
 * groups its read scopes allow. Matching is a case-insensitive substring.
 */
export default class SearchController {
  async index({ auth, request, workspace }: HttpContext) {
    const q = String(request.input('q') ?? '').trim().slice(0, 200)
    if (!q) return { query: q, groups: [] }

    const token =
      auth.authenticatedViaGuard === 'api' ? auth.use('api').user?.currentAccessToken : null
    const can = (scope: ApiScope) => !token || token.allows(scope)
    const pattern = like(q)
    const ws = workspace.id
    const groups: Group[] = []

    if (can('todos:read')) {
      const rows = await db
        .from('todos')
        .where('workspace_id', ws)
        .where('done', false)
        .where((w) => w.whereILike('title', pattern).orWhereILike('notes', pattern))
        .orderByRaw('(title ILIKE ?) DESC', [pattern])
        .orderBy('position')
        .limit(PER_GROUP)
        .select('id', 'title', 'notes', 'date')
      groups.push({
        key: 'todos',
        label: 'To-dos',
        items: rows.map((r) => ({
          type: 'todo',
          id: r.id,
          title: r.title,
          sub: snippet(r.notes, q) ?? (r.date ? short(r.date) : null),
          todo_id: r.id,
        })),
      })
    }

    if (can('goals:read')) {
      const rows = await db
        .from('goals')
        .where('goals.workspace_id', ws)
        .where((w) =>
          w
            .whereILike('goals.title', pattern)
            .orWhereExists((s) =>
              s
                .from('sub_goals')
                .whereColumn('sub_goals.goal_id', 'goals.id')
                .whereILike('sub_goals.title', pattern)
            )
        )
        .orderByRaw('(goals.title ILIKE ?) DESC', [pattern])
        .orderByRaw("(goals.status = 'active') DESC")
        .orderBy('goals.position')
        .limit(PER_GROUP)
        .select(
          'goals.id',
          'goals.title',
          'goals.status',
          db.raw(
            `(SELECT title FROM sub_goals WHERE goal_id = goals.id AND title ILIKE ?
              ORDER BY position LIMIT 1) AS sub_goal`,
            [pattern]
          )
        )
      groups.push({
        key: 'goals',
        label: 'Goals',
        items: rows.map((r) => {
          const titleHit = r.title.toLowerCase().includes(q.toLowerCase())
          const status = r.status === 'active' ? null : r.status === 'archived' ? 'Archived' : 'Completed'
          const detail = titleHit || !r.sub_goal ? null : `Sub-goal: ${r.sub_goal}`
          return {
            type: 'goal',
            id: r.id,
            title: r.title,
            sub: [status, detail].filter(Boolean).join(' · ') || null,
            goal_id: r.id,
            archived: r.status !== 'active',
          }
        }),
      })
    }

    if (can('projects:read')) {
      const [projects, tasks] = await Promise.all([
        db
          .from('projects')
          .where('workspace_id', ws)
          .where((w) => w.whereILike('title', pattern).orWhereILike('details', pattern))
          .orderByRaw('(title ILIKE ?) DESC', [pattern])
          .orderBy('position')
          .limit(PER_GROUP)
          .select('id', 'title', 'details'),
        db
          .from('tasks')
          .join('projects', 'projects.id', 'tasks.project_id')
          .where('projects.workspace_id', ws)
          .whereILike('tasks.title', pattern)
          .orderByRaw("(tasks.status = 'pending') DESC")
          .orderBy('tasks.position')
          .limit(PER_GROUP)
          .select('tasks.id', 'tasks.title', 'tasks.project_id', 'projects.title as project'),
      ])
      const items: Item[] = [
        ...projects.map((r) => ({
          type: 'project' as const,
          id: r.id,
          title: r.title,
          sub: r.title.toLowerCase().includes(q.toLowerCase()) ? null : snippet(r.details, q),
          project_id: r.id,
        })),
        ...tasks.map((r) => ({
          type: 'task' as const,
          id: r.id,
          title: r.title,
          sub: `Task in ${r.project}`,
          project_id: r.project_id,
        })),
      ]
      groups.push({ key: 'projects', label: 'Projects', items: items.slice(0, PER_GROUP) })

      const files = await db
        .from('project_files')
        .join('projects', 'projects.id', 'project_files.project_id')
        .where('projects.workspace_id', ws)
        .whereILike('project_files.name', pattern)
        .orderBy('project_files.uploaded_at', 'desc')
        .limit(PER_GROUP)
        .select(
          'project_files.id',
          'project_files.name',
          'project_files.project_id',
          'projects.title as project'
        )
      groups.push({
        key: 'files',
        label: 'Files',
        items: files.map((r) => ({
          type: 'file',
          id: r.id,
          title: r.name,
          sub: r.project,
          project_id: r.project_id,
        })),
      })
    }

    if (can('notes:read')) {
      const rows = await db
        .from('notes')
        .where('workspace_id', ws)
        .where((w) => w.whereILike('title', pattern).orWhereILike('body', pattern))
        .orderByRaw('(title ILIKE ?) DESC', [pattern])
        .orderBy('position')
        .limit(PER_GROUP)
        .select('id', 'title', 'body')
      groups.push({
        key: 'notes',
        label: 'Notes',
        items: rows.map((r) => ({
          type: 'note',
          id: r.id,
          title: r.title || 'Untitled note',
          sub: snippet(r.body, q),
          note_id: r.id,
        })),
      })
    }

    // Calendar: anything with a date whose title matches, soonest first.
    const dated: Item[] = []
    if (can('todos:read')) {
      const rows = await db
        .from('todos')
        .where('workspace_id', ws)
        .where('done', false)
        .whereNotNull('date')
        .whereILike('title', pattern)
        .orderBy('date')
        .limit(PER_GROUP)
        .select('id', 'title', 'date')
      for (const r of rows) {
        dated.push({
          type: 'calendar',
          id: r.id,
          title: `${short(r.date)} · ${r.title}`,
          sub: 'To-do',
          todo_id: r.id,
          date: r.date,
        })
      }
    }
    if (can('projects:read')) {
      const [projects, tasks] = await Promise.all([
        db
          .from('projects')
          .where('workspace_id', ws)
          .whereNotNull('due_date')
          .whereILike('title', pattern)
          .orderBy('due_date')
          .limit(PER_GROUP)
          .select('id', 'title', 'due_date'),
        db
          .from('tasks')
          .join('projects', 'projects.id', 'tasks.project_id')
          .where('projects.workspace_id', ws)
          .where('tasks.status', 'pending')
          .whereNotNull('tasks.due_date')
          .whereILike('tasks.title', pattern)
          .orderBy('tasks.due_date')
          .limit(PER_GROUP)
          .select('tasks.id', 'tasks.title', 'tasks.due_date', 'tasks.project_id', 'projects.title as project'),
      ])
      for (const r of projects) {
        dated.push({
          type: 'calendar',
          id: r.id,
          title: `${short(r.due_date)} · ${r.title}`,
          sub: 'Project due',
          project_id: r.id,
          date: r.due_date,
        })
      }
      for (const r of tasks) {
        dated.push({
          type: 'calendar',
          id: r.id,
          title: `${short(r.due_date)} · ${r.title}`,
          sub: `Task due in ${r.project}`,
          project_id: r.project_id,
          date: r.due_date,
        })
      }
    }
    dated.sort((a, b) => a.date!.localeCompare(b.date!))
    groups.push({ key: 'calendar', label: 'Calendar', items: dated.slice(0, PER_GROUP) })

    return { query: q, groups: groups.filter((g) => g.items.length > 0) }
  }
}
