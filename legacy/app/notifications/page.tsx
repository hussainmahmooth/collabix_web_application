'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Bell, 
  Check, 
  Trash2, 
  AlertCircle, 
  UserPlus, 
  MessageSquare, 
  CheckCircle2,
  Inbox
} from 'lucide-react'
import { useCollabixStore, Notification } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, notifications } = useCollabixStore()
  
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const handleMarkAsRead = async (notificationId: string, link: string | null) => {
    setUpdatingId(notificationId)
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) throw error

      if (link) {
        router.push(link)
      }
    } catch (err) {
      console.error('Error marking notification as read:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!user) return
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('profile_id', user.id)

      if (error) throw error
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <UserPlus className="w-4 h-4 text-blue" />
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-orange" />
      case 'deadline':
        return <AlertCircle className="w-4 h-4 text-red" />
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-blue" />
      default:
        return <Bell className="w-4 h-4 text-muted" />
    }
  }

  const timeAgo = (dateStr: string) => {
    const time = new Date(dateStr).getTime()
    const now = new Date().getTime()
    const diffMin = Math.round((now - time) / 60000)
    
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    
    const diffHours = Math.round(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.round(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Header control */}
        <div className="flex items-center justify-between gap-4 bg-card border border-border rounded-custom p-4 shadow-custom flex-wrap">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue" />
            <h2 className="text-sm font-extrabold text-text uppercase tracking-wider">
              Notifications Archive ({notifications.filter(n => !n.is_read).length} unread)
            </h2>
          </div>

          {notifications.some(n => !n.is_read) && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5 px-3.5 h-9 bg-bg border border-border hover:border-blue hover:text-blue rounded-xl text-xs font-bold text-text cursor-pointer transition-all shrink-0"
            >
              <Check className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>

        {/* List of items */}
        <div className="bg-card border border-border rounded-custom p-5 shadow-custom divide-y divide-border/60">
          {notifications.length === 0 ? (
            <div className="py-16 text-center select-none">
              <Inbox className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
              <h3 className="text-sm font-extrabold text-text">Inbox is empty</h3>
              <p className="text-xs text-muted mt-1">
                You'll receive alert updates when tasks are assigned or comments are added.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id}
                className={`
                  flex items-center gap-4 py-4 hover:bg-bg/25 transition-all first:pt-0 last:pb-0 group
                  ${!n.is_read ? 'font-semibold' : 'opacity-80'}
                `}
              >
                {/* Status Dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${!n.is_read ? 'bg-blue' : 'bg-transparent'}`} />

                {/* Icon wrapper */}
                <div className="w-9 h-9 rounded-xl bg-bg border border-border/80 grid place-items-center shrink-0">
                  {getNotificationIcon(n.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-text block truncate font-extrabold">
                    {n.title}
                  </span>
                  <p className="text-[10px] text-muted font-medium mt-1 truncate">
                    {n.content}
                  </p>
                </div>

                {/* Elapsed Time */}
                <span className="text-[9px] font-bold text-muted shrink-0">
                  {timeAgo(n.created_at)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 border-l border-border/60 pl-3 shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(n.id, n.link)}
                      disabled={updatingId === n.id}
                      className="p-1 border border-border hover:border-blue hover:text-blue bg-card rounded-lg text-muted transition-all cursor-pointer"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteNotification(n.id)}
                    className="p-1.5 border border-border hover:border-red hover:text-red hover:bg-red-soft rounded-lg text-muted transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete notification"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}
