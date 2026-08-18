import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: string
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  created_by: string | null
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  profile_id: string
  role: string
  profiles: Profile
}

export interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: string
  progress: number
  start_date: string | null
  due_date: string | null
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  due_date: string | null
  creator_id: string | null
  created_at: string
  updated_at: string
  projects?: { name: string }
  task_assignees?: { profile_id: string; profiles: Profile }[]
  task_labels?: { labels: { name: string; color: string } }[]
}

export interface Message {
  id: string
  channel_id: string
  sender_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export interface Channel {
  id: string
  workspace_id: string
  name: string
  is_dm: boolean
  created_at: string
}

export interface Notification {
  id: string
  profile_id: string
  title: string
  content: string
  type: string
  is_read: boolean
  link: string | null
  created_at: string
}

interface CollabixState {
  user: Profile | null
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  workspaceMembers: WorkspaceMember[]
  projects: Project[]
  tasks: Task[]
  channels: Channel[]
  activeChannel: Channel | null
  messages: Message[]
  notifications: Notification[]
  loading: boolean
  
  setUser: (user: Profile | null) => void
  setLoading: (loading: boolean) => void
  fetchInitialData: (userId: string) => Promise<void>
  switchWorkspace: (workspaceId: string) => Promise<void>
  switchChannel: (channelId: string) => Promise<void>
  
  // Real-time incremental mutators for instant socket syncing
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (taskId: string) => void
  addMessage: (message: Message) => void
  addNotification: (notification: Notification) => void

  // Member management mutators
  addWorkspaceMember: (member: WorkspaceMember) => void
  removeWorkspaceMember: (memberId: string) => void
  updateWorkspaceMember: (memberId: string, role: string, fullName: string) => void
}

const supabase = createClient()
const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

export const useCollabixStore = create<CollabixState>((set, get) => ({
  user: null,
  workspaces: [],
  activeWorkspace: null,
  workspaceMembers: [],
  projects: [],
  tasks: [],
  channels: [],
  activeChannel: null,
  messages: [],
  notifications: [],
  loading: false,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  fetchInitialData: async (userId) => {
    set({ loading: true })
    if (isPlaceholder) {
      const mockUser: Profile = {
        id: userId,
        full_name: 'Hussain',
        avatar_url: null,
        role: 'OWNER',
        created_at: new Date().toISOString()
      }

      const mockWorkspace: Workspace = {
        id: 'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11',
        name: 'Collabix Main Workspace',
        slug: 'collabix-main',
        created_by: userId,
        created_at: new Date().toISOString()
      }

      const mockMembers: WorkspaceMember[] = [
        {
          id: 'm-1',
          workspace_id: mockWorkspace.id,
          profile_id: userId,
          role: 'OWNER',
          profiles: mockUser
        },
        {
          id: 'm-2',
          workspace_id: mockWorkspace.id,
          profile_id: 'sarah-id',
          role: 'PROJECT_MANAGER',
          profiles: { id: 'sarah-id', full_name: 'Sarah Ahmed', avatar_url: null, role: 'PROJECT_MANAGER', created_at: new Date().toISOString() }
        },
        {
          id: 'm-3',
          workspace_id: mockWorkspace.id,
          profile_id: 'ahmed-id',
          role: 'MEMBER',
          profiles: { id: 'ahmed-id', full_name: 'Ahmed Ali', avatar_url: null, role: 'MEMBER', created_at: new Date().toISOString() }
        },
        {
          id: 'm-4',
          workspace_id: mockWorkspace.id,
          profile_id: 'maya-id',
          role: 'MEMBER',
          profiles: { id: 'maya-id', full_name: 'Maya Chen', avatar_url: null, role: 'MEMBER', created_at: new Date().toISOString() }
        },
        {
          id: 'm-5',
          workspace_id: mockWorkspace.id,
          profile_id: 'daniel-id',
          role: 'VIEWER',
          profiles: { id: 'daniel-id', full_name: 'Daniel Lee', avatar_url: null, role: 'VIEWER', created_at: new Date().toISOString() }
        }
      ]

      const mockProjects: Project[] = [
        {
          id: 'p1111111-1111-1111-1111-111111111111',
          workspace_id: mockWorkspace.id,
          name: 'E-Commerce Platform',
          description: 'Customer shopping interface and checkout flow redesign.',
          status: 'ACTIVE',
          progress: 72,
          start_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString()
        },
        {
          id: 'p2222222-2222-2222-2222-222222222222',
          workspace_id: mockWorkspace.id,
          name: 'Mobile Banking App',
          description: 'Secure iOS/Android mobile banking application experience.',
          status: 'ACTIVE',
          progress: 48,
          start_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString()
        },
        {
          id: 'p3333333-3333-3333-3333-333333333333',
          workspace_id: mockWorkspace.id,
          name: 'Analytics Dashboard',
          description: 'Business intelligence dashboard and analytics portal reporting tools.',
          status: 'ACTIVE',
          progress: 86,
          start_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString()
        }
      ]

      const mockTasks: Task[] = [
        {
          id: 't-1',
          project_id: 'p1111111-1111-1111-1111-111111111111',
          title: 'Finalize checkout flow',
          description: 'Review checkout basket and address selection flow API schema.',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          creator_id: 'sarah-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          projects: { name: 'E-Commerce Platform' },
          task_assignees: [{ profile_id: userId, profiles: mockUser }]
        },
        {
          id: 't-2',
          project_id: 'p2222222-2222-2222-2222-222222222222',
          title: 'Review authentication API',
          description: 'Audit secure token parameters and SSO redirect redirects.',
          status: 'TODO',
          priority: 'MEDIUM',
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          creator_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          projects: { name: 'Mobile Banking App' },
          task_assignees: [{ profile_id: 'sarah-id', profiles: mockMembers[1].profiles }]
        },
        {
          id: 't-3',
          project_id: 'p3333333-3333-3333-3333-333333333333',
          title: 'Prepare dashboard QA',
          description: 'Write browser unit checking scripts.',
          status: 'IN_REVIEW',
          priority: 'LOW',
          due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
          creator_id: 'ahmed-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          projects: { name: 'Analytics Dashboard' },
          task_assignees: [{ profile_id: 'ahmed-id', profiles: mockMembers[2].profiles }]
        },
        {
          id: 't-4',
          project_id: 'p1111111-1111-1111-1111-111111111111',
          title: 'Write project documentation',
          description: 'Assemble all README, CHANGELOG and architectural files.',
          status: 'COMPLETED',
          priority: 'LOW',
          due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          creator_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          projects: { name: 'E-Commerce Platform' },
          task_assignees: [{ profile_id: userId, profiles: mockUser }]
        }
      ]

      const mockChannels: Channel[] = [
        {
          id: 'c-1',
          workspace_id: mockWorkspace.id,
          name: 'general',
          is_dm: false,
          created_at: new Date().toISOString()
        },
        {
          id: 'c-2',
          workspace_id: mockWorkspace.id,
          name: 'project-ecommerce',
          is_dm: false,
          created_at: new Date().toISOString()
        },
        {
          id: 'c-3',
          workspace_id: mockWorkspace.id,
          name: 'Sarah Ahmed',
          is_dm: true,
          created_at: new Date().toISOString()
        }
      ]

      const mockMessages: Message[] = [
        {
          id: 'msg-1',
          channel_id: 'c-2',
          sender_id: 'sarah-id',
          content: 'Checkout flow is ready for review.',
          created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
          profiles: mockMembers[1].profiles
        },
        {
          id: 'msg-2',
          channel_id: 'c-2',
          sender_id: userId,
          content: 'Great. I will review it today.',
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          profiles: mockUser
        },
        {
          id: 'msg-3',
          channel_id: 'c-2',
          sender_id: 'ahmed-id',
          content: 'API integration is 80% complete.',
          created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          profiles: mockMembers[2].profiles
        }
      ]

      const mockNotifications: Notification[] = [
        {
          id: 'n-1',
          profile_id: userId,
          title: 'Deadline approaching',
          content: 'UI Design task is due tomorrow.',
          type: 'deadline',
          is_read: false,
          link: '/tasks',
          created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
        },
        {
          id: 'n-2',
          profile_id: userId,
          title: 'Task assigned',
          content: 'You were assigned "Finalize checkout flow".',
          type: 'assignment',
          is_read: false,
          link: '/tasks',
          created_at: new Date(Date.now() - 32 * 60 * 1000).toISOString()
        },
        {
          id: 'n-3',
          profile_id: userId,
          title: 'Task completed',
          content: 'Sarah completed UI Design.',
          type: 'comment',
          is_read: true,
          link: '/tasks',
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
        }
      ]

      set({
        user: mockUser,
        workspaces: [mockWorkspace],
        activeWorkspace: mockWorkspace,
        workspaceMembers: mockMembers,
        projects: mockProjects,
        tasks: mockTasks,
        channels: mockChannels,
        activeChannel: mockChannels[1],
        messages: mockMessages,
        notifications: mockNotifications,
        loading: false
      })
      return
    }

    try {
      // 1. Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()


      if (!profile) return

      set({ user: profile })

      // 2. Fetch user's workspaces
      const { data: members } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(*)')
        .eq('profile_id', userId)

      const workspacesList = members?.map((m: any) => m.workspaces).filter(Boolean) || []
      
      let selectedWorkspace = workspacesList[0] || null

      // If no workspace exists, let's look for the seed workspace
      if (!selectedWorkspace) {
        const { data: seedWorkspace } = await supabase
          .from('workspaces')
          .select('*')
          .eq('slug', 'collabix-main')
          .single()

        if (seedWorkspace) {
          // Join the user to the seed workspace as OWNER
          await supabase.from('workspace_members').insert({
            workspace_id: seedWorkspace.id,
            profile_id: userId,
            role: 'OWNER',
          })
          selectedWorkspace = seedWorkspace
          workspacesList.push(seedWorkspace)
        }
      }

      set({ workspaces: workspacesList, activeWorkspace: selectedWorkspace })

      if (selectedWorkspace) {
        await get().switchWorkspace(selectedWorkspace.id)
      }
    } catch (err) {
      console.error('Error fetching initial Collabix data:', err)
    } finally {
      set({ loading: false })
    }
  },

  switchWorkspace: async (workspaceId) => {
    const activeWorkspace = get().workspaces.find((w) => w.id === workspaceId) || null
    set({ activeWorkspace, loading: true })

    if (isPlaceholder) {
      set({ loading: false })
      return
    }

    try {
      // Fetch Workspace Members with Profile details
      const { data: members } = await supabase
        .from('workspace_members')
        .select('*, profiles(*)')
        .eq('workspace_id', workspaceId)

      // Fetch Workspace Projects
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      // Fetch Workspace Projects Tasks
      const projectIds = projects?.map((p: any) => p.id) || []
      let tasksList: Task[] = []

      if (projectIds.length > 0) {
        const { data: tasks } = await supabase
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
          .in('project_id', projectIds)
          .order('due_date', { ascending: true })
        
        tasksList = (tasks as unknown as Task[]) || []
      }

      // Fetch Chat Channels
      const { data: channels } = await supabase
        .from('channels')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('is_dm', { ascending: true })

      const activeChannel = channels?.[0] || null

      // Fetch Notifications
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', get().user?.id || '')
        .order('created_at', { ascending: false })
        .limit(20)

      set({
        workspaceMembers: members || [],
        projects: projects || [],
        tasks: tasksList,
        channels: channels || [],
        activeChannel,
        notifications: notifications || [],
      })

      if (activeChannel) {
        await get().switchChannel(activeChannel.id)
      }
    } catch (err) {
      console.error('Error switching workspace:', err)
    } finally {
      set({ loading: false })
    }
  },

  switchChannel: async (channelId) => {
    const activeChannel = get().channels.find((c) => c.id === channelId) || null
    set({ activeChannel })

    if (!channelId) return
    if (isPlaceholder) return

    try {
      const { data: messages } = await supabase
        .from('messages')
        .select('*, profiles(*)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      set({ messages: messages || [] })
    } catch (err) {
      console.error('Error fetching channel messages:', err)
    }
  },

  // Real-time updates handler methods
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  
  updateTask: (updatedTask) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)),
    })),
    
  deleteTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),

  addMessage: (message) =>
    set((state) => {
      // Avoid duplicate inserts
      if (state.messages.some((m) => m.id === message.id)) return state
      return { messages: [...state.messages, message] }
    }),

  addNotification: (notif) =>
    set((state) => {
      if (state.notifications.some((n) => n.id === notif.id)) return state
      return { notifications: [notif, ...state.notifications] }
    }),

  addWorkspaceMember: (member) =>
    set((state) => {
      if (state.workspaceMembers.some((m) => m.id === member.id)) return state
      return { workspaceMembers: [...state.workspaceMembers, member] }
    }),

  removeWorkspaceMember: (memberId) =>
    set((state) => ({
      workspaceMembers: state.workspaceMembers.filter((m) => m.id !== memberId)
    })),

  updateWorkspaceMember: (memberId, role, fullName) =>
    set((state) => ({
      workspaceMembers: state.workspaceMembers.map((m) =>
        m.id === memberId
          ? { ...m, role, profiles: m.profiles ? { ...m.profiles, full_name: fullName } : { id: m.profile_id, full_name: fullName, avatar_url: null, role: role, created_at: new Date().toISOString() } }
          : m
      )
    })),
}))
