import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import storageConfig, { storageConfigured } from '#config/storage'
import AppError from '#exceptions/app_error'
import Project from '#models/project'
import ProjectFile from '#models/project_file'
import { findFile, findInWs } from '#services/scoped'
import {
  fileExpirySeconds,
  signUpload,
  signedUrl,
  thumbUrl,
  uploadFile,
  verifyUpload,
  type UploadResult,
} from '#services/storage/cloudinary'
import { queueFileDeletes } from '#services/storage/deletes'
import { renameFileValidator, saveUploadValidator } from '#validators/file'

const maxBytes = () => storageConfig.maxUploadMb * 1024 * 1024

function view(file: ProjectFile) {
  return { ...file.serialize(), thumb_url: thumbUrl(file) }
}

function tooLarge(name: string) {
  return AppError.validation(
    `${name} is too large. Files can be up to ${storageConfig.maxUploadMb} MB.`
  )
}

function requireStorage() {
  if (!storageConfigured()) {
    throw new AppError('storage_not_configured', 'File storage is not set up.', 503)
  }
}

/** Project files (feature spec "Project files"): metadata here, files in Cloudinary. */
export default class ProjectFilesController {
  /** GET /projects/:id/files: newest first, plus whether storage is set up. */
  async index({ params, workspace }: HttpContext) {
    const project = await findInWs(Project, workspace, params.id)
    const files = await ProjectFile.query()
      .where('project_id', project.id)
      .orderBy('uploaded_at', 'desc')
      .orderBy('id', 'desc')
    return {
      data: files.map(view),
      storage: { enabled: storageConfigured(), max_upload_mb: storageConfig.maxUploadMb },
    }
  }

  /** POST /projects/:id/files/sign: a signature for a direct browser upload. */
  async sign({ params, workspace }: HttpContext) {
    requireStorage()
    const project = await findInWs(Project, workspace, params.id)
    return signUpload(project.id)
  }

  /**
   * POST /projects/:id/files. Multipart (API clients): the server uploads
   * the `file` field to Cloudinary. JSON (web app): saves the result of a
   * direct upload after checking Cloudinary's signature.
   */
  async store({ params, request, response, workspace }: HttpContext) {
    requireStorage()
    const project = await findInWs(Project, workspace, params.id)

    let name: string
    let result: UploadResult
    if (request.header('content-type')?.startsWith('multipart/')) {
      const file = request.file('file', { size: `${storageConfig.maxUploadMb}mb` })
      if (!file) throw AppError.validation('Attach the file as "file".')
      name = String(request.input('name') ?? '').trim() || file.clientName
      if (!file.isValid) {
        if (file.errors.some((e) => e.type === 'size')) throw tooLarge(name)
        throw AppError.validation(file.errors[0]?.message ?? 'Upload failed.')
      }
      try {
        result = await uploadFile(project.id, file.tmpPath!)
      } catch (error) {
        logger.error({ err: error }, 'cloudinary upload failed')
        throw new AppError('storage_error', "Couldn't upload to file storage.", 502)
      }
    } else {
      const input = await request.validateUsing(saveUploadValidator)
      name = input.name
      result = { ...input, format: input.format ?? null }
      if (!verifyUpload(project.id, result)) {
        throw AppError.validation('That upload could not be verified.')
      }
    }
    if (result.bytes > maxBytes()) {
      await queueFileDeletes([
        { cloudinaryPublicId: result.public_id, resourceType: result.resource_type },
      ])
      throw tooLarge(name)
    }

    const file = await ProjectFile.create({
      projectId: project.id,
      name,
      cloudinaryPublicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format || null,
      bytes: result.bytes,
      uploadedAt: DateTime.now(),
    })
    return response.created(view(file))
  }

  /** PATCH /files/:id { name } */
  async update({ params, request, workspace }: HttpContext) {
    const file = await findFile(workspace, params.id)
    const { name } = await request.validateUsing(renameFileValidator)
    file.name = name
    await file.save()
    return view(file)
  }

  /** DELETE /files/:id: the record goes now; Cloudinary deletion is queued. */
  async destroy({ params, response, workspace }: HttpContext) {
    const file = await findFile(workspace, params.id)
    await file.delete()
    await queueFileDeletes([file])
    return response.noContent()
  }

  /** GET /files/:id/url: signed URLs, valid for 10 minutes. */
  async url({ params, workspace }: HttpContext) {
    requireStorage()
    const file = await findFile(workspace, params.id)
    return {
      url: signedUrl(file),
      download_url: signedUrl(file, true),
      expires_at: DateTime.now().plus({ seconds: fileExpirySeconds() }).toISO(),
    }
  }
}
