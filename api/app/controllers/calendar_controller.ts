import type { HttpContext } from '@adonisjs/core/http'
import Todo from '#models/todo'
import { calendarValidator } from '#validators/suggestion'

/**
 * GET /calendar?month=YYYY-MM: every open, dated to-do in that month as
 * { date, id, title }, by date then list order. Dates are plain calendar
 * days, so there's no time zone to shift.
 */
export default class CalendarController {
  async index({ request }: HttpContext) {
    const { month } = await calendarValidator.validate(request.qs())
    const [y, m] = month.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    const rows = await Todo.query()
      .where('done', false)
      .where('date', '>=', `${month}-01`)
      .where('date', '<', `${next}-01`)
      .orderBy('date', 'asc')
      .orderBy('position', 'asc')
      .select('id', 'title', 'date')
    return { data: rows.map((t) => ({ date: t.date, id: t.id, title: t.title })) }
  }
}
