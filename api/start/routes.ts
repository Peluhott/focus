/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Everything lives under /api/v1. The web app (session cookie) and API keys
| (Bearer fk_…, limited by scopes) call the same endpoints. Settings and key
| management are session only. Data routes work in one workspace, picked by
| the X-Focus-Workspace header (personal when missing).
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { apiThrottle, loginThrottle, signupThrottle } from '#start/limiter'

const AuthController = () => import('#controllers/auth_controller')
const SettingsController = () => import('#controllers/settings_controller')
const TodosController = () => import('#controllers/todos_controller')
const GoalsController = () => import('#controllers/goals_controller')
const SubGoalsController = () => import('#controllers/sub_goals_controller')
const ProjectsController = () => import('#controllers/projects_controller')
const TasksController = () => import('#controllers/tasks_controller')
const StatsController = () => import('#controllers/stats_controller')
const OffTrackController = () => import('#controllers/off_track_controller')
const GoalSuggestionsController = () => import('#controllers/goal_suggestions_controller')
const CalendarController = () => import('#controllers/calendar_controller')
const CompletionsController = () => import('#controllers/completions_controller')
const ProjectFilesController = () => import('#controllers/project_files_controller')
const ApiKeysController = () => import('#controllers/api_keys_controller')
const AccountController = () => import('#controllers/account_controller')
const NotesController = () => import('#controllers/notes_controller')
const TodoHintsController = () => import('#controllers/todo_hints_controller')
const ExportController = () => import('#controllers/export_controller')
const WorkspacesController = () => import('#controllers/workspaces_controller')
const SearchController = () => import('#controllers/search_controller')
const FeedbackController = () => import('#controllers/feedback_controller')

router
  .group(() => {
    router.get('health', () => ({ ok: true }))

    router.post('auth/login', [AuthController, 'login']).use(loginThrottle)
    router.post('auth/signup', [AuthController, 'signup']).use(signupThrottle)
    router.post('auth/logout', [AuthController, 'logout']).use(middleware.auth())
    router.get('auth/me', [AuthController, 'me']).use(middleware.auth())

    /** Session only: API keys can't change settings or manage keys. */
    router
      .group(() => {
        router.get('settings', [SettingsController, 'show'])
        router.patch('settings', [SettingsController, 'update'])
        router.patch('account', [AccountController, 'update'])
        router.get('export', [ExportController, 'show'])
        router.post('feedback', [FeedbackController, 'store'])

        router.get('workspaces', [WorkspacesController, 'index'])
        router.post('workspaces', [WorkspacesController, 'store'])
        router.patch('workspaces/:id', [WorkspacesController, 'update'])
        router.delete('workspaces/:id', [WorkspacesController, 'destroy'])

        router.get('keys', [ApiKeysController, 'index'])
        router.post('keys', [ApiKeysController, 'store'])
        router.delete('keys/:id', [ApiKeysController, 'destroy'])
      })
      .where('id', router.matchers.number())
      .use([middleware.auth({ guards: ['web'] }), middleware.workspace()])

    /** Session or API key; a key needs the scope on each route. */
    router
      .group(() => {
        const todosRead = middleware.scope('todos:read')
        const todosWrite = middleware.scope('todos:write')
        const goalsRead = middleware.scope('goals:read')
        const goalsWrite = middleware.scope('goals:write')
        const projectsRead = middleware.scope('projects:read')
        const projectsWrite = middleware.scope('projects:write')
        const notesRead = middleware.scope('notes:read')
        const notesWrite = middleware.scope('notes:write')

        router.get('todos', [TodosController, 'index']).use(todosRead)
        router.post('todos', [TodosController, 'store']).use(todosWrite)
        router.get('todos/:id', [TodosController, 'show']).use(todosRead)
        router.patch('todos/:id', [TodosController, 'update']).use(todosWrite)
        router.post('todos/:id/recheck', [TodosController, 'recheck']).use(todosWrite)
        router.post('todos/:id/dismiss', [TodosController, 'dismiss']).use(todosWrite)
        router.delete('todos/:id', [TodosController, 'destroy']).use(todosWrite)
        router.get('todos/:id/hint', [TodoHintsController, 'show']).use(todosRead)
        router.post('todos/:id/hint', [TodoHintsController, 'store']).use(todosWrite)
        router.post('todos/:id/hint/add', [TodoHintsController, 'add']).use(todosWrite)

        router.get('goals', [GoalsController, 'index']).use(goalsRead)
        router.post('goals', [GoalsController, 'store']).use(goalsWrite)
        router.get('goals/:id', [GoalsController, 'show']).use(goalsRead)
        router.patch('goals/:id', [GoalsController, 'update']).use(goalsWrite)
        router.delete('goals/:id', [GoalsController, 'destroy']).use(goalsWrite)
        router.post('goals/:id/complete', [GoalsController, 'complete']).use(goalsWrite)
        router.post('goals/:id/archive', [GoalsController, 'archive']).use(goalsWrite)
        router.post('goals/:id/restore', [GoalsController, 'restore']).use(goalsWrite)

        router.get('goals/:id/subgoals', [SubGoalsController, 'index']).use(goalsRead)
        router.post('goals/:id/subgoals', [SubGoalsController, 'store']).use(goalsWrite)
        router.patch('subgoals/:id', [SubGoalsController, 'update']).use(goalsWrite)
        router.delete('subgoals/:id', [SubGoalsController, 'destroy']).use(goalsWrite)

        router.get('projects', [ProjectsController, 'index']).use(projectsRead)
        router.post('projects', [ProjectsController, 'store']).use(projectsWrite)
        router.get('projects/:id', [ProjectsController, 'show']).use(projectsRead)
        router.patch('projects/:id', [ProjectsController, 'update']).use(projectsWrite)
        router.delete('projects/:id', [ProjectsController, 'destroy']).use(projectsWrite)

        router.get('projects/:id/files', [ProjectFilesController, 'index']).use(projectsRead)
        router.post('projects/:id/files/sign', [ProjectFilesController, 'sign']).use(projectsWrite)
        router.post('projects/:id/files', [ProjectFilesController, 'store']).use(projectsWrite)
        router.patch('files/:id', [ProjectFilesController, 'update']).use(projectsWrite)
        router.delete('files/:id', [ProjectFilesController, 'destroy']).use(projectsWrite)
        router.get('files/:id/url', [ProjectFilesController, 'url']).use(projectsRead)

        router.get('projects/:id/tasks', [TasksController, 'index']).use(projectsRead)
        router.post('projects/:id/tasks', [TasksController, 'store']).use(projectsWrite)
        router.patch('tasks/:id', [TasksController, 'update']).use(projectsWrite)
        router.delete('tasks/:id', [TasksController, 'destroy']).use(projectsWrite)

        router.get('stats/completions', [StatsController, 'completions']).use(todosRead)
        router.get('stats/today', [StatsController, 'today']).use(todosRead)
        router.get('completions', [CompletionsController, 'index']).use(todosRead)
        router.delete('completions/:id', [CompletionsController, 'destroy']).use(todosWrite)

        router.get('off-track', [OffTrackController, 'index']).use(todosRead)
        router.post('off-track/clear', [OffTrackController, 'clear']).use(todosWrite)
        router.delete('off-track/:id', [OffTrackController, 'destroy']).use(todosWrite)

        router.get('goal-suggestions', [GoalSuggestionsController, 'index']).use(goalsRead)
        router
          .post('goal-suggestions/:id/accept', [GoalSuggestionsController, 'accept'])
          .use(goalsWrite)
        router
          .post('goal-suggestions/:id/dismiss', [GoalSuggestionsController, 'dismiss'])
          .use(goalsWrite)

        router.get('calendar', [CalendarController, 'index']).use(todosRead)
        /** Groups the key can't read are left out (no scope needed for the route). */
        router.get('search', [SearchController, 'index'])

        router.get('notes', [NotesController, 'index']).use(notesRead)
        router.post('notes', [NotesController, 'store']).use(notesWrite)
        router.get('notes/:id', [NotesController, 'show']).use(notesRead)
        router.patch('notes/:id', [NotesController, 'update']).use(notesWrite)
        router.delete('notes/:id', [NotesController, 'destroy']).use(notesWrite)
      })
      .where('id', router.matchers.number())
      .use([middleware.auth({ guards: ['web', 'api'] }), middleware.workspace(), apiThrottle])
  })
  .prefix('/api/v1')
