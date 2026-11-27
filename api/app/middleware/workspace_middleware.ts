import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import AppError from '#exceptions/app_error'
import type Workspace from '#models/workspace'
import { workspacesOf } from '#services/accounts'

export const WORKSPACE_HEADER = 'x-focus-workspace'

/**
 * Pick one of the user's workspaces from an `X-Focus-Workspace` value:
 * - a workspace id (what the web app sends),
 * - "personal" / "work" for the two default workspaces (older API scripts),
 * - or a workspace name (case-insensitive).
 * Missing: Personal if it's still there, else the first workspace, so
 * existing API scripts keep working. Unknown: 404 workspace_not_found.
 */
export function pickWorkspace(list: Workspace[], header: string | undefined): Workspace {
  const raw = (header ?? '').trim()
  if (!raw) return list.find((w) => w.kind === 'personal') ?? list[0]
  const lower = raw.toLowerCase()
  const found =
    (/^\d+$/.test(raw) && list.find((w) => w.id === Number(raw))) ||
    list.find((w) => w.kind === lower) ||
    list.find((w) => w.displayName.toLowerCase() === lower)
  if (!found) {
    throw new AppError('workspace_not_found', `No workspace "${raw}".`, 404)
  }
  return found
}

/**
 * Which workspace a request works in. Sets ctx.workspace to one of the
 * signed-in user's workspaces. Runs after `auth`.
 */
export default class WorkspaceMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    const list = await workspacesOf(user.id)
    ctx.workspace = pickWorkspace(list, ctx.request.header(WORKSPACE_HEADER))
    return next()
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /** Set by the workspace middleware on every data route. */
    workspace: Workspace
  }
}
