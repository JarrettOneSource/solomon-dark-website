import type { NativeDeadSpiderState } from '../core-kernels/native-dead-spider.ts'
import type { NativeSilkState } from '../core-kernels/native-silk.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'

export interface BoneyardSilkSnapshot {
  readonly id: number
  readonly ownerActorId: number
  readonly spawnTick: number
  readonly painterRegistration: NativeWorldManagerRegistration
  readonly state: NativeSilkState
}

export interface BoneyardSpiderRemainsSnapshot {
  readonly id: number
  readonly spawnTick: number
  readonly state: NativeDeadSpiderState
}
