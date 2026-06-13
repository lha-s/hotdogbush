# 🌭 HotDogBush — `$HOTDOG`

A [pump.fun](https://pump.fun) arcade game. **Cook hot dogs, climb a live leaderboard, and win a share of the trading tax every 4 hours.**

- **Home page is the game.** An original HTML5 Canvas cooking game (tap to grill, tap to serve — don't burn it, don't let customers walk).
- **Live leaderboard** under the game, updated in real time via Supabase Realtime.
- **Rounds reset every 4 hours.** Aligned to UTC windows (00/04/08/12/16/20:00).
- **Top 5 earners split 50% of the `$HOTDOG` trading tax** each round (distribution contract: see [`docs/REWARDS_CONTRACT.md`](docs/REWARDS_CONTRACT.md)).

> ℹ️ This is an **original** game in the hot-dog-stand genre. It deliberately does **not** use the
> proprietary Flash "Hot Dog Bush" SWF (which is copyrighted) or the Ruffle Flash emulator — a native
> Canvas game is legal to ship, far more Cloudflare-friendly, and reports scores cleanly to Supabase.

## Stack & why

| Layer | Choice | Justification |
|---|---|---|
| Frontend | Vite + TypeScript (vanilla) | Microsite bundle budget; ~60 kB gz JS (mostly supabase-js) |
| Game | HTML5 Canvas, no framework | Tactile 60fps loop, pure testable logic |
| Hosting | [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) | Latest CF static-hosting path (`assets` + SPA fallback) |
| Database / Realtime | [Supabase](https://supabase.com/docs) (local-first) | Postgres + Realtime `postgres_changes` for the live board |
| Score writes | Supabase Edge Function (`submit-score`) | Server-side validation; clients can never write `scores` (RLS) |
| 4h rounds | `rounds` table + aligned-window rotation, lazy + `pg_cron` | Correct even if cron lags; verifiable locally |

## Architecture

```
Browser (Vite SPA on Cloudflare)
  ├── Canvas game  ──► final cash = score
  │                      │
  │                      ▼  supabase.functions.invoke('submit-score')
  │              Supabase Edge Function (service_role)
  │                      │  validates → ensure_active_round() → INSERT scores
  │                      ▼
  └── Leaderboard ◄── Supabase Realtime (postgres_changes on `scores`)
                          ▲
                  Postgres + RLS (anon: read-only; writes denied)
                  pg_cron: rotate_rounds() every 4h (UTC-aligned)
```

Security model: the browser holds only the **publishable/anon** key. RLS grants the public
`SELECT` on `rounds`/`scores` but **no** write policy, so the only insert path is the edge
function using the service-role key. Verified: anon `INSERT` → HTTP 401; function submit → 200.

## Local development

Requires Docker, Node, and the Supabase CLI.

```bash
pnpm install
cp .env.example .env          # then paste the keys printed by `supabase status`

# 1. Start the local backend (Postgres + Realtime + Edge Runtime)
pnpm db:start                 # supabase start
supabase status               # copy Project URL + Publishable key into .env

# 2. Serve the score-submission edge function (separate terminal)
pnpm fn:serve                 # supabase functions serve submit-score --no-verify-jwt

# 3. Run the app
pnpm dev                      # http://localhost:5173

# Tests / build
pnpm test                     # vitest — pure game-logic unit tests
pnpm build                    # tsc --noEmit && vite build
pnpm db:types                 # regenerate src/types/db.ts from the live schema
```

> **Note:** macOS blocks Docker from mounting `~/Desktop` (TCC privacy). Keep the repo outside
> `~/Desktop`/`~/Documents`/`~/Downloads` or grant Docker Full Disk Access, or the Edge Runtime
> container will fail to start. Local Storage + Analytics containers are disabled in
> `supabase/config.toml` (unused by this app, and they're flaky locally).

## Deploy

### Backend (Supabase cloud)

```bash
supabase link --project-ref <your-ref>
supabase db push                       # apply migrations
supabase functions deploy submit-score # deploy the edge function
```

### Frontend (Cloudflare)

Set the production `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in your build environment, then:

```bash
pnpm cf:deploy        # npm run build && wrangler deploy
```

See [`wrangler.jsonc`](wrangler.jsonc).

## Token

- **Ticker:** `$HOTDOG` · launched on pump.fun.
- Revenue model (informational): 5% transaction tax, ~5% of circulating supply held by the team.
- **50% of tax** funds the per-round prize pool: 🥇 25% · 🥈 12% · 🥉 7% · 4th 4% · 5th 2%.

This repo is the **game + leaderboard**. The on-chain prize distribution is specced separately in
[`docs/REWARDS_CONTRACT.md`](docs/REWARDS_CONTRACT.md) and is **not yet deployed**.

## License & disclaimer

HotDogBush is a game. `$HOTDOG` is a memecoin — play for fun, not financial advice. MIT licensed
(see [`LICENSE`](LICENSE)).
