import React, { useMemo } from 'react'
import { Bell, CalendarClock, CheckSquare } from 'lucide-react'
import { useAlertsSummary, type AlertsTodoItem, type AlertsCalendarEventItem } from '@/hooks/useAlertsSummary'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { useNavigation } from '@/contexts/NavigationContext'
import { useAuth } from '@/contexts/AuthContext'

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const x of a) {
    if (!seen.has(x.id)) {
      seen.add(x.id)
      out.push(x)
    }
  }
  for (const x of b) {
    if (!seen.has(x.id)) {
      seen.add(x.id)
      out.push(x)
    }
  }
  return out
}

export function AlertsSummaryCard({ scope }: { scope: 'private' | 'shared' }) {
  const { user } = useAuth()
  const {
    data: privateData,
    isLoading: loadingPrivate,
  } = useAlertsSummary('private')
  const {
    data: sharedData,
    isLoading: loadingShared,
  } = useAlertsSummary('shared')
  const { navigateTo } = useNavigation()

  const isPrivateScope = scope === 'private'

  const privateTotals = {
    total: privateData?.total ?? 0,
    todoAlerts: privateData?.todoAlerts ?? 0,
    calendarAlerts: privateData?.calendarAlerts ?? 0,
    evidenceToDoAlerts: privateData?.evidenceToDoAlerts ?? 0,
    myTodoAlerts: privateData?.myTodoAlerts ?? 0,
    othersTodoAlerts: privateData?.othersTodoAlerts ?? 0,
    overdueTodoAlerts: privateData?.overdueTodoAlerts ?? 0,
  }
  const sharedTotals = {
    total: sharedData?.total ?? 0,
    todoAlerts: sharedData?.todoAlerts ?? 0,
    calendarAlerts: sharedData?.calendarAlerts ?? 0,
    evidenceToDoAlerts: sharedData?.evidenceToDoAlerts ?? 0,
    myTodoAlerts: sharedData?.myTodoAlerts ?? 0,
    othersTodoAlerts: sharedData?.othersTodoAlerts ?? 0,
    overdueTodoAlerts: sharedData?.overdueTodoAlerts ?? 0,
  }

  // When host views (private scope), merge private + shared lists so guest-created shared todos
  // are included in both the count and the list; dedupe by id to avoid double-counting.
  const { todos, events, total, todoAlerts, calendarAlerts, myTodoAlerts, othersTodoAlerts, overdueTodoAlerts } = useMemo(() => {
    if (!isPrivateScope) {
      return {
        todos: (sharedData?.todos ?? []) as AlertsTodoItem[],
        events: (sharedData?.events ?? []) as AlertsCalendarEventItem[],
        total: sharedTotals.total,
        todoAlerts: sharedTotals.todoAlerts,
        calendarAlerts: sharedTotals.calendarAlerts,
        myTodoAlerts: sharedTotals.myTodoAlerts,
        othersTodoAlerts: sharedTotals.othersTodoAlerts,
        overdueTodoAlerts: sharedTotals.overdueTodoAlerts,
      }
    }
    const mergedTodos = mergeById(
      (privateData?.todos ?? []) as AlertsTodoItem[],
      (sharedData?.todos ?? []) as AlertsTodoItem[]
    )
    const mergedEvents = mergeById(
      (privateData?.events ?? []) as AlertsCalendarEventItem[],
      (sharedData?.events ?? []) as AlertsCalendarEventItem[]
    )
    const now = new Date()
    let my = 0
    let others = 0
    let overdue = 0
    const userId = user?.id
    if (userId) {
      for (const t of mergedTodos) {
        const isMine = t.responsible_user_id === userId || (!t.responsible_user_id && t.user_id === userId)
        if (isMine) my += 1
        else others += 1
        if (t.due_date && new Date(t.due_date).getTime() < now.getTime()) overdue += 1
      }
    } else {
      my = privateTotals.myTodoAlerts + sharedTotals.myTodoAlerts
      others = privateTotals.othersTodoAlerts + sharedTotals.othersTodoAlerts
      overdue = privateTotals.overdueTodoAlerts + sharedTotals.overdueTodoAlerts
    }
    const privEvidence = privateData?.evidenceToDoAlerts ?? 0
    const sharedEvidence = sharedData?.evidenceToDoAlerts ?? 0
    return {
      todos: mergedTodos,
      events: mergedEvents,
      total: mergedTodos.length + mergedEvents.length + privEvidence + sharedEvidence,
      todoAlerts: mergedTodos.length,
      calendarAlerts: mergedEvents.length,
      myTodoAlerts: my,
      othersTodoAlerts: others,
      overdueTodoAlerts: overdue,
    }
  }, [
    isPrivateScope,
    privateData?.todos,
    privateData?.events,
    sharedData?.todos,
    sharedData?.events,
    user?.id,
    privateTotals.myTodoAlerts,
    privateTotals.othersTodoAlerts,
    privateTotals.overdueTodoAlerts,
    sharedTotals.myTodoAlerts,
    sharedTotals.othersTodoAlerts,
    sharedTotals.overdueTodoAlerts,
  ])

  const isLoading = loadingPrivate || loadingShared

  const [open, setOpen] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<'todos' | 'events'>('todos')

  const openTasks = () => {
    if (todoAlerts <= 0) return
    // If there is only one item, jump straight to the tasks screen.
    if (todoAlerts === 1) {
      navigateTo(scope === 'shared' ? 'todos-shared' : 'todos-private')
      return
    }
    setActiveSection('todos')
    setOpen(true)
  }

  const openReminders = () => {
    if (calendarAlerts <= 0) return
    if (calendarAlerts === 1) {
      navigateTo(scope === 'shared' ? 'calendar-shared' : 'calendar-private')
      return
    }
    setActiveSection('events')
    setOpen(true)
  }

  return (
    // Start from the previous 47.5% width and reduce it by 5% for a slightly narrower card.
    <div className="card-enhanced p-4 mb-4 mx-auto w-[45.125%]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-yellow-500" />
            <h3 className="text-base font-semibold text-gray-900 truncate">Alerts</h3>
          </div>
          <p
            className={`text-sm mt-1 ${
              !isLoading && total > 0 ? 'text-red-500' : 'text-gray-600'
            }`}
          >
            {isLoading ? 'Loading…' : `${total} total outstanding`}
          </p>
          {!isLoading && (
            <div className="flex items-center justify-between gap-4 text-xs text-gray-500 mt-1 w-full">
              {isPrivateScope && (
                <span className="whitespace-nowrap">
                  Private:{' '}
                  <span className={privateTotals.total > 0 ? 'text-red-500' : ''}>
                    {privateTotals.total}
                  </span>{' '}
                  • Shared:{' '}
                  <span className={sharedTotals.total > 0 ? 'text-red-500' : ''}>
                    {sharedTotals.total}
                  </span>
                </span>
              )}
              <span className="whitespace-nowrap">
                Tasks:{' '}
                <span
                  className={
                    myTodoAlerts > 0 || othersTodoAlerts > 0 || overdueTodoAlerts > 0
                      ? 'text-red-500'
                      : ''
                  }
                >
                  {myTodoAlerts}
                </span>{' '}
                assigned to you,{' '}
                <span
                  className={
                    othersTodoAlerts > 0 || overdueTodoAlerts > 0 ? 'text-red-500' : ''
                  }
                >
                  {othersTodoAlerts}
                </span>{' '}
                to others
                {overdueTodoAlerts > 0 && ` • ${overdueTodoAlerts} overdue`}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 text-sm text-gray-700">
          <button
            type="button"
            onClick={openTasks}
            disabled={todoAlerts <= 0}
            className={`flex items-center gap-2 rounded px-2 py-1 ${
              todoAlerts > 0 ? 'hover:bg-white/10 cursor-pointer' : 'opacity-60 cursor-default'
            }`}
            title={todoAlerts > 1 ? 'View tasks' : todoAlerts === 1 ? 'Open task' : 'No task alerts'}
          >
            <CheckSquare className="w-6 h-6 text-blue-600" />
            <span
              className={`text-lg font-semibold ${
                todoAlerts > 0 ? 'text-red-500' : ''
              }`}
            >
              {todoAlerts}
            </span>
            <span className="text-gray-600">tasks</span>
          </button>

          <button
            type="button"
            onClick={openReminders}
            disabled={calendarAlerts <= 0}
            className={`flex items-center gap-2 rounded px-2 py-1 ${
              calendarAlerts > 0 ? 'hover:bg-white/10 cursor-pointer' : 'opacity-60 cursor-default'
            }`}
            title={calendarAlerts > 1 ? 'View reminders' : calendarAlerts === 1 ? 'Open reminder' : 'No reminders'}
          >
            <CalendarClock className="w-6 h-6 text-green-600" />
            <span
              className={`text-lg font-semibold ${
                calendarAlerts > 0 ? 'text-red-500' : ''
              }`}
            >
              {calendarAlerts}
            </span>
            <span className="text-gray-600">reminders</span>
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeSection === 'todos' ? 'Task alerts' : 'Calendar reminders'}</DialogTitle>
          </DialogHeader>

          {activeSection === 'todos' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">{todos.length} tasks</div>
                <Button size="sm" variant="outline" onClick={() => navigateTo(scope === 'shared' ? 'todos-shared' : 'todos-private')}>
                  Open tasks
                </Button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto space-y-2">
                {todos.map(t => (
                  <div key={t.id} className="border rounded-md p-3">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Due: {t.due_date ? format(new Date(t.due_date), 'PPpp') : 'Unknown'}
                      {t.case_number ? ` • Claim: ${t.case_number}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">{events.length} events</div>
                <Button size="sm" variant="outline" onClick={() => navigateTo(scope === 'shared' ? 'calendar-shared' : 'calendar-private')}>
                  Open calendar
                </Button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto space-y-2">
                {events.map(e => (
                  <div key={e.id} className="border rounded-md p-3">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Starts: {e.start_time ? format(new Date(e.start_time), 'PPpp') : 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

