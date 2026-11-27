import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import storageConfig, { storageConfigured } from '#config/storage'
import AppError from '#exceptions/app_error'
import { uploadFeedbackImage } from '#services/storage/cloudinary'
import { feedbackValidator } from '#validators/feedback'

/**
 * POST /feedback (session only; FEEDBACK.md): "Send feedback". Saved in the
 * feedback table and logged, so it shows in the server logs too. Multipart
 * when a screenshot comes along (`screenshot`, an image), JSON otherwise.
 * The screenshot goes to Cloudinary (authenticated) when storage is set up.
 */
export default class FeedbackController {
  async store({ auth, request, response, workspace }: HttpContext) {
    const user = auth.getUserOrFail()
    const input = await request.validateUsing(feedbackValidator)

    let screenshotId: string | null = null
    const file = request.file('screenshot', {
      size: `${storageConfig.maxUploadMb}mb`,
      extnames: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'],
    })
    if (file) {
      if (!storageConfigured()) {
        throw new AppError('storage_not_configured', 'Screenshots need file storage.', 503)
      }
      if (!file.isValid) throw AppError.validation(file.errors[0]?.message ?? 'Upload failed.')
      try {
        screenshotId = (await uploadFeedbackImage(file.tmpPath!)).public_id
      } catch (error) {
        logger.error({ err: error }, 'feedback screenshot upload failed')
        throw new AppError('storage_error', "Couldn't upload the screenshot.", 502)
      }
    }

    const contactOk = input.contact_ok ?? true
    const [row] = await db
      .table('feedback')
      .insert({
        user_id: user.id,
        workspace_id: workspace.id,
        workspace_name: workspace.displayName,
        type: input.type,
        feature: input.feature,
        message: input.message,
        contact_ok: contactOk,
        email: contactOk ? user.email : null,
        screenshot_public_id: screenshotId,
        page: input.page ?? null,
        app_version: input.app_version ?? null,
        user_agent: input.user_agent ?? request.header('user-agent') ?? null,
        created_at: new Date(),
      })
      .returning('id')

    logger.info(
      { feedbackId: row.id ?? row, type: input.type, feature: input.feature, userId: user.id },
      'feedback received'
    )
    return response.created({ id: row.id ?? row })
  }
}
