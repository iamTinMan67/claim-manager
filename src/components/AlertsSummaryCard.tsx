import React from 'react'
import { Bell, CalendarClock, CheckSquare } from 'lucide-react'
import { useAlertsSummary } from '@/hooks/useAlertsSummary'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { useNavigation } from '@/contexts/NavigationContext'

export function AlertsSummaryCard({ scope }: { scope: 'private' | 'shared' }) {
  const { data, isLoading } = useAlertsSummary(scope)
  const { navigateTo } = useNavigation()

  const total = data?.total ?? 0
  const todoAlerts = data?.todoAlerts ?? 0
  const calendarAlerts = data?.calendarAlerts ?? 0
  const todos = data?.todos ?? []
  const events = data?.events ?? []

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
    <div className="card-enhanced p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-yellow-500" />
            <h3 className="text-base font-semibold text-gray-900 truncate">Alerts</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {isLoading ? 'Loading…' : `${total} total`}
          </p>
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

