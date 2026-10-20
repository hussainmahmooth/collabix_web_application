'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts'
import { 
  FileBarChart2, 
  ListTodo, 
  TrendingUp, 
  AlertTriangle,
  Award
} from 'lucide-react'
import { useCollabixStore } from '@/lib/store'
import DashboardLayout from '@/components/layout/DashboardLayout'

const COLORS = ['#2563EB', '#FACC15', '#16a34a', '#d97706', '#dc2626', '#94a3b8']

export default function ReportsPage() {
  const { projects, tasks, workspaceMembers } = useCollabixStore()
  
  // Hydration safeguard
  const [mounted, setMounted] = useState(false)
  const [selectedProject, setSelectedProject] = useState('ALL')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Filter tasks based on project select
  const filteredTasks = tasks.filter(t => 
    selectedProject === 'ALL' || t.project_id === selectedProject
  )

  // Calculations
  const completedTasks = filteredTasks.filter(t => t.status === 'COMPLETED').length
  const totalTasks = filteredTasks.length
  const pendingTasks = totalTasks - completedTasks
  
  const overdueTasks = filteredTasks.filter(t => {
    if (!t.due_date || t.status === 'COMPLETED') return false
    return new Date(t.due_date) < new Date()
  }).length

  const productivity = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // 1. Team Workload chart data
  const teamWorkloadData = workspaceMembers.map(member => {
    const activeTasks = tasks.filter(t => 
      t.status !== 'COMPLETED' && 
      (selectedProject === 'ALL' || t.project_id === selectedProject) &&
      t.task_assignees?.some(a => a.profile_id === member.profile_id)
    ).length

    return {
      name: member.profiles?.full_name?.split(' ')[0] || 'Unknown',
      tasks: activeTasks
    }
  })

  // 2. Project progress chart data
  const projectProgressData = projects.map(p => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
    Progress: p.progress
  }))

  // 3. Task Status distribution chart data
  const statusDistributionData = [
    { name: 'To Do', value: filteredTasks.filter(t => t.status === 'TODO').length },
    { name: 'In Progress', value: filteredTasks.filter(t => t.status === 'IN_PROGRESS').length },
    { name: 'In Review', value: filteredTasks.filter(t => t.status === 'IN_REVIEW').length },
    { name: 'Completed', value: filteredTasks.filter(t => t.status === 'COMPLETED').length },
    { name: 'Blocked', value: filteredTasks.filter(t => t.status === 'BLOCKED').length },
  ].filter(s => s.value > 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Filter controls */}
        <div className="flex items-center justify-between gap-4 bg-card border border-border rounded-custom p-4 shadow-custom flex-wrap">
          <div className="flex items-center gap-2">
            <FileBarChart2 className="w-5 h-5 text-blue" />
            <h2 className="text-sm font-extrabold text-text uppercase tracking-wider">
              Workspace Performance Reports
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Scope Scope:</label>
            <select
              className="h-9 px-3 border border-border bg-bg/50 rounded-xl text-xs font-semibold outline-none cursor-pointer"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="ALL">All Workspace Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dashboard report cards grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-custom p-5 shadow-custom flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider">Overall Completion</span>
              <TrendingUp className="w-4 h-4 text-blue" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-text tracking-tight">
                {productivity}%
              </span>
              <span className="text-[10px] font-semibold text-blue block mt-1">Workspace productivity</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-custom p-5 shadow-custom flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider">Completed Tasks</span>
              <Award className="w-4 h-4 text-green" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-text tracking-tight">
                {String(completedTasks).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-green block mt-1">Closed items</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-custom p-5 shadow-custom flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider">Remaining Tasks</span>
              <ListTodo className="w-4 h-4 text-orange" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-text tracking-tight">
                {String(pendingTasks).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-orange block mt-1">Active backlog</span>
            </div>
          </div>

          <div className="bg-card border border-border rounded-custom p-5 shadow-custom flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider">Overdue Items</span>
              <AlertTriangle className="w-4 h-4 text-red" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-text tracking-tight text-red">
                {String(overdueTasks).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-red block mt-1">Require immediate attention</span>
            </div>
          </div>
        </div>

        {/* Recharts Graphical Visuals */}
        {mounted && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Project Completion Trend Bar Chart */}
            <div className="bg-card border border-border rounded-custom p-5 shadow-custom min-h-[320px] flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-wider text-text mb-4">Project Completion Trend</h3>
              <div className="flex-1 w-full min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                    <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" domain={[0, 100]} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '10px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="Progress" fill="#2563EB" radius={[5, 5, 0, 0]} barSize={30} name="Completion Rate (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Team Workload Allocation Bar Chart */}
            <div className="bg-card border border-border rounded-custom p-5 shadow-custom min-h-[320px] flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-wider text-text mb-4">Team Workload Allocation</h3>
              <div className="flex-1 w-full min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamWorkloadData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                    <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '10px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="tasks" fill="#FACC15" radius={[5, 5, 0, 0]} barSize={30} name="Active Tasks Assigned" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Task Status Distribution Pie Chart */}
            <div className="bg-card border border-border rounded-custom p-5 shadow-custom min-h-[320px] flex flex-col lg:col-span-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-text mb-4">Task Status Distribution</h3>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="w-full min-h-[220px]">
                  {statusDistributionData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs font-bold text-muted">
                      No status records
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Status Legend metrics */}
                <div className="space-y-3 px-6">
                  {statusDistributionData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-muted">{item.name}</span>
                      </div>
                      <span className="text-text">{item.value} tasks ({totalTasks > 0 ? Math.round((item.value / totalTasks) * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
