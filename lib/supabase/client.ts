import { createBrowserClient } from '@supabase/ssr'
import { createMockSupabaseClient } from './mock'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  
  if (url.includes('placeholder')) {
    return createMockSupabaseClient() as any
  }
  
  return createBrowserClient(url, key)
}


