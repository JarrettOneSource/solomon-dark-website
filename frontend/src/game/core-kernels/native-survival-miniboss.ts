import type { NativeLootScriptAction } from './native-loot.ts'
import {
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'

export type NativeSurvivalOnDeathProgram = 'miniboss-die'

export const NATIVE_MINIBOSS_DIE_PROGRAM = Object.freeze({
  goldMaximum: 600,
  goldMinimum: 300,
  goldRollValue: 1,
  itemMode: 0,
  placementPolicy: 'trigger-focus' as const,
  randomBound: 2,
})

const GOLD_REWARD: NativeLootScriptAction = Object.freeze({
  kind: 'drop-random-gold',
  maximum: NATIVE_MINIBOSS_DIE_PROGRAM.goldMaximum,
  minimum: NATIVE_MINIBOSS_DIE_PROGRAM.goldMinimum,
})

const ITEM_REWARD: NativeLootScriptAction = Object.freeze({
  kind: 'drop-random-item',
  mode: NATIVE_MINIBOSS_DIE_PROGRAM.itemMode,
})

export function selectNativeMinibossDieReward(
  source: NativeRngState,
): Readonly<{
  action: NativeLootScriptAction
  rngState: NativeRngState
}> {
  const selected = drawNativeInteger(source, NATIVE_MINIBOSS_DIE_PROGRAM.randomBound)
  return Object.freeze({
    action: selected.value === NATIVE_MINIBOSS_DIE_PROGRAM.goldRollValue
      ? GOLD_REWARD
      : ITEM_REWARD,
    rngState: selected.state,
  })
}
