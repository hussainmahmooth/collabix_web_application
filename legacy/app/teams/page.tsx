'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  UserPlus, 
  Search, 
  X, 
  Mail, 
  ShieldAlert,
  MessageSquare,
  Shield,
  Briefcase,
  Trash2,
  Check
} from 'lucide-react'
import { useCollabixStore, WorkspaceMember } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout from '@/components/layout/DashboardLayout'

const roles = ['OWNER', 'ADMIN', 'PROJECT_MANAGER', 'MEMBER', 'VIEWER']

export default function TeamsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const { 
    user, 
    workspaceMembers, 
    activeWorkspace, 
    tasks, 
    channels,
    addWorkspaceMember,
    removeWorkspaceMember,
    updateWorkspaceMember
  } = useCollabixStore()

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)

  // Filter members by search query
  const filteredMembers = workspaceMembers.filter(m => 
    m.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Current user's workspace membership details
  const currentUserMember = workspaceMembers.find(m => m.profile_id === user?.id)
  const canManageRoles = currentUserMember?.role === 'OWNER' || currentUserMember?.role === 'ADMIN'

  // Workload calculator: count tasks that are assigned to a member and are not completed
  const getMemberWorkload = (profileId: string) => {
    const assignedTasks = tasks.filter(t => 
      t.status !== 'COMPLETED' && 
      t.task_assignees?.some(a => a.profile_id === profileId)
    )
    return assignedTasks.length
  }

  // Direct messaging redirect
  const handleOpenDM = async (targetMember: WorkspaceMember) => {
    if (!user || !activeWorkspace) return

    // 1. Search for existing DM channel with target member
    const existingDm = channels.find(c => c.is_dm && c.name.includes(targetMember.profiles.full_name))

    if (existingDm) {
      router.push(`/messages?channel=${existingDm.id}`)
      return
    }

    // 2. Create new DM channel if not found
    try {
      const dmChannelName = `${user.full_name} & ${targetMember.profiles.full_name}`
      
      const { data: channel, error: chError } = await supabase
        .from('channels')
        .insert({
          workspace_id: activeWorkspace.id,
          name: dmChannelName,
          is_dm: true
        })
        .select()
        .single()

      if (chError) throw chError

      if (channel) {
        // Add members to channel
        await supabase
          .from('channel_members')
          .insert([
            { channel_id: channel.id, profile_id: user.id },
            { channel_id: channel.id, profile_id: targetMember.profile_id }
          ])

        router.push(`/messages?channel=${channel.id}`)
      }
    } catch (err) {
      console.error('Error creating DM channel:', err)
    }
  }

  // Update member role
  const handleUpdateRole = async (memberId: string, newRole: string) => {
    setUpdatingMemberId(memberId)
    try {
      const member = workspaceMembers.find(m => m.id === memberId)
      const fullName = member?.profiles?.full_name || ''

      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error
      updateWorkspaceMember(memberId, newRole, fullName)
    } catch (err) {
      console.error('Error updating member role:', err)
    } finally {
      setUpdatingMemberId(null)
    }
  }

  // Remove member from workspace
  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (!confirm(`Are you sure you want to remove ${member.profiles.full_name} from this workspace?`)) return
    
    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', member.id)

      if (error) throw error
      removeWorkspaceMember(member.id)
    } catch (err) {
      console.error('Error removing workspace member:', err)
    }
  }

  // Rename a member profile
  const handleRenameMember = async (member: WorkspaceMember) => {
    const newName = prompt(`Enter new name for ${member.profiles?.full_name || 'Member'}:`, member.profiles?.full_name || '')
    if (!newName || newName.trim() === '') return
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', member.profile_id)

      if (error) throw error
      updateWorkspaceMember(member.id, member.role, newName)
    } catch (err) {
      console.error('Error renaming member:', err)
    }
  }

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName || !activeWorkspace) return
    setSubmitting(true)

    try {
      const profileId = crypto.randomUUID()

      // 1. Create Profile
      const { error: prError } = await supabase
        .from('profiles')
        .insert({
          id: profileId,
          full_name: newMemberName,
          role: newMemberRole
        })

      if (prError) throw prError

      // 2. Create Workspace Member link
      const { data: member, error: memError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: activeWorkspace.id,
          profile_id: profileId,
          role: newMemberRole
        })
        .select()
        .single()

      if (memError) throw memError

      // 3. Update local store
      const newMember: WorkspaceMember = {
        id: member?.id || crypto.randomUUID(),
        workspace_id: activeWorkspace.id,
        profile_id: profileId,
        role: newMemberRole,
        profiles: {
          id: profileId,
          full_name: newMemberName,
          avatar_url: null,
          role: newMemberRole,
          created_at: new Date().toISOString()
        }
      }
      
      addWorkspaceMember(newMember)

      setNewMemberName('')
      setModalOpen(false)
    } catch (err) {
      console.error('Error creating virtual member:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-full sm:w-[280px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search team members..."
              className="w-full h-10 pl-9 pr-4 border border-border bg-card rounded-xl text-xs font-semibold focus:border-blue transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 h-10 bg-blue hover:bg-blue/90 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm shadow-blue/15"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>

        {/* Member cards/rows */}
        <div className="bg-card border border-border rounded-custom p-5 shadow-custom divide-y divide-border/60">
          {filteredMembers.map((member) => {
            const workload = getMemberWorkload(member.profile_id)
            const isSelf = member.profile_id === user?.id
            
            return (
              <div 
                key={member.id} 
                className="flex items-center gap-4 py-4 hover:bg-bg/20 transition-all first:pt-0 last:pb-0 flex-wrap sm:flex-nowrap"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-yellow text-navy text-xs font-black grid place-items-center shrink-0 border border-yellow/20 shadow-sm">
                  {member.profiles?.full_name?.substring(0, 2).toUpperCase()}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-extrabold text-text flex items-center gap-1.5">
                    <span>{member.profiles?.full_name}</span>
                    {isSelf && (
                      <span className="text-[9px] bg-blue-soft text-blue font-bold px-1.5 py-0.5 rounded-md">
                        You
                      </span>
                    )}
                  </span>
                  <small className="text-[10px] font-bold text-muted uppercase tracking-wider block mt-1">
                    {member.role.replace('_', ' ')}
                  </small>
                </div>

                {/* Workload Metric */}
                <div className="shrink-0 text-center sm:text-left min-w-[90px]">
                  <span className="text-xs font-extrabold text-text block">
                    {workload} active
                  </span>
                  <span className="text-[9px] font-bold text-muted uppercase tracking-wider">
                    Task Workload
                  </span>
                </div>

                {/* Role Switcher (Authorized) */}
                <div className="shrink-0">
                  {canManageRoles && !isSelf ? (
                    <select
                      className="h-8 px-2 border border-border bg-bg/50 rounded-lg text-[10px] font-bold outline-none cursor-pointer"
                      value={member.role}
                      disabled={updatingMemberId === member.id}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                    >
                      {roles.map(r => (
                        <option key={r} value={r}>{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[10px] font-bold text-muted px-2 py-1 bg-bg border border-border rounded-lg select-none">
                      {member.role.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 w-full sm:w-auto justify-end border-t border-border/40 sm:border-0 pt-3 sm:pt-0 shrink-0">
                  {(canManageRoles || isSelf) && (
                    <button
                      onClick={() => handleRenameMember(member)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-bg/50 border border-border hover:border-blue hover:text-blue rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      <span>Rename</span>
                    </button>
                  )}

                  {!isSelf && (
                    <button
                      onClick={() => handleOpenDM(member)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-soft text-blue rounded-lg text-[10px] font-bold border border-blue/5 hover:bg-blue-soft/80 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>
                  )}

                  {canManageRoles && !isSelf && (
                    <button
                      onClick={() => handleRemoveMember(member)}
                      className="p-1.5 border border-border hover:border-red hover:text-red hover:bg-red-soft rounded-lg text-muted transition-all cursor-pointer"
                      title="Remove Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ==========================================
            MODAL: ADD MEMBER (LOCAL)
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

              <h3 className="text-lg font-extrabold text-text mb-1">Add Team Member</h3>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-6">
                Create a new virtual team member inside this workspace
              </p>

              <form onSubmit={handleCreateMember} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Teammate Full Name</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Sarah Ahmed or Ahmed Ali"
                    className="w-full h-11 px-3.5 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Workspace Role Permissions</label>
                  <select 
                    className="w-full h-11 px-3.5 bg-bg/50 border border-border text-xs rounded-xl outline-none cursor-pointer"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                  >
                    <option value="ADMIN">Admin (Modify project settings)</option>
                    <option value="PROJECT_MANAGER">Project Manager (Assign/Move Tasks)</option>
                    <option value="MEMBER">Member (Participate & Read/Write Chat)</option>
                    <option value="VIEWER">Viewer (Read-only access)</option>
                  </select>
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
                    {submitting ? 'Adding...' : 'Add Member'}
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
