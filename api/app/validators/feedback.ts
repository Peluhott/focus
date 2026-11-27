import vine from '@vinejs/vine'

export const FEEDBACK_TYPES = ['idea', 'bug', 'other'] as const

/** The form's "Feature" options (FEEDBACK.md). */
export const FEEDBACK_FEATURES = [
  'General',
  'Goals',
  'To-dos',
  'Projects',
  'Notes',
  'Calendar',
  'Timer',
  'Search',
  'Help me start',
  'Off-goal flags',
  'Settings',
] as const

/** POST /feedback (JSON, or multipart with an optional `screenshot` file). */
export const feedbackValidator = vine.compile(
  vine.object({
    type: vine.enum(FEEDBACK_TYPES),
    feature: vine.enum(FEEDBACK_FEATURES),
    message: vine.string().trim().minLength(1).maxLength(5000),
    contact_ok: vine.boolean().optional(),
    page: vine.string().trim().maxLength(500).optional(),
    app_version: vine.string().trim().maxLength(40).optional(),
    user_agent: vine.string().trim().maxLength(500).optional(),
  })
)
