import type { ActorPhysicsBody } from './actor-physics.ts'
import {
  HUB_PRIVATE_ROOM_IDS,
  HUB_PRIVATE_ROOM_LAYOUTS,
  type HubPrivateRoomLayoutDefinition,
} from './hub-private-room-layout.ts'
import {
  HUB_COLLEGE_INTRO_FADE_RATE,
  HUB_INCOMING_FADE_RATES,
  HUB_OUTGOING_FADE_RATE,
  beginHubTransition,
  hubIncomingPlacement,
  hubPortalAt,
  planHubScriptedMovement,
  type HubParticipantState,
  type HubRegionId,
} from './hub-regions.ts'
import {
  enterNativeCollegeDialogue,
  enterNativeCollegeOffice,
  nativeCollegeContactStep,
  nativeCollegeOfficeSpeed,
  nativeCollegePathTarget,
  stepNativeCollegeTitle,
} from './native-college-intro.ts'
import { NATIVE_HUB_NPC_CATALOG } from './native-hub-npc.ts'
import {
  PLAYER_CHARACTER_PHYSICS,
  type PlayerCharacterMovementPlan,
  type PlayerCharacterState,
} from './player-character.ts'
import type { Vector2 } from './vector.ts'

/**
 * Hub participant movement shared by the authoritative server tick and the
 * client's local prediction. The server and the client must pick the same
 * movement plan for a scripted participant (College walk, portal transition,
 * hold) and step the participant state the same way afterwards, otherwise the
 * prediction runs ahead of the server and the reconciliation correction drags
 * the presented sprite backwards for a few frames.
 */

export interface HubRegionPhysicsBody extends ActorPhysicsBody {
  region: HubRegionId
}

export type HubCollegePathTarget = ReturnType<typeof nativeCollegePathTarget>

export interface HubParticipantMovementPlan {
  /** Path target consumed by the College walk for this tick, if the intro walks. */
  readonly collegeTarget: HubCollegePathTarget | null
  /** Scripted plan, or null when ordinary input drives the participant. */
  readonly plan: PlayerCharacterMovementPlan | null
}

export interface HubParticipantStepOptions {
  readonly collegeIntroPending: boolean
  readonly collegeIntroWaiting: boolean
}

export interface HubParticipantStepResult {
  readonly participant: HubParticipantState
  readonly player: PlayerCharacterState
}

export function hubFixedActor(
  id: string,
  region: HubRegionId,
  x: number,
  y: number,
  radius: number,
): HubRegionPhysicsBody {
  return {
    delta: { x: 0, y: 0 },
    driven: false,
    id,
    position: { x, y },
    pushEnabled: false,
    pushResistance: 90,
    pushStrength: 0,
    radius,
    region,
  }
}

function privateRoomFixedActors(): readonly HubRegionPhysicsBody[] {
  const bodies: HubRegionPhysicsBody[] = []
  for (const region of HUB_PRIVATE_ROOM_IDS) {
    const layout: HubPrivateRoomLayoutDefinition = HUB_PRIVATE_ROOM_LAYOUTS[region]
    for (const [id, actor] of Object.entries(layout.actors)) {
      const { position, radius } = actor.collider
      bodies.push(hubFixedActor(id, region, position.x, position.y, radius))
    }
    for (const prop of layout.props) {
      const { position, radius } = prop.collider
      bodies.push(hubFixedActor(prop.id, region, position.x, position.y, radius))
    }
  }
  return bodies
}

export const HUB_FIXED_ACTOR_COLLISION_LAYOUT: readonly HubRegionPhysicsBody[] = [
  hubFixedActor('perk-witch', 'courtyard', 1340, 280, 15),
  hubFixedActor('potion-trader', 'courtyard', 1397, 664, 30),
  hubFixedActor('annalist', 'courtyard', 895.5, 455.5, 8),
  hubFixedActor('items-trader', 'courtyard', 1700.5, 449.5, 25),
  hubFixedActor('teacher', 'courtyard', 576.5, 710.5, 25),
  ...privateRoomFixedActors(),
]

/** The Office polisher only blocks players whose College admission is still pending. */
export const HUB_STORY_OFFICE_POLISHER_ACTOR: HubRegionPhysicsBody = hubFixedActor(
  'story-office-polisher',
  'office',
  566,
  735,
  15,
)

/**
 * True while the College intro exists but no authoritative tick has stepped it
 * yet: the server holds the walker until the client reports its renderer
 * ready, and the first stepped tick always advances the title cursor. A client
 * that only sees snapshots uses this to hold its prediction in step with the
 * server instead of walking ahead of it.
 */
export function hubCollegeIntroUnstarted(participant: Readonly<HubParticipantState>): boolean {
  const collegeIntro = participant.collegeIntro
  return collegeIntro !== null
    && collegeIntro.phase === 'courtyard-walk'
    && collegeIntro.titleCursor === 0
}

export function planHubParticipantMovement(
  player: PlayerCharacterState,
  participant: Readonly<HubParticipantState>,
  collegeIntroWaiting: boolean,
): HubParticipantMovementPlan {
  const transition = participant.transition
  const collegeIntro = participant.collegeIntro
  const collegeLoadoutWaiting = transition?.phase === 'college-loadout'
  const collegeDialogueWaiting = collegeIntro?.phase === 'arch-dialogue'
  const collegeWalk = collegeIntro !== null
    && collegeIntro.phase !== 'arch-dialogue'
    && transition?.phase !== 'outgoing'
  const collegeTarget = collegeWalk
    ? nativeCollegePathTarget(collegeIntro.phase, collegeIntro.pathCursor, player.position)
    : null
  if (collegeIntroWaiting || collegeLoadoutWaiting || collegeDialogueWaiting) {
    return { collegeTarget, plan: planHubScriptedMovement(player, player.position, 1) }
  }
  if (collegeTarget) {
    return {
      collegeTarget,
      plan: planHubScriptedMovement(
        player,
        collegeTarget.target,
        collegeIntro?.phase === 'office-walk' ? collegeIntro.officeSpeed : 1,
      ),
    }
  }
  if (transition) {
    return {
      collegeTarget,
      plan: planHubScriptedMovement(
        player,
        transition.scriptedTarget,
        transition.scriptedSpeed,
      ),
    }
  }
  return { collegeTarget, plan: null }
}

/**
 * Steps the participant after its movement committed for the tick: portal
 * contact, fades, the Office teleport and the College intro cursor, title,
 * Office entry and Archchancellor contact.
 */
export function stepHubParticipantMovement(
  participant: HubParticipantState,
  player: PlayerCharacterState,
  collegeTarget: HubCollegePathTarget | null,
  options: HubParticipantStepOptions,
): HubParticipantStepResult {
  if (options.collegeIntroWaiting) return { participant, player }
  let stepped = stepHubParticipantTransition(participant, player, options.collegeIntroPending)
  if (stepped.participant.collegeIntro === null) return stepped
  let collegeIntro = stepped.participant.collegeIntro
  if (collegeTarget && collegeIntro.phase !== 'arch-dialogue') {
    collegeIntro = {
      ...collegeIntro,
      officeSpeed: collegeIntro.phase === 'office-walk'
        ? nativeCollegeOfficeSpeed(collegeTarget.pathCursor, collegeIntro.officeSpeed)
        : collegeIntro.officeSpeed,
      pathCursor: collegeTarget.pathCursor,
    }
  }
  if (collegeIntro.phase === 'courtyard-walk') {
    collegeIntro = stepNativeCollegeTitle(collegeIntro)
  }
  if (participant.region === 'courtyard' && stepped.participant.region === 'office') {
    collegeIntro = enterNativeCollegeOffice(collegeIntro)
  }
  if (collegeIntro.phase === 'office-walk') {
    const targetPoint = collegeTarget?.target ?? player.position
    const eligible = nativeCollegeArchContactEligible(stepped.player.position, targetPoint)
    const contact = nativeCollegeContactStep(collegeIntro.contactCounter, eligible)
    collegeIntro = contact.activate
      ? enterNativeCollegeDialogue(collegeIntro)
      : { ...collegeIntro, contactCounter: contact.counter }
  }
  stepped = {
    ...stepped,
    participant: { ...stepped.participant, collegeIntro },
  }
  return stepped
}

export function stepHubParticipantTransition(
  participant: HubParticipantState,
  player: PlayerCharacterState,
  collegeIntroPending: boolean,
): HubParticipantStepResult {
  if (!participant.transition) {
    const portal = hubPortalAt(participant.region, player.position)
    return {
      participant: portal
        ? beginHubTransition(participant, portal, player.position)
        : participant,
      player,
    }
  }

  const transition = participant.transition
  if (transition.phase === 'college-intro') {
    const alpha = transition.alpha <= HUB_COLLEGE_INTRO_FADE_RATE
      ? 0
      : transition.alpha - HUB_COLLEGE_INTRO_FADE_RATE
    if (alpha > 0) {
      return {
        participant: {
          ...participant,
          transition: { ...transition, alpha },
        },
        player,
      }
    }
    return {
      participant: { ...participant, transition: null },
      player,
    }
  }
  if (transition.phase === 'college-loadout') return { participant, player }
  if (transition.phase === 'outgoing') {
    if (transition.alpha < 1) {
      const alpha = Math.min(1, transition.alpha + HUB_OUTGOING_FADE_RATE)
      return {
        participant: {
          ...participant,
          transition: { ...transition, alpha },
        },
        player,
      }
    }
    const incoming = hubIncomingPlacement(
      transition.sourceRegion,
      transition.destination,
    )
    return {
      participant: {
        collegeIntro: participant.collegeIntro,
        region: transition.destination,
        transition: {
          alpha: 1,
          destination: transition.destination,
          phase: collegeIntroPending
            && transition.sourceRegion === 'office'
            && transition.destination === 'courtyard'
            ? 'college-loadout'
            : 'incoming',
          scriptedSpeed: incoming.scriptedSpeed,
          scriptedTarget: incoming.scriptedTarget,
          sourceRegion: transition.sourceRegion,
        },
      },
      player: {
        ...player,
        position: incoming.position,
        velocity: { x: 0, y: 0 },
      },
    }
  }

  const fadeRate = HUB_INCOMING_FADE_RATES[participant.region]
  const targetReached = distanceSquared(player.position, transition.scriptedTarget) < 0.01
  const collegeOfficeWalk = participant.collegeIntro?.phase === 'office-walk'
  if (transition.alpha === 0 && (targetReached || collegeOfficeWalk)) {
    return {
      participant: { ...participant, transition: null },
      player,
    }
  }
  const alpha = Math.max(0, transition.alpha - fadeRate)
  return {
    participant: {
      ...participant,
      transition: { ...transition, alpha },
    },
    player,
  }
}

export function nativeCollegeArchContactEligible(
  position: Readonly<Vector2>,
  pathTarget: Readonly<Vector2>,
): boolean {
  const arch = NATIVE_HUB_NPC_CATALOG.storyOffice.interactions['arch-chancellor'].geometry
  const dx = arch.position.x - position.x
  const dy = arch.position.y - position.y
  const maximum = PLAYER_CHARACTER_PHYSICS.radius + arch.radius + 1
  if (dx * dx + dy * dy > maximum * maximum) return false
  const moveX = pathTarget.x - position.x
  const moveY = pathTarget.y - position.y
  const moveLength = Math.hypot(moveX, moveY)
  const targetLength = Math.hypot(dx, dy)
  if (moveLength === 0 || targetLength === 0) return false
  return (moveX * dx + moveY * dy) / (moveLength * targetLength) >= 0.7
}

function distanceSquared(first: Vector2, second: Vector2): number {
  const dx = first.x - second.x
  const dy = first.y - second.y
  return dx * dx + dy * dy
}
