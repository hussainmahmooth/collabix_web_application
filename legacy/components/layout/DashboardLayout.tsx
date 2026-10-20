'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCollabixStore, Task, Message, Notification } from '@/lib/store'
import Sidebar from './Sidebar'
import Header from './Header'
import { X, Loader } from 'lucide-react'

const supabase = createClient()

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  
  const {
    user,
    projects,
    workspaceMembers,
    activeWorkspace,
    loading,
    fetchInitialData,
    addTask,
    updateTask,
    deleteTask,
    addMessage,
    addNotification,
  } = useCollabixStore()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)

  // Form states for creating task
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskProjectId, setTaskProjectId] = useState('')
  const [taskAssigneeId, setTaskAssigneeId] = useState('')
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskSubmitting, setTaskSubmitting] = useState(false)

  // Form states for creating project
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [projectDueDate, setProjectDueDate] = useState('')
  const [projectSubmitting, setProjectSubmitting] = useState(false)

  // 1. Authenticate user & load initial store data
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await fetchInitialData(session.user.id)
    }

    checkAuth()
  }, [fetchInitialData, router, supabase])

  // 2. Set up real-time listener subscriptions
  useEffect(() => {
    if (!activeWorkspace) return

    // Channels listeners
    const taskChannel = supabase
      .channel('realtime-tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        async (payload: any) => {
          if (payload.eventType === 'INSERT') {
            // Fetch task with relational data (projects, assignees)
            const { data } = await supabase
              .from('tasks')
              .select(`
                *,
                projects(name),
                task_assignees(
                  profile_id,
                  profiles(*)
                ),
                task_labels(
                  labels(name, color)
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (data) addTask(data as unknown as Task)
          } else if (payload.eventType === 'UPDATE') {
            const { data } = await supabase
              .from('tasks')
              .select(`
                *,
                projects(name),
                task_assignees(
                  profile_id,
                  profiles(*)
                ),
                task_labels(
                  labels(name, color)
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (data) updateTask(data as unknown as Task)
          } else if (payload.eventType === 'DELETE') {
            deleteTask(payload.old.id)
          }
        }
      )
      .subscribe()

    const msgChannel = supabase
      .channel('realtime-messages-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload: any) => {
          const { data } = await supabase
            .from('messages')
            .select('*, profiles(*)')
            .eq('id', payload.new.id)
            .single()

          if (data) addMessage(data as unknown as Message)
        }
      )
      .subscribe()

    const notifChannel = supabase
      .channel('realtime-notifications-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload: any) => {
          addNotification(payload.new as Notification)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(taskChannel)
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(notifChannel)
    }
  }, [activeWorkspace, addTask, updateTask, deleteTask, addMessage, addNotification, supabase])

  // Set default project selection when project options load
  useEffect(() => {
    if (projects.length > 0 && !taskProjectId) {
      setTaskProjectId(projects[0].id)
    }
  }, [projects, taskProjectId])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle || !taskProjectId || !user) return
    setTaskSubmitting(true)

    try {
      // 1. Insert task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          project_id: taskProjectId,
          title: taskTitle,
          description: taskDesc || null,
          status: 'TODO',
          priority: taskPriority,
          due_date: taskDueDate ? new Date(taskDueDate).toISOString() : null,
          creator_id: user.id,
        })
        .select()
        .single()

      if (taskError) throw taskError

      // 2. Insert assignee if chosen
      if (taskAssigneeId && task) {
        await supabase
          .from('task_assignees')
          .insert({
            task_id: task.id,
            profile_id: taskAssigneeId,
          })

        // 3. Trigger notification for assignee (if not self)
        if (taskAssigneeId !== user.id) {
          await supabase.from('notifications').insert({
            profile_id: taskAssigneeId,
            title: 'New Task Assigned',
            content: `You have been assigned the task: "${taskTitle}"`,
            type: 'assignment',
            link: `/tasks`,
          })
        }
      }

      // Close modal and reset fields
      setTaskTitle('')
      setTaskDesc('')
      setTaskAssigneeId('')
      setTaskDueDate('')
      setTaskModalOpen(false)
    } catch (err) {
      console.error('Error inserting task:', err)
    } finally {
      setTaskSubmitting(false)
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName || !activeWorkspace) return
    setProjectSubmitting(true)

    try {
      const { error } = await supabase.from('projects').insert({
        workspace_id: activeWorkspace.id,
        name: projectName,
        description: projectDesc || null,
        status: 'ACTIVE',
        progress: 0,
        due_date: projectDueDate ? projectDueDate : null,
      })

      if (error) throw error

      setProjectName('')
      setProjectDesc('')
      setProjectDueDate('')
      setProjectModalOpen(false)
    } catch (err) {
      console.error('Error inserting project:', err)
    } finally {
      setProjectSubmitting(false)
    }
  }

  if (loading && !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 text-blue animate-spin" />
          <span className="text-xs font-bold text-muted">Loading your workspace...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Panel */}
      <div className="lg:pl-[245px] md:pl-[80px] min-h-screen flex flex-col transition-all duration-300">
        <div className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">
          {/* Header Panel */}
          <Header 
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            onCreateTaskClick={() => setTaskModalOpen(true)}
          />

          {/* Child Page view router */}
          <main className="pb-12">
            {children}
          </main>
        </div>
      </div>

      {/* ==========================================
          MODAL: CREATE TASK
          ========================================== */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] bg-card border border-border rounded-custom p-6 shadow-2xl relative">
            <button 
              onClick={() => setTaskModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-bg border border-border grid place-items-center cursor-pointer"
            >
              <X className="w-4 h-4 text-text" />
            </button>

            <h3 className="text-lg font-extrabold text-text mb-1">Create Task</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-6">
              Add a new task to your team workspace
            </p>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Task Title</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Design checkout screen"
                  className="w-full h-10 px-3.5 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Description</label>
                <textarea 
                  placeholder="Describe what needs to be completed..."
                  className="w-full min-h-[90px] p-3.5 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl resize-none"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Project</label>
                  <select 
                    required
                    className="w-full h-10 px-2.5 bg-bg/50 border border-border text-xs rounded-xl outline-none"
                    value={taskProjectId}
                    onChange={(e) => setTaskProjectId(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Assign Member</label>
                  <select 
                    className="w-full h-10 px-2.5 bg-bg/50 border border-border text-xs rounded-xl outline-none"
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {workspaceMembers.map((m) => (
                      <option key={m.profile_id} value={m.profile_id}>
                        {m.profiles?.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Priority</label>
                  <select 
                    className="w-full h-10 px-2.5 bg-bg/50 border border-border text-xs rounded-xl outline-none"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Due Date</label>
                  <input 
                    type="date"
                    className="w-full h-10 px-3 bg-bg/50 border border-border text-xs rounded-xl"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/80">
                <button 
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2.5 border border-border text-xs font-bold rounded-xl hover:bg-bg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={taskSubmitting}
                  className="px-4 py-2.5 bg-blue hover:bg-blue/90 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {taskSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CREATE PROJECT
          ========================================== */}
      {projectModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-[450px] bg-card border border-border rounded-custom p-6 shadow-2xl relative">
            <button 
              onClick={() => setProjectModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-bg border border-border grid place-items-center cursor-pointer"
            >
              <X className="w-4 h-4 text-text" />
            </button>

            <h3 className="text-lg font-extrabold text-text mb-1">Create Project</h3>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-6">
              Establish a new workspace project board
            </p>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Project Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Student Portal"
                  className="w-full h-10 px-3.5 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Description</label>
                <textarea 
                  placeholder="What is this project's core focus..."
                  className="w-full min-h-[90px] p-3.5 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl resize-none"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Target Deadline Date</label>
                <input 
                  type="date"
                  className="w-full h-10 px-3 bg-bg/50 border border-border text-xs rounded-xl"
                  value={projectDueDate}
                  onChange={(e) => setProjectDueDate(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/80">
                <button 
                  type="button"
                  onClick={() => setProjectModalOpen(false)}
                  className="px-4 py-2.5 border border-border text-xs font-bold rounded-xl hover:bg-bg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={projectSubmitting}
                  className="px-4 py-2.5 bg-blue hover:bg-blue/90 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {projectSubmitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
