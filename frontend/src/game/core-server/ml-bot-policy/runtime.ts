import type { MlBotPolicyActionMasks } from './actions.ts'
import {
  validateMlBotPolicyCheckpoint,
  type MlBotPolicyCheckpoint,
  type MlBotPolicyTensors,
} from './checkpoint.ts'
import {
  ML_BOT_POLICY_OBSERVATION_NAMES,
  ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
} from './spec.ts'

export interface MlBotPolicySelectionOptions {
  readonly mode: 'argmax' | 'sample'
  readonly random?: () => number
  readonly temperature?: number
}

export interface MlBotPolicyHeadResult {
  readonly actions: Readonly<{
    ability: number
    aim: number
    movement: number
    target: number
  }>
  readonly latent: Float32Array
  readonly logProbability: number
  readonly probabilities: Readonly<{
    ability: Float32Array
    aim: Float32Array
    movement: Float32Array
    target: Float32Array
  }>
  readonly value: number
}

export interface MlBotPolicyAutoregressiveResult extends MlBotPolicyHeadResult {
  readonly masks: MlBotPolicyActionMasks
}

export interface MlBotPolicyChoiceResult {
  readonly latent: Float32Array
  readonly logProbability: number
  readonly probabilities: Float32Array
  readonly selectedOption: number
  readonly value: number
}

export class MlBotPolicyRuntime {
  private readonly checkpoint: MlBotPolicyCheckpoint
  private readonly tensors: MlBotPolicyTensors

  constructor(checkpoint: MlBotPolicyCheckpoint) {
    validateMlBotPolicyCheckpoint(checkpoint)
    this.checkpoint = checkpoint
    this.tensors = checkpoint.tensors
  }

  infer(
    observation: Float32Array,
    masks: MlBotPolicyActionMasks,
    options: MlBotPolicySelectionOptions,
  ): MlBotPolicyHeadResult {
    validateObservation(observation)
    const latent = this.encode(observation)
    const movement = head(
      dense(latent, this.tensors.movement_weight, this.tensors.movement_bias, 9),
      masks.movement,
      options,
    )
    const target = head(
      dense(latent, this.tensors.target_weight, this.tensors.target_bias, 9),
      masks.target,
      options,
    )
    const ability = head(
      dense(latent, this.tensors.ability_weight, this.tensors.ability_bias, 22),
      masks.ability,
      options,
    )
    const aim = head(
      dense(latent, this.tensors.aim_weight, this.tensors.aim_bias, 9),
      masks.aim,
      options,
    )
    return {
      actions: Object.freeze({
        ability: ability.selected,
        aim: aim.selected,
        movement: movement.selected,
        target: target.selected,
      }),
      latent,
      logProbability: movement.logProbability
        + target.logProbability
        + ability.logProbability
        + aim.logProbability,
      probabilities: Object.freeze({
        ability: ability.probabilities,
        aim: aim.probabilities,
        movement: movement.probabilities,
        target: target.probabilities,
      }),
      value: scalar(latent, this.tensors.value_weight, this.tensors.value_bias),
    }
  }

  inferAutoregressive(
    observation: Float32Array,
    baseMasks: Readonly<Pick<MlBotPolicyActionMasks, 'movement' | 'target'>>,
    abilityMaskForTarget: (targetAction: number) => Uint8Array,
    aimMaskForAction: (targetAction: number, abilityAction: number) => Uint8Array,
    options: MlBotPolicySelectionOptions,
  ): MlBotPolicyAutoregressiveResult {
    validateObservation(observation)
    const latent = this.encode(observation)
    const movement = head(
      dense(latent, this.tensors.movement_weight, this.tensors.movement_bias, 9),
      baseMasks.movement,
      options,
    )
    const target = head(
      dense(latent, this.tensors.target_weight, this.tensors.target_bias, 9),
      baseMasks.target,
      options,
    )
    const abilityMask = abilityMaskForTarget(target.selected)
    const ability = head(
      dense(latent, this.tensors.ability_weight, this.tensors.ability_bias, 22),
      abilityMask,
      options,
    )
    const aimMask = aimMaskForAction(target.selected, ability.selected)
    const aim = head(
      dense(latent, this.tensors.aim_weight, this.tensors.aim_bias, 9),
      aimMask,
      options,
    )
    return {
      actions: Object.freeze({
        ability: ability.selected,
        aim: aim.selected,
        movement: movement.selected,
        target: target.selected,
      }),
      latent,
      logProbability: movement.logProbability
        + target.logProbability
        + ability.logProbability
        + aim.logProbability,
      masks: Object.freeze({
        ability: abilityMask,
        aim: aimMask,
        movement: baseMasks.movement,
        target: baseMasks.target,
      }),
      probabilities: Object.freeze({
        ability: ability.probabilities,
        aim: aim.probabilities,
        movement: movement.probabilities,
        target: target.probabilities,
      }),
      value: scalar(latent, this.tensors.value_weight, this.tensors.value_bias),
    }
  }

  choose(
    observation: Float32Array,
    optionDescriptors: Float32Array,
    mask: Uint8Array,
    options: MlBotPolicySelectionOptions,
  ): MlBotPolicyChoiceResult {
    validateObservation(observation)
    if (
      optionDescriptors.length === 0
      || optionDescriptors.length % ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length !== 0
    ) throw new RangeError('ML bot policy option descriptors must contain complete nonempty rows')
    const optionCount = optionDescriptors.length / ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length
    if (mask.length !== optionCount) throw new RangeError('ML bot policy choice mask length is invalid')
    for (let index = 0; index < optionDescriptors.length; index += 1) {
      if (!Number.isFinite(optionDescriptors[index])) {
        throw new RangeError(`ML bot policy option descriptor ${index} is not finite`)
      }
    }
    const latent = this.encode(observation)
    const logits = new Float32Array(optionCount)
    const descriptorWidth = ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length
    for (let option = 0; option < optionCount; option += 1) {
      const hidden = new Float32Array(128)
      const descriptorOffset = option * descriptorWidth
      for (let row = 0; row < 128; row += 1) {
        const weightOffset = row * (256 + descriptorWidth)
        let sum = this.tensors.choice_hidden_bias[row]!
        for (let column = 0; column < 256; column += 1) {
          sum = fused(sum, this.tensors.choice_hidden_weight[weightOffset + column]!, latent[column]!)
        }
        for (let column = 0; column < descriptorWidth; column += 1) {
          sum = fused(
            sum,
            this.tensors.choice_hidden_weight[weightOffset + 256 + column]!,
            optionDescriptors[descriptorOffset + column]!,
          )
        }
        hidden[row] = Math.fround(Math.tanh(sum))
      }
      logits[option] = scalar(
        hidden,
        this.tensors.choice_score_weight,
        this.tensors.choice_score_bias,
      )
    }
    const selected = head(logits, mask, {
      ...options,
      temperature: options.temperature ?? this.checkpoint.metadata.choiceTemperature,
    })
    return {
      latent,
      logProbability: selected.logProbability,
      probabilities: selected.probabilities,
      selectedOption: selected.selected,
      value: scalar(latent, this.tensors.choice_value_weight, this.tensors.choice_value_bias),
    }
  }

  private encode(observation: Float32Array): Float32Array {
    const first = dense(
      observation,
      this.tensors.trunk_1_weight,
      this.tensors.trunk_1_bias,
      512,
      true,
    )
    return dense(
      first,
      this.tensors.trunk_2_weight,
      this.tensors.trunk_2_bias,
      256,
      true,
    )
  }
}

function dense(
  input: Float32Array,
  weights: Float32Array,
  bias: Float32Array,
  outputWidth: number,
  tanh = false,
): Float32Array {
  if (bias.length !== outputWidth || weights.length !== input.length * outputWidth) {
    throw new Error('ML bot policy dense tensor shape is invalid')
  }
  const output = new Float32Array(outputWidth)
  for (let row = 0; row < outputWidth; row += 1) {
    const offset = row * input.length
    let sum = bias[row]!
    for (let column = 0; column < input.length; column += 1) {
      sum = fused(sum, weights[offset + column]!, input[column]!)
    }
    output[row] = Math.fround(tanh ? Math.tanh(sum) : sum)
  }
  return output
}

function scalar(input: Float32Array, weights: Float32Array, bias: Float32Array): number {
  if (bias.length !== 1 || weights.length !== input.length) {
    throw new Error('ML bot policy scalar tensor shape is invalid')
  }
  let sum = bias[0]!
  for (let index = 0; index < input.length; index += 1) {
    sum = fused(sum, weights[index]!, input[index]!)
  }
  return Math.fround(sum)
}

function fused(sum: number, weight: number, value: number): number {
  return Math.fround(sum + Math.fround(weight * value))
}

function head(
  logits: Float32Array,
  mask: Uint8Array,
  options: MlBotPolicySelectionOptions,
): Readonly<{ logProbability: number; probabilities: Float32Array; selected: number }> {
  if (mask.length !== logits.length) throw new RangeError('ML bot policy mask length is invalid')
  const temperature = options.temperature ?? 1
  if (!Number.isFinite(temperature) || temperature <= 0) {
    throw new RangeError('ML bot policy temperature must be positive and finite')
  }
  let maximum = Number.NEGATIVE_INFINITY
  let validCount = 0
  for (let index = 0; index < logits.length; index += 1) {
    if (mask[index] !== 1) continue
    validCount += 1
    maximum = Math.max(maximum, logits[index]! / temperature)
  }
  if (validCount === 0) throw new Error('ML bot policy mask has no legal action')
  const probabilities = new Float32Array(logits.length)
  let total = 0
  for (let index = 0; index < logits.length; index += 1) {
    if (mask[index] !== 1) continue
    const value = Math.exp(logits[index]! / temperature - maximum)
    probabilities[index] = value
    total += value
  }
  let selected = -1
  let best = Number.NEGATIVE_INFINITY
  for (let index = 0; index < probabilities.length; index += 1) {
    if (mask[index] !== 1) continue
    probabilities[index] = Math.fround(probabilities[index]! / total)
    if (options.mode === 'argmax' && logits[index]! > best) {
      best = logits[index]!
      selected = index
    }
  }
  if (options.mode === 'sample') {
    if (!options.random) throw new Error('ML bot policy sampling requires an injected random source')
    const draw = options.random()
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
      throw new RangeError('ML bot policy random draw must be within [0, 1)')
    }
    let cumulative = 0
    for (let index = 0; index < probabilities.length; index += 1) {
      cumulative += probabilities[index]!
      if (mask[index] === 1 && draw < cumulative) {
        selected = index
        break
      }
    }
    if (selected < 0) {
      for (let index = probabilities.length - 1; index >= 0; index -= 1) {
        if (mask[index] === 1) {
          selected = index
          break
        }
      }
    }
  }
  if (selected < 0) throw new Error('ML bot policy failed to select a legal action')
  return {
    logProbability: Math.log(probabilities[selected]!),
    probabilities,
    selected,
  }
}

function validateObservation(observation: Float32Array): void {
  if (!(observation instanceof Float32Array) || observation.length !== ML_BOT_POLICY_OBSERVATION_NAMES.length) {
    throw new RangeError(`ML bot policy observation must contain ${ML_BOT_POLICY_OBSERVATION_NAMES.length} float32 values`)
  }
  for (let index = 0; index < observation.length; index += 1) {
    if (!Number.isFinite(observation[index])) {
      throw new RangeError(`ML bot policy observation ${index} is not finite`)
    }
  }
}
