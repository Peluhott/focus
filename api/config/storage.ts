import env from '#start/env'

/**
 * Project files on Cloudinary (feature spec "Project files"). Focus keeps
 * only metadata; the files live in Cloudinary as `authenticated` assets.
 */
const storageConfig = {
  cloudName: env.get('CLOUDINARY_CLOUD_NAME'),
  apiKey: env.get('CLOUDINARY_API_KEY'),
  apiSecret: env.get('CLOUDINARY_API_SECRET'),
  /** Free plan: 10 MB per image or raw file. */
  maxUploadMb: env.get('MAX_UPLOAD_MB') ?? 10,
  /** Signed open/download URLs last 10 minutes. */
  urlTtlSeconds: 600,
  /** Files go in a folder per project. */
  folder: (projectId: number) => `focus/projects/${projectId}`,
}

export function storageConfigured() {
  return Boolean(storageConfig.cloudName && storageConfig.apiKey && storageConfig.apiSecret)
}

export default storageConfig
