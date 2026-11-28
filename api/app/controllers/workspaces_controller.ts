import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { generateKeyBetween } from 'fractional-indexing'
import AppError from '#exceptions/app_error'
import Workspace, { MAX_WORKSPACES, workspaceView } from '#models/workspace'
import { workspacesOf } from '#services/accounts'
import { inList, positionFor, wantsMove } from '#services/ordering'
import { queueFileDeletes } from '#services/storage/deletes'
import { createWorkspaceValidator, updateWorkspaceValidator } from '#validators/workspace'

const list = (userId: number) => `workspaces:${userId}`
const siblings = (userId: number) => () => Workspace.query().where('user_id', userId)

const listed = (userId: number, trx: TransactionClientContract) =>
  Workspace.ofUser(userId).useTransaction(trx)

async function assertNameFree(userId: number, name: string, exceptId?: number) {
  const query = Workspace.query()
    .where('user_id', userId)
    .whereRaw('lower(name) = ?', [name.toLowerCase()])
  if (exceptId !== undefined) query.whereNot('id', exceptId)
  if (await query.first()) {
    throw AppError.validation(`You already have a workspace called "${name}".`)
  }
}

/**
 * The user's workspaces (session only). Each has its own goals, projects,
 * to-dos, notes and AI setting. Users add as many as they like (up to
 * MAX_WORKSPACES), rename, reorder and delete them, but always keep one.
 */
export default class WorkspacesController {
  async index({ auth }: HttpContext) {
    const rows = await workspacesOf(auth.getUserOrFail().id)
    return { data: rows.map(workspaceView) }
  }

  /**
   * POST /workspaces { name }: at the bottom, goal limit 3, AI off until
   * turned on with the warning (not copied from the current workspace, so
   * the warning is never skipped).
   */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { name } = await request.validateUsing(createWorkspaceValidator)
    await workspacesOf(user.id)
    const workspace = await inList(list(user.id), async (trx) => {
      const rows = await listed(user.id, trx)
      if (rows.length >= MAX_WORKSPACES) {
        throw AppError.validation(`You can have up to ${MAX_WORKSPACES} workspaces.`)
      }
      await assertNameFree(user.id, name)
      return Workspace.create(
        {
          userId: user.id,
          kind: null,
          name,
          position: generateKeyBetween(rows.at(-1)?.position ?? null, null),
          aiEnabled: false,
          aiAckRequired: true,
          focusLimit: 3,
        },
        { client: trx }
      )
    })
    return response.created(workspaceView(workspace))
  }

  /** PATCH /workspaces/:id { name?, before_id? | after_id? } */
  async update({ auth, params, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const workspace = await Workspace.query()
      .where('user_id', user.id)
      .where('id', params.id)
      .firstOrFail()
    const input = await request.validateUsing(updateWorkspaceValidator)
    if (input.name !== undefined) {
      await assertNameFree(user.id, input.name, workspace.id)
      workspace.name = input.name
    }
    if (wantsMove(input)) {
      await inList(list(user.id), async (trx) => {
        workspace.position = await positionFor(siblings(user.id), input, workspace.id, trx)
        await workspace.useTransaction(trx).save()
      })
    } else {
      await workspace.save()
    }
    return workspaceView(workspace)
  }

  /**
   * DELETE /workspaces/:id: the workspace and everything in it (the
   * database cascades). 409 last_workspace for the only one left. Its
   * files leave Cloudinary through the worker, its AI spend this month
   * still counts toward the caps, and its AI consents are kept.
   */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const files = await inList(list(user.id), async (trx) => {
      const rows = await Workspace.ofUser(user.id).useTransaction(trx)
      const workspace = rows.find((w) => w.id === Number(params.id))
      if (!workspace) throw AppError.notFound('Workspace')
      if (rows.length <= 1) {
        throw new AppError('last_workspace', 'You need at least one workspace.', 409)
      }

      const found = await trx
        .from('project_files')
        .join('projects', 'projects.id', 'project_files.project_id')
        .where('projects.workspace_id', workspace.id)
        .select(
          'project_files.cloudinary_public_id as cloudinaryPublicId',
          'project_files.resource_type as resourceType'
        )

      // AI spend needs nothing here: ai_usage rows keep counting (their
      // workspace_id just goes null).
      await trx
        .from('ai_consents')
        .where('workspace_id', workspace.id)
        .whereNull('workspace_name')
        .update({ workspace_name: workspace.displayName })

      await workspace.useTransaction(trx).delete()

      if (user.lastWorkspaceId === workspace.id || user.lastWorkspaceId === null) {
        const next = rows.find((w) => w.id !== workspace.id)!
        user.useTransaction(trx)
        user.lastWorkspaceId = next.id
        await user.save()
      }
      return found as { cloudinaryPublicId: string; resourceType: string }[]
    })
    await queueFileDeletes(files)
    return response.noContent()
  }
}
