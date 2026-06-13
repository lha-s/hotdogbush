import './style.css';
import { Engine } from './game/engine.ts';
import { preloadSprites } from './game/assets.ts';
import { MAX_PLAUSIBLE_SCORE } from './game/constants.ts';
import { Leaderboard } from './leaderboard/leaderboard.ts';
import { fetchActiveRound, submitScore } from './leaderboard/api.ts';
import { isConfigured } from './lib/supabase.ts';
import type { GameState } from './game/types.ts';

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};

// --- token / branding ---
const ticker = import.meta.env.VITE_TOKEN_TICKER ?? 'HOTDOG';
const pumpUrl = import.meta.env.VITE_PUMPFUN_URL ?? 'https://pump.fun';
$('#pumpLink').setAttribute('href', pumpUrl);

// --- elements ---
const canvas = $<HTMLCanvasElement>('#game');
const overlay = $('#overlay');
const hud = $('#hud');
const hudCash = $('#hudCash');
const hudServed = $('#hudServed');
const hudTime = $('#hudTime');
const roundTimer = $('#roundTimer');

// remember the player's name across runs
const NAME_KEY = 'hotdogbush.name';
let playerName = localStorage.getItem(NAME_KEY) ?? '';

// --- leaderboard ---
const leaderboard = new Leaderboard($<HTMLOListElement>('#leaderboard'), $('#lbStatus'));
if (isConfigured) {
  leaderboard.init().catch((e) => console.error('leaderboard init failed', e));
} else {
  $('#lbStatus').title = 'leaderboard offline — set Supabase env';
}

// --- round countdown ---
let roundEndsAt: number | null = null;

async function syncRound(): Promise<void> {
  const round = await fetchActiveRound();
  roundEndsAt = round ? new Date(round.ends_at).getTime() : null;
}

function tickRoundTimer(): void {
  if (roundEndsAt == null) {
    roundTimer.textContent = '4:00:00';
    return;
  }
  const ms = roundEndsAt - Date.now();
  if (ms <= 0) {
    roundTimer.textContent = '00:00:00';
    // round rolled over — re-resolve round + leaderboard
    syncRound().then(() => leaderboard.refreshRound());
    return;
  }
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  roundTimer.textContent = `${hh}:${mm}:${ss}`;
}

if (isConfigured) syncRound();
setInterval(tickRoundTimer, 1000);
tickRoundTimer();

// --- HUD ---
function paintHud(state: GameState): void {
  hudCash.textContent = `$${state.cash.toLocaleString()}`;
  hudServed.textContent = String(state.served);
  const s = Math.ceil(state.timeLeft);
  hudTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// --- engine ---
const engine = new Engine(canvas, {
  onHud: paintHud,
  onGameOver: (finalCash, served) => showGameOver(finalCash, served),
});
void preloadSprites(); // non-blocking; renderer falls back to procedural art until ready
engine.run();

// --- overlay states ---
function showStart(): void {
  overlay.hidden = false;
  hud.hidden = true;
  overlay.innerHTML = `
    <h2>HotDogBush 🌭</h2>
    <p>You've got <strong>90 seconds</strong>. Tap <strong>Bun</strong> to set a bun on the prep table and tap the
    grill to cook (green zone = top dollar). Then <strong>drag</strong>: cooked sausage → bun,
    <strong>Ketchup</strong>/<strong>Drink</strong> → plate, and finally drag the finished plate onto the
    customer whose order it matches. <strong>Tap the cash</strong> before it vanishes; drag burnt dogs to the <strong>Trash</strong>.</p>
    <button class="btn btn--play" id="playBtn">Start the shift</button>
    <p style="font-size:0.8rem;color:var(--color-muted)">Cash collected this shift is your score on the $${ticker} leaderboard.</p>
  `;
  $('#playBtn').addEventListener('click', beginRun, { once: true });
}

function beginRun(): void {
  overlay.hidden = true;
  hud.hidden = false;
  engine.start();
}

function showGameOver(finalCash: number, served: number): void {
  overlay.hidden = false;
  overlay.innerHTML = `
    <h2>Shift over</h2>
    <p class="big-score">$${finalCash.toLocaleString()}</p>
    <p>${served} dogs served. Put your name on the board to claim your spot.</p>
    <div class="overlay__field">
      <input id="nameInput" maxlength="20" placeholder="your name" value="${escapeAttr(playerName)}" autocomplete="off" />
      <button class="btn btn--play" id="submitBtn">Submit score</button>
    </div>
    <p id="submitMsg" style="font-size:0.85rem;color:var(--color-muted)" aria-live="polite"></p>
    <button class="btn btn--pump" id="againBtn">Play again</button>
  `;

  const nameInput = $<HTMLInputElement>('#nameInput');
  const submitBtn = $<HTMLButtonElement>('#submitBtn');
  const msg = $('#submitMsg');

  $('#againBtn').addEventListener('click', beginRun, { once: true });

  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (name.length < 2) {
      msg.textContent = 'Enter at least 2 characters.';
      return;
    }
    if (!isConfigured) {
      msg.textContent = 'Leaderboard offline (no Supabase env configured).';
      return;
    }
    if (finalCash < 0 || finalCash > MAX_PLAUSIBLE_SCORE) {
      msg.textContent = 'Score out of range.';
      return;
    }
    playerName = name;
    localStorage.setItem(NAME_KEY, name);
    submitBtn.disabled = true;
    msg.textContent = 'Submitting…';
    const res = await submitScore(name, finalCash);
    if (res.ok) {
      msg.textContent = '✅ On the board! Watch it update live below.';
      await syncRound();
    } else {
      msg.textContent = `Could not submit: ${res.error ?? 'unknown error'}`;
      submitBtn.disabled = false;
    }
  });
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

showStart();
