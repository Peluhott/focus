import type { HttpContext } from '@adonisjs/core/http'
import { findInWs, inWs } from '#services/scoped'
import type Workspace from '#models/workspace'
import Note from '#models/note'
import { inList, positionFor, topPosition, wantsMove } from '#services/ordering'
import { paginateByPosition } from '#services/paginate'
import { createNoteValidator, listNotesValidator, updateNoteValidator } from '#validators/note'

/** A workspace's notes, in their manual order. */
const notesOf = (ws: Workspace) => () => inWs(Note, ws)
const notesList = (ws: Workspace) => `notes:${ws.id}`

/** `%`, `_` and `\` match literally in a search. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

export default class NotesController {
  /** GET /notes: in your order, optionally filtered by `q`. */
  async index({ request, workspace }: HttpContext) {
    const filters = await listNotesValidator.validate(request.qs())
    const query = inWs(Note, workspace)
    if (filters.q) {
      const pattern = likePattern(filters.q)
      query.where((q) => q.whereILike('title', pattern).orWhereILike('body', pattern))
    }
    const { rows, nextCursor } = await paginateByPosition<Note>(query, filters, 'notes')
    return { data: rows.map((n) => n.serialize()), next_cursor: nextCursor }
  }

  async show({ params, workspace }: HttpContext) {
    const note = await findInWs(Note, workspace, params.id)
    return note.serialize()
  }

  /** POST /notes: new notes go on top unless before_id / after_id says where. */
  async store({ request, response, workspace }: HttpContext) {
    const input = await request.validateUsing(createNoteValidator)
    const note = await inList(notesList(workspace), async (trx) =>
      Note.create(
        {
          workspaceId: workspace.id,
          title: input.title ?? '',
          body: input.body ?? '',
          position: wantsMove(input)
            ? await positionFor(notesOf(workspace), input, 0, trx)
            : await topPosition(notesOf(workspace), trx),
        },
        { client: trx }
      )
    )
    return response.created(note.serialize())
  }

  /** PATCH /notes/:id: edit, and/or move with before_id / after_id. */
  async update({ params, request, workspace }: HttpContext) {
    const note = await findInWs(Note, workspace, params.id)
    const input = await request.validateUsing(updateNoteValidator)
    if (input.title !== undefined) note.title = input.title
    if (input.body !== undefined) note.body = input.body

    if (wantsMove(input)) {
      await inList(notesList(workspace), async (trx) => {
        note.position = await positionFor(notesOf(workspace), input, note.id, trx)
        await note.useTransaction(trx).save()
      })
    } else {
      await note.save()
    }
    return note.serialize()
  }

  async destroy({ params, response, workspace }: HttpContext) {
    const note = await findInWs(Note, workspace, params.id)
    await note.delete()
    return response.noContent()
  }
}
