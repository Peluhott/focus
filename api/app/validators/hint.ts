import vine from '@vinejs/vine'

export const requestHintValidator = vine.compile(
  vine.object({
    /** "Another idea": ask again even if the to-do hasn't changed. */
    force: vine.boolean().optional(),
  })
)

export const addHintStepValidator = vine.compile(
  vine.object({
    /** The step's text (the run's `text`, possibly edited), as the new to-do's title. */
    title: vine.string().trim().minLength(1).maxLength(500),
  })
)
