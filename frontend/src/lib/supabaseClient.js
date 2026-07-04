import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  // Don't throw — allow the app to at least render (e.g. during local UI
  // work before env vars are configured). Auth calls will simply fail.
  console.warn(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill them in.',
  )
}

// Fall back to harmless placeholders so the app can still boot (and be
// developed against visually) before real Supabase credentials are set.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-publishable-key',
)
