// Hand-written placeholder. Regenerate from the live local schema with:
//   npm run db:types   (supabase gen types typescript --local > src/types/db.ts)
export interface LeaderboardRow {
  id: string;
  round_id: string;
  player_name: string;
  wallet: string | null;
  score: number;
  created_at: string;
}

export interface RoundRow {
  id: string;
  started_at: string;
  ends_at: string;
  status: 'active' | 'closed';
}
