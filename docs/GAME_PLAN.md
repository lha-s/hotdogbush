# HotDogBush — Speed-Mode Build Plan

Lead-architect synthesis of five design slices (data model, interaction, layout zones, progression,
art) into one coherent, phased plan. Produced via the ECC planning pipeline; agents drew mechanics
from the original open-source games (boncanoski/HotDogBush WinForms, RikuBS Construct export) —
non-copyrightable game mechanics only; **all art is our own original sprites**.

Grows the **current** codebase (27 tests passing) into the full speed-mode game. Every phase ends
green and shippable. **Speed mode only — no career, no cash "Goal".**

---

## Conflict resolutions (decided once)

1. **Extend `Plate`/`Order` in place; do NOT add a parallel `Tray` type.** Generalize `Dog` →
   `CookItem` with a `kind` discriminant. New fields default `null`/`false` so existing tests pass.
2. **Grill cooks sausages AND patties on the same 3 slots.** Fries cook in a separate fryer, onions
   in a separate pan (different timings/zones). Slot contention is the intended difficulty.
3. **Layout = the layout-zones rect map** (customers top, condiments+trash+fryer left, buns+onion
   pans center, grill right, 6-cell source shelf bottom, DOM status bar).
4. **Progression = `UNLOCK`/`SPAWN`/`PATIENCE`/`TRAY` constants.** Delete the dead `DIFFICULTY`
   block. `ORDER_COMBOS` retired once `generateOrder` is time-aware.
5. **Spawn bug fix is Phase 1.** `step()` sets `state.spawnTimer = RULES.spawnInterval`, which is
   `undefined` → spawning breaks after the first customer. Replace with pure `spawnGap(elapsed,rng)`.
6. Cooking starts by dragging a raw source onto an appliance; tapping an empty grill slot still
   starts a sausage (back-compat).
7. Status bar = DOM (clock, cash, Pause). Adds a `paused` phase. No goal.
8. Condiments are per-plate booleans; onion is a topping boolean.

---

## 1. Data model (src/game/types.ts) — additions are backward-compatible

```ts
export type GamePhase = 'start' | 'playing' | 'paused' | 'gameover';
export type Grade = 'perfect' | 'good' | 'overdone';
export type FoodKind = 'sausage' | 'patty' | 'fries' | 'onion';
export type CookStation = 'grill' | 'fryer' | 'pan';

export interface CookItem { id: number; kind: FoodKind; station: CookStation; slot: number; cook: number; }
export interface Order { sausage; ketchup; drink; burger; fries; onion; mustard; } // all boolean
export interface Plate { bun; burgerBun; sausage: Grade|null; patty: Grade|null; fries: Grade|null;
                         onion; ketchup; mustard; drink; }
// GameState: dogs -> cookItems, nextDogId -> nextItemId, phase adds 'paused'
export type Station = 'ketchup'|'mustard'|'trash'|'fryer'|'hotdogBun'|'burgerBun'|'drink';
```

## 2. Zone layout (960×560)

| Zone | Rect / formula | Slots |
|---|---|---|
| Customer face (serve target) | `x=16+slot*188, y=58, w=176, h=84` | 5 |
| Customer order bubble (draw) | `x=16+slot*188+8, y=2, w=160, h=52` | 5 |
| Ketchup / Mustard bottles | `{x:8,y:154,w:66,h:86}` / `{x:78,...}` | — |
| Trash | `{x:8, y:248, w:136, h:86}` | — |
| Fryer | `{x:8, y:342, w:136, h:106}` | 2 |
| Hot-dog / Burger bun source | `{x:156,y:154,w:110,h:70}` / `{x:274,...}` | — |
| Onion pan | `x=400+slot*108, y=154, w:96, h:70` | 2 |
| Prep table | `x=156+slot*172, y=240, w:150, h:124` | 3 |
| Grill (sausage+patty) | `x=668, y=154+slot*98, w:276, h:84` | 3 |
| Source shelf | `x=28+slot*152, y=456, w:144, h:92` | 6 |
| Status bar | DOM under canvas | — |

Shelf (L→R): drink, raw potato (→fryer), hot-dog bun, raw onion (→pan), raw patty (→grill), raw sausage (→grill).

## 3. Drag/drop interactions

Drag raw source → appliance (cook); cooked item → plate (with right bun); condiment/onion → plate;
finished plate → matching customer; junk → trash. Taps: cook sausage on empty grill, toss burnt,
place bun, collect cash. Serve requires every wanted FOOD present; condiments are pay modifiers.

## 4. Progression / scoring constants

```ts
export const UNLOCK = { dog:0, ketchup:0, drink:0, burger:18, mustard:18, fries:45, onion:45 };
export const PHASES = { RUSH:18, PEAK:45, CRUNCH:72 };            // <18 = WARMUP
export const SPAWN  = { startGap:8.0, minGap:2.8, rampTo:72, jitter:0.25 };
export const PATIENCE = { base:15, perPhaseDrop:2, min:9 };       // 15/13/11/9
export const TRAY = { maxItems:{WARMUP:2,RUSH:2,PEAK:3,CRUNCH:4}, toppingChance:..., drinkChance:..., twoProteinChance:... };
export const FRYER_COOK = { perfectFrom:5, overdoneFrom:8,  burntFrom:12, meterMax:14 };
export const PAN_COOK   = { perfectFrom:6, overdoneFrom:10, burntFrom:15, meterMax:17 };
// PAYOUT += burgerBun:10, mustard:3/Miss:2, onion:4/Miss:2, friesPerfect:8/Overdone:4,
//          comboStep:2, comboMax:10, speedBonusWindow:4, speedBonus:5
```
Pure helpers: `phaseOf(elapsed)`, `isUnlocked(item,elapsed)`, `spawnGap(elapsed,rng)`, `patienceFor(elapsed)`.

## 5. Art (original SVGs, incremental — renderer falls back procedurally)

patty-raw/cooked/burnt, burger-bun, fries-raw/cooked, onion-raw/fried, bottle-ketchup/mustard,
topping-ketchup/mustard, drink(+source), fryer, pan, grill, trash, ticket-bubble, tray, icon-*,
customer-3/happy/sad, counter, cash.

---

## Implementation roadmap (each phase: `npm run build && npm test` green)

1. **Fix spawn bug + progression scaffolding** — `spawnGap`/`phaseOf`/`patienceFor`; delete dead
   `DIFFICULTY`; customers keep arriving and pacing ramps. (No new food.)
2. **`Dog`→`CookItem` rename + `paused` phase + DOM status bar** (clock/cash/Pause).
3. **Layout zone remap** to the table above (geometry + render; no new mechanics).
4. **Burgers** — patty on shared grill + burger bun, end to end.
5. **Fries (fryer) + Onions (pan)** — two new appliances with own cook bands.
6. **Mustard** — second condiment.
7. **Multi-item trays + time-aware `generateOrder`** — retire `ORDER_COMBOS`.
8. **Scoring polish** — combo curve, speed bonus, tray multiplier.
9. **Locked-station UX + unlock banners + customer faces** — polish + remaining art.

> File-size guard: split `render.ts` drawing helpers into `render-items.ts` when it nears 500 lines.

All new logic stays pure/DOM-free in `logic.ts`, tested in `tests/logic.test.ts` (≥80% coverage).
