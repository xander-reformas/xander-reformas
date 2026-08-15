import { createClient } from '@supabase/supabase-js'

// Reemplaza estos valores con los de tu proyecto en supabase.com
// Settings → API → Project URL y anon public key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://TU-PROYECTO.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'TU-ANON-KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Helper: obtiene el user_id del usuario autenticado
export async function getUID() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}
