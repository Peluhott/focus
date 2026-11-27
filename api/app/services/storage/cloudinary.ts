import { v2 as cloudinary } from 'cloudinary'
import storageConfig, { storageConfigured } from '#config/storage'
import AppError from '#exceptions/app_error'
import type ProjectFile from '#models/project_file'

/**
 * Project files on Cloudinary (feature spec "Project files"). Uploads are
 * `authenticated`, so their links don't work on their own; opening a file
 * asks the API for a signed URL valid for 10 minutes.
 */

let configured = false
function client() {
  if (!storageConfigured()) {
    throw new AppError('storage_not_configured', 'File storage is not set up.', 503)
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: storageConfig.cloudName,
      api_key: storageConfig.apiKey,
      api_secret: storageConfig.apiSecret,
      secure: true,
    })
    configured = true
  }
  return cloudinary
}

export type UploadResult = {
  public_id: string
  version: number
  signature: string
  resource_type: string
  format?: string | null
  bytes: number
  type?: string
}

/** Signature for a direct browser upload into the project's folder. */
export function signUpload(projectId: number) {
  const c = client()
  const params = {
    timestamp: Math.round(Date.now() / 1000),
    folder: storageConfig.folder(projectId),
    type: 'authenticated',
  }
  const signature = c.utils.api_sign_request(params, storageConfig.apiSecret!)
  return {
    ...params,
    signature,
    api_key: storageConfig.apiKey!,
    cloud_name: storageConfig.cloudName!,
    upload_url: `https://api.cloudinary.com/v1_1/${storageConfig.cloudName}/auto/upload`,
    max_upload_mb: storageConfig.maxUploadMb,
  }
}

/** Is this really Cloudinary's answer for an upload into this project? */
export function verifyUpload(projectId: number, result: UploadResult) {
  const c = client()
  const utils = c.utils as unknown as {
    verify_api_response_signature(publicId: string, version: number, signature: string): boolean
  }
  return (
    result.public_id.startsWith(`${storageConfig.folder(projectId)}/`) &&
    utils.verify_api_response_signature(result.public_id, result.version, result.signature)
  )
}

/** Server-side upload (multipart from API clients). */
export async function uploadFile(projectId: number, path: string): Promise<UploadResult> {
  const result = await client().uploader.upload(path, {
    resource_type: 'auto',
    type: 'authenticated',
    folder: storageConfig.folder(projectId),
  })
  return result as unknown as UploadResult
}

/** A screenshot sent with feedback (FEEDBACK.md), kept private in its own folder. */
export async function uploadFeedbackImage(path: string): Promise<UploadResult> {
  const result = await client().uploader.upload(path, {
    resource_type: 'image',
    type: 'authenticated',
    folder: 'focus/feedback',
  })
  return result as unknown as UploadResult
}

const expiresAt = () => Math.round(Date.now() / 1000) + storageConfig.urlTtlSeconds

/** Signed, expiring URL to open (or, with attachment, download) the file. */
export function signedUrl(file: ProjectFile, attachment = false) {
  return client().utils.private_download_url(file.cloudinaryPublicId, file.format ?? '', {
    resource_type: file.resourceType,
    type: 'authenticated',
    expires_at: expiresAt(),
    attachment,
  })
}

/**
 * A small signed thumbnail for images. Cloudinary's signed delivery URLs
 * don't expire on the free plan, but they only ever show this 88×88 crop.
 */
export function thumbUrl(file: ProjectFile) {
  if (!storageConfigured() || file.resourceType !== 'image' || file.format === 'pdf') return null
  return client().url(file.cloudinaryPublicId, {
    resource_type: 'image',
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format: 'jpg',
    transformation: [{ crop: 'fill', width: 88, height: 88 }],
  })
}

/** Delete from Cloudinary (worker job). "not found" counts as done. */
export async function destroyAsset(publicId: string, resourceType: string) {
  const result = await client().uploader.destroy(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    invalidate: true,
  })
  if (result?.result !== 'ok' && result?.result !== 'not found') {
    throw new Error(`Cloudinary destroy failed: ${JSON.stringify(result)}`)
  }
  return result.result as string
}

export const fileExpirySeconds = () => storageConfig.urlTtlSeconds
