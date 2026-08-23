import type { GameSimulationState } from '../game-simulation.ts'
import {
  createMlBotPolicyActionMaskPlan,
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
  const plan = createMlBotPolicyActionMaskPlan(state, playerId, frame)
  const evaluation = runtime.inferAutoregressive(
    frame.values,
    { movement: plan.movement, target: plan.target },
    target => plan.abilityByTarget[target]!,
    (_target, ability) => plan.aimByAbility[ability]!,
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
