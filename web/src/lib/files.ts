import { useQuery } from '@tanstack/react-query'
import { ApiError, del, get, patch, post } from './api'
import { useOptimisticMutation } from './optimistic'
import type { FilesResponse, ProjectFile, UploadSignature } from './types'

/** Project files (PROJECT-FILES.md). Uploads go straight to Cloudinary. */

export const filesKey = (projectId: number) => ['files', projectId] as const

export function useProjectFiles(projectId: number) {
  return useQuery({
    queryKey: filesKey(projectId),
    queryFn: () => get<FilesResponse>(`/projects/${projectId}/files`),
  })
}

export function useRenameFile(projectId: number) {
  return useOptimisticMutation<ProjectFile, { id: number; name: string }, FilesResponse>({
    scope: `files-${projectId}`,
    queryKey: () => filesKey(projectId),
    mutationFn: ({ id, name }) => patch<ProjectFile>(`/files/${id}`, { name }),
    apply: (old, { id, name }) => ({
      ...old,
      data: old.data.map((f) => (f.id === id ? { ...f, name } : f)),
    }),
  })
}

export function useDeleteFile(projectId: number) {
  return useOptimisticMutation<void, { id: number }, FilesResponse>({
    scope: `files-${projectId}`,
    queryKey: () => filesKey(projectId),
    mutationFn: ({ id }) => del(`/files/${id}`),
    apply: (old, { id }) => ({ ...old, data: old.data.filter((f) => f.id !== id) }),
  })
}

/** Signed URLs, valid 10 minutes. Ask on click, never in advance. */
export const fileUrls = (id: number) =>
  get<{ url: string; download_url: string; expires_at: string }>(`/files/${id}/url`)

export type UploadHandle = { promise: Promise<ProjectFile>; abort: () => void }

/**
 * The web upload flow: sign → upload to Cloudinary with progress → save the
 * record. `abort` cancels the Cloudinary request; no record is saved.
 */
export function uploadFile(
  projectId: number,
  file: File,
  onProgress: (loaded: number) => void
): UploadHandle {
  let xhr: XMLHttpRequest | null = null
  let aborted = false
  const promise = (async () => {
    const sig = await post<UploadSignature>(`/projects/${projectId}/files/sign`)
    if (aborted) throw new DOMException('Aborted', 'AbortError')
    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const form = new FormData()
      form.append('file', file)
      form.append('api_key', sig.api_key)
      form.append('timestamp', String(sig.timestamp))
      form.append('signature', sig.signature)
      form.append('folder', sig.folder)
      form.append('type', sig.type)
      xhr = new XMLHttpRequest()
      xhr.open('POST', sig.upload_url)
      xhr.upload.onprogress = (e) => onProgress(e.loaded)
      xhr.onload = () => {
        let body: Record<string, unknown> | null = null
        try {
          body = JSON.parse(xhr!.responseText)
        } catch {
          body = null
        }
        if (xhr!.status >= 200 && xhr!.status < 300 && body) resolve(body)
        else {
          const message = (body?.error as { message?: string } | undefined)?.message
          reject(new ApiError(xhr!.status, 'storage_error', message ?? 'Upload failed.'))
        }
      }
      xhr.onerror = () => reject(new ApiError(0, 'network_error', 'Upload failed. Check your connection.'))
      xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
      xhr.send(form)
    })
    return post<ProjectFile>(`/projects/${projectId}/files`, {
      name: file.name,
      public_id: result.public_id,
      version: result.version,
      signature: result.signature,
      resource_type: result.resource_type,
      format: result.format ?? null,
      bytes: result.bytes,
    })
  })()
  return {
    promise,
    abort: () => {
      aborted = true
      xhr?.abort()
    },
  }
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'avif'])
const TYPES: Record<string, [string, FileKind]> = {
  pdf: ['PDF', 'pdf'],
  doc: ['Word', 'doc'],
  docx: ['Word', 'doc'],
  xls: ['Excel', 'xls'],
  xlsx: ['Excel', 'xls'],
  csv: ['CSV', 'csv'],
  ppt: ['Slides', 'ppt'],
  pptx: ['Slides', 'ppt'],
  zip: ['ZIP', 'zip'],
  mp4: ['Video', 'video'],
  mov: ['Video', 'video'],
  webm: ['Video', 'video'],
  mp3: ['Audio', 'audio'],
  wav: ['Audio', 'audio'],
  m4a: ['Audio', 'audio'],
  txt: ['Text', 'text'],
  md: ['Markdown', 'text'],
}

export type FileKind =
  | 'image'
  | 'pdf'
  | 'doc'
  | 'xls'
  | 'csv'
  | 'ppt'
  | 'zip'
  | 'video'
  | 'audio'
  | 'text'
  | 'file'

/** Type label and icon kind, from the file name's extension. */
export function fileType(name: string): { label: string; kind: FileKind } {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (IMAGE_EXT.has(ext)) return { label: `${ext.toUpperCase()} image`, kind: 'image' }
  const known = TYPES[ext]
  if (known) return { label: known[0], kind: known[1] }
  return { label: ext ? ext.toUpperCase() : 'File', kind: 'file' }
}

/** "512 B", "412 KB", "2.3 MB", "24 MB". */
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  const mb = b / (1024 * 1024)
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`
}
