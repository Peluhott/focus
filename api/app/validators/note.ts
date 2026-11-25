import vine from '@vinejs/vine'
import { listQuery, placement } from '#validators/common'

export const listNotesValidator = vine.compile(
  vine.object({
    ...listQuery,
    /** Matches title or body, case-insensitive. */
    q: vine.string().trim().maxLength(200).optional(),
  })
)

export const createNoteValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(200).optional(),
    body: vine.string().maxLength(50000).optional(),
    ...placement,
  })
)

export const updateNoteValidator = vine.compile(
  vine.object({
    title: vine.string().trim().maxLength(200).optional(),
    body: vine.string().maxLength(50000).optional(),
    ...placement,
  })
)
