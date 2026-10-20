'use client'

import { useState } from 'react'
import { Sparkles, Send, Loader, ArrowRight } from 'lucide-react'
import { useCollabixStore } from '@/lib/store'
import { askAI } from './actions'
import DashboardLayout from '@/components/layout/DashboardLayout'

interface Message {
  sender: 'user' | 'ai'
  content: string
}

export default function AIPage() {
  const { activeWorkspace } = useCollabixStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      content: 'Hello! I am Collabix AI, your project workspace assistant. Ask me questions about projects, tasks, workloads, or upcoming deadlines in this workspace!'
    }
  ])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async (text: string) => {
    if (!text.trim() || !activeWorkspace || loading) return
    
    // Add user message
    const userMsg = text.trim()
    setMessages(prev => [...prev, { sender: 'user', content: userMsg }])
    setInputText('')
    setLoading(true)

    try {
      const response = await askAI(userMsg, activeWorkspace.id)
      setMessages(prev => [...prev, { sender: 'ai', content: response }])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { sender: 'ai', content: 'Sorry, I encountered an issue querying your workspace. Make sure your database and auth connection is active.' }])
    } finally {
      setLoading(false)
    }
  }

  const promptOptions = [
    "What tasks are overdue?",
    "Who has the most assigned tasks?",
    "Summarize the project statuses.",
    "What should I work on today?"
  ]

  return (
    <DashboardLayout>
      <div className="max-w-[800px] mx-auto space-y-6">
        
        {/* Chat window container */}
        <div className="bg-card border border-border rounded-custom shadow-custom overflow-hidden min-h-[520px] flex flex-col justify-between">
          
          {/* AI Banner header */}
          <div className="bg-gradient-to-r from-navy to-[#1e293b] p-4 text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-yellow text-navy grid place-items-center font-black">
              ✦
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-white">Collabix AI</h2>
              <small className="text-[9px] font-bold text-slate-300 block mt-0.5">Powered by Google Gemini Context Retrieval</small>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[420px]">
            {messages.map((msg, idx) => {
              const isUser = msg.sender === 'user'
              return (
                <div key={idx} className={`flex gap-3 max-w-[80%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`
                    w-7 h-7 rounded-lg text-[10px] font-black grid place-items-center shrink-0 border shadow-xs
                    ${isUser ? 'bg-blue text-white border-blue/10' : 'bg-yellow text-navy border-yellow/20'}
                  `}>
                    {isUser ? 'U' : '✦'}
                  </div>

                  <div className={`
                    px-4 py-2.5 rounded-2xl text-xs leading-relaxed font-medium shadow-xs whitespace-pre-wrap
                    ${isUser 
                      ? 'bg-blue text-white rounded-tr-none' 
                      : 'bg-bg text-text rounded-tl-none border border-border'
                    }
                  `}>
                    {msg.content}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="flex gap-3 items-center text-muted">
                <div className="w-7 h-7 rounded-lg bg-yellow text-navy text-[10px] font-black grid place-items-center shrink-0 border border-yellow/20">
                  ✦
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-bg border border-border rounded-2xl rounded-tl-none text-xs font-bold text-muted">
                  <Loader className="w-4 h-4 animate-spin text-blue" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom quick suggestions & Compose Form */}
          <div className="p-4 bg-card border-t border-border space-y-3">
            
            {/* Suggested quick buttons */}
            {messages.length <= 2 && !loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {promptOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleSend(opt)}
                    className="p-2.5 bg-blue-soft/50 text-blue font-bold text-[10px] rounded-lg border border-blue/10 hover:bg-blue-soft transition-all text-left flex items-center justify-between group cursor-pointer"
                  >
                    <span>{opt}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}

            {/* Input form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault()
                handleSend(inputText)
              }}
              className="flex gap-3"
            >
              <input 
                type="text" 
                placeholder="Ask Collabix AI..." 
                disabled={loading}
                className="flex-1 h-11 px-4 bg-bg/50 border border-border focus:border-blue text-xs rounded-xl disabled:opacity-50"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button 
                type="submit"
                disabled={loading || !inputText.trim()}
                className="w-11 h-11 bg-blue hover:bg-blue/90 text-white rounded-xl grid place-items-center cursor-pointer shadow-sm shadow-blue/15 disabled:opacity-50"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </form>
          </div>

        </div>

      </div>
    </DashboardLayout>
  )
}
