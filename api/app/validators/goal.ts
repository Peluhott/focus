import vine from '@vinejs/vine'
import { GOAL_STATUSES } from '#models/goal'
import { listQuery, placement } from '#validators/common'

export const listGoalsValidator = vine.compile(
  vine.object({
    ...listQuery,
    status: vine.enum([...GOAL_STATUSES, 'all'] as const).optional(),
  })
)

export const createGoalValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(300),
    details: vine.string().maxLength(20000).optional(),
  })
)

export const updateGoalValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(300).optional(),
    details: vine.string().maxLength(20000).optional(),
    ...placement,
  })
)

export const createSubGoalValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(300),
    details: vine.string().maxLength(20000).optional(),
  })
)

export const updateSubGoalValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(300).optional(),
    details: vine.string().maxLength(20000).optional(),
    done: vine.boolean().optional(),
    ...placement,
  })
)
