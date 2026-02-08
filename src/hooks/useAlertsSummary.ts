import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

type AlertsScope = 'private' | 'shared'

export interface AlertsTodoItem {
  id: string
  title: string
  due_date: string
  alarm_time: string | null
  case_number: string | null
  responsible_user_id?: string | null
  user_id?: string | null
}

export interface AlertsCalendarEventItem {
  id: string
  title: string
  start_time: string
  end_time: string | null
  claim_id: string | null
}

export interface PerClaimAlerts {
  [caseNumber: string]: {
    todoAlerts: number
    calendarAlerts: number
    evidenceToDoAlerts: number
    total: number
    myTodoAlerts: number
    othersTodoAlerts: number
    overdueTodoAlerts: number
  }
}

const emptyAlertsResult = {
  todoAlerts: 0,
  calendarAlerts: 0,
  evidenceToDoAlerts: 0,
  total: 0,
  myTodoAlerts: 0,
  othersTodoAlerts: 0,
  overdueTodoAlerts: 0,
  todos: [] as AlertsTodoItem[],
  events: [] as AlertsCalendarEventItem[],
  perClaimAlerts: {} as PerClaimAlerts,
}

export function useAlertsSummary(scope: AlertsScope) {
  return useQuery({
    queryKey: ['alerts-summary', scope],
    queryFn: async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth.user?.id
        if (!userId) return emptyAlertsResult

        // If we're on the shared claims screen, filter alerts to shared claims only.
        let sharedClaimIds: string[] | null = null
        let sharedCaseNumbers: string[] | null = null
        let sharedClaimsMeta: { claim_id: string; case_number: string | null }[] = []

        if (scope === 'shared') {
          const { data: shares, error: sharesError } = await supabase
            .from('claim_shares')
            .select('claim_id')
            .or(`owner_id.eq.${userId},shared_with_id.eq.${userId}`)

          if (!sharesError && shares?.length) {
            sharedClaimIds = Array.from(new Set((shares || []).map((s) => s.claim_id).filter(Boolean)))
          } else {
            sharedClaimIds = sharesError ? [] : []
          }

          if (!sharedClaimIds?.length) return emptyAlertsResult

          const { data: claims, error: claimsError } = await supabase
            .from('claims')
            .select('case_number, claim_id')
            .in('claim_id', sharedClaimIds as any)

          if (!claimsError && claims?.length) {
            sharedClaimsMeta = (claims || []) as { claim_id: string; case_number: string | null }[]
            sharedCaseNumbers = Array.from(new Set(sharedClaimsMeta.map((c) => c.case_number).filter(Boolean) as string[]))
          } else {
            sharedClaimsMeta = []
            sharedCaseNumbers = []
          }
        }

        // Claim IDs for this scope (for evidence To-Do count): private = my claims, shared = shared claims
        let claimIdsForEvidence: string[] = []
        if (scope === 'shared' && sharedClaimIds?.length) {
          claimIdsForEvidence = sharedClaimIds
        } else if (scope === 'private') {
          const { data: myClaims } = await supabase.from('claims').select('claim_id').eq('user_id', userId)
          claimIdsForEvidence = (myClaims || []).map((c: { claim_id: string }) => c.claim_id).filter(Boolean)
        }

        // Count evidence items with method = 'To-Do' (claim-detail evidence, not task-list todos)
        let evidenceToDoAlerts = 0
        const evidenceToDoByClaimId: Record<string, number> = {}
        if (claimIdsForEvidence.length > 0) {
          const { data: ecData, error: ecError } = await supabase
            .from('evidence_claims')
            .select('claim_id, evidence:evidence_id ( method )')
            .in('claim_id', claimIdsForEvidence as any)
          if (!ecError && ecData) {
            for (const row of ecData as any[]) {
              const method = row.evidence?.method as string | null | undefined
              if (!method) continue
              const normalized = String(method).toLowerCase().replace(/[\s-]/g, '')
              if (normalized === 'todo') {
                evidenceToDoAlerts += 1
                const cid = row.claim_id as string
                if (cid) evidenceToDoByClaimId[cid] = (evidenceToDoByClaimId[cid] || 0) + 1
              }
            }
          }
        }

      let todosRes: { data: any[] | null; error?: any }
      if (scope === 'shared' && sharedCaseNumbers?.length) {
        const { data, error } = await supabase
          .from('todos')
          .select('id,title,due_date,alarm_time,case_number,responsible_user_id,user_id')
          .eq('completed', false)
          .in('case_number', sharedCaseNumbers as any)
        if (error) console.error('useAlertsSummary shared todos', error)
        todosRes = { data: data ?? null, error }
      } else {
        // Private: same pattern as TodoList - two separate .eq() queries then merge (avoids .or() / RLS issues)
        const [assigned, created] = await Promise.all([
          supabase.from('todos').select('id,title,due_date,alarm_time,case_number,responsible_user_id,user_id').eq('completed', false).eq('responsible_user_id', userId),
          supabase.from('todos').select('id,title,due_date,alarm_time,case_number,responsible_user_id,user_id').eq('completed', false).eq('user_id', userId),
        ])
        if (assigned.error) console.error('useAlertsSummary private todos (assigned)', assigned.error)
        if (created.error) console.error('useAlertsSummary private todos (created)', created.error)
        const byId = new Map<string, any>()
        for (const row of assigned.data ?? []) {
          if (row?.id) byId.set(row.id, row)
        }
        for (const row of created.data ?? []) {
          if (row?.id && !byId.has(row.id)) byId.set(row.id, row)
        }
        todosRes = { data: Array.from(byId.values()) }
      }

      const now = new Date()

      const todos = ((todosRes.data || []) as any[]).map((row) => ({
        id: row.id,
        title: row.title || 'Untitled task',
        due_date: row.due_date,
        alarm_time: row.alarm_time ?? null,
        case_number: row.case_number ?? null,
        responsible_user_id: row.responsible_user_id ?? null,
        user_id: row.user_id ?? null,
      })) as AlertsTodoItem[]

      todos.sort((a, b) => {
        // Sort by alarm_time (if present) else due_date
        const aTime = (a.alarm_time || a.due_date) ?? ''
        const bTime = (b.alarm_time || b.due_date) ?? ''
        return aTime.localeCompare(bTime)
      })

      const nowIso = now.toISOString()

      // Shared calendar_events: Calendar component stores case_number in claim_id when creating events, so filter by sharedCaseNumbers.
      let eventsRes: { data: any[] | null }
      if (scope === 'shared' && sharedCaseNumbers?.length) {
        const { data, error } = await supabase
          .from('calendar_events')
          .select('id,title,start_time,end_time,claim_id')
          .in('claim_id', sharedCaseNumbers as any)
          .gte('start_time', nowIso)
        if (error) console.error('useAlertsSummary shared events', error)
        eventsRes = { data: data ?? null }
      } else {
        // Private: two .eq() queries then merge (same pattern as todos)
        const [byAssignee, byCreator] = await Promise.all([
          supabase.from('calendar_events').select('id,title,start_time,end_time,claim_id').eq('responsible_user_id', userId).gte('start_time', nowIso),
          supabase.from('calendar_events').select('id,title,start_time,end_time,claim_id').eq('user_id', userId).gte('start_time', nowIso),
        ])
        if (byAssignee.error) console.error('useAlertsSummary private events (assignee)', byAssignee.error)
        if (byCreator.error) console.error('useAlertsSummary private events (creator)', byCreator.error)
        const byId = new Map<string, any>()
        for (const row of byAssignee.data ?? []) {
          if (row?.id) byId.set(row.id, row)
        }
        for (const row of byCreator.data ?? []) {
          if (row?.id && !byId.has(row.id)) byId.set(row.id, row)
        }
        eventsRes = { data: Array.from(byId.values()) }
      }
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

      // Global assignment/overdue breakdown
      let myTodoAlerts = 0
      let othersTodoAlerts = 0
      let overdueTodoAlerts = 0

      for (const t of todos) {
        const isMine =
          t.responsible_user_id === userId ||
          (!t.responsible_user_id && t.user_id === userId)

        if (isMine) {
          myTodoAlerts += 1
        } else {
          othersTodoAlerts += 1
        }

        if (t.due_date) {
          const due = new Date(t.due_date)
          if (due.getTime() < now.getTime()) {
            overdueTodoAlerts += 1
          }
        }
      }

      // Build per-claim breakdown only for shared scope (used by shared claims UI)
      let perClaimAlerts: PerClaimAlerts = {}
      if (scope === 'shared') {
        const claimIdToCaseNumber: Record<string, string> = {}
        for (const c of sharedClaimsMeta) {
          if (c.claim_id && c.case_number) {
            claimIdToCaseNumber[c.claim_id] = c.case_number
          }
        }

        // Group todos by case_number
        for (const t of todos) {
          if (!t.case_number) continue
          if (!perClaimAlerts[t.case_number]) {
            perClaimAlerts[t.case_number] = {
              todoAlerts: 0,
              calendarAlerts: 0,
              evidenceToDoAlerts: 0,
              total: 0,
              myTodoAlerts: 0,
              othersTodoAlerts: 0,
              overdueTodoAlerts: 0,
            }
          }
          perClaimAlerts[t.case_number].todoAlerts += 1
          const isMineTodo =
            t.responsible_user_id === userId ||
            (!t.responsible_user_id && t.user_id === userId)
          if (isMineTodo) {
            perClaimAlerts[t.case_number].myTodoAlerts += 1
          } else {
            perClaimAlerts[t.case_number].othersTodoAlerts += 1
          }
          if (t.due_date) {
            const due = new Date(t.due_date)
            if (due.getTime() < now.getTime()) {
              perClaimAlerts[t.case_number].overdueTodoAlerts += 1
            }
          }
        }

        // Group events by claim_id (may be UUID or case_number depending on app)
        for (const e of events) {
          if (!e.claim_id) continue
          const caseNumber = claimIdToCaseNumber[e.claim_id] ?? (sharedCaseNumbers?.includes(e.claim_id) ? e.claim_id : null)
          if (!caseNumber) continue
          if (!perClaimAlerts[caseNumber]) {
            perClaimAlerts[caseNumber] = {
              todoAlerts: 0,
              calendarAlerts: 0,
              evidenceToDoAlerts: 0,
              total: 0,
              myTodoAlerts: 0,
              othersTodoAlerts: 0,
              overdueTodoAlerts: 0,
            }
          }
          perClaimAlerts[caseNumber].calendarAlerts += 1
        }

        // Add evidence To-Do count per claim (same as private: tasks + reminders + evidence to-do)
        for (const [claimId, count] of Object.entries(evidenceToDoByClaimId)) {
          const caseNumber = claimIdToCaseNumber[claimId]
          if (!caseNumber) continue
          if (!perClaimAlerts[caseNumber]) {
            perClaimAlerts[caseNumber] = {
              todoAlerts: 0,
              calendarAlerts: 0,
              evidenceToDoAlerts: 0,
              total: 0,
              myTodoAlerts: 0,
              othersTodoAlerts: 0,
              overdueTodoAlerts: 0,
            }
          }
          perClaimAlerts[caseNumber].evidenceToDoAlerts = count
        }

        // Finalize totals (tasks + reminders + evidence to-do, same as private)
        for (const key of Object.keys(perClaimAlerts)) {
          const entry = perClaimAlerts[key]
          entry.total = entry.todoAlerts + entry.calendarAlerts + entry.evidenceToDoAlerts
        }
        }

      return {
        todoAlerts,
        calendarAlerts,
        evidenceToDoAlerts,
        total: todoAlerts + calendarAlerts + evidenceToDoAlerts,
        myTodoAlerts,
        othersTodoAlerts,
        overdueTodoAlerts,
        todos,
        events,
        perClaimAlerts,
      }
      } catch (err) {
        console.error('useAlertsSummary failed', scope, err)
        return emptyAlertsResult
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

