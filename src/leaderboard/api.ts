import { supabase } from '../lib/supabase.ts';
import type { LeaderboardRow, RoundRow } from '../types/db.ts';

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

/** Fetch the current active round (the edge function / DB ensures one exists on submit). */
export async function fetchActiveRound(): Promise<RoundRow | null> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[lb] fetchActiveRound', error.message);
    return null;
  }
  return data as RoundRow | null;
}

/** Top scores for a round, highest first. */
export async function fetchTop(roundId: string, limit = 10): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('round_id', roundId)
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('[lb] fetchTop', error.message);
    return [];
  }
  return (data ?? []) as LeaderboardRow[];
}

/**
 * Submit a score through the edge function (server-side validation + round assignment).
 * We never write to `scores` directly from the client — RLS forbids it.
 */
export async function submitScore(playerName: string, score: number, wallet?: string): Promise<SubmitResult> {
  const { data, error } = await supabase.functions.invoke('submit-score', {
    body: { player_name: playerName, score, wallet: wallet ?? null },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  if (data && (data as { error?: string }).error) {
    return { ok: false, error: (data as { error: string }).error };
  }
  return { ok: true };
}
