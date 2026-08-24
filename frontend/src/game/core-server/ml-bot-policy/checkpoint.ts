import {
  ML_BOT_POLICY_ACTION_HEADS,
  ML_BOT_POLICY_ARCHITECTURE,
  ML_BOT_POLICY_MODEL_FORMAT,
  ML_BOT_POLICY_OBSERVATION_NAMES,
  ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
  ML_BOT_POLICY_SPEC,
} from './spec.ts'

export const ML_BOT_POLICY_TENSOR_SPECS = Object.freeze({
  ability_bias: [22],
  ability_weight: [22, 256],
  aim_bias: [9],
  aim_weight: [9, 256],
  choice_hidden_bias: [128],
  choice_hidden_weight: [128, 394],
  choice_score_bias: [1],
  choice_score_weight: [1, 128],
  choice_value_bias: [1],
  choice_value_weight: [1, 256],
  movement_bias: [9],
  movement_weight: [9, 256],
  target_bias: [9],
  target_weight: [9, 256],
  trunk_1_bias: [512],
  trunk_1_weight: [512, 3_026],
  trunk_2_bias: [256],
  trunk_2_weight: [256, 512],
  value_bias: [1],
  value_weight: [1, 256],
} as const)

export type MlBotPolicyTensorName = keyof typeof ML_BOT_POLICY_TENSOR_SPECS
export type MlBotPolicyTensors = Record<MlBotPolicyTensorName, Float32Array>

export interface MlBotPolicyCheckpointMetadata {
  readonly actionHeads: typeof ML_BOT_POLICY_ACTION_HEADS
  readonly architecture: string
  readonly choiceCoverage: Readonly<Record<string, number>>
  readonly choiceHiddenSize: number
  readonly choicePolicyMode?: 'learned' | 'scripted'
  readonly choiceTemperature: number
  readonly choiceTrajectoryVersion: number
  readonly hiddenSizes: readonly number[]
  readonly mainTrajectoryVersion: number
  readonly modelFormat: string
  readonly modelVersion: number
  readonly observationNames: readonly string[]
  readonly observationVersion: number
  readonly optionDescriptorNames: readonly string[]
  readonly primaryCurriculum: typeof ML_BOT_POLICY_SPEC.primaryCurriculum
  readonly seed: number
  readonly trainedEnvironmentSteps: number
  readonly trainedUpdates: number
}

export interface MlBotPolicyCheckpoint {
  readonly metadata: MlBotPolicyCheckpointMetadata
  readonly tensors: MlBotPolicyTensors
}

interface EncodedTensorDescriptor {
  readonly byteLength: number
  readonly byteOffset: number
  readonly name: MlBotPolicyTensorName
  readonly shape: readonly number[]
}

interface EncodedHeader {
  readonly metadata: MlBotPolicyCheckpointMetadata
  readonly tensors: readonly EncodedTensorDescriptor[]
}

const MAGIC = Uint8Array.from([0x53, 0x44, 0x4d, 0x4c, 0x56, 0x37, 0x00, 0x01])
const PREFIX_BYTES = MAGIC.length + 4

export function createZeroMlBotPolicyCheckpoint(seed: number): MlBotPolicyCheckpoint {
  requireUint32(seed, 'ML bot policy seed')
  const tensors = Object.fromEntries(Object.entries(ML_BOT_POLICY_TENSOR_SPECS).map(
    ([name, shape]) => [name, new Float32Array(elementCount(shape))],
  )) as MlBotPolicyTensors
  return {
    metadata: {
      actionHeads: ML_BOT_POLICY_ACTION_HEADS,
      architecture: ML_BOT_POLICY_ARCHITECTURE,
      choiceCoverage: Object.freeze({}),
      choiceHiddenSize: 128,
      choicePolicyMode: 'scripted',
      choiceTemperature: 1.25,
      choiceTrajectoryVersion: 7,
      hiddenSizes: Object.freeze([512, 256]),
      mainTrajectoryVersion: 7,
      modelFormat: ML_BOT_POLICY_MODEL_FORMAT,
      modelVersion: 7,
      observationNames: ML_BOT_POLICY_OBSERVATION_NAMES,
      observationVersion: 7,
      optionDescriptorNames: ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
      primaryCurriculum: ML_BOT_POLICY_SPEC.primaryCurriculum,
      seed,
      trainedEnvironmentSteps: 0,
      trainedUpdates: 0,
    },
    tensors,
  }
}

export function validateMlBotPolicyCheckpoint(checkpoint: MlBotPolicyCheckpoint): void {
  const { metadata, tensors } = checkpoint
  if (metadata.modelFormat !== ML_BOT_POLICY_MODEL_FORMAT) {
    throw new Error(`ML bot policy format must be ${ML_BOT_POLICY_MODEL_FORMAT}`)
  }
  if (metadata.architecture !== ML_BOT_POLICY_ARCHITECTURE) {
    throw new Error(`ML bot policy architecture must be ${ML_BOT_POLICY_ARCHITECTURE}`)
  }
  for (const [label, value] of [
    ['model', metadata.modelVersion],
    ['observation', metadata.observationVersion],
    ['main trajectory', metadata.mainTrajectoryVersion],
    ['choice trajectory', metadata.choiceTrajectoryVersion],
  ] as const) {
    if (value !== 7) throw new Error(`ML bot policy ${label} version 7 is required; legacy artifacts have no shim`)
  }
  requireNames(metadata.observationNames, ML_BOT_POLICY_OBSERVATION_NAMES, 'observation names')
  requireNames(
    metadata.optionDescriptorNames,
    ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
    'option descriptor names',
  )
  requireNames(metadata.hiddenSizes.map(String), ['512', '256'], 'hidden sizes')
  if (JSON.stringify(metadata.primaryCurriculum) !== JSON.stringify(ML_BOT_POLICY_SPEC.primaryCurriculum)) {
    throw new Error('ML bot policy primary curriculum does not match schema v7')
  }
  if (metadata.choiceHiddenSize !== 128) throw new Error('ML bot policy choice hidden size must be 128')
  for (const head of ['movement', 'target', 'ability', 'aim'] as const) {
    requireNames(metadata.actionHeads[head], ML_BOT_POLICY_ACTION_HEADS[head], `${head} actions`)
  }
  requireUint32(metadata.seed, 'ML bot policy seed')
  requireNonnegativeInteger(metadata.trainedEnvironmentSteps, 'trained environment steps')
  requireNonnegativeInteger(metadata.trainedUpdates, 'trained updates')
  if (!Number.isFinite(metadata.choiceTemperature) || metadata.choiceTemperature <= 0) {
    throw new Error('ML bot policy choice temperature must be positive and finite')
  }
  if (
    metadata.choicePolicyMode !== undefined
    && metadata.choicePolicyMode !== 'learned'
    && metadata.choicePolicyMode !== 'scripted'
  ) throw new Error('ML bot policy choice mode must be learned or scripted')
  for (const [key, value] of Object.entries(metadata.choiceCoverage)) {
    if (key.length === 0) throw new Error('ML bot policy choice coverage keys must not be empty')
    requireNonnegativeInteger(value, `choice coverage ${key}`)
  }
  const expectedNames = Object.keys(ML_BOT_POLICY_TENSOR_SPECS).sort()
  const actualNames = Object.keys(tensors).sort()
  requireNames(actualNames, expectedNames, 'tensor names')
  for (const name of expectedNames as MlBotPolicyTensorName[]) {
    const tensor = tensors[name]
    const expectedLength = elementCount(ML_BOT_POLICY_TENSOR_SPECS[name])
    if (!(tensor instanceof Float32Array) || tensor.length !== expectedLength) {
      throw new Error(`ML bot policy tensor ${name} must contain ${expectedLength} float32 values`)
    }
    for (let index = 0; index < tensor.length; index += 1) {
      if (!Number.isFinite(tensor[index])) {
        throw new Error(`ML bot policy tensor ${name}[${index}] is not finite`)
      }
    }
  }
}

export function encodeMlBotPolicyCheckpoint(checkpoint: MlBotPolicyCheckpoint): Uint8Array {
  validateMlBotPolicyCheckpoint(checkpoint)
  const tensorNames = Object.keys(ML_BOT_POLICY_TENSOR_SPECS).sort() as MlBotPolicyTensorName[]
  let byteOffset = 0
  const descriptors = tensorNames.map((name): EncodedTensorDescriptor => {
    const byteLength = checkpoint.tensors[name].byteLength
    const descriptor = {
      byteLength,
      byteOffset,
      name,
      shape: ML_BOT_POLICY_TENSOR_SPECS[name],
    }
    byteOffset += byteLength
    return descriptor
  })
  const header: EncodedHeader = { metadata: checkpoint.metadata, tensors: descriptors }
  const headerBytes = new TextEncoder().encode(JSON.stringify(header))
  const encoded = new Uint8Array(PREFIX_BYTES + headerBytes.length + byteOffset)
  encoded.set(MAGIC, 0)
  new DataView(encoded.buffer).setUint32(MAGIC.length, headerBytes.length, true)
  encoded.set(headerBytes, PREFIX_BYTES)
  const view = new DataView(encoded.buffer)
  const payloadStart = PREFIX_BYTES + headerBytes.length
  for (const descriptor of descriptors) {
    const tensor = checkpoint.tensors[descriptor.name]
    for (let index = 0; index < tensor.length; index += 1) {
      view.setFloat32(payloadStart + descriptor.byteOffset + index * 4, tensor[index]!, true)
    }
  }
  return encoded
}

export function decodeMlBotPolicyCheckpoint(encoded: Uint8Array): MlBotPolicyCheckpoint {
  if (encoded.length < PREFIX_BYTES || MAGIC.some((value, index) => encoded[index] !== value)) {
    throw new Error('ML bot policy checkpoint magic is invalid')
  }
  const source = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength)
  const headerLength = source.getUint32(MAGIC.length, true)
  const payloadStart = PREFIX_BYTES + headerLength
  if (payloadStart > encoded.length) throw new Error('ML bot policy checkpoint header is truncated')
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(encoded.subarray(PREFIX_BYTES, payloadStart)))
  } catch {
    throw new Error('ML bot policy checkpoint header is invalid JSON')
  }
  const header = parseHeader(parsed)
  const tensors = {} as MlBotPolicyTensors
  for (const descriptor of header.tensors) {
    const expectedShape = ML_BOT_POLICY_TENSOR_SPECS[descriptor.name]
    if (!expectedShape) throw new Error(`ML bot policy checkpoint tensor ${descriptor.name} is unknown`)
    requireNames(descriptor.shape.map(String), expectedShape.map(String), `${descriptor.name} shape`)
    const expectedByteLength = elementCount(expectedShape) * 4
    if (descriptor.byteLength !== expectedByteLength) {
      throw new Error(`ML bot policy checkpoint tensor ${descriptor.name} byte length is invalid`)
    }
    const start = payloadStart + descriptor.byteOffset
    const end = start + descriptor.byteLength
    if (start < payloadStart || end > encoded.length) {
      throw new Error(`ML bot policy checkpoint tensor ${descriptor.name} is truncated`)
    }
    const tensor = new Float32Array(expectedByteLength / 4)
    for (let index = 0; index < tensor.length; index += 1) {
      tensor[index] = source.getFloat32(start + index * 4, true)
    }
    tensors[descriptor.name] = tensor
  }
  if (payloadStart + header.tensors.reduce((maximum, descriptor) => (
    Math.max(maximum, descriptor.byteOffset + descriptor.byteLength)
  ), 0) !== encoded.length) {
    throw new Error('ML bot policy checkpoint contains trailing or overlapping payload data')
  }
  const checkpoint = { metadata: header.metadata, tensors }
  validateMlBotPolicyCheckpoint(checkpoint)
  return checkpoint
}

function parseHeader(value: unknown): EncodedHeader {
  if (value === null || typeof value !== 'object') throw new Error('ML bot policy checkpoint header must be an object')
  const source = value as Record<string, unknown>
  if (source.metadata === null || typeof source.metadata !== 'object' || !Array.isArray(source.tensors)) {
    throw new Error('ML bot policy checkpoint header is incomplete')
  }
  const names = new Set<string>()
  const tensors = source.tensors.map((entry): EncodedTensorDescriptor => {
    if (entry === null || typeof entry !== 'object') throw new Error('ML bot policy tensor descriptor must be an object')
    const row = entry as Record<string, unknown>
    const name = String(row.name) as MlBotPolicyTensorName
    if (names.has(name)) throw new Error(`ML bot policy tensor ${name} is duplicated`)
    names.add(name)
    if (
      !Number.isSafeInteger(row.byteLength)
      || !Number.isSafeInteger(row.byteOffset)
      || Number(row.byteLength) < 0
      || Number(row.byteOffset) < 0
      || !Array.isArray(row.shape)
      || row.shape.some((dimension) => !Number.isSafeInteger(dimension) || Number(dimension) < 1)
    ) throw new Error(`ML bot policy tensor ${name} descriptor is invalid`)
    return {
      byteLength: Number(row.byteLength),
      byteOffset: Number(row.byteOffset),
      name,
      shape: row.shape.map(Number),
    }
  })
  return {
    metadata: source.metadata as unknown as MlBotPolicyCheckpointMetadata,
    tensors,
  }
}

function elementCount(shape: readonly number[]): number {
  return shape.reduce((product, dimension) => product * dimension, 1)
}

function requireNames(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`ML bot policy ${label} do not match schema v7`)
  }
}

function requireUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error(`${label} must be a uint32`)
  }
}

function requireNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`ML bot policy ${label} must be a nonnegative integer`)
}
