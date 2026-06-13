# HotDogBush Rewards Distribution — design spec

> Status: **DESIGN / NOT DEPLOYED.** The game + leaderboard (this repo) ship first. This document
> specs the on-chain payout so it can be built and audited before any real funds move.

## Goal

Every 4-hour round, distribute **50% of accumulated `$HOTDOG` trading tax** to the round's top 5
earners on the leaderboard:

| Rank | Share of the round prize pool |
|------|------------------------------|
| 🥇 1st | 25% |
| 🥈 2nd | 12% |
| 🥉 3rd | 7%  |
| 4th  | 4%  |
| 5th  | 2%  |

(The five shares sum to 50% of the tax; the remaining 50% of tax is retained per the token's
economic model. The percentages above are of the **total tax**, matching the UI copy.)

## Trust boundary & the score problem

The leaderboard score is produced by a **client-side game**, so it is not trustlessly verifiable
on-chain. The honest framing: this is a **memecoin game with an oracle-attested payout**, not a
trustless game. The design below makes the oracle auditable and the funds custody-minimized, which
is the realistic bar for this class of product.

Anti-abuse already in place (this repo):
- Scores are written only by the `submit-score` edge function (service role); clients cannot insert
  (RLS denies all anon writes — verified: anon `INSERT` → 401).
- Server-side bounds validation (`0 ≤ score ≤ 100000`, name length, wallet shape).

Recommended additions before money is attached:
- **Wallet-bound submissions:** require the player to sign a message with their Solana wallet; store
  the verified pubkey on the score row (the `wallet` column already exists).
- **Server-side replay/plausibility checks:** rate-limit per wallet, reject implausible cash/serve
  ratios, optionally re-simulate from an action log.
- **Sybil resistance:** minimum `$HOTDOG` hold or a small entry stake to appear on the payout board.

## Architecture

```
Round ends (UTC 4h boundary)
  └─► pg_cron rotate_rounds() closes the round
        └─► snapshot top 5 (wallet, rank, score) into `round_results`
              └─► Distributor service (off-chain signer / Cloudflare Worker Cron)
                    ├─ reads tax pool balance (treasury token account)
                    ├─ computes per-rank amounts
                    └─► Solana program `distribute(round_id, [winners])`
                          └─ transfers from treasury PDA to each winner ATA
                          └─ emits Distributed event; marks round paid
```

### On-chain program (Anchor / Rust)

Minimal program holding a treasury PDA and paying out winners:

```rust
// pseudocode sketch — not built yet
#[program]
pub mod hotdogbush_rewards {
    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey, mint: Pubkey) -> Result<()> { ... }

    /// Called once per round by the trusted distributor authority.
    /// winners: up to 5 (pubkey, bps_of_pool). Idempotent per round_id.
    pub fn distribute(
        ctx: Context<Distribute>,
        round_id: [u8; 16],          // uuid bytes from Postgres
        winners: Vec<Winner>,        // [{ wallet, amount }]
    ) -> Result<()> {
        require!(!ctx.accounts.round_marker.paid, Err::AlreadyPaid);
        // transfer SPL tokens treasury_pda -> each winner ATA
        // set round_marker.paid = true (PDA seeded by round_id => replay-proof)
    }
}
```

Key properties:
- **Idempotent payouts:** a `round_marker` PDA seeded by `round_id` prevents double-payment.
- **Custody-minimized:** the distributor authority can *trigger* a payout but the amounts are
  bounded by program logic; consider a multisig (Squads) as the authority.
- **Auditable:** `round_results` in Postgres + on-chain `Distributed` events must reconcile.

### Off-chain distributor

A scheduled job (Cloudflare Worker [Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
or a Supabase scheduled function) that, shortly after each boundary:
1. Reads the just-closed round's top 5 from `round_results`.
2. Reads the treasury balance, computes amounts.
3. Builds + signs the `distribute` transaction with the authority key (KMS / multisig).
4. Records the tx signature back on the round row.

## Required schema additions (future migration)

```sql
-- snapshot taken at round close so payouts are immutable
create table public.round_results (
  round_id   uuid references public.rounds(id),
  rank       int  check (rank between 1 and 5),
  wallet     text not null,
  player_name text not null,
  score      int  not null,
  amount     numeric,        -- filled by distributor
  tx_sig     text,           -- solana signature once paid
  primary key (round_id, rank)
);
```

Extend `rotate_rounds()` to `insert into round_results (...) select ... order by score desc limit 5`
for the round being closed, before opening the next one.

## Open decisions (flagged, not assumed)

- Authority model: single hot key vs. Squads multisig (recommend multisig).
- Payout currency: `$HOTDOG` vs. SOL/USDC equivalent.
- Tie-breaking: current rule is higher score, then earlier submission (`created_at`).
- Minimum thresholds / entry stake for Sybil resistance.

These require product + treasury sign-off and are intentionally **not** implemented yet.
