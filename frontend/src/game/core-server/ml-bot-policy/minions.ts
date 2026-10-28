import type { NativeBeltSkillId } from '../../core-kernels/player-progression.ts'
import type {
  NativeSecondaryActorState,
  NativeSecondarySimulationState,
} from '../../core-kernels/native-secondary-abilities.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'

export interface MlBotPolicyMinionOptions {
  readonly playerId: string
  readonly position: Readonly<Vector2>
  readonly quickbar: readonly (NativeBeltSkillId | null)[]
  readonly worldKey: string
}

export interface MlBotPolicyMinionObservation {
  readonly blockS: Float32Array
  readonly ownTargetIds: ReadonlySet<number>
  readonly secondaryMinionActive: readonly boolean[]
}

type GolemActor = NativeSecondaryActorState & {
  readonly golem: NonNullable<NativeSecondaryActorState['golem']>
  readonly kind: 'golem'
}

export function observeMlBotPolicyMinions(
  secondaryAbilities: NativeSecondarySimulationState,
  options: MlBotPolicyMinionOptions,
): MlBotPolicyMinionObservation {
  const golems = secondaryAbilities.actors.filter((actor): actor is GolemActor => (
    actor.kind === 'golem'
    && actor.golem !== null
    && actor.worldKey === options.worldKey
  )).sort((left, right) => (
    Number(right.ownerId === options.playerId) - Number(left.ownerId === options.playerId)
    || distanceSquared(left.position, options.position) - distanceSquared(right.position, options.position)
    || left.id - right.id
  ))
  const blockS = new Float32Array(4 * 15 + 2)
  for (let slot = 0; slot < Math.min(4, golems.length); slot += 1) {
    const actor = golems[slot]!
    const start = slot * 15
    const relative = {
      x: actor.position.x - options.position.x,
      y: actor.position.y - options.position.y,
    }
    const direction = normalized(relative.x, relative.y)
    blockS[start] = 1
    blockS[start + 1] = Number(actor.ownerId === options.playerId)
    blockS[start + 2] = direction.x
    blockS[start + 3] = direction.y
    blockS[start + 4] = scaledUnsigned(Math.hypot(relative.x, relative.y), ML_BOT_POLICY_SCALES.range)
    blockS[start + 5] = ratio(actor.golem.currentHealth, actor.golem.maximumHealth)
    blockS[start + 6] = scaledUnsigned(actor.golem.maximumHealth, ML_BOT_POLICY_SCALES.hp)
    blockS[start + 7] = Number(actor.golem.iron)
    blockS[start + 8] = Number(actor.golem.phase === 'assembly')
    blockS[start + 9] = Number(actor.golem.phase === 'active')
    blockS[start + 10] = Number(actor.golem.phase === 'attack')
    blockS[start + 11] = Number(actor.golem.phase === 'provoke')
    blockS[start + 12] = Number(actor.targetId !== null)
    blockS[start + 13] = scaledUnsigned(actor.golem.reflectFactor, ML_BOT_POLICY_SCALES.multiplier)
    blockS[start + 14] = scaledUnsigned(
      actor.ageTicks / ML_BOT_POLICY_SCALES.tickRate,
      ML_BOT_POLICY_SCALES.minionAgeSeconds,
    )
  }
  const ownGolems = golems.filter(({ ownerId }) => ownerId === options.playerId)
  const allyGolems = golems.filter(({ ownerId }) => ownerId !== options.playerId)
  blockS[4 * 15] = Math.min(ownGolems.length, ML_BOT_POLICY_SCALES.minionCount)
    / ML_BOT_POLICY_SCALES.minionCount
  blockS[4 * 15 + 1] = Math.min(allyGolems.length, ML_BOT_POLICY_SCALES.minionCount)
    / ML_BOT_POLICY_SCALES.minionCount
  const ownTargetIds = new Set(ownGolems.flatMap(({ targetId }) => targetId === null ? [] : [targetId]))
  const secondaryMinionActive = Object.freeze(Array.from({ length: 8 }, (_, slot) => (
    ownGolems.some(({ skillId }) => skillId !== null && options.quickbar[slot] === skillId)
  )))
  return { blockS, ownTargetIds, secondaryMinionActive }
}

function distanceSquared(left: Readonly<Vector2>, right: Readonly<Vector2>): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
}

function normalized(x: number, y: number): Vector2 {
  const length = Math.hypot(x, y)
  return length > 1e-9 ? { x: x / length, y: y / length } : { x: 0, y: 0 }
}

function ratio(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0
}

function scaledUnsigned(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale))
}
