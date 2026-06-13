-- Schedule round rotation on aligned 4-hour boundaries via pg_cron.
-- The submit-score function also calls ensure_active_round() lazily, so correctness
-- never depends on cron firing on time — this is the scheduled safety net + the hook
-- point for snapshotting winners for reward distribution (see docs/REWARDS_CONTRACT.md).
--
-- Wrapped defensively: if pg_cron is unavailable (some local setups), startup still
-- succeeds and the lazy path keeps rounds correct.

do $$
begin
  create extension if not exists pg_cron;

  -- pg_cron exposes schedule/unschedule in the `cron` schema.
  begin
    perform cron.unschedule('hotdogbush_rotate_rounds');
  exception when others then
    null; -- not previously scheduled
  end;

  -- Run at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC.
  perform cron.schedule(
    'hotdogbush_rotate_rounds',
    '0 */4 * * *',
    'select public.rotate_rounds();'
  );
exception when others then
  raise notice 'pg_cron unavailable, skipping schedule (lazy rotation still active): %', sqlerrm;
end;
$$;
