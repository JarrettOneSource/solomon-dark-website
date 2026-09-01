// Tiny spell bus: the console grimoire, konami listener, and page components
// all talk over window CustomEvents so nothing needs React context.

export type SpellKind = 'fireball' | 'etherWisp' | 'cyanOrb' | 'purpleBolt' | 'frostLance'

export type SpellEvent =
  | { spell: 'cast'; what?: SpellKind }
  | { spell: 'summon'; what: 'imp' | 'spider' | 'wisp' | 'flame' }
  | { spell: 'midnight'; source: 'console' | 'konami' | 'clock' }
  | { spell: 'gameover' }
  | { spell: 'attune'; element: string }
  | { spell: 'bloodmoon'; on: boolean }
  | { spell: 'spider' }
  | { spell: 'wave'; count?: number }
  | { spell: 'scurry' }
  | { spell: 'tomefly' }

const EVENT = 'sdr:spell'

export function castSpell(detail: SpellEvent) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }))
}

export function onSpell(handler: (e: SpellEvent) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<SpellEvent>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

// ---- mouse effects preference ----------------------------------------------
// Gates the cursor trail and the School of Magic click rites together.
// Per-device, like the ♪ mute, and off until the wand is raised from the
// effects rail (the key is only ever present when someone turned it on).

const CURSOR_FX_KEY = 'sdr:mouse-fx'
const CURSOR_FX_EVENT = 'sdr:mousefx'

export function mouseFxEnabled(): boolean {
  return localStorage.getItem(CURSOR_FX_KEY) === '1'
}

export function setMouseFxEnabled(on: boolean) {
  if (on) localStorage.setItem(CURSOR_FX_KEY, '1')
  else localStorage.removeItem(CURSOR_FX_KEY)
  window.dispatchEvent(new CustomEvent(CURSOR_FX_EVENT, { detail: on }))
}

export function onMouseFx(handler: (on: boolean) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<boolean>).detail)
  window.addEventListener(CURSOR_FX_EVENT, listener)
  return () => window.removeEventListener(CURSOR_FX_EVENT, listener)
}
