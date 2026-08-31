/**
 * The stock application tick counter `App+0x28` (global `0x0081F658`).
 *
 * Retail 0.72.5: the static `App` object at `0x0081F630` runs the inherited
 * base tick `0x00427800` (vtable slot 8) from the 100 Hz scheduler
 * `0x0040D1B0`; `0x0042781E..0x00427824` is `cmp byte [App+0x2C],0; jnz;
 * inc dword [App+0x28]`. `App+0x2C` has no writer outside the constructor
 * and `+0x68` (the scene-transition skip) is zero during play, so the
 * counter never pauses — it keeps counting while the InventoryScreen and
 * SkillScreen modals are open. UI code that "blinks" (the Tutorial pointer
 * primitive `0x005C9BB0`: draw iff `!blink || tick % 50 > 19`) reads this
 * counter, never the gameplay tick.
 *
 * The web derives the same 100 Hz tick from the presentation clock so it is
 * unaffected by the gameplay pause. Its phase relative to process start is not
 * reproducible.
 */
export const NATIVE_APPLICATION_TICK_RATE = 100
export const NATIVE_APPLICATION_TICK_MS = 1_000 / NATIVE_APPLICATION_TICK_RATE

export function nativeApplicationTick(nowMs: number): number {
  return Math.floor(nowMs / NATIVE_APPLICATION_TICK_MS)
}
