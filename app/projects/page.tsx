'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FolderPlus, 
  Search, 
  Plus, 
  X,
  FolderKanban,
  FileBarChart2,
  Calendar,
  LayoutGrid
} from 'lucide-react'
import { useCollabixStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function ProjectsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { 
    projects, 
    tasks, 
    workspaceMembers, 
    activeWorkspace 
  } = useCollabixStore()

  // Local state for project creation
  const [modalOpen, setModalOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [projectDueDate, setProjectDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('')

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName || !activeWorkspace) return
    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          workspace_id: activeWorkspace.id,
          name: projectName,
          description: projectDesc || null,
          status: 'ACTIVE',
          progress: 0,
          due_date: projectDueDate ? projectDueDate : null
        })

      if (error) throw error

      setProjectName('')
      setProjectDesc('')
      setProjectDueDate('')
      setModalOpen(false)
    } catch (err) {
      console.error('Error creating project:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Filter projects by search query
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Get project statistics helper
  const getProjectStats = (projectId: string) => {
    const projectTasks = tasks.filter(t => t.project_id === projectId)
    const completedTasks = projectTasks.filter(t => t.status === 'COMPLETED').length
    
    // Count unique assignees on tasks in this project
    const assigneesSet = new Set<string>()
    projectTasks.forEach(t => {
      t.task_assignees?.forEach(a => assigneesSet.add(a.profile_id))
    })

    return {
      tasksCount: projectTasks.length,
      completedCount: completedTasks,
      teamCount: assigneesSet.size || 1
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Controls header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-full sm:w-[280px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search projects..."
              className="w-full h-10 pl-9 pr-4 border border-border bg-card rounded-xl text-xs font-semibold focus:border-blue transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 h-10 bg-blue hover:bg-blue/90 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm shadow-blue/15"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        </div>

        {/* Project grid */}
        {filteredProjects.length === 0 ? (
          <div className="py-16 text-center bg-card border border-border rounded-custom shadow-custom">
            <div className="w-12 h-12 bg-blue-soft text-blue rounded-xl grid place-items-center mx-auto mb-4">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-extrabold text-text">No projects found</h3>
            <p className="text-xs text-muted mt-1.5 max-w-[320px] mx-auto leading-relaxed">
              Create your first project board to begin organizing tasks and collaborating in real-time.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-5 inline-flex items-center gap-1.5 px-4 h-9 bg-blue text-white text-xs font-bold rounded-xl hover:bg-blue/90 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => {
              const stats = getProjectStats(project.id)
              return (
                <div 
                  key={project.id} 
                  className="bg-card border border-border rounded-custom p-6 shadow-custom flex flex-col justify-between min-h-[220px] hover:border-blue/20 hover:shadow-lg transition-all duration-300"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-extrabold text-text line-clamp-1">
                        {project.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-soft text-blue shrink-0">
                        {project.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted font-medium mt-2 line-clamp-2 min-h-[32px]">
                      {project.description || 'No description provided.'}
                    </p>

                    {/* Progress details */}
                    <div className="mt-5">
                      <div className="w-full bg-bg h-2 rounded-full overflow-hidden mb-2 border border-border/50">
                        <div 
                          className="bg-blue h-full rounded-full transition-all duration-500" 
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-muted">
                        <span>{project.progress}% complete</span>
                        <span>{stats.completedCount} / {stats.tasksCount} tasks</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer links */}
                  <div className="flex items-center justify-between pt-5 mt-5 border-t border-border/60">
                    <span className="text-[9px] font-extrabold text-muted uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{project.due_date ? new Date(project.due_date).toLocaleDateString() : 'No deadline'}</span>
                    </span>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => router.push(`/reports?project=${project.id}`)}
                        className="p-2 border border-border hover:bg-bg rounded-lg text-muted hover:text-text transition-all cursor-pointer"
                        title="View Reports"
                      >
                        <FileBarChart2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => router.push(`/tasks?project=${project.id}`)}
                        className="px-3.5 py-1.5 bg-bg border border-border hover:border-blue hover:text-blue rounded-lg text-[10px] font-bold text-text transition-all cursor-pointer"
                      >
                        Open Project
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ==========================================
            MODAL: CREATE PROJECT (LOCAL)
            ========================================== */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-[450px] bg-card border border-border rounded-custom p-6 shadow-2xl relative">
              <button 
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-bg border border-border grid place-items-center cursor-pointer"
              >
                <X className="w-4 h-4 text-text" />
              </button>

              <h3 className="text-lg font-extrabold text-text mb-1">Create Project</h3>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-6">
                Establish a new project dashboard board
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
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2.5 border border-border text-xs font-bold rounded-xl hover:bg-bg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2.5 bg-blue hover:bg-blue/90 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
