import { supabase } from '../lib/supabase.ts';
import type { LeaderboardRow } from '../types/db.ts';
import { fetchActiveRound, fetchTop } from './api.ts';

const PRIZE_PCT = ['25%', '12%', '7%', '4%', '2%'];

/**
 * Realtime leaderboard widget. Renders the top N for the active round and
 * keeps it live via Supabase postgres_changes on the `scores` table.
 */
export class Leaderboard {
  private listEl: HTMLOListElement;
  private statusEl: HTMLElement;
  private roundId: string | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private rows: LeaderboardRow[] = [];

  constructor(listEl: HTMLOListElement, statusEl: HTMLElement) {
    this.listEl = listEl;
    this.statusEl = statusEl;
  }

  async init(): Promise<void> {
    const round = await fetchActiveRound();
    this.roundId = round?.id ?? null;
    if (this.roundId) {
      this.rows = await fetchTop(this.roundId, 10);
      this.paint();
      this.subscribe(this.roundId);
    } else {
      this.paint(); // empty state
    }
  }

  /** Re-resolve the active round (e.g. after a 4h rotation) and rewire realtime. */
  async refreshRound(): Promise<void> {
    const round = await fetchActiveRound();
    const newId = round?.id ?? null;
    if (newId !== this.roundId) {
      this.roundId = newId;
      this.rows = newId ? await fetchTop(newId, 10) : [];
      this.paint();
      if (newId) this.subscribe(newId);
    }
  }

  private subscribe(roundId: string): void {
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = supabase
      .channel(`scores:${roundId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scores', filter: `round_id=eq.${roundId}` },
        (payload) => this.onInsert(payload.new as LeaderboardRow),
      )
      .subscribe((status) => {
        const live = status === 'SUBSCRIBED';
        this.statusEl.className = live ? 'dot dot--on' : 'dot dot--off';
        this.statusEl.title = live ? 'live' : 'connecting…';
      });
  }

  private onInsert(row: LeaderboardRow): void {
    // Keep only this player's best for display clarity.
    const existing = this.rows.find((r) => r.player_name === row.player_name);
    if (existing) {
      if (row.score > existing.score) existing.score = row.score;
    } else {
      this.rows.push(row);
    }
    this.rows.sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at));
    this.rows = this.rows.slice(0, 10);
    this.paint(row.player_name);
  }

  private paint(highlightName?: string): void {
    if (this.rows.length === 0) {
      this.listEl.innerHTML = '<li class="lb-empty">Be the first to cook. Your name goes here.</li>';
      return;
    }
    this.listEl.innerHTML = this.rows
      .map((r, i) => {
        const rank = i + 1;
        const prize = rank <= 5 ? PRIZE_PCT[i] : '';
        const isNew = highlightName && r.player_name === highlightName ? ' lb-row--new' : '';
        const prizeAttr = rank === 1 ? ' data-prize="1"' : '';
        return `<li class="lb-row${isNew}" data-rank="${rank}"${prizeAttr}>
          <span class="lb-row__rank">${rankBadge(rank)}</span>
          <span class="lb-row__name" title="${escapeHtml(r.player_name)}">${escapeHtml(r.player_name)}${prize ? ` · <small style="color:var(--color-muted)">${prize}</small>` : ''}</span>
          <span class="lb-row__cash">$${r.score.toLocaleString()}</span>
        </li>`;
      })
      .join('');
  }

  destroy(): void {
    if (this.channel) supabase.removeChannel(this.channel);
  }
}

function rankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
