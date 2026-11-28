import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowSquareOutIcon,
  CloudSlashIcon,
  DownloadSimpleIcon,
  FileAudioIcon,
  FileCsvIcon,
  FileDocIcon,
  FileIcon,
  FileImageIcon,
  FilePdfIcon,
  FilePptIcon,
  FileTextIcon,
  FileVideoIcon,
  FileXlsIcon,
  FileZipIcon,
  PencilSimpleIcon,
  TrashIcon,
  TrayArrowDownIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import { shortDayMaybeYear } from '../lib/dates'
import {
  fileType,
  fileUrls,
  filesKey,
  formatBytes,
  uploadFile,
  useDeleteFile,
  useProjectFiles,
  useRenameFile,
  type FileKind,
} from '../lib/files'
import { errorMessage } from '../lib/optimistic'
import { useToast } from '../lib/toast'
import type { FilesResponse, ProjectFile } from '../lib/types'

const ICONS: Record<FileKind, typeof FileIcon> = {
  image: FileImageIcon,
  pdf: FilePdfIcon,
  doc: FileDocIcon,
  xls: FileXlsIcon,
  csv: FileCsvIcon,
  ppt: FilePptIcon,
  zip: FileZipIcon,
  video: FileVideoIcon,
  audio: FileAudioIcon,
  text: FileTextIcon,
  file: FileIcon,
}

function TypeIcon({ name }: { name: string }) {
  const Icon = ICONS[fileType(name).kind]
  return <Icon size={24} aria-hidden />
}

type Upload = {
  key: number
  file: File
  loaded: number
  error: string | null
  abort: () => void
}

type Rejection = { key: number; message: string }

let nextKey = 1

/**
 * The Files section on Project detail (PROJECT-FILES.md), between Details
 * and Tasks. The whole section is the drop zone.
 */
export default function ProjectFiles({ projectId }: { projectId: number }) {
  const { data } = useProjectFiles(projectId)
  const qc = useQueryClient()
  const toast = useToast()
  const rename = useRenameFile(projectId)
  const remove = useDeleteFile(projectId)
  const picker = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [rejections, setRejections] = useState<Rejection[]>([])
  const [renaming, setRenaming] = useState<number | null>(null)

  if (!data) return <div className="files" />

  const { enabled, max_upload_mb: maxMb } = data.storage
  const files = data.data

  if (!enabled) {
    return (
      <div className="files" data-screen-label="Project files">
        <div className="files-header">
          <h3 className="files-title">Files</h3>
        </div>
        <div className="files-off">
          <CloudSlashIcon size={20} aria-hidden />
          <div>
            <div style={{ fontSize: 15 }}>File storage not set up</div>
            <div className="files-off-note">
              Add your Cloudinary credentials to the server to turn on uploads. The rest of the
              project works as usual.
            </div>
          </div>
        </div>
      </div>
    )
  }

  function patchUpload(key: number, change: Partial<Upload>) {
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...change } : u)))
  }

  function start(file: File, key = nextKey++) {
    const handle = uploadFile(projectId, file, (loaded) => patchUpload(key, { loaded }))
    const row: Upload = { key, file, loaded: 0, error: null, abort: handle.abort }
    setUploads((list) => (list.some((u) => u.key === key) ? list.map((u) => (u.key === key ? row : u)) : [row, ...list]))
    handle.promise
      .then((saved) => {
        qc.setQueryData<FilesResponse>(filesKey(projectId), (old) =>
          old ? { ...old, data: [saved, ...old.data.filter((f) => f.id !== saved.id)] } : old
        )
        setUploads((list) => list.filter((u) => u.key !== key))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setUploads((list) => list.filter((u) => u.key !== key))
          return
        }
        patchUpload(key, { error: `${file.name} didn't upload. ${errorMessage(error)}` })
      })
  }

  function add(list: FileList | null) {
    if (!list) return
    const tooBig: Rejection[] = []
    for (const file of Array.from(list)) {
      if (file.size > maxMb * 1024 * 1024) {
        tooBig.push({
          key: nextKey++,
          message: `${file.name} is ${formatBytes(file.size)}. Files can be up to ${maxMb} MB.`,
        })
      } else {
        start(file)
      }
    }
    if (tooBig.length) setRejections((r) => [...tooBig, ...r])
  }

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!dragging) setDragging(true)
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setDragging(false)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return
    e.preventDefault()
    setDragging(false)
    add(e.dataTransfer.files)
  }

  /** Open a tab right away (so it isn't blocked), then point it at the signed URL. */
  async function openFile(file: ProjectFile, download: boolean) {
    const tab = download ? null : window.open('about:blank', '_blank')
    try {
      const urls = await fileUrls(file.id)
      if (download) {
        window.location.assign(urls.download_url)
      } else if (tab) {
        tab.opener = null
        tab.location.href = urls.url
      } else {
        window.open(urls.url, '_blank', 'noopener')
      }
    } catch (error) {
      tab?.close()
      toast(errorMessage(error))
    }
  }

  function commitRename(file: ProjectFile, value: string) {
    setRenaming(null)
    const name = value.trim()
    if (!name || name === file.name) return
    rename.mutate({ id: file.id, name })
  }

  const count = files.length

  return (
    <div
      className={`files${dragging ? ' is-dragging' : ''}`}
      data-screen-label="Project files"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="files-header">
        <h3 className="files-title">
          Files
          {count > 0 && <span className="files-count">{count}</span>}
        </h3>
        <button className="btn btn-secondary" onClick={() => picker.current?.click()}>
          <UploadSimpleIcon aria-hidden />
          Upload
        </button>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          aria-label="Upload files"
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {rejections.map((r) => (
        <ErrorLine key={r.key} message={r.message} onDismiss={() => setRejections((l) => l.filter((x) => x.key !== r.key))} />
      ))}

      {dragging ? (
        <p className="files-empty is-drop">
          <TrayArrowDownIcon size={18} aria-hidden />
          Drop to upload to this project
        </p>
      ) : (
        count === 0 &&
        uploads.length === 0 && (
          <p className="files-empty">
            <TrayArrowDownIcon size={18} aria-hidden />
            No files. Drop files here or click Upload.
          </p>
        )
      )}

      <div className="files-list">
        {uploads.map((u) => (
          <div key={u.key} className="file-row">
            <div className="file-thumb is-pending">
              <TypeIcon name={u.file.name} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="file-name-pending">{u.file.name}</div>
              {u.error ? (
                <div className="file-error-line">
                  <ErrorLine message={u.error}>
                    <button className="btn btn-ghost" onClick={() => start(u.file, u.key)}>
                      Retry
                    </button>
                  </ErrorLine>
                </div>
              ) : (
                <div className="file-progress">
                  <div className="file-progress-track">
                    <div
                      className="file-progress-fill"
                      style={{ width: `${Math.min(100, Math.round((u.loaded / (u.file.size || 1)) * 100))}%` }}
                    />
                  </div>
                  <span className="file-progress-label">
                    {Math.min(100, Math.round((u.loaded / (u.file.size || 1)) * 100))}% of {formatBytes(u.file.size)}
                  </span>
                </div>
              )}
            </div>
            <button
              className="btn btn-ghost btn-icon file-action"
              aria-label="Cancel upload"
              title="Cancel upload"
              onClick={() => {
                if (u.error) setUploads((l) => l.filter((x) => x.key !== u.key))
                else u.abort()
              }}
            >
              <XIcon size={18} aria-hidden />
            </button>
          </div>
        ))}

        {files.map((file) => (
          <div key={file.id} className="file-row">
            <div className="file-thumb">
              {file.thumb_url ? (
                <img src={file.thumb_url} alt="" loading="lazy" />
              ) : (
                <TypeIcon name={file.name} />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              {renaming === file.id ? (
                <input
                  className="input file-rename"
                  autoFocus
                  aria-label="File name"
                  defaultValue={file.name}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(file, e.currentTarget.value)
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                  onBlur={(e) => commitRename(file, e.currentTarget.value)}
                />
              ) : (
                <a
                  href="#"
                  className="file-name"
                  title={`Open ${file.name}`}
                  onClick={(e) => {
                    e.preventDefault()
                    void openFile(file, false)
                  }}
                >
                  {file.name}
                </a>
              )}
              <div className="file-meta">
                {fileType(file.name).label} · {formatBytes(file.bytes)} · {shortDayMaybeYear(file.uploaded_at)}
              </div>
            </div>
            <div className="file-actions">
              <IconButton label="Open" onClick={() => void openFile(file, false)}>
                <ArrowSquareOutIcon size={18} aria-hidden />
              </IconButton>
              <IconButton label="Download" onClick={() => void openFile(file, true)}>
                <DownloadSimpleIcon size={18} aria-hidden />
              </IconButton>
              <IconButton label="Rename" onClick={() => setRenaming(file.id)}>
                <PencilSimpleIcon size={18} aria-hidden />
              </IconButton>
              <IconButton label="Delete" onClick={() => remove(file)}>
                <TrashIcon size={18} aria-hidden />
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      <p className="files-footnote">
        Any file type, up to {maxMb} MB each. Files are private to your account.
      </p>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className="btn btn-ghost btn-icon file-action" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

function ErrorLine({
  message,
  onDismiss,
  children,
}: {
  message: string
  onDismiss?: () => void
  children?: ReactNode
}) {
  return (
    <div role="alert" className="files-error">
      <WarningCircleIcon size={18} aria-hidden style={{ flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{message}</span>
      {children}
      {onDismiss && (
        <button className="btn btn-ghost btn-icon files-dismiss" aria-label="Dismiss" onClick={onDismiss}>
          <XIcon aria-hidden />
        </button>
      )}
    </div>
  )
}
