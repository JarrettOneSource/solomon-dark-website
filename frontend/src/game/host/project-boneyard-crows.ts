import {
  nativeEighteenWayFacingBucket,
} from '../core-kernels/boneyard-mage-lightning.ts'
import type {
  NativeCrowState,
} from '../core-kernels/native-crow.ts'
import {
  type BoneyardEnemyStore,
} from '../core-server/enemies/model.ts'
import type {
  BoneyardEnemyDeathEffectSnapshot,
} from '../protocol/game-state.ts'

export function projectBoneyardCrows(store: BoneyardEnemyStore): BoneyardEnemyDeathEffectSnapshot[] {
  const crows: BoneyardEnemyDeathEffectSnapshot[] = []
  for (const actor of store.actors) {
    if (actor.brain.family !== 'heartmonger') continue
    for (const crow of actor.brain.crows) {
      if (crow.position !== null) crows.push(projectCrow(crow, actor.id, actor.spawnTick))
    }
  }
  for (const crow of store.detachedCrows) {
    crows.push(projectCrow(crow.flight, crow.ownerActorId, crow.spawnTick))
  }
  return crows
}

function projectCrow(crow: NativeCrowState, ownerActorId: number, spawnTick: number): BoneyardEnemyDeathEffectSnapshot {
  const channel = Math.round(Math.min(1, Math.max(0, crow.lightIntensity)) * 255)
  return {
    ageTicks: crow.age,
    alpha: 1,
    atlas: 'Heartmonger',
    blendMode: 'normal',
    entry: 2 + Math.trunc(crow.flapPhase) * 18 + nativeEighteenWayFacingBucket(crow.headingDeg),
    height: -crow.height,
    id: crow.id,
    kind: 'crow',
    ownerActorId,
    painterRegistration: null,
    position: { ...crow.position! },
    presentationOwner: 'direct-post-world',
    rotationRadians: 0,
    scale: 1,
    scaleY: 1,
    shadow: false,
    spawnTick,
    tint: channel * 0x010101,
  }
}
