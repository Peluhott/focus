import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, fetchAll, get, patch, post } from './api'
import { errorMessage, reorder, useOptimisticMutation } from './optimistic'
import { useToast } from './toast'
import { deferDelete, useVisible } from './pendingDeletes'
import type { Placement, Project, Task } from './types'

export const projectsRootKey = ['projects'] as const
export const projectsKey = (status: string, goal: string) => ['projects', status, goal] as const
export const projectKey = (id: number) => ['project', id] as const
export const tasksKey = (projectId: number) => ['tasks', projectId] as const

/**
 * The list view. status: "open" (everything but archived) or a status;
 * goal: "all", "none" or a goal id.
 */
export function useProjects(status: string, goal: string) {
  const qs = new URLSearchParams()
  if (status !== 'open') qs.set('status', status)
  if (goal !== 'all') qs.set('goal_id', goal)
  const query = qs.toString()
  const select = useVisible<Project>('project')
  return useQuery({
    queryKey: projectsKey(status, goal),
    queryFn: () => fetchAll<Project>(`/projects${query ? `?${query}` : ''}`),
    select,
  })
}

export function useProject(id: number) {
  return useQuery({ queryKey: projectKey(id), queryFn: () => get<Project>(`/projects/${id}`) })
}

/** Not optimistic: the detail view needs the new project's id. */
export function useCreateProject() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: () => post<Project>('/projects', { title: '' }),
    onSuccess: (project) => {
      qc.setQueryData(projectKey(project.id), project)
      qc.invalidateQueries({ queryKey: projectsRootKey })
    },
    onError: (e) => toast(errorMessage(e)),
  })
}

export type ProjectPatch = Partial<Pick<Project, 'title' | 'details' | 'status' | 'goal_id' | 'due_date'>>

/** `goal` (optional) is the linked goal to show right away when goal_id changes. */
export function useUpdateProject() {
  return useOptimisticMutation<
    Project,
    { id: number; patch: ProjectPatch; goal?: Project['goal'] },
    Project
  >({
    scope: 'projects',
    queryKey: ({ id }) => projectKey(id),
    mutationFn: ({ id, patch: body }) => patch<Project>(`/projects/${id}`, body),
    apply: (old, { patch: body, goal }) => ({ ...old, ...body, ...(goal !== undefined ? { goal } : {}) }),
    // Keep the list view in step, so Back doesn't flash the old title or status.
    // A list refetch already in flight would overwrite this, so cancel it first.
    alsoApply: async (qc, { id, patch: body, goal }) => {
      await qc.cancelQueries({ queryKey: projectsRootKey })
      qc.setQueriesData<Project[]>({ queryKey: projectsRootKey }, (list) =>
        list?.map((p) => (p.id === id ? { ...p, ...body, ...(goal !== undefined ? { goal } : {}) } : p))
      )
    },
    settle: (_old, project) => project,
    alsoInvalidate: () => [projectsRootKey, ['goals']],
  })
}

export function useMoveProject(status: string, goal: string) {
  return useOptimisticMutation<Project, { id: number; placement: Placement; order: Project[] }, Project[]>({
    scope: 'projects',
    queryKey: () => projectsKey(status, goal),
    mutationFn: ({ id, placement }) => patch<Project>(`/projects/${id}`, placement),
    apply: (old, { order }) => reorder(old, order),
    alsoInvalidate: () => [projectsRootKey],
  })
}

/** Delete with Undo (UNDO.md): its tasks and files go with it when the toast ends. */
export function useDeleteProject() {
  const qc = useQueryClient()
  return (project: Pick<Project, 'id' | 'title'>) =>
    deferDelete(qc, {
      kind: 'project',
      id: project.id,
      title: project.title,
      lists: [projectsRootKey],
      commit: () => del(`/projects/${project.id}`),
      afterCommit: () => {
        qc.removeQueries({ queryKey: projectKey(project.id) })
        qc.invalidateQueries({ queryKey: projectsRootKey })
        qc.invalidateQueries({ queryKey: ['goals'] })
      },
    })
}

// — tasks —

export function useTasks(projectId: number) {
  const select = useVisible<Task>('task')
  return useQuery({
    queryKey: tasksKey(projectId),
    queryFn: async () => (await get<{ data: Task[] }>(`/projects/${projectId}/tasks`)).data,
    select,
  })
}

const afterTask = (projectId: number) => [projectKey(projectId), projectsRootKey]

export function useAddTask(projectId: number) {
  return useOptimisticMutation<Task, { tempId: number; title: string }, Task[]>({
    scope: `tasks:${projectId}`,
    queryKey: () => tasksKey(projectId),
    mutationFn: ({ title }) => post<Task>(`/projects/${projectId}/tasks`, { title }),
    apply: (old, { tempId, title }) => {
      const pending = old.filter((t) => t.status === 'pending')
      const complete = old.filter((t) => t.status === 'complete')
      const task: Task = {
        id: tempId,
        project_id: projectId,
        title,
        details: '',
        status: 'pending',
        due_date: null,
        position: '',
        completed_at: null,
      }
      return [...pending, task, ...complete]
    },
    settle: (old, task, { tempId }) => old.map((t) => (t.id === tempId ? task : t)),
    alsoInvalidate: () => afterTask(projectId),
  })
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'details' | 'due_date' | 'status'>>

/**
 * Edits a task. Completing moves it to the top of Complete; un-completing
 * moves it to the end of Pending.
 */
export function useUpdateTask(projectId: number) {
  return useOptimisticMutation<Task, { id: number; patch: TaskPatch }, Task[]>({
    scope: `tasks:${projectId}`,
    queryKey: () => tasksKey(projectId),
    mutationFn: ({ id, patch: body }) => patch<Task>(`/tasks/${id}`, body),
    apply: (old, { id, patch: body }) => {
      const task = old.find((t) => t.id === id)
      if (!task) return old
      const updated: Task = { ...task, ...body }
      const rest = old.filter((t) => t.id !== id)
      const pending = rest.filter((t) => t.status === 'pending')
      const complete = rest.filter((t) => t.status === 'complete')
      if (body.status && body.status !== task.status) {
        if (body.status === 'complete') {
          updated.completed_at = new Date().toISOString()
          return [...pending, updated, ...complete]
        }
        updated.completed_at = null
        return [...pending, updated, ...complete]
      }
      return old.map((t) => (t.id === id ? updated : t))
    },
    alsoInvalidate: () => afterTask(projectId),
  })
}

export function useMoveTask(projectId: number) {
  return useOptimisticMutation<Task, { id: number; placement: Placement; order: Task[] }, Task[]>({
    scope: `tasks:${projectId}`,
    queryKey: () => tasksKey(projectId),
    mutationFn: ({ id, placement }) => patch<Task>(`/tasks/${id}`, placement),
    apply: (old, { order }) => reorder(old, order),
  })
}

export function useDeleteTask(projectId: number) {
  const qc = useQueryClient()
  return (task: Task) =>
    deferDelete(qc, {
      kind: 'task',
      id: task.id,
      title: task.title,
      lists: [tasksKey(projectId)],
      commit: () => del(`/tasks/${task.id}`),
      afterCommit: () => {
        for (const key of afterTask(projectId)) qc.invalidateQueries({ queryKey: key })
      },
    })
}
