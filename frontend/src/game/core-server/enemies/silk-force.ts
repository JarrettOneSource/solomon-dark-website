import type { NativeRngState } from '../../core-kernels/native-rng.ts'
import { createNativeSilkFragments, stepNativeFadeLine } from '../../core-kernels/native-silk-force.ts'
import type { NativeFadeLineActor } from '../../core-kernels/native-silk-force.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import type { BoneyardEnemyStore, WorkingStep } from './model.ts'

export function applyBoneyardSilkForce(
  source: BoneyardEnemyStore,
  id: number,
  amount: number,
  direction: Readonly<Vector2>,
  tick: number,
  rng: NativeRngState,
  lightAt: (position: Readonly<Vector2>) => number,
): Readonly<{ store: BoneyardEnemyStore; rng: NativeRngState }> {
  const silk = source.silks.find(actor => actor.id === id)
  if (!silk) return { store: source, rng }
  const forceAccumulator = Math.fround(silk.state.forceAccumulator + amount)
  if (forceAccumulator <= 1) {
    return { rng, store: { ...source, silks: source.silks.map(actor => actor.id === id
      ? { ...actor, state: { ...actor.state, forceAccumulator } } : actor) } }
  }
  const created = createNativeSilkFragments(silk.state, direction, lightAt, rng)
  return { rng: created.rngState, store: {
    ...source,
    silks: source.silks.filter(actor => actor.id !== id),
    nextDeathEffectId: source.nextDeathEffectId + created.fragments.length,
    silkFragments: [...source.silkFragments, ...created.fragments.map((state, index) => ({
      id: source.nextDeathEffectId + index, spawnTick: tick, state,
    }))],
  } }
}

export function stepSilkFragments(work: WorkingStep): void {
  const survivors: NativeFadeLineActor[] = []
  for (const actor of work.silkFragments) {
    const state = stepNativeFadeLine(actor.state)
    if (state !== null) survivors.push({ ...actor, state })
  }
  work.silkFragments = survivors
}
