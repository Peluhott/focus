import { currentWorkspace } from './workspace'

/**
 * Thin fetch wrapper for /api/v1. Same origin (Vite proxies /api in dev), so
 * the session cookie rides along. Mutating requests echo the XSRF-TOKEN
 * cookie in the X-XSRF-TOKEN header, which the API's CSRF check expects.
 */

export class ApiError extends Error {
  status: number
  code: string
  fields?: { field: string; message: string }[]

  constructor(status: number, code: string, message: string, fields?: ApiError['fields']) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/** While true, requests use keepalive, so they finish after the tab closes. */
let keepalive = false
export const setKeepalive = (on: boolean) => {
  keepalive = on
}

export async function api<T = unknown>(method: Method, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  // Which workspace the data routes act on (WORK-MODE.md): its id.
  const ws = currentWorkspace()
  if (ws !== null) headers['X-Focus-Workspace'] = String(ws)
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') {
    const xsrf = readCookie('XSRF-TOKEN')
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf
  }

  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      keepalive,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network_error', "Can't reach the server.")
  }

  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const err = data?.error
    throw new ApiError(
      response.status,
      err?.code ?? 'server_error',
      err?.message ?? `Request failed (${response.status}).`,
      err?.fields
    )
  }
  return data as T
}

export const get = <T>(path: string) => api<T>('GET', path)
export const post = <T>(path: string, body?: unknown) => api<T>('POST', path, body ?? {})
export const patch = <T>(path: string, body: unknown) => api<T>('PATCH', path, body)
export const del = <T = void>(path: string) => api<T>('DELETE', path)

/** POST multipart form data (e.g. feedback with a screenshot). */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const ws = currentWorkspace()
  if (ws !== null) headers['X-Focus-Workspace'] = String(ws)
  const xsrf = readCookie('XSRF-TOKEN')
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf
  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, { method: 'POST', headers, credentials: 'same-origin', body: form })
  } catch {
    throw new ApiError(0, 'network_error', "Can't reach the server.")
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const err = data?.error
    throw new ApiError(response.status, err?.code ?? 'server_error', err?.message ?? 'Request failed.', err?.fields)
  }
  return data as T
}

/** Read every page of a cursor-paginated list. */
export async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = []
  let cursor: string | null = null
  const sep = path.includes('?') ? '&' : '?'
  do {
    const url: string = cursor ? `${path}${sep}cursor=${encodeURIComponent(cursor)}` : path
    const page: { data: T[]; next_cursor: string | null } = await get(url)
    out.push(...page.data)
    cursor = page.next_cursor
  } while (cursor)
  return out
}
