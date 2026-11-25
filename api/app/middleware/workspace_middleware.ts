import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import AppError from '#exceptions/app_error'
import Workspace, { WORKSPACE_KINDS, type WorkspaceKind } from '#models/workspace'

export const WORKSPACE_HEADER = 'x-focus-workspace'

/**
 * Which workspace a request works in (designhandoff WORK-MODE.md): the
 * `X-Focus-Workspace: personal|work` header, personal when it's missing so
 * existing API scripts keep working. Sets ctx.workspace to the signed-in
 * user's row. Runs after `auth`.
 */
export default class WorkspaceMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail()
    const raw = (ctx.request.header(WORKSPACE_HEADER) ?? 'personal').trim().toLowerCase()
    if (!WORKSPACE_KINDS.includes(raw as WorkspaceKind)) {
      throw AppError.validation('X-Focus-Workspace must be "personal" or "work".')
    }
    let workspace = await Workspace.query().where('user_id', user.id).where('kind', raw).first()
    // Accounts made before workspaces existed (or by the old deploy) get theirs now.
    if (!workspace) {
      workspace = await Workspace.firstOrCreate(
        { userId: user.id, kind: raw as WorkspaceKind },
        { aiEnabled: raw === 'personal' }
      )
    }
    ctx.workspace = workspace
    return next()
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /** Set by the workspace middleware on every data route. */
    workspace: Workspace
  }
}
