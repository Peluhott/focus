import { useQuery } from '@tanstack/react-query'
import { get } from './api'
import type { CalendarEntry } from './types'

export const calendarKey = (month: string) => ['calendar', month] as const

/** Open dated to-dos in one month ("YYYY-MM"). */
export function useCalendar(month: string) {
  return useQuery({
    queryKey: calendarKey(month),
    queryFn: () => get<{ data: CalendarEntry[] }>(`/calendar?month=${month}`).then((r) => r.data),
  })
}
