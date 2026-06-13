-- HotDogBush leaderboard schema
-- Rounds reset on aligned 4-hour UTC windows (00:00, 04:00, 08:00, 12:00, 16:00, 20:00).
-- Scores are written ONLY by the submit-score edge function (service_role); the public
-- can read scores/rounds but never insert directly (anti-tamper at the RLS boundary).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- rounds
-- ---------------------------------------------------------------------------
create table if not exists public.rounds (
  id          uuid primary key default extensions.gen_random_uuid(),
  started_at  timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'active' check (status in ('active', 'closed')),
  created_at  timestamptz not null default now(),
  constraint rounds_started_at_key unique (started_at)
);

comment on table public.rounds is '4-hour competition windows. One active round at a time.';

-- ---------------------------------------------------------------------------
-- scores
-- ---------------------------------------------------------------------------
create table if not exists public.scores (
  id           uuid primary key default extensions.gen_random_uuid(),
  round_id     uuid not null references public.rounds (id) on delete cascade,
  player_name  text not null check (char_length(player_name) between 2 and 20),
  wallet       text check (wallet is null or char_length(wallet) between 32 and 64),
  score        integer not null check (score >= 0 and score <= 100000),
  created_at   timestamptz not null default now()
);

comment on table public.scores is 'One row per submitted run. Leaderboard = top scores per round.';

create index if not exists scores_round_score_idx
  on public.scores (round_id, score desc, created_at asc);

-- ---------------------------------------------------------------------------
-- Round helpers
-- ---------------------------------------------------------------------------

-- Start of the current aligned 4-hour UTC window.
create or replace function public.current_window_start()
returns timestamptz
language sql
stable
as $$
  select date_trunc('hour', now() at time zone 'utc')
       - make_interval(hours => (extract(hour from now() at time zone 'utc')::int % 4));
$$;

-- Ensure exactly one active round for the current window; close any stale ones.
-- Safe to call concurrently (unique started_at + on conflict).
create or replace function public.ensure_active_round()
returns public.rounds
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_start timestamptz := public.current_window_start();
  v_end   timestamptz := v_start + interval '4 hours';
  v_round public.rounds;
begin
  -- close everything that isn't the current window
  update public.rounds
     set status = 'closed'
   where status = 'active'
     and started_at <> v_start;

  insert into public.rounds (started_at, ends_at, status)
  values (v_start, v_end, 'active')
  on conflict (started_at) do update set status = 'active'
  returning * into v_round;

  return v_round;
end;
$$;

-- Cron entrypoint: rotate rounds on the boundary. Returns the new active round id.
create or replace function public.rotate_rounds()
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_round public.rounds;
begin
  v_round := public.ensure_active_round();
  return v_round.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.rounds enable row level security;
alter table public.scores enable row level security;

-- Public read access (leaderboard is public).
drop policy if exists "rounds are public" on public.rounds;
create policy "rounds are public" on public.rounds
  for select using (true);

drop policy if exists "scores are public" on public.scores;
create policy "scores are public" on public.scores
  for select using (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated => writes are denied.
-- The edge function uses the service_role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Realtime: broadcast score inserts to subscribed clients
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.scores;

-- Seed the first round so the app has something to show immediately.
select public.ensure_active_round();
