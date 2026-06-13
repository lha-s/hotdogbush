import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate at the boundary: a misconfigured env is a hard, visible failure, not a silent one.
if (!url || !anonKey) {
  console.error('[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.');
}

export const supabase: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const isConfigured = Boolean(url && anonKey);
