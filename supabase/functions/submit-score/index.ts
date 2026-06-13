// submit-score — the ONLY path that writes to public.scores.
// Validates input, resolves/rotates the active 4-hour round, and inserts using the
// service_role key (RLS denies all client writes). Deployed to Supabase Edge Runtime (Deno).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_SCORE = 100_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Payload {
  player_name?: unknown;
  score?: unknown;
  wallet?: unknown;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  // --- validate at the boundary ---
  const name = typeof payload.player_name === 'string' ? payload.player_name.trim() : '';
  if (name.length < 2 || name.length > 20) {
    return json({ error: 'player_name must be 2-20 characters' }, 400);
  }

  const score = Number(payload.score);
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return json({ error: `score must be an integer between 0 and ${MAX_SCORE}` }, 400);
  }

  let wallet: string | null = null;
  if (payload.wallet != null) {
    if (typeof payload.wallet !== 'string' || payload.wallet.length < 32 || payload.wallet.length > 64) {
      return json({ error: 'wallet must be a 32-64 char string' }, 400);
    }
    wallet = payload.wallet;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'server misconfigured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Resolve (and lazily rotate) the active round so correctness never depends on cron timing.
  const { data: round, error: roundErr } = await admin.rpc('ensure_active_round');
  if (roundErr || !round) {
    console.error('ensure_active_round failed', roundErr);
    return json({ error: 'could not resolve active round' }, 500);
  }
  const roundId = (round as { id: string }).id;

  const { error: insertErr } = await admin
    .from('scores')
    .insert({ round_id: roundId, player_name: name, score, wallet });

  if (insertErr) {
    console.error('insert failed', insertErr);
    return json({ error: 'could not save score' }, 500);
  }

  return json({ ok: true, round_id: roundId });
});
