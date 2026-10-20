'use client'

import { usePathname } from 'next/navigation'
import { Menu, Search, Bell, Plus } from 'lucide-react'
import { useCollabixStore } from '@/lib/store'

interface HeaderProps {
  onMenuToggle: () => void
  onCreateTaskClick: () => void
}

export default function Header({ onMenuToggle, onCreateTaskClick }: HeaderProps) {
  const pathname = usePathname()
  const { user, notifications } = useCollabixStore()

  const getHeaderInfo = () => {
    const firstName = user?.full_name?.split(' ')[0] || 'Team'
    
    if (pathname.startsWith('/dashboard')) {
      return {
        title: `Good morning, ${firstName}`,
        sub: "Here's what's happening with your projects today.",
      }
    }
    if (pathname.startsWith('/tasks')) {
      return {
        title: 'My Tasks',
        sub: 'Track and update what you need to complete.',
      }
    }
    if (pathname.startsWith('/projects')) {
      return {
        title: 'Projects',
        sub: 'Manage and update every project in one place.',
      }
    }
    if (pathname.startsWith('/teams')) {
      return {
        title: 'Teams',
        sub: 'Monitor team members, workload split and productivity.',
      }
    }
    if (pathname.startsWith('/calendar')) {
      return {
        title: 'Calendar',
        sub: 'Plan project deadlines, milestones and upcoming events.',
      }
    }
    if (pathname.startsWith('/messages')) {
      return {
        title: 'Messages',
        sub: 'Collaborate with your team members in real-time.',
      }
    }
    if (pathname.startsWith('/notifications')) {
      return {
        title: 'Notifications',
        sub: 'Stay updated on assignment changes and updates.',
      }
    }
    if (pathname.startsWith('/reports')) {
      return {
        title: 'Reports',
        sub: 'Measure project velocity and overall team productivity.',
      }
    }
    if (pathname.startsWith('/ai')) {
      return {
        title: 'Collabix AI',
        sub: 'Your intelligent assistant powered by Google Gemini.',
      }
    }
    if (pathname.startsWith('/settings')) {
      return {
        title: 'Settings',
        sub: 'Manage workspace configuration, billing and preferences.',
      }
    }

    return {
      title: 'Collabix Workspace',
      sub: 'Team collaboration and tasks overview.',
    }
  }

  const headerInfo = getHeaderInfo()
  const unreadNotifications = notifications.filter(n => !n.is_read).length

  return (
    <header className="flex items-center gap-4 py-6 border-b border-border/60 mb-6 flex-wrap md:flex-nowrap">
      
      {/* Mobile drawer toggle */}
      <button 
        onClick={onMenuToggle}
        className="w-10 h-10 border border-border bg-card hover:bg-bg rounded-xl grid place-items-center cursor-pointer lg:hidden md:grid shrink-0"
      >
        <Menu className="w-5 h-5 text-text" />
      </button>

      {/* Header Titles */}
      <div className="flex-1 min-w-[200px]">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-text leading-none">
          {headerInfo.title}
        </h1>
        <p className="text-xs text-muted mt-1.5 font-medium leading-none">
          {headerInfo.sub}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0 justify-end">
        
        {/* Search */}
        <label className="flex items-center gap-2 border border-border bg-card rounded-xl px-3 h-10 w-full md:w-[220px] focus-within:border-blue transition-all">
          <Search className="w-4 h-4 text-muted" />
          <input 
            type="text" 
            placeholder="Search anything..." 
            className="bg-transparent border-0 outline-none w-full text-xs font-semibold placeholder:text-muted/65"
          />
        </label>

        {/* Notifications Alert */}
        <div className="relative">
          <button className="w-10 h-10 border border-border bg-card hover:bg-bg rounded-xl grid place-items-center cursor-pointer shrink-0">
            <Bell className="w-4.5 h-4.5 text-text" />
          </button>
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-orange animate-ping" />
          )}
        </div>

        {/* Create Task Button */}
        <button 
          onClick={onCreateTaskClick}
          className="flex items-center gap-1.5 px-4 h-10 bg-blue hover:bg-blue/90 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm shadow-blue/15"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Create Task</span>
        </button>
      </div>
    </header>
  )
}
