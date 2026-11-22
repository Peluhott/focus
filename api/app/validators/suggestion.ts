import vine from '@vinejs/vine'

export const listStatusValidator = (statuses: readonly [string, ...string[]]) =>
  vine.compile(vine.object({ status: vine.enum([...statuses, 'all']).optional() }))

/** POST /goal-suggestions/:id/accept: optional edits from the goal editor. */
export const acceptSuggestionValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    details: vine.string().trim().maxLength(10_000).optional(),
    sub_goals: vine
      .array(vine.string().trim().minLength(1).maxLength(500))
      .maxLength(50)
      .optional(),
  })
)

/** GET /calendar?month=YYYY-MM */
export const calendarValidator = vine.compile(
  vine.object({
    month: vine
      .string()
      .trim()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  })
)
