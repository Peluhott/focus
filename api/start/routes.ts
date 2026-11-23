/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Everything lives under /api/v1. The web app and (from Phase 5) API keys
| call the same endpoints.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { loginThrottle } from '#start/limiter'

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

router
  .group(() => {
    router.get('health', () => ({ ok: true }))

    router.post('auth/login', [AuthController, 'login']).use(loginThrottle)
    router.post('auth/logout', [AuthController, 'logout']).use(middleware.auth())
    router.get('auth/me', [AuthController, 'me']).use(middleware.auth())

    router
      .group(() => {
        router.get('settings', [SettingsController, 'show'])
        router.patch('settings', [SettingsController, 'update'])

        router.get('todos', [TodosController, 'index'])
        router.post('todos', [TodosController, 'store'])
        router.get('todos/:id', [TodosController, 'show'])
        router.patch('todos/:id', [TodosController, 'update'])
        router.post('todos/:id/recheck', [TodosController, 'recheck'])
        router.post('todos/:id/dismiss', [TodosController, 'dismiss'])
        router.delete('todos/:id', [TodosController, 'destroy'])

        router.get('goals', [GoalsController, 'index'])
        router.post('goals', [GoalsController, 'store'])
        router.get('goals/:id', [GoalsController, 'show'])
        router.patch('goals/:id', [GoalsController, 'update'])
        router.delete('goals/:id', [GoalsController, 'destroy'])
        router.post('goals/:id/complete', [GoalsController, 'complete'])
        router.post('goals/:id/archive', [GoalsController, 'archive'])
        router.post('goals/:id/restore', [GoalsController, 'restore'])

        router.get('goals/:id/subgoals', [SubGoalsController, 'index'])
        router.post('goals/:id/subgoals', [SubGoalsController, 'store'])
        router.patch('subgoals/:id', [SubGoalsController, 'update'])
        router.delete('subgoals/:id', [SubGoalsController, 'destroy'])

        router.get('projects', [ProjectsController, 'index'])
        router.post('projects', [ProjectsController, 'store'])
        router.get('projects/:id', [ProjectsController, 'show'])
        router.patch('projects/:id', [ProjectsController, 'update'])
        router.delete('projects/:id', [ProjectsController, 'destroy'])

        router.get('projects/:id/files', [ProjectFilesController, 'index'])
        router.post('projects/:id/files/sign', [ProjectFilesController, 'sign'])
        router.post('projects/:id/files', [ProjectFilesController, 'store'])
        router.patch('files/:id', [ProjectFilesController, 'update'])
        router.delete('files/:id', [ProjectFilesController, 'destroy'])
        router.get('files/:id/url', [ProjectFilesController, 'url'])

        router.get('projects/:id/tasks', [TasksController, 'index'])
        router.post('projects/:id/tasks', [TasksController, 'store'])
        router.patch('tasks/:id', [TasksController, 'update'])
        router.delete('tasks/:id', [TasksController, 'destroy'])

        router.get('stats/completions', [StatsController, 'completions'])
        router.get('completions', [CompletionsController, 'index'])
        router.delete('completions/:id', [CompletionsController, 'destroy'])

        router.get('off-track', [OffTrackController, 'index'])
        router.post('off-track/clear', [OffTrackController, 'clear'])
        router.delete('off-track/:id', [OffTrackController, 'destroy'])

        router.get('goal-suggestions', [GoalSuggestionsController, 'index'])
        router.post('goal-suggestions/:id/accept', [GoalSuggestionsController, 'accept'])
        router.post('goal-suggestions/:id/dismiss', [GoalSuggestionsController, 'dismiss'])

        router.get('calendar', [CalendarController, 'index'])
      })
      .where('id', router.matchers.number())
      .use(middleware.auth())
  })
  .prefix('/api/v1')
