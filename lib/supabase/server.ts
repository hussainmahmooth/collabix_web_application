import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createMockSupabaseClient } from './mock'

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  
  if (url.includes('placeholder')) {
    return createMockSupabaseClient() as any
  }

  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if there is middleware refreshing user sessions.
        }
      },
    },
  })
}


