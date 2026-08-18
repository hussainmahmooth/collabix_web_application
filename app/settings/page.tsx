'use client'

import { useState } from 'react'
import { 
  Settings as SettingsIcon,
  User,
  Layout,
  Volume2,
  ChevronRight,
  Plus
} from 'lucide-react'
import { useCollabixStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function SettingsPage() {
  const supabase = createClient()
  const { user, activeWorkspace } = useCollabixStore()

  // New workspace form
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceSlug, setNewWorkspaceSlug] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName || !newWorkspaceSlug || !user) return
    setSubmitting(true)
    setSuccessMsg('')

    try {
      // 1. Create workspace
      const { data: ws, error: wsError } = await supabase
        .from('workspaces')
        .insert({
          name: newWorkspaceName,
          slug: newWorkspaceSlug.toLowerCase().replace(/\s+/g, '-'),
          created_by: user.id
        })
        .select()
        .single()

      if (wsError) throw wsError

      if (ws) {
        // 2. Add creator as OWNER member
        await supabase
          .from('workspace_members')
          .insert({
            workspace_id: ws.id,
            profile_id: user.id,
            role: 'OWNER'
          })

        setSuccessMsg(`Workspace "${newWorkspaceName}" created successfully!`)
        setNewWorkspaceName('')
        setNewWorkspaceSlug('')
        window.location.reload()
      }
    } catch (err) {
      console.error('Error creating workspace:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle Dark Mode Theme
  const toggleTheme = () => {
    const isDark = document.body.classList.toggle('dark')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }

  return (
    <DashboardLayout>
      <div className="max-w-[700px] mx-auto space-y-6">
        
        {/* Profile Card settings */}
        {user && (
          <div className="bg-card border border-border rounded-custom p-6 shadow-custom">
            <h3 className="text-xs font-black uppercase tracking-wider text-text mb-4 flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue" />
              <span>Account Details</span>
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span className="text-xs font-bold text-muted">Full Name</span>
                <span className="text-xs font-extrabold text-text">{user.full_name}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span className="text-xs font-bold text-muted">Workspace Role</span>
                <span className="text-xs font-extrabold text-text">{user.role}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span className="text-xs font-bold text-muted">Profile Created</span>
                <span className="text-xs font-extrabold text-text">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Preferences settings */}
        <div className="bg-card border border-border rounded-custom p-6 shadow-custom">
          <h3 className="text-xs font-black uppercase tracking-wider text-text mb-4 flex items-center gap-1.5">
            <Layout className="w-4 h-4 text-blue" />
            <span>Preferences</span>
          </h3>

          <div className="space-y-4.5">
            <div className="flex justify-between items-center p-3.5 bg-bg/40 border border-border rounded-xl">
              <div>
                <b className="text-xs font-extrabold text-text block">Appearance</b>
                <small className="text-[9px] font-bold text-muted uppercase block mt-0.5">Toggle Dark Mode</small>
              </div>
              <button 
                onClick={toggleTheme}
                className="px-4 py-2 border border-border hover:border-blue hover:text-blue bg-card rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Change Theme
              </button>
            </div>

            <div className="flex justify-between items-center p-3.5 bg-bg/40 border border-border rounded-xl opacity-80">
              <div>
                <b className="text-xs font-extrabold text-text block">Desktop Notifications</b>
                <small className="text-[9px] font-bold text-muted uppercase block mt-0.5">Task assignments alerts</small>
              </div>
              <div className="w-11 h-6 bg-blue rounded-full p-0.5 flex justify-end items-center cursor-not-allowed">
                <span className="w-5 h-5 rounded-full bg-white block" />
              </div>
            </div>
          </div>
        </div>

        {/* Create workspace setting */}
        <div className="bg-card border border-border rounded-custom p-6 shadow-custom">
          <h3 className="text-xs font-black uppercase tracking-wider text-text mb-1.5 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-blue" />
            <span>Create Workspace</span>
          </h3>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-6">
            Launch a new corporate workspace group
          </p>

          {successMsg && (
            <div className="mb-4 p-3 bg-green-soft text-green text-xs font-semibold rounded-lg border border-green/10 text-center">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Workspace Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Acme Corp"
                  className="w-full h-10 px-3.5 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl"
                  value={newWorkspaceName}
                  onChange={(e) => {
                    setNewWorkspaceName(e.target.value)
                    setNewWorkspaceSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Unique URL Slug</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. acme-corp"
                  className="w-full h-10 px-3.5 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl"
                  value={newWorkspaceSlug}
                  onChange={(e) => setNewWorkspaceSlug(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button 
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 bg-blue hover:bg-blue/90 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-sm shadow-blue/15"
              >
                {submitting ? 'Creating...' : 'Create Workspace'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </DashboardLayout>
  )
}
