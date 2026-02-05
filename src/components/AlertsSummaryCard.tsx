import React from 'react'
import { Bell, CalendarClock, CheckSquare } from 'lucide-react'
import { useAlertsSummary } from '@/hooks/useAlertsSummary'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { useNavigation } from '@/contexts/NavigationContext'

export function AlertsSummaryCard({ scope }: { scope: 'private' | 'shared' }) {
  // Always load both private and shared summaries so we can present a global view.
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
    myTodoAlerts: privateData?.myTodoAlerts ?? 0,
    othersTodoAlerts: privateData?.othersTodoAlerts ?? 0,
    overdueTodoAlerts: privateData?.overdueTodoAlerts ?? 0,
  }
  const sharedTotals = {
    total: sharedData?.total ?? 0,
    todoAlerts: sharedData?.todoAlerts ?? 0,
    calendarAlerts: sharedData?.calendarAlerts ?? 0,
    myTodoAlerts: sharedData?.myTodoAlerts ?? 0,
    othersTodoAlerts: sharedData?.othersTodoAlerts ?? 0,
    overdueTodoAlerts: sharedData?.overdueTodoAlerts ?? 0,
  }

  const isLoading = loadingPrivate || loadingShared

  const total = isPrivateScope
    ? privateTotals.total + sharedTotals.total
    : sharedTotals.total

  const todoAlerts = isPrivateScope
    ? privateTotals.todoAlerts + sharedTotals.todoAlerts
    : sharedTotals.todoAlerts

  const calendarAlerts = isPrivateScope
    ? privateTotals.calendarAlerts + sharedTotals.calendarAlerts
    : sharedTotals.calendarAlerts

  const todos = (isPrivateScope ? privateData?.todos : sharedData?.todos) ?? []
  const events = (isPrivateScope ? privateData?.events : sharedData?.events) ?? []

  const myTodoAlerts = isPrivateScope
    ? privateTotals.myTodoAlerts + sharedTotals.myTodoAlerts
    : sharedTotals.myTodoAlerts
  const othersTodoAlerts = isPrivateScope
    ? privateTotals.othersTodoAlerts + sharedTotals.othersTodoAlerts
    : sharedTotals.othersTodoAlerts
  const overdueTodoAlerts = isPrivateScope
    ? privateTotals.overdueTodoAlerts + sharedTotals.overdueTodoAlerts
    : sharedTotals.overdueTodoAlerts

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
    <div className="card-enhanced p-4 mb-4 mx-auto w-[42.75%]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-yellow-500" />
            <h3 className="text-base font-semibold text-gray-900 truncate">Alerts</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {isLoading ? 'Loading…' : `${total} total outstanding`}
          </p>
          {!isLoading && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
              {isPrivateScope && (
                <span>
                  Private: {privateTotals.total} • Shared: {sharedTotals.total}
                </span>
              )}
              <span>
                Tasks: {myTodoAlerts} assigned to you, {othersTodoAlerts} to others
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
            <span className="text-lg font-semibold">{todoAlerts}</span>
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
            <span className="text-lg font-semibold">{calendarAlerts}</span>
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

