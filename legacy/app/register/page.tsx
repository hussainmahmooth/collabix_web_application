'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const isConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isConfigured) {
      setError("Database is not connected. Please edit the '.env.local' file in the project root to configure your live Supabase database to register accounts.")
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      setSuccess(true)
      setLoading(false)
      // Automatically redirect after a short delay
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 2000)
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
          <h2 className="text-2xl font-extrabold tracking-tight text-text">Create your account</h2>
          <p className="text-xs text-muted mt-1.5 text-center">
            Join Collabix to collaborate with your team.
          </p>
        </div>

        {!isConfigured && (
          <div 
            className="mb-5 p-3.5 text-xs font-semibold rounded-lg border text-center"
            style={{ backgroundColor: 'rgba(217, 119, 6, 0.08)', color: '#b45309', borderColor: 'rgba(217, 119, 6, 0.2)' }}
          >
            ⚠️ Database is not connected. Please edit the <code>.env.local</code> file in the project root to configure your live Supabase database to start registering accounts.
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 bg-red-soft text-red text-xs font-semibold rounded-lg border border-red/10 text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-green-soft text-green text-xs font-semibold rounded-lg border border-green/10 text-center">
            Registration successful! Redirecting you now...
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Full Name
            </label>
            <input
              type="text"
              required
              className="w-full h-11 px-3.5 bg-bg/50 border border-border focus:border-blue focus:bg-card focus:ring-1 focus:ring-blue text-xs rounded-xl transition-all"
              placeholder="Hussain"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

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
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full h-11 pl-3.5 pr-10 bg-bg/50 border border-border focus:border-blue focus:bg-card focus:ring-1 focus:ring-blue text-xs rounded-xl transition-all"
                placeholder="•••••••• (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors focus:outline-none cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full h-11 bg-blue text-white rounded-xl text-xs font-bold transition-all hover:bg-blue/90 disabled:opacity-50 mt-2 shadow-sm cursor-pointer"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border/80 text-center">
          <p className="text-xs text-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-blue font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
