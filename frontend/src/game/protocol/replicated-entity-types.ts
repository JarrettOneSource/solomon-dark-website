export type ReplicatedEntityKey = readonly [typeId: number, entityId: number]
export type ReplicatedEntityDescriptor = readonly [
  typeId: number,
  entityId: number,
  ...staticComponents: number[],
]
export type ReplicatedEntitySample = readonly [
  typeId: number,
  entityId: number,
  ...dynamicComponents: number[],
]

export interface ReplicatedEntityFrame {
  baselineSequence: number
  keyframe: boolean
  retired: readonly ReplicatedEntityKey[]
  samples: readonly ReplicatedEntitySample[]
  spawned: readonly ReplicatedEntityDescriptor[]
}
