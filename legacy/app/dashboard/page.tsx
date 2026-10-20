'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  FolderKanban, 
  ListTodo, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react'
import { useCollabixStore, Task } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { 
    user, 
    projects, 
    tasks, 
    activeWorkspace 
  } = useCollabixStore()
  
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)

  // Filter tasks assigned to current user
  const myTasks = tasks.filter(t => 
    t.task_assignees?.some(a => a.profile_id === user?.id)
  )

  // Calculations
  const totalProjects = projects.length
  const activeTasksCount = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length
  const completedTasksCount = tasks.filter(t => t.status === 'COMPLETED').length
  
  // Calculate upcoming deadlines (tasks/projects due in the next 7 days)
  const upcomingDeadlinesCount = tasks.filter(t => {
    if (!t.due_date || t.status === 'COMPLETED') return false
    const diff = new Date(t.due_date).getTime() - new Date().getTime()
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000
  }).length

  // Toggle task completion
  const handleToggleTask = async (task: Task) => {
    if (updatingTaskId) return
    setUpdatingTaskId(task.id)
    
    const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED'
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', task.id)
      
      if (error) throw error
    } catch (err) {
      console.error('Error updating task:', err)
    } finally {
      setUpdatingTaskId(null)
    }
  }

  // Get status color styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'bg-bg text-muted border border-border'
      case 'IN_PROGRESS':
        return 'bg-blue-soft text-blue'
      case 'IN_REVIEW':
        return 'bg-yellow-soft text-orange'
      case 'COMPLETED':
        return 'bg-green-soft text-green'
      case 'BLOCKED':
        return 'bg-red-soft text-red'
      case 'CANCELLED':
        return 'bg-bg text-muted line-through border border-border'
      default:
        return 'bg-bg text-muted'
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* KPI Metrics row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-custom p-5 shadow-custom flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Projects</span>
              <FolderKanban className="w-4 h-4 text-blue" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-text tracking-tight">
                {String(totalProjects).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-blue block mt-1">Active workspace scope</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-custom p-5 shadow-custom flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider">Active Tasks</span>
              <ListTodo className="w-4 h-4 text-orange" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-text tracking-tight">
                {String(activeTasksCount).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-orange block mt-1">Pending allocation</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-custom p-5 shadow-custom flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider">Completed Tasks</span>
              <CheckCircle2 className="w-4 h-4 text-green" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-text tracking-tight">
                {String(completedTasksCount).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-green block mt-1">All time archive</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-custom p-5 shadow-custom flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider">Deadlines Approaching</span>
              <AlertCircle className="w-4 h-4 text-red" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-text tracking-tight">
                {String(upcomingDeadlinesCount).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-red block mt-1">Due within 7 days</span>
            </div>
          </div>
        </div>

        {/* Mid grid: Active Projects & AI prompt */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Active Projects card */}
          <div className="bg-card border border-border rounded-custom p-6 shadow-custom lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-text">Active Projects</h2>
              <Link href="/projects" className="text-xs font-bold text-blue hover:underline flex items-center gap-0.5">
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-4.5">
              {projects.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border rounded-xl">
                  <p className="text-xs font-bold text-muted">No active projects created yet.</p>
                  <p className="text-[10px] text-muted/80 mt-1">Use the "+ Create Task" modal to select a project target.</p>
                </div>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="bg-bg/40 border border-border/80 rounded-2xl p-4.5 hover:border-blue/20 hover:bg-bg/70 transition-all">
                    <div className="flex items-center justify-between">
                      <b className="text-xs font-extrabold text-text">{project.name}</b>
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-bold bg-blue-soft text-blue">
                        {project.status}
                      </span>
                    </div>
                    
                    {/* Progress slider bar */}
                    <div className="w-full bg-border/55 h-2 rounded-full overflow-hidden mt-3 mb-2">
                      <div 
                        className="bg-blue h-full rounded-full transition-all duration-500" 
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold text-muted">
                      <span><b>{project.progress}%</b> complete</span>
                      <span>Due {project.due_date ? new Date(project.due_date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Banner Card */}
          <div className="bg-gradient-to-br from-navy to-[#1e293b] text-white rounded-custom p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
            {/* Absolute vector details */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-yellow/5 rounded-full blur-xl pointer-events-none" />

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-yellow" />
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-yellow">Collabix AI</h2>
              </div>
              <p className="text-[11px] text-slate-300 font-semibold mt-1">Your intelligent assistant</p>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5 mt-6 backdrop-blur-xs">
                <small className="text-[9px] font-extrabold text-blue-300 uppercase tracking-widest block">Today's Insight</small>
                <b className="text-xs font-extrabold block text-white mt-1">
                  {upcomingDeadlinesCount > 0 
                    ? `${upcomingDeadlinesCount} deadlines are approaching` 
                    : 'Projects are on schedule!'}
                </b>
                <p className="text-[10px] text-slate-300 mt-2 font-medium leading-relaxed">
                  {upcomingDeadlinesCount > 0 
                    ? "Prioritize tasks due soon and review blocking comments in active sprint channels." 
                    : "No immediate bottlenecks detected. Optimize team workloads and review upcoming milestones."}
                </p>
              </div>
            </div>

            <button 
              onClick={() => router.push('/ai')}
              className="w-full mt-6 h-11 bg-yellow hover:bg-yellow/95 text-navy font-black text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
            >
              Ask Collabix AI
            </button>
          </div>
        </div>

        {/* Lower grid: My Tasks & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* My Tasks Today */}
          <div className="bg-card border border-border rounded-custom p-6 shadow-custom">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-text">My Tasks Today</h2>
              <Link href="/tasks" className="text-xs font-bold text-blue hover:underline flex items-center gap-0.5">
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2">
              {myTasks.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border rounded-xl">
                  <p className="text-xs font-bold text-muted">You have no tasks assigned for today.</p>
                  <p className="text-[10px] text-muted/80 mt-1">Assign yourself a task in the board to view it here.</p>
                </div>
              ) : (
                myTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 bg-bg/40 border border-border/80 rounded-xl p-3.5 hover:bg-bg/75 transition-all">
                    
                    {/* Checkbox wrapper */}
                    <button 
                      onClick={() => handleToggleTask(task)}
                      disabled={updatingTaskId === task.id}
                      className={`
                        w-[18px] h-[18px] rounded-md border flex items-center justify-center text-[10px] font-black cursor-pointer transition-all shrink-0
                        ${task.status === 'COMPLETED' 
                          ? 'bg-green border-green text-white' 
                          : 'bg-white border-border hover:border-blue'
                        }
                      `}
                    >
                      {task.status === 'COMPLETED' && '✓'}
                    </button>

                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-extrabold text-text block truncate ${task.status === 'COMPLETED' ? 'line-through text-muted' : ''}`}>
                        {task.title}
                      </span>
                      <small className="text-[9px] font-bold text-muted">
                        {task.projects?.name}
                      </small>
                    </div>

                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${getStatusStyle(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    <span className="text-[9px] font-black text-muted uppercase tracking-wider shrink-0 w-[50px] text-right">
                      {task.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card border border-border rounded-custom p-6 shadow-custom">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-text">Recent Activity</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted select-none">Realtime feed</span>
            </div>

            <div className="divide-y divide-border/60">
              {/* Seed activities / dynamic events listing */}
              <div className="flex items-center gap-3.5 py-3">
                <div className="w-8 h-8 rounded-full bg-yellow text-navy text-[10px] font-black grid place-items-center shrink-0">
                  SA
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text font-bold leading-tight">
                    Sarah Ahmed <span className="text-muted font-semibold">completed</span> UI Design
                  </p>
                  <small className="text-[9px] font-semibold text-muted block mt-0.5">E-Commerce Platform</small>
                </div>
                <span className="text-[9px] font-bold text-muted shrink-0">10m ago</span>
              </div>

              <div className="flex items-center gap-3.5 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-soft text-blue text-[10px] font-black grid place-items-center shrink-0">
                  AA
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text font-bold leading-tight">
                    Ahmed Ali <span className="text-muted font-semibold">created task</span> API Integration
                  </p>
                  <small className="text-[9px] font-semibold text-muted block mt-0.5">Mobile Banking App</small>
                </div>
                <span className="text-[9px] font-bold text-muted shrink-0">32m ago</span>
              </div>

              <div className="flex items-center gap-3.5 py-3">
                <div className="w-8 h-8 rounded-full bg-green-soft text-green text-[10px] font-black grid place-items-center shrink-0">
                  MC
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text font-bold leading-tight">
                    Maya Chen <span className="text-muted font-semibold">commented on</span> Analytics Dashboard
                  </p>
                  <small className="text-[9px] font-semibold text-muted block mt-0.5">"Queries are fully optimized now!"</small>
                </div>
                <span className="text-[9px] font-bold text-muted shrink-0">1h ago</span>
              </div>

              <div className="flex items-center gap-3.5 py-3">
                <div className="w-8 h-8 rounded-full bg-yellow text-navy text-[10px] font-black grid place-items-center shrink-0">
                  H
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text font-bold leading-tight">
                    You <span className="text-muted font-semibold">changed project status</span> Mobile Banking
                  </p>
                  <small className="text-[9px] font-semibold text-muted block mt-0.5">Updated status to ACTIVE</small>
                </div>
                <span className="text-[9px] font-bold text-muted shrink-0">2h ago</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </DashboardLayout>
  )
}
