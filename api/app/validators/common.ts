import vine from '@vinejs/vine'

/** A calendar date, "YYYY-MM-DD". Postgres rejects impossible ones (422). */
export const isoDate = () =>
  vine
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)

/** before_id / after_id for reordering. */
export const placement = {
  before_id: vine.number().withoutDecimals().positive().optional(),
  after_id: vine.number().withoutDecimals().positive().optional(),
}

export const listQuery = {
  cursor: vine.string().optional(),
  limit: vine.number().withoutDecimals().range([1, 100]).optional(),
}
