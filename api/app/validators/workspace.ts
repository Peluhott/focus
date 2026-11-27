import vine from '@vinejs/vine'
import { placement } from '#validators/common'

const name = () => vine.string().trim().minLength(1).maxLength(40)

export const createWorkspaceValidator = vine.compile(vine.object({ name: name() }))

export const updateWorkspaceValidator = vine.compile(
  vine.object({
    name: name().optional(),
    ...placement,
  })
)
