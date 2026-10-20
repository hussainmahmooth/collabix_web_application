'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    })

    if (resetError) {
      setError(resetError.message)
    } else {
      setMessage('Password reset link sent to your email address!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 transition-colors duration-300">
      <div className="w-full max-w-[440px] bg-card border border-border shadow-custom rounded-custom p-8 transition-colors duration-300">
        
        {/* Branding header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-[11px] bg-blue text-white grid place-items-center font-extrabold text-2xl mb-3 shadow-md shadow-blue/20">
            ✦
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-text">Reset password</h2>
          <p className="text-xs text-muted mt-1.5 text-center">
            Enter your email to receive a recovery link.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-soft text-red text-xs font-semibold rounded-lg border border-red/10 text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 p-3.5 bg-green-soft text-green text-xs font-semibold rounded-lg border border-green/10 text-center">
            {message}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-blue text-white rounded-xl text-xs font-bold transition-all hover:bg-blue/90 disabled:opacity-50 mt-2 shadow-sm cursor-pointer"
          >
            {loading ? 'Sending link...' : 'Send Recovery Link'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border/80 text-center">
          <p className="text-xs text-muted">
            Remembered your password?{' '}
            <Link href="/login" className="text-blue font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
