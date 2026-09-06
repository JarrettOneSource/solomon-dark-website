import { nativeBoneyardFencePosts } from '../core-kernels/boneyard-fence-posts.ts'
import { createBoneyardArenaTransition } from '../core-kernels/boneyard-arena-transition.ts'
import {
  NATIVE_SOLOMON_NAVIGATION_CLEARANCE,
  createSolomonEncounter,
} from '../core-kernels/boneyard-encounter.ts'
import { createBoneyardGateLeaves } from '../core-kernels/boneyard-gate.ts'
import { createBoneyardWaveDirector } from '../core-kernels/boneyard-wave-director.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { createNativeEnemyWorldFeedbackState } from '../core-kernels/native-enemy-world-feedback.ts'
import {
  STOCK_TUTORIAL_BONEYARD_ID,
  createNativeTutorialState,
  nativeTutorialDialogueTicks,
} from '../core-kernels/native-tutorial.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import { createBoneyardCollisionWorld } from './boneyard-collision.ts'
import {
  NATIVE_BADGUY_NAVIGATION_CLEARANCE,
  NATIVE_DEMON_NAVIGATION_CLEARANCE,
  boneyardNavigationMeshIsPrepared,
  prepareBoneyardNavigationMesh,
} from './boneyard-enemy-navigation.ts'
import { createBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import { createBoneyardLootStore } from './boneyard-loot-store.ts'
import { createBoneyardSceneryTargets, solomonEscapeTraversalBounds } from './boneyard-world-placement.ts'
import type {
  BoneyardWorldNavigationPreparation,
  BoneyardWorldState,
} from './boneyard-world-state.ts'

export function createBoneyardWorld(
  loaded: LoadedBoneyard,
  lanternLightRegistration: NativeWorldManagerRegistration | null = null,
  solomonPainterRegistration: NativeWorldManagerRegistration | null = null,
): BoneyardWorldState {
  const tutorial = loaded.choice.id === STOCK_TUTORIAL_BONEYARD_ID
  const ownsRetailEncounter = loaded.choice.source === 'default'
    && loaded.scene.solomonDig !== null
    && !tutorial
  const ownsSolomonEncounter = loaded.choice.source === 'default'
    && loaded.scene.solomonDig !== null
  return {
    arenaTransition: ownsRetailEncounter
      ? createBoneyardArenaTransition(loaded.scene.bounds, loaded.scene.spawn)
      : null,
    bounds: { ...loaded.scene.bounds },
    collision: createBoneyardCollisionWorld(loaded.scene),
    ...createBoneyardSceneryTargets(loaded.scene),
    encounter: ownsSolomonEncounter
      ? createSolomonEncounter(loaded.scene.solomonDig!, loaded.seed, tutorial
          ? { dialogueMode: 'tutorial', tutorialDialogueTicks: nativeTutorialDialogueTicks() }
          : undefined)
      : null,
    enemies: createBoneyardEnemyStore(loaded.seed, loaded.scene.objects.length + nativeBoneyardFencePosts(loaded.scene.fences).length),
    enemyWorldFeedback: createNativeEnemyWorldFeedbackState(),
    enemyEvents: [],
    gateLeaves: createBoneyardGateLeaves(loaded.scene.fences, loaded.seed),
    kind: 'boneyard',
    lanternLightRegistration,
    lanternPosition: loaded.scene.solomonDig === null
      ? null
      : Object.freeze({ ...loaded.scene.solomonDig.lanternPosition }),
    hallOfFameRuns: {},
    loot: createBoneyardLootStore(
      loaded.seed,
      loaded.scene.objects.flatMap((object, sceneryRegistrationOrdinal) => (
        object.typeId === 2061 ? [{
          eid: object.eid,
          position: Object.freeze({ ...object.pos }),
          sceneryRegistrationOrdinal,
          subtype: 0,
        }] : []
      )),
    ),
    lootEvents: [],
    playerOuchDeadlineTick: 0,
    runId: loaded.runId,
    solomonPainterRegistration,
    spawn: { ...loaded.scene.spawn },
    tutorial: tutorial
      ? createNativeTutorialState(loaded.scene.spawn, 0, loaded.seed)
      : null,
    tutorialProfileEconomy: null,
    waves: ownsRetailEncounter
      ? createBoneyardWaveDirector(loaded.seed, undefined, {
          sourceSha256: loaded.sourceSha256,
        })
      : null,
  }
}

export function boneyardWorldNavigationPreparations(
  world: BoneyardWorldState,
): readonly BoneyardWorldNavigationPreparation[] {
  const hostileBounds = world.arenaTransition?.combatBounds ?? world.bounds
  const preparations: BoneyardWorldNavigationPreparation[] = [
    { bounds: hostileBounds, clearance: NATIVE_BADGUY_NAVIGATION_CLEARANCE },
    { bounds: hostileBounds, clearance: NATIVE_DEMON_NAVIGATION_CLEARANCE },
  ]
  if (world.encounter !== null) {
    preparations.push({
      bounds: solomonEscapeTraversalBounds(world.bounds),
      clearance: NATIVE_SOLOMON_NAVIGATION_CLEARANCE,
    })
  }
  return Object.freeze(preparations)
}

export function boneyardWorldNavigationIsPrepared(world: BoneyardWorldState): boolean {
  return boneyardWorldNavigationPreparations(world).every(({ bounds, clearance }) => (
    boneyardNavigationMeshIsPrepared(bounds, world.collision, clearance)
  ))
}

export function prepareBoneyardWorldNavigation(world: BoneyardWorldState): void {
  for (const { bounds, clearance } of boneyardWorldNavigationPreparations(world)) {
    prepareBoneyardNavigationMesh(bounds, world.collision, clearance)
  }
}
