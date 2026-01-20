import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

type AlertsScope = 'private' | 'shared'

export interface AlertsTodoItem {
  id: string
  title: string
  due_date: string
  alarm_time: string | null
  case_number: string | null
}

export interface AlertsCalendarEventItem {
  id: string
  title: string
  start_time: string
  end_time: string | null
  claim_id: string | null
}

export function useAlertsSummary(scope: AlertsScope) {
  return useQuery({
    queryKey: ['alerts-summary', scope],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id
      if (!userId) {
        return { todoAlerts: 0, calendarAlerts: 0, total: 0, todos: [] as AlertsTodoItem[], events: [] as AlertsCalendarEventItem[] }
      }

      // If we're on the shared claims screen, filter alerts to shared claims only.
      let sharedClaimIds: string[] | null = null
      let sharedCaseNumbers: string[] | null = null

      if (scope === 'shared') {
        const { data: shares, error: sharesError } = await supabase
          .from('claim_shares')
          .select('claim_id')
          .or(`owner_id.eq.${userId},shared_with_id.eq.${userId}`)

        if (!sharesError) {
          sharedClaimIds = Array.from(new Set((shares || []).map(s => s.claim_id).filter(Boolean)))
        } else {
          sharedClaimIds = []
        }

        if (!sharedClaimIds.length) {
          return { todoAlerts: 0, calendarAlerts: 0, total: 0, todos: [] as AlertsTodoItem[], events: [] as AlertsCalendarEventItem[] }
        }

        const { data: claims, error: claimsError } = await supabase
          .from('claims')
          .select('case_number, claim_id')
          .in('claim_id', sharedClaimIds as any)

        if (!claimsError) {
          sharedCaseNumbers = Array.from(new Set((claims || []).map(c => c.case_number).filter(Boolean)))
        } else {
          sharedCaseNumbers = []
        }
      }

      const now = new Date()
      const nowIso = now.toISOString()
      const endOfToday = new Date(now)
      endOfToday.setHours(23, 59, 59, 999)
      const endOfTodayIso = endOfToday.toISOString()

      // Assignment logic:
      // - New rows use responsible_user_id
      // - Older rows may have responsible_user_id = null, so we treat user_id as implicit assignee
      const assignedToMeFilter = `responsible_user_id.eq.${userId},and(responsible_user_id.is.null,user_id.eq.${userId})`

      const todoBase = supabase
        .from('todos')
        .select('id,title,due_date,alarm_time,case_number', { head: false })
        .eq('completed', false)
        .or(assignedToMeFilter)

      const todoDueQuery = sharedCaseNumbers?.length
        ? todoBase.in('case_number', sharedCaseNumbers as any).lte('due_date', endOfTodayIso)
        : todoBase.lte('due_date', endOfTodayIso)

      const todoAlarmQuery = sharedCaseNumbers?.length
        ? todoBase
            .in('case_number', sharedCaseNumbers as any)
            .eq('alarm_enabled', true)
            .not('alarm_time', 'is', null)
            .lte('alarm_time', nowIso)
        : todoBase
            .eq('alarm_enabled', true)
            .not('alarm_time', 'is', null)
            .lte('alarm_time', nowIso)

      const [dueTodosRes, alarmTodosRes] = await Promise.all([todoDueQuery, todoAlarmQuery])
      const todoById = new Map<string, AlertsTodoItem>()
      for (const row of (dueTodosRes.data || []) as any[]) {
        if (!row?.id) continue
        todoById.set(row.id, {
          id: row.id,
          title: row.title || 'Untitled task',
          due_date: row.due_date,
          alarm_time: row.alarm_time ?? null,
          case_number: row.case_number ?? null,
        })
      }
      for (const row of (alarmTodosRes.data || []) as any[]) {
        if (!row?.id) continue
        todoById.set(row.id, {
          id: row.id,
          title: row.title || 'Untitled task',
          due_date: row.due_date,
          alarm_time: row.alarm_time ?? null,
          case_number: row.case_number ?? null,
        })
      }

      const todos = Array.from(todoById.values()).sort((a, b) => {
        // Sort by alarm_time (if present) else due_date
        const aTime = (a.alarm_time || a.due_date) ?? ''
        const bTime = (b.alarm_time || b.due_date) ?? ''
        return aTime.localeCompare(bTime)
      })

      const eventsBase = supabase
        .from('calendar_events')
        .select('id,title,start_time,end_time,claim_id', { head: false })
        .or(assignedToMeFilter)
        .gte('start_time', nowIso)
        // Count all upcoming events (not time-window limited)

      const eventsQuery =
        scope === 'shared' && sharedClaimIds?.length
          ? eventsBase.in('claim_id', sharedClaimIds as any)
          : eventsBase

      const eventsRes = await eventsQuery
      const events = ((eventsRes.data || []) as any[]).map((e) => ({
        id: e.id,
        title: e.title || 'Untitled event',
        start_time: e.start_time,
        end_time: e.end_time ?? null,
        claim_id: e.claim_id ?? null,
      })) as AlertsCalendarEventItem[]
      events.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

      const calendarAlerts = events.length

      const todoAlerts = todos.length
      return { todoAlerts, calendarAlerts, total: todoAlerts + calendarAlerts, todos, events }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

