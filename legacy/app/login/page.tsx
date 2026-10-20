'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isConfigured) {
      setError("Database is not connected. Please configure your live Supabase URL and Key in '.env.local' to sign in.")
      return
    }

    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const handleSandboxPreview = async () => {
    setError(null)
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: 'leader@collabix.com',
      password: 'password123',
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 transition-colors duration-300">
      <div className="w-full max-w-[440px] bg-card border border-border shadow-custom rounded-custom p-8 transition-colors duration-300">
        
        {/* Branding header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-[11px] bg-blue text-white grid place-items-center font-extrabold text-2xl mb-3 shadow-md shadow-blue/20">
            ✦
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-text">Welcome back</h2>
          <p className="text-xs text-muted mt-1.5 text-center">
            Sign in to access your Collabix workspace.
          </p>
        </div>

        {!isConfigured && (
          <div 
            className="mb-5 p-3.5 text-xs font-semibold rounded-lg border text-center"
            style={{ backgroundColor: 'rgba(217, 119, 6, 0.08)', color: '#b45309', borderColor: 'rgba(217, 119, 6, 0.2)' }}
          >
            ⚠️ Database is not connected. Please edit the <code>.env.local</code> file in the project root to configure your live Supabase database to start signing in.
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 bg-red-soft text-red text-xs font-semibold rounded-lg border border-red/10 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Email Address
            </label>
            <input
              type="email"
              required
              className="w-full h-11 px-3.5 bg-bg/50 border border-border focus:border-blue focus:bg-card focus:ring-1 focus:ring-blue text-xs rounded-xl transition-all"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Password
              </label>
              <Link 
                href="/reset-password" 
                className="text-[10px] font-bold text-blue hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              className="w-full h-11 px-3.5 bg-bg/50 border border-border focus:border-blue focus:bg-card focus:ring-1 focus:ring-blue text-xs rounded-xl transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-blue text-white rounded-xl text-xs font-bold transition-all hover:bg-blue/90 disabled:opacity-50 mt-2 shadow-sm cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border/80 text-center">
          <p className="text-xs text-muted">
            Don't have an account?{' '}
            <Link href="/register" className="text-blue font-bold hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        {!isConfigured && (
          <div className="mt-5 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={handleSandboxPreview}
              disabled={loading}
              className="w-full h-10 px-4 bg-yellow-soft hover:bg-yellow-soft/80 text-orange border border-orange/10 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
            >
              {loading ? 'Entering Sandbox...' : 'Explore Offline Sandbox Preview'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
