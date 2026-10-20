'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  Hash, 
  MessageSquare, 
  Send, 
  Plus, 
  Users, 
  User,
  X
} from 'lucide-react'
import { useCollabixStore, Channel } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen grid place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xs font-bold text-muted font-sans">Loading messages...</span>
        </div>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  )
}

function MessagesContent() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const { 
    user, 
    channels, 
    activeChannel, 
    messages, 
    switchChannel, 
    activeWorkspace 
  } = useCollabixStore()

  // Local state
  const [inputText, setInputText] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelIsDM, setNewChannelIsDM] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Handle selection of channel from search parameters
  useEffect(() => {
    const urlChannel = searchParams.get('channel')
    if (urlChannel) {
      switchChannel(urlChannel)
    }
  }, [searchParams, switchChannel])

  // 2. Scroll messages container to bottom on message load or new message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Split channels into regular channels and DMs
  const textChannels = channels.filter(c => !c.is_dm)
  const dmChannels = channels.filter(c => c.is_dm)

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || !activeChannel || !user) return
    const text = inputText.trim()
    setInputText('')

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          channel_id: activeChannel.id,
          sender_id: user.id,
          content: text
        })

      if (error) throw error
    } catch (err) {
      console.error('Error sending message:', err)
    }
  }

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChannelName.trim() || !activeWorkspace) return
    setSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('channels')
        .insert({
          workspace_id: activeWorkspace.id,
          name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
          is_dm: newChannelIsDM
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        switchChannel(data.id)
      }

      setNewChannelName('')
      setModalOpen(false)
    } catch (err) {
      console.error('Error creating channel:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="bg-card border border-border rounded-custom shadow-custom overflow-hidden min-h-[600px] flex flex-col md:grid md:grid-cols-4">
        
        {/* Left Side Pane: Channels Selector */}
        <div className="border-r border-border p-5 flex flex-col justify-between md:col-span-1 bg-card">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-text">Conversations</h3>
              <button 
                onClick={() => setModalOpen(true)}
                className="w-7 h-7 bg-bg border border-border rounded-lg grid place-items-center hover:border-blue hover:text-blue cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Public Channels List */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                Channels
              </span>
              <div className="space-y-1">
                {textChannels.map((ch) => {
                  const isActive = activeChannel?.id === ch.id
                  return (
                    <button
                      key={ch.id}
                      onClick={() => switchChannel(ch.id)}
                      className={`
                        w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer
                        ${isActive 
                          ? 'bg-blue-soft text-blue' 
                          : 'text-muted hover:bg-bg hover:text-text'
                        }
                      `}
                    >
                      <Hash className="w-4 h-4 shrink-0" />
                      <span className="truncate">{ch.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Direct Messages List */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                Direct Messages
              </span>
              <div className="space-y-1">
                {dmChannels.length === 0 ? (
                  <span className="text-[10px] text-muted/70 block pl-3">No active DMs</span>
                ) : (
                  dmChannels.map((ch) => {
                    const isActive = activeChannel?.id === ch.id
                    return (
                      <button
                        key={ch.id}
                        onClick={() => switchChannel(ch.id)}
                        className={`
                          w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer
                          ${isActive 
                            ? 'bg-blue-soft text-blue' 
                            : 'text-muted hover:bg-bg hover:text-text'
                          }
                        `}
                      >
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span className="truncate">{ch.name.replace(' & ', ', ')}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Pane: Chat Messages feed */}
        <div className="md:col-span-3 flex flex-col justify-between h-[600px] bg-bg/10">
          {activeChannel ? (
            <>
              {/* Chat header */}
              <div className="border-b border-border p-4 bg-card flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-text flex items-center gap-1.5 leading-none">
                    {activeChannel.is_dm ? (
                      <MessageSquare className="w-4 h-4 text-blue" />
                    ) : (
                      <Hash className="w-4 h-4 text-blue" />
                    )}
                    <span>{activeChannel.name}</span>
                  </h4>
                  <small className="text-[9px] font-bold text-muted block mt-1">
                    {activeChannel.is_dm ? 'Private messaging thread' : 'Public team broadcast feed'}
                  </small>
                </div>
              </div>

              {/* Message scroll container */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted select-none">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-xs font-bold">No messages here yet.</span>
                    <span className="text-[10px] opacity-80 mt-0.5">Start the conversation by typing below!</span>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id
                    return (
                      <div 
                        key={msg.id}
                        className={`flex gap-3 max-w-[75%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                      >
                        {/* Avatar */}
                        <div 
                          className="w-7 h-7 rounded-full bg-yellow text-navy text-[10px] font-black grid place-items-center shrink-0 border border-yellow/20 shadow-sm"
                          title={msg.profiles?.full_name}
                        >
                          {msg.profiles?.full_name?.substring(0, 2).toUpperCase()}
                        </div>

                        {/* Content text */}
                        <div className="space-y-1">
                          {!isMe && (
                            <span className="text-[9px] font-bold text-muted block ml-1 leading-none">
                              {msg.profiles?.full_name}
                            </span>
                          )}
                          <div 
                            className={`
                              px-4 py-2.5 rounded-2xl text-xs leading-relaxed font-medium shadow-xs
                              ${isMe 
                                ? 'bg-blue text-white rounded-tr-none' 
                                : 'bg-card text-text rounded-tl-none border border-border'
                              }
                            `}
                          >
                            {msg.content}
                          </div>
                          <small className="text-[8px] font-bold text-muted block leading-none pl-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </small>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message composer form */}
              <form onSubmit={handleSendMessage} className="p-4 bg-card border-t border-border flex gap-3">
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  className="flex-1 h-11 px-4 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button 
                  type="submit"
                  className="w-11 h-11 bg-blue hover:bg-blue/90 text-white rounded-xl grid place-items-center cursor-pointer shadow-sm shadow-blue/15"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted select-none">
              <MessageSquare className="w-12 h-12 mb-3 opacity-40" />
              <h4 className="text-sm font-extrabold text-text">No conversation active</h4>
              <p className="text-xs text-muted mt-1 max-w-[280px] text-center leading-relaxed">
                Select a public channel or direct message thread from the left menu sidebar.
              </p>
            </div>
          )}
        </div>

        {/* ==========================================
            MODAL: CREATE CHANNEL / DM
            ========================================== */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-[420px] bg-card border border-border rounded-custom p-6 shadow-2xl relative">
              <button 
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-bg border border-border grid place-items-center cursor-pointer"
              >
                <X className="w-4 h-4 text-text" />
              </button>

              <h3 className="text-lg font-extrabold text-text mb-1">New Channel</h3>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-6">
                Establish a new messaging channel in this workspace
              </p>

              <form onSubmit={handleCreateChannel} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">Channel Name</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. tech-discussions"
                    className="w-full h-11 px-3.5 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-bg/40 border border-border rounded-xl">
                  <div>
                    <label className="text-xs font-extrabold text-text block">Private Direct Message</label>
                    <small className="text-[9px] text-muted font-bold uppercase block mt-0.5">Toggle DM structure</small>
                  </div>
                  <input 
                    type="checkbox"
                    className="w-4 h-4 accent-blue cursor-pointer"
                    checked={newChannelIsDM}
                    onChange={(e) => setNewChannelIsDM(e.target.checked)}
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
                    {submitting ? 'Creating...' : 'Create Channel'}
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
