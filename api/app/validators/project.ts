import vine from '@vinejs/vine'
import { PROJECT_STATUSES } from '#models/project'
import { TASK_STATUSES } from '#models/task'
import { isoDate, listQuery, placement } from '#validators/common'

export const listProjectsValidator = vine.compile(
  vine.object({
    ...listQuery,
    /** Default: everything except archived. "all" includes archived. */
    status: vine.enum([...PROJECT_STATUSES, 'all'] as const).optional(),
    /** A goal id, or "none" for projects without a goal. */
    goal_id: vine
      .string()
      .regex(/^(none|\d+)$/)
      .optional(),
  })
)

export const createProjectValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(300).optional(),
    details: vine.string().maxLength(50000).optional(),
    status: vine.enum(PROJECT_STATUSES).optional(),
    goal_id: vine.number().withoutDecimals().positive().nullable().optional(),
    due_date: isoDate().nullable().optional(),
  })
)

export const updateProjectValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(300).optional(),
    details: vine.string().maxLength(50000).optional(),
    status: vine.enum(PROJECT_STATUSES).optional(),
    goal_id: vine.number().withoutDecimals().positive().nullable().optional(),
    due_date: isoDate().nullable().optional(),
    ...placement,
  })
)

export const createTaskValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500),
    details: vine.string().maxLength(20000).optional(),
    due_date: isoDate().nullable().optional(),
  })
)

export const updateTaskValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    details: vine.string().maxLength(20000).optional(),
    due_date: isoDate().nullable().optional(),
    status: vine.enum(TASK_STATUSES).optional(),
    ...placement,
  })
)
