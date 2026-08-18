'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  X,
  User,
  Clock,
  Briefcase
} from 'lucide-react'
import { useCollabixStore, Task } from '@/lib/store'
import DashboardLayout from '@/components/layout/DashboardLayout'

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarPage() {
  const router = useRouter()
  const { tasks, projects } = useCollabixStore()

  // Track active month/year view
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1)) // Default to August 2026 matching seeds
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const viewYear = currentDate.getFullYear()
  const viewMonth = currentDate.getMonth()

  const handlePrevMonth = () => {
    setCurrentDate(new Date(viewYear, viewMonth - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(viewYear, viewMonth + 1, 1))
  }

  // Get days in the month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  // Get weekday of the first day of the month
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const daysCount = getDaysInMonth(viewYear, viewMonth)
  const startOffset = getFirstDayOfMonth(viewYear, viewMonth)

  // Generate calendar grid items
  const calendarCells = []

  // Padding cells before start of month
  for (let i = 0; i < startOffset; i++) {
    calendarCells.push({ day: null, isCurrentMonth: false })
  }

  // Current month cells
  for (let d = 1; d <= daysCount; d++) {
    calendarCells.push({ day: d, isCurrentMonth: true })
  }

  // Find events on a specific day
  const getEventsForDay = (day: number) => {
    return tasks.filter(task => {
      if (!task.due_date) return false
      const taskDate = new Date(task.due_date)
      return (
        taskDate.getFullYear() === viewYear &&
        taskDate.getMonth() === viewMonth &&
        taskDate.getDate() === day
      )
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Calendar control bar */}
        <div className="flex items-center justify-between gap-4 bg-card border border-border rounded-custom p-4 shadow-custom flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue" />
            <h2 className="text-sm font-extrabold text-text uppercase tracking-wider">
              {months[viewMonth]} {viewYear}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrevMonth}
              className="w-9 h-9 border border-border bg-card hover:bg-bg rounded-xl grid place-items-center cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4.5 h-4.5 text-text" />
            </button>
            
            <button 
              onClick={() => setCurrentDate(new Date(2026, 7, 1))}
              className="px-3.5 h-9 border border-border bg-card hover:bg-bg rounded-xl text-xs font-bold text-text cursor-pointer shrink-0"
            >
              Today (Aug 2026)
            </button>

            <button 
              onClick={handleNextMonth}
              className="w-9 h-9 border border-border bg-card hover:bg-bg rounded-xl grid place-items-center cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4.5 h-4.5 text-text" />
            </button>
          </div>
        </div>

        {/* Calendar Grid Matrix */}
        <div className="bg-card border border-border rounded-custom p-6 shadow-custom overflow-hidden">
          
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border/80 pb-3 mb-3 text-center">
            {weekdays.map(day => (
              <span key={day} className="text-[10px] font-black text-muted uppercase tracking-wider">
                {day}
              </span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-2.5">
            {calendarCells.map((cell, idx) => {
              const dayTasks = cell.day ? getEventsForDay(cell.day) : []
              const isToday = cell.day === 17 && viewMonth === 7 && viewYear === 2026 // mock system today coordinate
              
              return (
                <div 
                  key={idx}
                  className={`
                    min-h-[100px] border border-border/60 rounded-xl p-2.5 flex flex-col justify-between transition-all relative
                    ${cell.isCurrentMonth ? 'bg-card' : 'bg-bg/25 border-transparent'}
                    ${isToday ? 'ring-2 ring-blue/50 bg-blue-soft/10 border-blue/35' : ''}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-black tracking-tight ${
                      cell.isCurrentMonth 
                        ? (isToday ? 'text-blue' : 'text-text') 
                        : 'text-muted/40'
                    }`}>
                      {cell.day ? String(cell.day).padStart(2, '0') : ''}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue animate-pulse" />
                    )}
                  </div>

                  {/* Day events pills list */}
                  <div className="flex-1 mt-2 space-y-1.5 overflow-hidden max-h-[70px]">
                    {dayTasks.map((task) => {
                      const isCompleted = task.status === 'COMPLETED'
                      return (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={`
                            w-full text-left truncate text-[9px] font-extrabold px-1.5 py-0.5 rounded-md cursor-pointer block border border-blue/5 select-none
                            ${isCompleted 
                              ? 'bg-green-soft text-green line-through' 
                              : 'bg-blue-soft text-blue hover:bg-blue-soft/80'
                            }
                          `}
                          title={task.title}
                        >
                          {task.title}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

        </div>

        {/* ==========================================
            POP-OVER DIALOG: TASK DETAILS
            ========================================== */}
        {selectedTask && (
          <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-[420px] bg-card border border-border rounded-custom p-6 shadow-2xl relative">
              <button 
                onClick={() => setSelectedTask(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-bg border border-border grid place-items-center cursor-pointer"
              >
                <X className="w-4 h-4 text-text" />
              </button>

              <span className="text-[9px] font-black text-blue uppercase tracking-widest block mb-1.5">
                {selectedTask.projects?.name}
              </span>

              <h4 className="text-sm font-extrabold text-text leading-snug">
                {selectedTask.title}
              </h4>

              {selectedTask.description && (
                <p className="text-[11px] text-muted font-medium mt-3 leading-relaxed">
                  {selectedTask.description}
                </p>
              )}

              <div className="space-y-2 mt-5 pt-4 border-t border-border/80 text-[10px] font-bold text-muted uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted" />
                  <span>Status: <b className="text-text font-extrabold ml-1">{selectedTask.status.replace('_', ' ')}</b></span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted" />
                  <span>Priority: <b className="text-text font-extrabold ml-1">{selectedTask.priority}</b></span>
                </div>

                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted" />
                  <span>Assignee: <b className="text-text font-extrabold ml-1">
                    {selectedTask.task_assignees && selectedTask.task_assignees.length > 0 
                      ? selectedTask.task_assignees[0].profiles?.full_name 
                      : 'Unassigned'}
                  </b></span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-border/80">
                <button 
                  onClick={() => {
                    setSelectedTask(null)
                    router.push('/tasks')
                  }}
                  className="px-4 py-2 bg-blue text-white text-xs font-bold rounded-xl hover:bg-blue/90 shadow-sm shadow-blue/15"
                >
                  Manage Tasks
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
