import logger from '@adonisjs/core/services/logger'
import type ProjectFile from '#models/project_file'
import { alignmentQueue } from '#services/alignment/queue'

/** Queue Cloudinary deletions; the worker retries while Cloudinary is down. */
export async function queueFileDeletes(
  files: Pick<ProjectFile, 'cloudinaryPublicId' | 'resourceType'>[]
) {
  for (const file of files) {
    try {
      await alignmentQueue().deleteFile({
        publicId: file.cloudinaryPublicId,
        resourceType: file.resourceType,
      })
    } catch (error) {
      logger.error(
        { err: error, publicId: file.cloudinaryPublicId },
        'could not queue a file deletion'
      )
    }
  }
}
