// Loads the original SVG sprites (public/assets). The renderer falls back to procedural
// canvas drawing for any sprite that hasn't loaded yet, so the game is always playable.

export type SpriteKey =
  | 'bg'
  | 'sausageRaw'
  | 'sausageCooked'
  | 'sausageBurnt'
  | 'pattyRaw'
  | 'pattyCooked'
  | 'pattyBurnt'
  | 'bun'
  | 'burgerBun'
  | 'customer1'
  | 'customer2'
  | 'condiments';

const MANIFEST: Record<SpriteKey, string> = {
  bg: '/assets/stand-bg.svg',
  sausageRaw: '/assets/sausage-raw.svg',
  sausageCooked: '/assets/sausage-cooked.svg',
  sausageBurnt: '/assets/sausage-burnt.svg',
  pattyRaw: '/assets/patty-raw.svg',
  pattyCooked: '/assets/patty-cooked.svg',
  pattyBurnt: '/assets/patty-burnt.svg',
  bun: '/assets/bun.svg',
  burgerBun: '/assets/burger-bun.svg',
  customer1: '/assets/customer-1.svg',
  customer2: '/assets/customer-2.svg',
  condiments: '/assets/condiments.svg',
};

const cache = new Map<SpriteKey, HTMLImageElement>();
const ready = new Set<SpriteKey>();

/** Kick off loading every sprite. Resolves once all attempts settle (errors are non-fatal). */
export function preloadSprites(): Promise<void> {
  const loads = (Object.keys(MANIFEST) as SpriteKey[]).map(
    (key) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ready.add(key);
          resolve();
        };
        img.onerror = () => resolve(); // fall back to procedural draw
        img.src = MANIFEST[key];
        cache.set(key, img);
      }),
  );
  return Promise.all(loads).then(() => undefined);
}

/** Returns the loaded image for a key, or null if it isn't ready (caller draws a fallback). */
export function sprite(key: SpriteKey): HTMLImageElement | null {
  return ready.has(key) ? (cache.get(key) ?? null) : null;
}
