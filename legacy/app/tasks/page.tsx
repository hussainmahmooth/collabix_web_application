'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  Search, 
  Plus, 
  List, 
  KanbanSquare, 
  ChevronRight, 
  User, 
  Calendar, 
  CheckSquare,
  AlertCircle,
  MoreVertical,
  Trash2,
  CheckCircle2,
  X
} from 'lucide-react'
import { useCollabixStore, Task } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout from '@/components/layout/DashboardLayout'

const statuses = [
  { key: 'TODO', label: 'To Do', color: 'border-l-muted' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'border-l-blue' },
  { key: 'IN_REVIEW', label: 'In Review', color: 'border-l-yellow' },
  { key: 'COMPLETED', label: 'Completed', color: 'border-l-green' },
  { key: 'BLOCKED', label: 'Blocked', color: 'border-l-red' },
  { key: 'CANCELLED', label: 'Cancelled', color: 'border-l-muted line-through' }
]

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen grid place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-bold text-muted font-sans">Loading tasks...</span>
        </div>
      </div>
    }>
      <TasksContent />
    </Suspense>
  )
}

function TasksContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const { 
    user, 
    tasks, 
    projects, 
    workspaceMembers,
    activeWorkspace 
  } = useCollabixStore()

  // State
  const [viewMode, setViewMode] = useState<'list' | 'board'>('board')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [projectFilter, setProjectFilter] = useState<string>('ALL')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL')
  
  // Modals / dropdown tracking
  const [activeTaskMenu, setActiveTaskMenu] = useState<string | null>(null)
  
  // Set project filter from URL if present
  useEffect(() => {
    const urlProj = searchParams.get('project')
    if (urlProj) {
      setProjectFilter(urlProj)
    }
  }, [searchParams])

  // Mutators
  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    setActiveTaskMenu(null)
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId)

      if (error) throw error
    } catch (err) {
      console.error('Error updating task status:', err)
    }
  }

  const handleUpdatePriority = async (taskId: string, newPriority: string) => {
    setActiveTaskMenu(null)
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ priority: newPriority, updated_at: new Date().toISOString() })
        .eq('id', taskId)

      if (error) throw error
    } catch (err) {
      console.error('Error updating task priority:', err)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    setActiveTaskMenu(null)
    if (!confirm('Are you sure you want to delete this task?')) return
    
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
    } catch (err) {
      console.error('Error deleting task:', err)
    }
  }

  // Filtering Logic
  const filteredTasks = tasks.filter(task => {
    // 1. Search text
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))

    // 2. Status tab
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'OVERDUE' && task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED') ||
      task.status === statusFilter

    // 3. Project filter dropdown
    const matchesProject = projectFilter === 'ALL' || task.project_id === projectFilter

    // 4. Assignee filter dropdown
    const matchesAssignee = assigneeFilter === 'ALL' || 
      (assigneeFilter === 'UNASSIGNED' && (!task.task_assignees || task.task_assignees.length === 0)) ||
      task.task_assignees?.some(a => a.profile_id === assigneeFilter)

    return matchesSearch && matchesStatus && matchesProject && matchesAssignee
  })

  // Style colors
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-soft text-red font-black border border-red/10'
      case 'HIGH': return 'bg-orange/10 text-orange font-bold'
      case 'MEDIUM': return 'bg-blue-soft text-blue font-bold'
      case 'LOW': return 'bg-bg text-muted font-medium'
      default: return 'bg-bg text-muted'
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Subnavigation Filter Tabs */}
        <div className="flex items-center justify-between border-b border-border/80 pb-1 flex-wrap gap-4">
          <div className="flex gap-1 overflow-x-auto">
            {['ALL', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'OVERDUE'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`
                  px-3.5 py-2 text-xs font-bold rounded-xl transition-all border shrink-0 cursor-pointer
                  ${statusFilter === tab 
                    ? 'bg-blue text-white border-blue shadow-sm shadow-blue/15' 
                    : 'bg-card border-border hover:bg-bg text-muted hover:text-text'
                  }
                `}
              >
                {tab === 'ALL' ? 'All Tasks' : tab === 'IN_PROGRESS' ? 'In Progress' : tab === 'IN_REVIEW' ? 'In Review' : tab.charAt(0) + tab.slice(1).toLowerCase().replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* View Toggles */}
          <div className="flex bg-card border border-border p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg cursor-pointer ${viewMode === 'list' ? 'bg-blue-soft text-blue' : 'text-muted'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-lg cursor-pointer ${viewMode === 'board' ? 'bg-blue-soft text-blue' : 'text-muted'}`}
              title="Kanban Board"
            >
              <KanbanSquare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-card border border-border rounded-custom p-4 shadow-custom">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filter by title/desc..."
              className="w-full h-10 pl-9 pr-3 border border-border bg-bg/50 rounded-xl text-xs font-semibold focus:border-blue transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Project filter */}
          <div>
            <select
              className="w-full h-10 px-3 border border-border bg-bg/50 rounded-xl text-xs font-semibold outline-none"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Assignee filter */}
          <div>
            <select
              className="w-full h-10 px-3 border border-border bg-bg/50 rounded-xl text-xs font-semibold outline-none"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
            >
              <option value="ALL">All Assignees</option>
              <option value="UNASSIGNED">Unassigned Tasks</option>
              {workspaceMembers.map((m) => (
                <option key={m.profile_id} value={m.profile_id}>
                  {m.profiles?.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters CTA */}
          <div className="flex items-center justify-end">
            {(searchQuery || statusFilter !== 'ALL' || projectFilter !== 'ALL' || assigneeFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('ALL')
                  setProjectFilter('ALL')
                  setAssigneeFilter('ALL')
                }}
                className="text-xs font-bold text-blue hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* View renderers */}
        {filteredTasks.length === 0 ? (
          <div className="py-20 text-center bg-card border border-border rounded-custom shadow-custom">
            <CheckSquare className="w-10 h-10 text-muted mx-auto mb-3" />
            <h4 className="text-sm font-extrabold text-text">No tasks matches your filters</h4>
            <p className="text-xs text-muted mt-1">Adjust filters or click "+ Create Task" in the header to add work.</p>
          </div>
        ) : viewMode === 'list' ? (
          
          /* ==========================================
              LIST VIEW
              ========================================== */
          <div className="bg-card border border-border rounded-custom p-5 shadow-custom divide-y divide-border/60">
            {filteredTasks.map((task) => (
              <div 
                key={task.id} 
                className="flex items-center gap-4 py-3.5 hover:bg-bg/25 transition-all group first:pt-0 last:pb-0"
              >
                {/* Task check box */}
                <button
                  onClick={() => handleUpdateStatus(task.id, task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED')}
                  className={`
                    w-4.5 h-4.5 rounded-md border flex items-center justify-center text-[10px] font-black cursor-pointer transition-all
                    ${task.status === 'COMPLETED' 
                      ? 'bg-green border-green text-white' 
                      : 'bg-white border-border hover:border-blue'
                    }
                  `}
                >
                  {task.status === 'COMPLETED' && '✓'}
                </button>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-extrabold text-text block truncate ${task.status === 'COMPLETED' ? 'line-through text-muted' : ''}`}>
                    {task.title}
                  </span>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[9px] font-bold bg-blue-soft text-blue px-1.5 py-0.5 rounded-md">
                      {task.projects?.name}
                    </span>
                    {task.due_date && (
                      <span className="text-[9px] font-bold text-muted flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Due {new Date(task.due_date).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Assignee initials badge */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {task.task_assignees && task.task_assignees.length > 0 ? (
                    task.task_assignees.map((assignee) => (
                      <div 
                        key={assignee.profile_id}
                        className="w-6.5 h-6.5 rounded-full bg-yellow text-navy text-[9px] font-black grid place-items-center border border-yellow/20"
                        title={assignee.profiles?.full_name}
                      >
                        {assignee.profiles?.full_name?.substring(0, 1).toUpperCase()}
                      </div>
                    ))
                  ) : (
                    <div className="w-6.5 h-6.5 rounded-full bg-bg border border-border text-muted grid place-items-center" title="Unassigned">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Priority */}
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 ${getPriorityStyle(task.priority)}`}>
                  {task.priority}
                </span>

                {/* Status */}
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                  task.status === 'COMPLETED' ? 'bg-green-soft text-green' : 
                  task.status === 'IN_PROGRESS' ? 'bg-blue-soft text-blue' : 
                  task.status === 'IN_REVIEW' ? 'bg-yellow-soft text-orange' : 'bg-bg text-muted border border-border'
                }`}>
                  {task.status.replace('_', ' ')}
                </span>

                {/* Actions Dropdown Trigger */}
                <div className="relative">
                  <button 
                    onClick={() => setActiveTaskMenu(activeTaskMenu === task.id ? null : task.id)}
                    className="p-1 border border-border rounded-lg bg-card text-muted hover:text-text cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all shrink-0"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {activeTaskMenu === task.id && (
                    <div className="absolute right-0 mt-1 w-[160px] bg-card border border-border rounded-xl shadow-lg z-50 p-1">
                      <div className="text-[8px] font-bold text-muted uppercase tracking-wider px-2.5 py-1">Set Status</div>
                      {statuses.map(s => (
                        <button
                          key={s.key}
                          onClick={() => handleUpdateStatus(task.id, s.key)}
                          className="w-full text-left px-2.5 py-1 text-[10px] font-bold hover:bg-bg rounded-lg text-text"
                        >
                          {s.label}
                        </button>
                      ))}
                      <div className="border-t border-border/80 my-1"></div>
                      <div className="text-[8px] font-bold text-muted uppercase tracking-wider px-2.5 py-1">Set Priority</div>
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (
                        <button
                          key={p}
                          onClick={() => handleUpdatePriority(task.id, p)}
                          className="w-full text-left px-2.5 py-1 text-[10px] font-bold hover:bg-bg rounded-lg text-text"
                        >
                          {p}
                        </button>
                      ))}
                      <div className="border-t border-border/80 my-1"></div>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="w-full text-left px-2.5 py-1.5 text-[10px] font-extrabold hover:bg-red-soft text-red rounded-lg flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Task</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          
          /* ==========================================
              BOARD VIEW (KANBAN)
              ========================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* Filter statuses to render 3 major boards on mobile, or 3 columns on dashboard to keep spacing comfortable */}
            {['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED'].map((colKey) => {
              const colTasks = filteredTasks.filter(t => t.status === colKey)
              const colDef = statuses.find(s => s.key === colKey)!

              return (
                <div key={colKey} className="bg-card/50 border border-border/70 rounded-custom p-4.5 shadow-sm flex flex-col min-h-[400px]">
                  {/* Column Header */}
                  <div className={`flex items-center justify-between border-l-3 ${colDef.color} pl-2 mb-4`}>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-text uppercase tracking-wider">{colDef.label}</h4>
                      <span className="bg-border/60 text-muted px-2 py-0.5 rounded-full text-[9px] font-bold">
                        {colTasks.length}
                      </span>
                    </div>
                  </div>

                  {/* Tasks Container */}
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[620px] pr-1">
                    {colTasks.length === 0 ? (
                      <div className="py-10 text-center border border-dashed border-border/60 rounded-xl bg-card/20">
                        <span className="text-[10px] text-muted font-bold">No tasks here</span>
                      </div>
                    ) : (
                      colTasks.map((task) => (
                        <div 
                          key={task.id} 
                          className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-blue/20 hover:shadow-md transition-all relative group"
                        >
                          {/* Menu Actions trigger */}
                          <div className="absolute top-3.5 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setActiveTaskMenu(activeTaskMenu === task.id ? null : task.id)}
                              className="p-1 hover:bg-bg border border-border/80 rounded-lg text-muted hover:text-text cursor-pointer"
                            >
                              <MoreVertical className="w-3 h-3" />
                            </button>

                            {activeTaskMenu === task.id && (
                              <div className="absolute right-0 mt-1 w-[160px] bg-card border border-border rounded-xl shadow-lg z-50 p-1">
                                <div className="text-[8px] font-bold text-muted uppercase tracking-wider px-2.5 py-1">Move Status</div>
                                {statuses.map(s => (
                                  <button
                                    key={s.key}
                                    onClick={() => handleUpdateStatus(task.id, s.key)}
                                    className="w-full text-left px-2.5 py-1 text-[10px] font-bold hover:bg-bg rounded-lg text-text"
                                  >
                                    {s.label}
                                  </button>
                                ))}
                                <div className="border-t border-border/80 my-1"></div>
                                <div className="text-[8px] font-bold text-muted uppercase tracking-wider px-2.5 py-1">Set Priority</div>
                                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (
                                  <button
                                    key={p}
                                    onClick={() => handleUpdatePriority(task.id, p)}
                                    className="w-full text-left px-2.5 py-1 text-[10px] font-bold hover:bg-bg rounded-lg text-text"
                                  >
                                    {p}
                                  </button>
                                ))}
                                <div className="border-t border-border/80 my-1"></div>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="w-full text-left px-2.5 py-1.5 text-[10px] font-extrabold hover:bg-red-soft text-red rounded-lg flex items-center gap-1.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Task</span>
                                </button>
                              </div>
                            )}
                          </div>

                          <span className="text-[9px] font-black text-blue uppercase block mb-1">
                            {task.projects?.name}
                          </span>
                          
                          <h5 className="text-xs font-extrabold text-text line-clamp-2 pr-4 leading-snug">
                            {task.title}
                          </h5>
                          
                          {task.description && (
                            <p className="text-[10px] text-muted mt-1.5 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Task footer metrics */}
                          <div className="flex items-center justify-between pt-3.5 mt-3.5 border-t border-border/50">
                            {task.due_date ? (
                              <span className="text-[9px] font-bold text-muted flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(task.due_date).toLocaleDateString()}</span>
                              </span>
                            ) : (
                              <span></span>
                            )}

                            <div className="flex items-center gap-2.5">
                              {/* Priority pill */}
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase ${getPriorityStyle(task.priority)}`}>
                                {task.priority}
                              </span>

                              {/* Assignee Avatar */}
                              {task.task_assignees && task.task_assignees.length > 0 ? (
                                <div 
                                  className="w-5.5 h-5.5 rounded-full bg-yellow text-navy text-[8px] font-black grid place-items-center border border-yellow/20"
                                  title={task.task_assignees[0].profiles?.full_name}
                                >
                                  {task.task_assignees[0].profiles?.full_name?.substring(0, 1).toUpperCase()}
                                </div>
                              ) : (
                                <div className="w-5.5 h-5.5 rounded-full bg-bg border border-border text-muted grid place-items-center" title="Unassigned">
                                  <User className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
