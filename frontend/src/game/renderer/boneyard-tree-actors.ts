import type { Vec2 } from '../../editor/model.ts'
import type { BoneyardSceneryActorPoses } from '../client/boneyard-presentation-timeline.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'

/** The Maggot bit records native category/grid lifetime, independently of art state. */
export type NativeTreeActorPoses = BoneyardSceneryActorPoses

type EnemyPose = NativeTreeActorPoses['enemies'][number]
type NativeTreeActorSnapshot = {
  players: Readonly<Record<string, { position: Vec2 }>>
  world: {
    enemies: readonly (Pick<EnemyPose, 'id' | 'position' | 'enemyToken' | 'nativeTypeId'> & {
      animation: { state: EnemyPose['animationState']; coffinState: EnemyPose['coffinState'] }
    })[]
    maggots: NativeTreeActorPoses['maggots']
    encounter: NativeTreeActorPoses['encounter']
  }
}

/**
 * Tree::Tick 005F1C50 queries registered actors with (flags & 3) != 0 and bank 0.
 * Roots are borrowed read-only; camera, bounds and polygon tests belong to Tree.
 * No physical-body, health, art-visibility or distance proxy supplies membership.
 */
export function nativeTreeActorPositions(
  poses: NativeTreeActorPoses,
  localPlayerId: string,
): readonly Readonly<Vec2>[] {
  const positions: Readonly<Vec2>[] = []
  const primary = poses.players.find(({ id }) => id === localPlayerId)
  // Native primary death retains category/bank/cell until actual removal.
  if (primary) positions.push(primary.position)
  for (const enemy of poses.enemies) {
    if (nativeTreeEnemyMember(enemy)) positions.push(enemy.position)
  }
  for (const maggot of poses.maggots) {
    // Conversion, emergence and terminal art alone do not identify cell admission.
    if (maggot.nativeTreeQueryMember === true) positions.push(maggot.position)
  }
  // All six live Dig phases retain registration. The existing web 'gone'
  // disposition means renderer-absent; its timer is not native bounds deletion.
  if (poses.encounter && poses.encounter.phase !== 'gone') {
    positions.push(poses.encounter.position)
  }
  return positions
}

/** Use the same eligibility contract for the already sampled current frame. */
export function nativeTreeActorPositionsFromSnapshot(
  snapshot: NativeTreeActorSnapshot,
  localPlayerId: string,
): readonly Readonly<Vec2>[] {
  return nativeTreeActorPositions({
    players: Object.entries(snapshot.players).map(([id, player]) => ({ id, position: player.position })),
    enemies: snapshot.world.enemies.map((enemy) => ({
      id: enemy.id,
      position: enemy.position,
      enemyToken: enemy.enemyToken,
      nativeTypeId: enemy.nativeTypeId,
      animationState: enemy.animation.state,
      coffinState: enemy.animation.coffinState,
    })),
    maggots: snapshot.world.maggots,
    encounter: snapshot.world.encounter,
  }, localPlayerId)
}

function nativeTreeEnemyMember(enemy: EnemyPose): boolean {
  if (BONEYARD_WAVE_ENEMY_TYPES[enemy.enemyToken] !== enemy.nativeTypeId) return false
  // Accepted lethal damage clears category before the visual death callback.
  if (enemy.animationState === 'death') return false
  // Coffin's rise inserts the cell and sets category 2. Other Badguy types,
  // including physically non-colliding Wraith/Cocoon, already have that category.
  return enemy.enemyToken !== 'COFFIN' || enemy.coffinState !== 'hidden'
}
