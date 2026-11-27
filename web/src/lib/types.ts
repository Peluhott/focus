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
  /** Checked off while red: moved to the off-track backlog instead of completed. */
  off_track?: boolean
  /** AI alignment (spec "AI alignment check"); all null while the AI is off. */
  alignment_status: AlignmentStatus | null
  alignment_reason: string | null
  alignment_source: 'ai' | 'manual' | null
  /** Every active goal the to-do serves (best first). To-dos match goals only. */
  matches: TodoMatch[]
  /** none · one (1 goal) · several (2+ but not all) · all (every active goal). */
  match_level: MatchLevel
  /** Repeat: stays on the list; each check-off logs a completion. No date. */
  recurring: boolean
  /** "Done N×" */
  completion_count: number
  /** For "✓ today" (compared with the local date). */
  last_completed_at: string | null
  /** Set on the response to a recurring check-off (for Undo). */
  completion_id?: number
}

export type TodoMatch = { type: 'goal'; id: number; title: string; confidence: number | null }

export type MatchLevel = 'none' | 'one' | 'several' | 'all'

export type AlignmentStatus = 'pending' | 'aligned' | 'unaligned' | 'dismissed' | 'error'

/** A goal a to-do can be linked to by hand ("Link to…"). */
export type LinkTarget = { id: number; title: string }

/** One of the user's workspaces (GET /workspaces, auth/me). */
export type WorkspaceInfo = {
  id: number
  name: string
  position: string | null
  ai_enabled: boolean
  /** Turning AI on asks for the warning (every workspace but the original Personal). */
  ai_ack_required: boolean
}

/**
 * GET /settings for the request's workspace. focus_limit, timer_minutes and
 * last_workspace_id are the user's (shared); ai_enabled is this workspace's.
 */
export type Settings = {
  focus_limit: 3 | 5 | 7
  timer_minutes: number
  last_workspace_id: number | null
  workspace: { id: number; name: string }
  ai_enabled: boolean
  ai_available: boolean
  ai_ack_required: boolean
  /** Last time AI was turned on here after the warning. */
  ai_ack_at: string | null
  /** Uploads work (project files, feedback screenshots). */
  storage_enabled: boolean
}

/** A note (NOTES.md). Markdown body, manual order. */
export type Note = {
  id: number
  /** '' allowed; the list shows "Untitled note". */
  title: string
  body: string
  position: string
  created_at: string
  updated_at: string
}

/** queued while the worker thinks (the backend has no "running"). */
export type TodoHintStatus = 'queued' | 'ready' | 'error' | 'skipped'

/** "Help me start" (START-SMALL.md): one small first step. */
export type TodoHintRun = {
  id: number
  todo_id: number
  status: TodoHintStatus
  text: string | null
  error: string | null
  created_at: string
}

export type SubGoal = {
  id: number
  goal_id: number
  title: string
  done: boolean
  position: string
}

export type GoalStatus = 'active' | 'completed' | 'archived'

export type Goal = {
  id: number
  title: string
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

/** A red to-do you checked off (docs "Off-track backlog"). */
export type OffTrackItem = {
  id: number
  todo_id: number | null
  title_snapshot: string
  notes_snapshot: string
  reason: string | null
  status: 'open' | 'used' | 'cleared'
  moved_at: string
  used_in_goal_id: number | null
}

export type SuggestionRunStatus = 'queued' | 'ready' | 'empty' | 'error' | 'skipped'

/** A goal the AI built from a recurring backlog theme. */
export type GoalSuggestion = {
  id: number
  run_id: number
  title: string
  details: string
  sub_goals: string[]
  item_ids: number[]
  rationale: string
  status: 'open' | 'accepted' | 'dismissed'
  accepted_goal_id: number | null
  items: { id: number; title: string; reason: string | null; moved_at: string; status: OffTrackItem['status'] }[]
}

export type SuggestionsResponse = {
  data: GoalSuggestion[]
  latest_run: { id: number; status: SuggestionRunStatus; trigger: string; created_at: string } | null
}

export type CalendarEntry = { date: string; id: number; title: string }

/** A file on a project (metadata; the file lives in Cloudinary). */
export type ProjectFile = {
  id: number
  project_id: number
  name: string
  resource_type: 'image' | 'video' | 'raw'
  format: string | null
  bytes: number
  uploaded_at: string
  /** Small signed 88×88 crop, images only. */
  thumb_url: string | null
}

export type FilesResponse = {
  data: ProjectFile[]
  storage: { enabled: boolean; max_upload_mb: number }
}

export type UploadSignature = {
  timestamp: number
  folder: string
  type: string
  signature: string
  api_key: string
  cloud_name: string
  upload_url: string
  max_upload_mb: number
}

/** An API key (Settings > API keys). `key` is only present right after creating it. */
export type ApiKey = {
  id: number
  name: string
  prefix: string | null
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
  key?: string
}
