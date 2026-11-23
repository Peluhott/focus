import vine from '@vinejs/vine'
import { ALIGNMENT_STATUSES } from '#models/todo'
import { isoDate, listQuery, placement } from '#validators/common'

export const listTodosValidator = vine.compile(
  vine.object({
    ...listQuery,
    done: vine.boolean().optional(),
    date: isoDate().optional(),
    alignment_status: vine.enum(ALIGNMENT_STATUSES).optional(),
  })
)

export const createTodoValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500),
    notes: vine.string().maxLength(10000).optional(),
    date: isoDate().nullable().optional(),
    recurring: vine.boolean().optional(),
  })
)

export const updateTodoValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    notes: vine.string().maxLength(10000).optional(),
    date: isoDate().nullable().optional(),
    done: vine.boolean().optional(),
    /** Repeat: stays on the list; each check-off logs a completion. */
    recurring: vine.boolean().optional(),
    /** "Link to…": a manual link to an active goal (null unlinks). */
    matched_goal_id: vine.number().withoutDecimals().positive().nullable().optional(),
    ...placement,
  })
)

export const listCompletionsValidator = vine.compile(
  vine.object({
    from: isoDate().optional(),
    to: isoDate().optional(),
  })
)
