import { drawNativeInteger } from '../core-kernels/native-rng.ts'
import type { BoneyardLootStore } from './boneyard-loot-store.ts'
import { randomBoneyardWaveInteger } from '../core-kernels/boneyard-wave-timeline.ts'
import { NATIVE_LOOT_ACTOR_SEED_BOUND } from '../core-kernels/native-loot.ts'
import { NATIVE_ENEMY_ACTION_SEED_BOUND } from '../core-kernels/native-enemy-targeting.ts'

export type NativeEnemyLootSeedBound = typeof NATIVE_LOOT_ACTOR_SEED_BOUND
  | typeof NATIVE_ENEMY_ACTION_SEED_BOUND

/** The world supplies shared entropy; standalone enemy stores retain their own stream. */
export function nextEnemyLootSeed(
  state: { rngState: number },
  rollLootSeed: ((bound: NativeEnemyLootSeedBound) => number) | undefined,
  bound: NativeEnemyLootSeedBound = NATIVE_LOOT_ACTOR_SEED_BOUND,
): number {
  const seed = rollLootSeed?.(bound)
  if (seed !== undefined) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed >= bound) {
      throw new RangeError('native loot seed writer returned an invalid seed')
    }
    return seed
  }
  const draw = randomBoneyardWaveInteger(state.rngState, bound)
  state.rngState = draw.state
  return draw.value
}

export function rollBoneyardLootSeed(
  source: BoneyardLootStore,
  bound: NativeEnemyLootSeedBound,
): { readonly seed: number; readonly store: BoneyardLootStore } {
  const draw = drawNativeInteger(source.sharedRng, bound)
  return {
    seed: draw.value,
    store: { ...source, sharedRng: draw.state },
  }
}
