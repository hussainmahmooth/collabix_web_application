// Mock Supabase Client for Sandbox Mode
// Prevents network connection failures when utilizing default placeholder URLs

export function createMockSupabaseClient() {
  const handler = {
    get(target: any, prop: string): any {
      if (prop === 'auth') {
        return {
          getSession: () => Promise.resolve({ 
            data: { session: { user: { id: 'demo-user-hussain-id', email: 'leader@collabix.com' } } }, 
            error: null 
          }),
          getUser: () => Promise.resolve({ 
            data: { user: { id: 'demo-user-hussain-id', email: 'leader@collabix.com' } }, 
            error: null 
          }),
          signInWithPassword: () => Promise.resolve({ 
            data: { user: { id: 'demo-user-hussain-id', email: 'leader@collabix.com' } }, 
            error: null 
          }),
          signUp: () => Promise.resolve({ 
            data: { user: { id: 'demo-user-hussain-id', email: 'demo@collabix.com' } }, 
            error: null 
          }),
          signOut: () => Promise.resolve({ error: null }),
          resetPasswordForEmail: () => Promise.resolve({ error: null }),
        }
      }
      
      if (prop === 'from') {
        return () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              limit: () => Promise.resolve({ data: [], error: null }),
              order: () => Promise.resolve({ data: [], error: null })
            }),
            in: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            }),
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null })
            })
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'mock-inserted-id' }, error: null })
            })
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null })
          }),
          delete: () => ({
            eq: () => Promise.resolve({ data: null, error: null })
          })
        })
      }
      
      if (prop === 'channel') {
        return () => ({
          on: () => ({
            subscribe: () => ({})
          }),
          subscribe: () => ({})
        })
      }
      
      if (prop === 'removeChannel') {
        return () => {}
      }

      return () => {}
    }
  }

  return new Proxy({}, handler)
}
