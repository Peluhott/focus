/** API shapes (snake_case, as the API returns them). */

export type Page<T> = { data: T[]; next_cursor: string | null }

export type Placement = { before_id: number } | { after_id: number }

export type Todo = {
  id: number
  title: string
  notes: string
  /** "YYYY-MM-DD" or null */
  date: string | null
  position: string
  done: boolean
  done_at: string | null
  /** AI alignment (spec "AI alignment check"); all null while the AI is off. */
  alignment_status: AlignmentStatus | null
  alignment_reason: string | null
  alignment_source: 'ai' | 'manual' | null
  matched_goal_id: number | null
  matched_project_id: number | null
  /** The matched goal, for the aligned chip. To-dos match goals only. */
  matched_goal?: { id: number; title: string } | null
}

export type AlignmentStatus = 'pending' | 'aligned' | 'unaligned' | 'dismissed' | 'error'

/** A goal a to-do can be linked to by hand ("Link to…"). */
export type LinkTarget = { id: number; title: string }

export type Settings = { focus_limit: 3 | 5 | 7; ai_enabled: boolean; ai_available: boolean }

export type SubGoal = {
  id: number
  goal_id: number
  title: string
  details: string
  done: boolean
  position: string
}

export type GoalStatus = 'active' | 'completed' | 'archived'

export type Goal = {
  id: number
  title: string
  details: string
  status: GoalStatus
  position: string
  completed_at: string | null
  sub_goals: SubGoal[]
  projects_count: number
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'done' | 'archived'

export type Project = {
  id: number
  title: string
  details: string
  status: ProjectStatus
  goal_id: number | null
  due_date: string | null
  position: string
  goal: { id: number; title: string; status: GoalStatus } | null
  open_task_count: number
  next_due: string | null
}

export type Task = {
  id: number
  project_id: number
  title: string
  details: string
  status: 'pending' | 'complete'
  due_date: string | null
  position: string
  completed_at: string | null
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  done: 'Done',
  archived: 'Archived',
}
