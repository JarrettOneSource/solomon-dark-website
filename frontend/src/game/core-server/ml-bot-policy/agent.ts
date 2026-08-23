import type { GameSimulationState } from '../game-simulation.ts'
import {
  resolveMlBotPolicyDecision,
  type MlBotPolicyDecision,
} from './actions.ts'
import type { MlBotPolicyFrame } from './observer.ts'
import {
  MlBotPolicyRuntime,
  type MlBotPolicyAutoregressiveResult,
  type MlBotPolicySelectionOptions,
} from './runtime.ts'

export interface MlBotPolicyEvaluatedDecision {
  readonly decision: MlBotPolicyDecision
  readonly evaluation: MlBotPolicyAutoregressiveResult
}

export function evaluateMlBotPolicyDecision(
  runtime: MlBotPolicyRuntime,
  state: GameSimulationState,
  playerId: string,
  frame: MlBotPolicyFrame,
  options: MlBotPolicySelectionOptions,
): MlBotPolicyEvaluatedDecision {
  const safeTarget = frame.targetId !== null || frame.enemyRows.length === 0 ? 0 : 1
  const base = resolveMlBotPolicyDecision(state, playerId, frame, {
    ability: 0,
    aim: 0,
    movement: 0,
    target: safeTarget,
  })
  const evaluation = runtime.inferAutoregressive(
    frame.values,
    { movement: base.masks.movement, target: base.masks.target },
    target => resolveMlBotPolicyDecision(state, playerId, frame, {
      ability: 0,
      aim: 0,
      movement: 0,
      target,
    }).masks.ability,
    (target, ability) => resolveMlBotPolicyDecision(state, playerId, frame, {
      ability,
      aim: 0,
      movement: 0,
      target,
    }).masks.aim,
    options,
  )
  const decision = resolveMlBotPolicyDecision(
    state,
    playerId,
    frame,
    evaluation.actions,
  )
  return Object.freeze({ decision, evaluation })
}
