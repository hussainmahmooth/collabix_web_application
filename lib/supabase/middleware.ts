import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createMockSupabaseClient } from './mock'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  let supabase: any

  if (url.includes('placeholder')) {
    supabase = createMockSupabaseClient()
  } else {
    supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })
  }

  // Get user session securely (this uses JWT validation)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const redirectUrl = request.nextUrl.clone()
  const isAuthPage = redirectUrl.pathname.startsWith('/login') || redirectUrl.pathname.startsWith('/register')
  
  // Dashboard routes protection
  const isProtectedPage = 
    redirectUrl.pathname.startsWith('/dashboard') ||
    redirectUrl.pathname.startsWith('/tasks') ||
    redirectUrl.pathname.startsWith('/projects') ||
    redirectUrl.pathname.startsWith('/teams') ||
    redirectUrl.pathname.startsWith('/calendar') ||
    redirectUrl.pathname.startsWith('/messages') ||
    redirectUrl.pathname.startsWith('/notifications') ||
    redirectUrl.pathname.startsWith('/reports') ||
    redirectUrl.pathname.startsWith('/ai') ||
    redirectUrl.pathname.startsWith('/settings')

  if (!user && isProtectedPage) {
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if (user && (isAuthPage || redirectUrl.pathname === '/')) {
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
