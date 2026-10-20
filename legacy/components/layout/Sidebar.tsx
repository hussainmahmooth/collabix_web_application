'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  Home, 
  CheckSquare, 
  Folder, 
  Users, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  Bell, 
  BarChart3, 
  Sparkles, 
  Settings,
  LogOut,
  ChevronDown,
  Plus
} from 'lucide-react'
import { useCollabixStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  
  const { 
    user, 
    workspaces, 
    activeWorkspace, 
    switchWorkspace 
  } = useCollabixStore()

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    { name: 'My Tasks', path: '/tasks', icon: CheckSquare },
    { name: 'Projects', path: '/projects', icon: Folder },
    { name: 'Teams', path: '/teams', icon: Users },
    { name: 'Calendar', path: '/calendar', icon: CalendarIcon },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'AI Assistant', path: '/ai', icon: Sparkles },
    { name: 'Settings', path: '/settings', icon: Settings },
  ]

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleWorkspaceChange = async (workspaceId: string) => {
    setWorkspaceMenuOpen(false)
    await switchWorkspace(workspaceId)
    router.push('/dashboard')
  }

  return (
    <>
      {/* Mobile background overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-navy/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed z-40 top-0 bottom-0 left-0
        width-[245px] w-[245px] bg-card border-r border-border p-5
        flex flex-col justify-between
        transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:w-[245px]
        md:w-[80px] md:p-3.5
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col gap-6">
          
          {/* Logo brand section */}
          <div className="flex items-center gap-3 px-2 md:justify-center lg:justify-start">
            <div className="w-9 h-9 rounded-xl bg-blue text-white grid place-items-center font-extrabold text-xl shadow-sm select-none">
              ✦
            </div>
            <span className="font-extrabold text-xl tracking-tight text-text md:hidden lg:inline">
              Collabix
            </span>
          </div>

          {/* Workspace Switcher */}
          {activeWorkspace && (
            <div className="relative px-1">
              <button 
                onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                className="w-full flex items-center justify-between gap-2 p-2 bg-bg hover:bg-border/60 border border-border rounded-xl text-left transition-all md:justify-center lg:justify-between"
              >
                <div className="flex items-center gap-2 overflow-hidden md:hidden lg:flex">
                  <div className="w-6 h-6 rounded-lg bg-yellow text-navy font-bold text-xs grid place-items-center shrink-0">
                    {activeWorkspace.name.substring(0, 1)}
                  </div>
                  <span className="text-xs font-bold text-text truncate max-w-[120px]">
                    {activeWorkspace.name}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted md:hidden lg:block shrink-0" />
                
                {/* Collapsed view display */}
                <div className="hidden md:grid lg:hidden w-8 h-8 rounded-lg bg-yellow text-navy font-bold text-sm place-items-center">
                  {activeWorkspace.name.substring(0, 1)}
                </div>
              </button>

              {workspaceMenuOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-card border border-border shadow-lg rounded-xl overflow-hidden z-50 p-1 md:w-[180px] md:left-2">
                  <div className="text-[10px] font-bold text-muted px-3 py-1.5 uppercase tracking-wider">
                    Workspaces
                  </div>
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => handleWorkspaceChange(w.id)}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                        activeWorkspace.id === w.id 
                          ? 'bg-blue-soft text-blue' 
                          : 'hover:bg-bg text-text'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-md bg-yellow/80 text-navy text-[10px] font-extrabold grid place-items-center">
                        {w.name.substring(0, 1)}
                      </div>
                      <span className="truncate">{w.name}</span>
                    </button>
                  ))}
                  
                  {/* Create workspace button */}
                  <button 
                    onClick={() => {
                      setWorkspaceMenuOpen(false)
                      router.push('/settings')
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-blue flex items-center gap-2 hover:bg-blue-soft/50 rounded-lg mt-1 border-t border-border/80 pt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Workspace</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path)
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all
                    md:justify-center lg:justify-start
                    ${isActive 
                      ? 'bg-blue-soft text-blue' 
                      : 'text-muted hover:bg-blue-soft/40 hover:text-blue'
                    }
                  `}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="md:hidden lg:inline truncate">
                    {item.name}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Profile / Footer section */}
        {user && (
          <div className="flex flex-col gap-2 pt-4 border-t border-border/80">
            <div className="flex items-center gap-2.5 p-1.5 bg-bg rounded-xl md:justify-center lg:justify-start">
              <div className="w-8 h-8 rounded-full bg-yellow text-navy font-extrabold text-xs grid place-items-center shrink-0 shadow-sm border border-yellow/20">
                {user.full_name?.substring(0, 1).toUpperCase()}
              </div>
              <div className="flex flex-col overflow-hidden md:hidden lg:flex">
                <span className="text-xs font-extrabold text-text truncate">
                  {user.full_name}
                </span>
                <span className="text-[9px] font-bold text-muted truncate">
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold text-red hover:bg-red-soft hover:text-red transition-all md:justify-center lg:justify-start cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              <span className="md:hidden lg:inline">Sign Out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
