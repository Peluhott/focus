import vine from '@vinejs/vine'

const fileName = () => vine.string().trim().minLength(1).maxLength(255)

/** POST /projects/:id/files with the result of a direct browser upload. */
export const saveUploadValidator = vine.compile(
  vine.object({
    name: fileName(),
    public_id: vine.string().minLength(1).maxLength(500),
    version: vine.number().withoutDecimals(),
    signature: vine.string().minLength(1).maxLength(200),
    /** Where to look the file up; its real type, size and format come from Cloudinary. */
    resource_type: vine.enum(['image', 'video', 'raw'] as const),
    /** Sent by the web app but ignored (Cloudinary is asked instead). */
    format: vine.string().maxLength(32).nullable().optional(),
    bytes: vine.number().withoutDecimals().min(0).optional(),
  })
)

export const renameFileValidator = vine.compile(vine.object({ name: fileName() }))
