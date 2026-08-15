import {
  actorHeadingFromVector,
  actorHeadingIndex,
} from './actor-heading.ts'
import {
  playerPrimaryCastOwnsFacing,
  type PlayerCharacterInput,
  type PlayerCharacterState,
  type PlayerPrimaryCastState,
  type WizardElement,
} from './player-character.ts'
import type { NativePrimarySkillRankStats } from './player-progression.ts'
import {
  WATER_FROST_PARTICLES_PER_TICK,
  WATER_FROST_UNDERPOWERED_PARTICLES_PER_TICK,
  waterFrostJetEmission,
  waterFrostJetLifetimeTicks,
  waterFrostJetObstruction,
} from './primary-spell-water.ts'
import {
  earthImpactLifetimeTicks,
  earthVisualRandomInt,
  earthVisualUnitRandom,
} from './primary-spell-earth.ts'
import {
  EARTH_BOULDER_IDENTITY_ORIENTATION,
  earthBoulderFlightOrientationStep,
  earthBoulderHeldOrientationStep,
  type EarthBoulderOrientation,
} from './primary-spell-earth-orientation.ts'
import type { Vector2 } from './vector.ts'
import {
  NATIVE_FIRE_IMPACT_LIFETIME_TICKS,
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from './primary-spell-fire-native.ts'
import { NATIVE_ETHER_IMPACT_VISIBLE_TICKS } from './primary-spell-ether-native.ts'
import {
  AIR_PRIMARY_TARGET_Y_OFFSET,
  ETHER_PRIMARY_INITIAL_TURN,
  NATIVE_PRIMARY_HOSTILE_FLAG,
  airPrimaryBoltGeometry,
  advanceEtherPrimaryHoming,
  nativePrimaryTargetEligible,
  selectAirPrimaryTarget,
  selectEtherPrimaryTarget,
  type PrimarySpellTarget,
} from './primary-spell-targeting.ts'
import {
  createNativeLightProviderOrder,
  type NativeLightProviderRegistration,
  type RegisterNativeLightProvider,
} from './native-light-provider-order.ts'

export type PrimarySpellProjectileKind = 'earth' | 'ether' | 'fire'
export type PrimarySpellTransientKind =
  | 'air'
  | 'earth-called-rock'
  | 'earth-impact'
  | 'ether-impact'
  | 'fire'
  | 'fire-impact'
  | 'water'
export type PrimarySpellProjectilePhase = 'flight' | 'held'

interface PrimarySpellProjectileBaseState {
  ageTicks: number
  charge: number
  damage: number
  direction: Vector2
  flightTicks: number
  id: number
  lightRegistration: NativeLightProviderRegistration
  ownerId: string
  phase: PrimarySpellProjectilePhase
  position: Vector2
  velocity: Vector2
  worldKey: string
}

export interface PrimarySpellEarthProjectileState extends PrimarySpellProjectileBaseState {
  assemblyCharge: number
  hitTargetIds: readonly string[]
  kind: 'earth'
  orientation: EarthBoulderOrientation
}

export interface PrimarySpellEtherProjectileState extends PrimarySpellProjectileBaseState {
  headingDegrees: number
  kind: 'ether'
  targetId: string | null
  turnAccumulator: number
  underpowered: boolean
}

export interface PrimarySpellFireProjectileState extends PrimarySpellProjectileBaseState {
  kind: 'fire'
  underpowered: boolean
}

export type PrimarySpellProjectileState =
  | PrimarySpellEarthProjectileState
  | PrimarySpellEtherProjectileState
  | PrimarySpellFireProjectileState

interface PrimarySpellChannelTransientBase {
  ageTicks: number
  direction: Vector2
  id: number
  lightRegistration: NativeLightProviderRegistration | null
  origin: Vector2
  ownerId: string
  underpowered: boolean
  variant: number
  worldKey: string
}

export interface PrimarySpellAirTransientState extends PrimarySpellChannelTransientBase {
  birthTick: number
  endpoint: Vector2
  kind: 'air'
  lightRegistration: NativeLightProviderRegistration
  midpoint: Vector2
  targetId: string | null
}

export interface PrimarySpellWaterTransientState extends PrimarySpellChannelTransientBase {
  kind: 'water'
  lightRegistration: null
  obstructionDistance: number | null
  obstructionPoint: Vector2 | null
}

export type PrimarySpellChannelTransientState =
  | PrimarySpellAirTransientState
  | PrimarySpellWaterTransientState

export interface PrimarySpellChannelEmission {
  damage: number
  direction: Vector2
  id: number
  kind: 'air' | 'water'
  manaCost: number
  origin: Vector2
  ownerId: string
  queryOrigin: Vector2
  underpowered: boolean
  worldKey: string
}

export interface PrimarySpellEarthImpactState {
  ageTicks: number
  birthTick: number
  charge: number
  id: number
  kind: 'earth-impact'
  lightRegistration: null
  lifetimeTicks: number
  origin: Vector2
  ownerId: string
  worldKey: string
}

export interface PrimarySpellEarthCalledRockState {
  ageTicks: number
  fallVelocity: number
  falling: boolean
  height: number
  id: number
  kind: 'earth-called-rock'
  lightRegistration: null
  lateralMagnitude: number
  ownerId: string
  parentId: number
  position: Vector2
  rotation: number
  rotationStep: number
  scale: number
  speed: number
  targetHeight: number
  variant: number
  worldKey: string
}

export interface PrimarySpellFireParticleState {
  ageTicks: number
  direction: Vector2
  id: number
  kind: 'fire'
  lightRegistration: null
  origin: Vector2
  ownerId: string
  variant: number
  worldKey: string
}

export interface PrimarySpellEtherImpactState {
  ageTicks: number
  birthTick: number
  id: number
  kind: 'ether-impact'
  lightRegistration: NativeLightProviderRegistration
  origin: Vector2
  ownerId: string
  worldKey: string
}

export interface PrimarySpellFireImpactState {
  ageTicks: number
  id: number
  kind: 'fire-impact'
  lightRegistration: NativeLightProviderRegistration
  origin: Vector2
  ownerId: string
  worldKey: string
}

export type PrimarySpellTransientState =
  | PrimarySpellChannelTransientState
  | PrimarySpellEarthCalledRockState
  | PrimarySpellEarthImpactState
  | PrimarySpellEtherImpactState
  | PrimarySpellFireImpactState
  | PrimarySpellFireParticleState

export interface PrimarySpellSimulationState {
  nextId: number
  projectiles: readonly PrimarySpellProjectileState[]
  transients: readonly PrimarySpellTransientState[]
}

export interface PrimarySpellCastAuthority {
  availableMana: number
  eligible: boolean
  primarySkill: NativePrimarySkillRankStats
}

export interface PrimarySpellTickContext {
  canPlaceProjectile: (
    spell: PrimarySpellProjectileState,
    position: Vector2,
    radius: number,
  ) => boolean
  canTraverseProjectile: (
    spell: PrimarySpellProjectileState,
    from: Vector2,
    to: Vector2,
  ) => boolean
  castAuthority: Readonly<Record<string, PrimarySpellCastAuthority>>
  inputs: Readonly<Record<string, PlayerCharacterInput>>
  players: Readonly<Record<string, PlayerCharacterState>>
  previousPlayers: Readonly<Record<string, PlayerCharacterState>>
  registerLightProvider?: RegisterNativeLightProvider
  spells: PrimarySpellSimulationState
  tick: number
  viewScale: number
  spellObstructionPoint: (
    ownerId: string,
    start: Vector2,
    end: Vector2,
    excludedSourceId?: string,
  ) => Vector2 | null
  spellRangeEndpoint: (
    ownerId: string,
    start: Vector2,
    direction: Vector2,
  ) => Vector2
  spellTargets: (ownerId: string) => readonly PrimarySpellTarget[]
  worldKeyForPlayer: (playerId: string) => string
}

export interface PrimarySpellTickResult {
  channelEmissions: readonly PrimarySpellChannelEmission[]
  manaSpent: Readonly<Record<string, number>>
  players: Readonly<Record<string, PlayerCharacterState>>
  spells: PrimarySpellSimulationState
}

export const PRIMARY_CAST_ACTION_END_TICK = 74
export const PRIMARY_CAST_EMISSION_TICK = 19
export const PRIMARY_CAST_ETHER_ACTION_END_TICK = 56
export const PRIMARY_CAST_ETHER_EMISSION_TICK = 15
export const PRIMARY_SPELL_AIR_REACH = 205
export const PRIMARY_SPELL_AIR_LIFETIME_TICKS = 5
export const PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS = 3
export const PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS = NATIVE_ETHER_IMPACT_VISIBLE_TICKS
export const PRIMARY_SPELL_WATER_REACH = 205
export const PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS = NATIVE_FIRE_IMPACT_LIFETIME_TICKS
export const PRIMARY_SPELL_ETHER_COLLISION_RADIUS = 6
export const PRIMARY_SPELL_FIRE_COLLISION_RADIUS = 20
export const PRIMARY_SPELL_EARTH_INITIAL_CHARGE = Math.fround(0.18)
export const PRIMARY_SPELL_EARTH_CHARGE_STEP = Math.fround(0.00125)
export const PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE = Math.fround(0.3)
export const PRIMARY_SPELL_EARTH_RELEASE_COLLISION_RADIUS_SCALE = 45
export const PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE = 75
export const PRIMARY_SPELL_EARTH_CALLED_ROCK_INITIAL_SPEED = Math.fround(0.1)
export const PRIMARY_SPELL_EARTH_CALLED_ROCK_SPEED_MULTIPLIER = 1.100000023841858
export const PRIMARY_SPELL_EARTH_CALLED_ROCK_SPEED_CAP = 5
export const PRIMARY_SPELL_EARTH_CALLED_ROCK_REMOVE_DISTANCE = 5
export const PRIMARY_SPELL_EARTH_FIRST_TICK_CHARGE = Math.fround(
  PRIMARY_SPELL_EARTH_INITIAL_CHARGE + PRIMARY_SPELL_EARTH_CHARGE_STEP,
)
export const PRIMARY_SPELL_ETHER_UNDERPOWERED_SPEED = Math.fround(2.4)
export const PRIMARY_SPELL_ETHER_UNDERPOWERED_TURN_INPUT = Math.fround(1.2)
export const PRIMARY_SPELL_TICKS_PER_SECOND = 100
export const PRIMARY_SPELL_RANK_ONE_MANA_COSTS = {
  air: 0.12,
  earth: 0.12,
  ether: 6,
  fire: 12,
  water: 0.125,
} as const satisfies Readonly<Record<WizardElement, number>>

const PRIMARY_SKILL_ID_BY_ELEMENT = {
  air: 24,
  earth: 40,
  ether: 8,
  fire: 16,
  water: 32,
} as const satisfies Readonly<Record<WizardElement, number>>

const STAFF_PRIMARY_EMITTER_OFFSETS: Readonly<Record<0 | 1 | 7 | 8, readonly Vector2[]>> = {
  0: [
    { x: -32.5, y: -66.5 }, { x: -21.5, y: -72.5 },
    { x: -9, y: -76.5 }, { x: 4.5, y: -76.5 },
    { x: 17, y: -74.5 }, { x: 28.5, y: -69.5 },
    { x: 38.5, y: -61.5 }, { x: 45.5, y: -52.5 },
    { x: 49.5, y: -41.5 }, { x: 50.5, y: -30.5 },
    { x: 47.5, y: -19.5 }, { x: 41.5, y: -9.5 },
    { x: 32.5, y: -1.5 }, { x: 21.5, y: 4.5 },
    { x: 9, y: 8.5 }, { x: -4.5, y: 8.5 },
    { x: -17, y: 6.5 }, { x: -28.5, y: 1.5 },
    { x: -38.5, y: -6.5 }, { x: -45.5, y: -15.5 },
    { x: -49.5, y: -26.5 }, { x: -50.5, y: -37.5 },
    { x: -47.5, y: -48.5 }, { x: -41.5, y: -58.5 },
  ],
  1: [
    { x: -41.5, y: 3.5 }, { x: -51.5, y: -7 },
    { x: -58.5, y: -19.5 }, { x: -60.5, y: -32.5 },
    { x: -59.5, y: -46 }, { x: -53.5, y: -58.5 },
    { x: -44, y: -69.5 }, { x: -31.5, y: -78 },
    { x: -17.5, y: -82 }, { x: -1.5, y: -83 },
    { x: 14.5, y: -82.5 }, { x: 29, y: -79.5 },
    { x: 41.5, y: -71.5 }, { x: 51.5, y: -61 },
    { x: 58.5, y: -48.5 }, { x: 60.5, y: -35.5 },
    { x: 59.5, y: -22 }, { x: 53.5, y: -9.5 },
    { x: 44.5, y: 1.5 }, { x: 31.5, y: 10 },
    { x: 17.5, y: 15.5 }, { x: 1.5, y: 17.5 },
    { x: -14.5, y: 16.5 }, { x: -29, y: 11.5 },
  ],
  7: [
    { x: 8.5, y: -56 }, { x: 20, y: -52.5 },
    { x: 30, y: -47.5 }, { x: 38.5, y: -39.5 },
    { x: 43.5, y: -30.5 }, { x: 46, y: -20.5 },
    { x: 45.5, y: -10 }, { x: 41.5, y: -0.5 },
    { x: 35.5, y: 8.5 }, { x: 26.5, y: 15 },
    { x: 15.5, y: 19.5 }, { x: 3.5, y: 21.5 },
    { x: -8.5, y: 21.5 }, { x: -20, y: 18 },
    { x: -30, y: 12.5 }, { x: -38.5, y: 4.5 },
    { x: -43.5, y: -4.5 }, { x: -46.5, y: -14.5 },
    { x: -45.5, y: -24.5 }, { x: -41.5, y: -34.5 },
    { x: -35.5, y: -43 }, { x: -26.5, y: -49.5 },
    { x: -15.5, y: -54.5 }, { x: -3.5, y: -56.5 },
  ],
  8: [
    { x: 8.5, y: -47.5 }, { x: 17.5, y: -45 },
    { x: 25.5, y: -40 }, { x: 31.5, y: -33.5 },
    { x: 35.5, y: -26.5 }, { x: 37, y: -18.5 },
    { x: 36, y: -10.5 }, { x: 32.5, y: -2.5 },
    { x: 26.5, y: 4.5 }, { x: 19.5, y: 9.5 },
    { x: 10.5, y: 12.5 }, { x: 1, y: 14 },
    { x: -8.5, y: 13 }, { x: -17.5, y: 10.5 },
    { x: -25.5, y: 5.5 }, { x: -31.5, y: -1 },
    { x: -35.5, y: -8.5 }, { x: -37, y: -16.5 },
    { x: -36, y: -24.5 }, { x: -32.5, y: -32.5 },
    { x: -26.5, y: -38.5 }, { x: -19.5, y: -44 },
    { x: -10.5, y: -47.5 }, { x: -1, y: -48.5 },
  ],
}

export function createPrimarySpellSimulation(): PrimarySpellSimulationState {
  return { nextId: 1, projectiles: [], transients: [] }
}

function standalonePrimaryLightProviderOrderState(source: PrimarySpellSimulationState) {
  const nextRegistrationOrdinal = { actor: 0, transient: 0 }
  for (const registration of [
    ...source.projectiles.map(({ lightRegistration }) => lightRegistration),
    ...source.transients.map(({ lightRegistration }) => lightRegistration),
  ]) {
    if (registration === null) continue
    nextRegistrationOrdinal[registration.managerLane] = Math.max(
      nextRegistrationOrdinal[registration.managerLane],
      registration.registrationOrdinal + 1,
    )
  }
  return { nextRegistrationOrdinal }
}

export function primaryCastPose(
  actionTick: number,
  channelActive = false,
  element: WizardElement = 'fire',
): 0 | 1 | 7 | 8 {
  if (channelActive) return actionTick <= 0 ? 0 : 7
  const actionEndTick = primaryCastActionEndTick(element)
  const emissionTick = primaryCastEmissionTick(element)
  const recoveryTick = element === 'ether' ? 28 : 37
  if (actionTick < 2 || actionTick >= actionEndTick) return 0
  if (actionTick < emissionTick) return 1
  if (actionTick < recoveryTick) return 8
  return 7
}

export function primaryCastActionEndTick(element: WizardElement): number {
  return element === 'ether'
    ? PRIMARY_CAST_ETHER_ACTION_END_TICK
    : PRIMARY_CAST_ACTION_END_TICK
}

export function primaryCastEmissionTick(element: WizardElement): number {
  return element === 'ether'
    ? PRIMARY_CAST_ETHER_EMISSION_TICK
    : PRIMARY_CAST_EMISSION_TICK
}

export function primarySpellEmitter(
  player: Pick<PlayerCharacterState, 'config' | 'headingIndex' | 'position' | 'primaryCast'>,
): Vector2 {
  const offset = primarySpellEmitterOffset(
    player.headingIndex,
    player.primaryCast.actionTick,
    player.primaryCast.channelActive,
    player.config.element,
  )
  return {
    x: player.position.x + offset.x,
    y: player.position.y + offset.y,
  }
}

export function primarySpellEmitterOffset(
  headingIndex: number,
  actionTick: number,
  channelActive = false,
  element: WizardElement = 'fire',
): Vector2 {
  const pose = primaryCastPose(actionTick, channelActive, element)
  const facing = ((Math.round(headingIndex) % 24) + 24) % 24
  return STAFF_PRIMARY_EMITTER_OFFSETS[pose][facing]
}

export function stepPrimarySpells(context: PrimarySpellTickContext): PrimarySpellTickResult {
  const standaloneLightProviderOrder = createNativeLightProviderOrder(
    standalonePrimaryLightProviderOrderState(context.spells),
  )
  const registerLightProvider = context.registerLightProvider
    ?? standaloneLightProviderOrder.register
  let nextId = context.spells.nextId
  const existingCalledRockIds = new Set(context.spells.transients
    .filter((effect) => effect.kind === 'earth-called-rock')
    .map((effect) => effect.id))
  let transients: PrimarySpellTransientState[] = []
  for (const effect of context.spells.transients) {
    if (effect.kind === 'earth-called-rock') {
      transients.push(effect)
    } else if (effect.ageTicks + 1 < transientLifetime(effect)) {
      transients.push({ ...effect, ageTicks: effect.ageTicks + 1 })
    }
  }
  let projectiles: PrimarySpellProjectileState[] = []
  for (const spell of context.spells.projectiles) {
    if (spell.phase === 'held') {
      projectiles.push(advanceProjectile(spell, []))
      continue
    }
    if (
      (spell.kind === 'ether' || spell.kind === 'fire')
      && spell.ageTicks % 5 === 0
      && !context.canTraverseProjectile(
        spell,
        spell.position,
        {
          x: spell.position.x + spell.velocity.x * 5,
          y: spell.position.y + spell.velocity.y * 5,
        },
      )
    ) {
      if (spell.kind === 'fire') {
        transients = [...transients, fireImpact(
          nextId,
          spell,
          registerLightProvider('transient'),
        )]
        nextId += 1
      } else {
        transients = [...transients, etherImpact(
          nextId,
          spell,
          context.tick,
          registerLightProvider('transient'),
        )]
        nextId += 1
      }
      continue
    }
    const targets = context.spellTargets(spell.ownerId)
    const advanced = advanceProjectile(spell, targets)
    if (
      advanced.kind === 'earth'
      && !context.canPlaceProjectile(
        advanced,
        advanced.position,
        advanced.charge * PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
      )
    ) {
      transients = [...transients, earthImpact(nextId, advanced, context.tick)]
      nextId += 1
      continue
    }
    projectiles.push(advanced)
  }
  const manaSpent: Record<string, number> = {}
  const channelEmissions: PrimarySpellChannelEmission[] = []
  const players: Record<string, PlayerCharacterState> = { ...context.players }

  for (const spell of projectiles) {
    if (spell.kind !== 'fire') continue
    transients = [...transients, createFireParticle(nextId, spell)]
    nextId += 1
  }

  for (const [playerId, player] of Object.entries(context.players)) {
    const previous = context.previousPlayers[playerId] ?? player
    const input = context.inputs[playerId]
    const authority = context.castAuthority[playerId]
    if (authority) assertPrimarySkillMatchesElement(player.config.element, authority.primarySkill)
    const manaCost = authority
      ? primarySpellManaCost(player.config.element, authority.primarySkill)
      : 0
    let availableMana = authority?.availableMana ?? 0
    manaSpent[playerId] = 0
    const debitMana = (): boolean => {
      const spent = Math.min(Math.max(0, availableMana), manaCost)
      availableMana = Math.max(0, availableMana - spent)
      manaSpent[playerId] += spent
      return availableMana <= 0
    }
    const rawHeld = input?.cast.primary === true && input.aim !== null
    const pressed = rawHeld && !previous.primaryCast.held
    const released = !rawHeld && previous.primaryCast.held
    const oneShotPrimary = player.config.element === 'ether' || player.config.element === 'fire'
    const acceptedCast = rawHeld
      && previous.primaryCast.actionTick < 0
      && (pressed || (oneShotPrimary && previous.primaryCast.castSequence > 0))
      && authority?.eligible === true
    const sustainedPrimary = (
      player.config.element === 'air'
      || player.config.element === 'water'
      || player.config.element === 'earth'
    )
    const aimSamplesInput = rawHeld && (
      sustainedPrimary || previous.primaryCast.actionTick < 0
    )
    const aimDirection = aimSamplesInput && input?.aim
      ? primarySpellAimDirection(player.position, input.aim, context.viewScale)
      : previous.primaryCast.aimDirection
    let primaryCast = advancePrimaryCast(
      previous.primaryCast,
      rawHeld,
      acceptedCast,
      player.config.element,
    )
    const castOwnsFacing = playerPrimaryCastOwnsFacing(primaryCast)
    let nextPlayer: PlayerCharacterState = {
      ...player,
      headingIndex: castOwnsFacing
        ? actorHeadingIndex(actorHeadingFromVector(aimDirection.x, aimDirection.y))
        : player.headingIndex,
      primaryCast: { ...primaryCast, aimDirection },
    }
    const worldKey = context.worldKeyForPlayer(playerId)

    if (authority?.eligible !== true) {
      if (player.config.element === 'earth') {
        projectiles = projectiles.filter((spell) => !(
          spell.kind === 'earth'
          && spell.ownerId === playerId
          && spell.phase === 'held'
        ))
      }
      players[playerId] = {
        ...nextPlayer,
        primaryCast: {
          ...nextPlayer.primaryCast,
          actionTick: -1,
          channelActive: false,
          underpowered: false,
        },
      }
      continue
    }

    if (acceptedCast) {
      switch (player.config.element) {
        case 'air':
        case 'water':
          primaryCast = { ...nextPlayer.primaryCast, channelActive: true }
          nextPlayer = { ...nextPlayer, primaryCast }
          break
        case 'earth': {
          primaryCast = { ...nextPlayer.primaryCast, channelActive: true }
          nextPlayer = { ...nextPlayer, primaryCast }
          const emitter = primarySpellEmitter(nextPlayer)
          projectiles = [...projectiles, {
            ageTicks: 1,
            assemblyCharge: PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
            charge: PRIMARY_SPELL_EARTH_FIRST_TICK_CHARGE,
            damage: authority.primarySkill.damageMinimum,
            direction: { ...aimDirection },
            flightTicks: 0,
            hitTargetIds: [],
            id: nextId,
            kind: 'earth',
            lightRegistration: registerLightProvider('actor'),
            orientation: [...EARTH_BOULDER_IDENTITY_ORIENTATION],
            ownerId: playerId,
            phase: 'held',
            position: { x: emitter.x, y: emitter.y + 15 },
            velocity: { x: 0, y: 0 },
            worldKey,
          }]
          nextId += 1
          break
        }
        case 'ether':
        case 'fire':
          break
      }
    }

    if (
      nextPlayer.primaryCast.actionTick === primaryCastEmissionTick(player.config.element)
      && previous.primaryCast.actionTick !== primaryCastEmissionTick(player.config.element)
      && (player.config.element === 'ether' || player.config.element === 'fire')
    ) {
      const underpowered = debitMana()
      const born = createOneShotProjectile(
        nextId,
        playerId,
        nextPlayer,
        player.config.element,
        authority.primarySkill,
        worldKey,
        context.spellTargets(playerId),
        underpowered,
        registerLightProvider('actor'),
      )
      nextId += 1
      if (born.kind === 'fire') {
        const initialClear = context.canTraverseProjectile(
          born,
          nextPlayer.position,
          born.position,
        )
        const firstLookaheadClear = initialClear && context.canTraverseProjectile(
          born,
          born.position,
          {
            x: born.position.x + born.velocity.x * 5,
            y: born.position.y + born.velocity.y * 5,
          },
        )
        if (initialClear && firstLookaheadClear) {
          const spell = advanceProjectile(born, [])
          projectiles = [...projectiles, spell]
          transients = [...transients, createFireParticle(nextId, spell)]
          nextId += 1
        } else {
          transients = [...transients, fireImpact(
            nextId,
            born,
            registerLightProvider('transient'),
          )]
          nextId += 1
        }
      } else {
        if (born.kind !== 'ether') throw new Error('Expected an Ether projectile')
        const firstLookaheadClear = context.canTraverseProjectile(
          born,
          born.position,
          {
            x: born.position.x + born.velocity.x * 5,
            y: born.position.y + born.velocity.y * 5,
          },
        )
        if (firstLookaheadClear) {
          const spell = advanceProjectile(
            born,
            context.spellTargets(playerId),
          )
          if (spell.kind !== 'ether') throw new Error('Expected an Ether projectile')
          projectiles = [...projectiles, spell]
        } else {
          transients = [...transients, etherImpact(
            nextId,
            born,
            context.tick,
            registerLightProvider('transient'),
          )]
          nextId += 1
        }
      }
      nextPlayer = {
        ...nextPlayer,
        primaryCast: {
          ...nextPlayer.primaryCast,
          emissionSequence: nextPlayer.primaryCast.emissionSequence + 1,
          fizzleSequence: underpowered
            ? nextPlayer.primaryCast.fizzleSequence + 1
            : nextPlayer.primaryCast.fizzleSequence,
          underpowered,
        },
      }
    }

    const earthReleaseEligible = player.config.element === 'earth' && projectiles.some((spell) => (
      spell.kind === 'earth'
      && spell.ownerId === playerId
      && spell.phase === 'held'
      && spell.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE
    ))

    if (nextPlayer.primaryCast.channelActive) {
      switch (player.config.element) {
        case 'air': {
          if (!rawHeld) break
          const underpowered = debitMana()
          const emitter = primarySpellEmitter(nextPlayer)
          const air = createAirTransient(
            playerId,
            nextPlayer,
            emitter,
            aimDirection,
            context,
          )
          channelEmissions.push({
            damage: primarySpellChannelDamage(authority.primarySkill, underpowered),
            direction: { ...aimDirection },
            id: nextId,
            kind: 'air',
            manaCost,
            origin: emitter,
            ownerId: playerId,
            queryOrigin: { ...nextPlayer.position },
            underpowered,
            worldKey,
          })
          transients = [...transients, {
            ageTicks: 0,
            birthTick: context.tick,
            direction: { ...aimDirection },
            endpoint: air.endpoint,
            id: nextId,
            kind: 'air',
            lightRegistration: registerLightProvider('transient'),
            midpoint: air.midpoint,
            origin: emitter,
            ownerId: playerId,
            targetId: air.targetId,
            underpowered,
            variant: nextId % 4,
            worldKey,
          }]
          nextPlayer = {
            ...nextPlayer,
            primaryCast: {
              ...nextPlayer.primaryCast,
              targetId: air.targetId,
              underpowered,
            },
          }
          nextId += 1
          break
        }
        case 'water': {
          if (!rawHeld) break
          const underpowered = debitMana()
          const emitter = primarySpellEmitter(nextPlayer)
          channelEmissions.push({
            damage: primarySpellChannelDamage(authority.primarySkill, underpowered),
            direction: { ...aimDirection },
            id: nextId,
            kind: 'water',
            manaCost,
            origin: emitter,
            ownerId: playerId,
            queryOrigin: { ...nextPlayer.position },
            underpowered,
            worldKey,
          })
          const emitted = Array.from(
            {
              length: underpowered
                ? WATER_FROST_UNDERPOWERED_PARTICLES_PER_TICK
                : WATER_FROST_PARTICLES_PER_TICK,
            },
            (_, variant): PrimarySpellTransientState => {
              const id = nextId + variant
              const born = waterFrostJetEmission(
                emitter,
                aimDirection,
                context.tick,
                variant,
                id,
              )
              const obstruction = waterFrostJetObstruction(
                born,
                nextPlayer.position,
                id,
                (start, end) => context.spellObstructionPoint(playerId, start, end),
                underpowered,
              )
              return {
                ageTicks: 1,
                direction: born.direction,
                id,
                kind: 'water',
                lightRegistration: null,
                obstructionDistance: obstruction?.distance ?? null,
                obstructionPoint: obstruction?.point ?? null,
                origin: born.origin,
                ownerId: playerId,
                underpowered,
                variant,
                worldKey,
              }
            },
          )
          transients = [...transients, ...emitted]
          nextId += emitted.length
          nextPlayer = {
            ...nextPlayer,
            primaryCast: { ...nextPlayer.primaryCast, underpowered },
          }
          break
        }
        case 'earth': {
          const underpowered = debitMana()
          projectiles = projectiles.map((spell) => {
            if (spell.kind !== 'earth' || spell.ownerId !== playerId || spell.phase !== 'held') {
              return spell
            }
            const emitter = primarySpellEmitter(nextPlayer)
            const charge = acceptedCast || (!rawHeld && (
              spell.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE
            )) || (underpowered && spell.charge > PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE)
              ? spell.charge
              : Math.min(1, Math.fround(spell.charge + PRIMARY_SPELL_EARTH_CHARGE_STEP))
            const releasesThisTick = !rawHeld
              && spell.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE
            return {
              ...spell,
              assemblyCharge: Math.floor(30 * spell.charge) === Math.floor(30 * charge)
                ? spell.assemblyCharge
                : charge,
              charge,
              damage: underpowered && spell.charge < 1
                ? Math.fround(spell.damage * 0.5)
                : spell.damage,
              direction: { ...aimDirection },
              orientation: releasesThisTick
                ? spell.orientation
                : earthBoulderHeldOrientationStep(spell.orientation, aimDirection),
              position: { x: emitter.x, y: emitter.y + 15 },
              worldKey,
            }
          })
          nextPlayer = {
            ...nextPlayer,
            primaryCast: {
              ...nextPlayer.primaryCast,
              fizzleSequence: underpowered && context.tick % 50 === 0
                ? nextPlayer.primaryCast.fizzleSequence + 1
                : nextPlayer.primaryCast.fizzleSequence,
              underpowered,
            },
          }
          const heldBoulder = projectiles.find((
            spell,
          ): spell is PrimarySpellEarthProjectileState => (
            spell.kind === 'earth'
            && spell.ownerId === playerId
            && spell.phase === 'held'
          ))
          if ((rawHeld || !earthReleaseEligible)
            && heldBoulder
            && heldBoulder.charge < 1
            && earthCalledRockEmits(
              heldBoulder,
              context.tick,
            )) {
            transients = [...transients, createEarthCalledRock(
              nextId,
              heldBoulder,
            )]
            nextId += 1
          }
          break
        }
        case 'ether':
        case 'fire':
          break
      }
    }

    const shouldEndChannel = nextPlayer.primaryCast.channelActive && (
      player.config.element === 'earth'
        ? !rawHeld && earthReleaseEligible
        : released
    )

    if (shouldEndChannel) {
      if (player.config.element === 'earth') {
        const released = releaseHeldEarthProjectiles(
          projectiles,
          playerId,
          aimDirection,
          context.canPlaceProjectile,
          context.tick,
          nextId,
        )
        projectiles = released.projectiles
        transients = [...transients, ...released.impacts]
        nextId = released.nextId
        nextPlayer = {
          ...nextPlayer,
          primaryCast: {
            ...nextPlayer.primaryCast,
            emissionSequence: nextPlayer.primaryCast.emissionSequence + 1,
          },
        }
      }
      nextPlayer = {
        ...nextPlayer,
        primaryCast: {
          ...nextPlayer.primaryCast,
          actionTick: -1,
          channelActive: false,
          targetId: null,
          underpowered: false,
        },
      }
    }

    players[playerId] = nextPlayer
  }

  const bouldersById = new Map(projectiles
    .filter((spell) => spell.kind === 'earth')
    .map((spell) => [spell.id, spell]))
  const advancedTransients: PrimarySpellTransientState[] = []
  for (const effect of transients) {
    if (effect.kind !== 'earth-called-rock' || !existingCalledRockIds.has(effect.id)) {
      advancedTransients.push(effect)
      continue
    }
    const advanced = advanceEarthCalledRock(effect, bouldersById.get(effect.parentId))
    if (advanced) advancedTransients.push(advanced)
  }
  transients = advancedTransients

  return {
    channelEmissions,
    manaSpent,
    players,
    spells: { nextId, projectiles, transients },
  }
}

function releaseHeldEarthProjectiles(
  projectiles: readonly PrimarySpellProjectileState[],
  playerId: string,
  aimDirection: Vector2,
  canPlaceProjectile: PrimarySpellTickContext['canPlaceProjectile'],
  tick: number,
  sourceNextId: number,
): {
  impacts: readonly PrimarySpellEarthImpactState[]
  nextId: number
  projectiles: PrimarySpellProjectileState[]
} {
  const impacts: PrimarySpellEarthImpactState[] = []
  const releasedProjectiles: PrimarySpellProjectileState[] = []
  let nextId = sourceNextId
  for (const spell of projectiles) {
    if (spell.kind !== 'earth' || spell.ownerId !== playerId || spell.phase !== 'held') {
      releasedProjectiles.push(spell)
      continue
    }
    const velocity = {
      x: Math.fround(aimDirection.x * 3),
      y: Math.fround(aimDirection.y * 3),
    }
    const position = {
      x: Math.fround(spell.position.x + velocity.x),
      y: Math.fround(spell.position.y + velocity.y),
    }
    const storedDelta = {
      x: Math.fround(position.x - spell.position.x),
      y: Math.fround(position.y - spell.position.y),
    }
    const releasedSpell: PrimarySpellProjectileState = {
      ...spell,
      damage: nativeEarthReleaseDamage(spell.damage, spell.charge),
      direction: { ...aimDirection },
      flightTicks: 1,
      orientation: earthBoulderFlightOrientationStep(
        spell.orientation,
        aimDirection,
        storedDelta,
        spell.charge,
      ),
      phase: 'flight',
      position,
      velocity,
    }
    if (canPlaceProjectile(
      releasedSpell,
      releasedSpell.position,
      releasedSpell.charge * PRIMARY_SPELL_EARTH_RELEASE_COLLISION_RADIUS_SCALE,
    )) {
      releasedProjectiles.push(releasedSpell)
    } else {
      impacts.push(earthImpact(nextId, releasedSpell, tick))
      nextId += 1
    }
  }
  return { impacts, nextId, projectiles: releasedProjectiles }
}

export function removePrimarySpellOwner(
  spells: PrimarySpellSimulationState,
  playerId: string,
): PrimarySpellSimulationState {
  return {
    ...spells,
    projectiles: spells.projectiles.filter((spell) => spell.ownerId !== playerId),
    transients: spells.transients.filter((effect) => effect.ownerId !== playerId),
  }
}

export function primarySpellAimDirection(
  playerPosition: Vector2,
  worldAim: Vector2,
  viewScale: number,
): Vector2 {
  const dx = worldAim.x - playerPosition.x
  const dy = worldAim.y - (playerPosition.y - 25 / viewScale)
  const length = Math.hypot(dx, dy)
  return length > 0.0001
    ? { x: dx / length, y: dy / length }
    : { x: 0, y: -1 }
}

export function nativeEarthReleaseDamage(
  baseDamage: number,
  charge: number,
): number {
  const baseCharge = Math.fround(baseDamage * charge)
  const quadratic = Math.fround(baseCharge * charge)
  const cap = Math.fround(baseDamage * 1.25)
  return Math.fround(Math.max(0.25, Math.min(quadratic, cap)))
}

function createAirTransient(
  ownerId: string,
  player: PlayerCharacterState,
  emitter: Vector2,
  aimDirection: Vector2,
  context: PrimarySpellTickContext,
): Pick<PrimarySpellAirTransientState, 'endpoint' | 'midpoint' | 'targetId'> {
  const rangeEndpoint = context.spellRangeEndpoint(
    ownerId,
    player.position,
    aimDirection,
  )
  const untargetedEndpoint = context.spellObstructionPoint(
    ownerId,
    player.position,
    rangeEndpoint,
  ) ?? rangeEndpoint
  const maxRange = Math.hypot(
    rangeEndpoint.x - player.position.x,
    rangeEndpoint.y - player.position.y,
  )
  const target = selectAirPrimaryTarget({
    aimDirection,
    hasLineOfSight: (candidate) => context.spellObstructionPoint(
      ownerId,
      player.position,
      candidate.position,
      candidate.id,
    ) === null,
    maxRange,
    origin: player.position,
    previousTargetId: player.primaryCast.targetId,
    targets: context.spellTargets(ownerId),
  })
  let endpoint = untargetedEndpoint
  if (target) {
    const attachment = {
      x: target.position.x + target.attachment.x,
      y: target.position.y + target.attachment.y,
    }
    const clipped = context.spellObstructionPoint(
      ownerId,
      player.position,
      attachment,
      target.id,
    ) ?? attachment
    endpoint = { x: clipped.x, y: clipped.y + AIR_PRIMARY_TARGET_Y_OFFSET }
  }
  const geometry = airPrimaryBoltGeometry(emitter, aimDirection, endpoint)
  return {
    endpoint: geometry.endpoint,
    midpoint: geometry.midpoint,
    targetId: target?.id ?? null,
  }
}

function advancePrimaryCast(
  previous: PlayerPrimaryCastState,
  held: boolean,
  acceptedCast: boolean,
  element: WizardElement,
): PlayerPrimaryCastState {
  let actionTick = previous.actionTick
  if (actionTick >= 0) {
    if (previous.channelActive) {
      actionTick = Math.min(actionTick + 1, 1)
    } else {
      actionTick += 1
      if (actionTick >= primaryCastActionEndTick(element)) actionTick = -1
    }
  }
  if (acceptedCast) actionTick = 0
  return {
    ...previous,
    actionTick,
    castSequence: acceptedCast ? previous.castSequence + 1 : previous.castSequence,
    held,
    underpowered: acceptedCast ? false : previous.underpowered,
  }
}

function createOneShotProjectile(
  id: number,
  ownerId: string,
  player: PlayerCharacterState,
  kind: 'ether' | 'fire',
  primarySkill: NativePrimarySkillRankStats,
  worldKey: string,
  targets: readonly PrimarySpellTarget[],
  underpowered: boolean,
  lightRegistration: NativeLightProviderRegistration,
): PrimarySpellProjectileState {
  const direction = player.primaryCast.aimDirection
  const emitter = primarySpellEmitter(player)
  const speed = kind === 'ether'
    ? underpowered ? PRIMARY_SPELL_ETHER_UNDERPOWERED_SPEED : 3
    : 4.5
  const alongAim = kind === 'fire' ? 20 : 0
  const spawn = {
    x: emitter.x + direction.x * alongAim,
    y: emitter.y + 10 + direction.y * alongAim,
  }
  const velocity = { x: direction.x * speed, y: direction.y * speed }
  const common = {
    ageTicks: 0,
    charge: 1,
    damage: (kind === 'ether' && (id & 1) === 0
      ? primarySkill.damageMinimum
      : primarySkill.damageMaximum) * (underpowered ? 0.5 : 1),
    direction: { ...direction },
    flightTicks: 0,
    id,
    kind,
    lightRegistration,
    ownerId,
    phase: 'flight' as const,
    position: spawn,
    underpowered,
    velocity,
    worldKey,
  }
  if (kind === 'fire') {
    return { ...common, kind: 'fire' }
  }
  const target = selectEtherPrimaryTarget({
    aimDirection: direction,
    origin: spawn,
    targets,
  })
  return {
    ...common,
    headingDegrees: Math.fround(actorHeadingFromVector(direction.x, direction.y)),
    kind: 'ether',
    targetId: target?.id ?? null,
    turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
  }
}

function primarySpellManaCost(
  element: WizardElement,
  primarySkill: NativePrimarySkillRankStats,
): number {
  return element === 'ether' || element === 'fire'
    ? primarySkill.manaCost
    : primarySkill.manaCost / PRIMARY_SPELL_TICKS_PER_SECOND
}

function primarySpellChannelDamage(
  primarySkill: NativePrimarySkillRankStats,
  underpowered: boolean,
): number {
  return primarySkill.damageMinimum / PRIMARY_SPELL_TICKS_PER_SECOND
    * (underpowered ? 0.5 : 1)
}

function assertPrimarySkillMatchesElement(
  element: WizardElement,
  primarySkill: NativePrimarySkillRankStats,
): void {
  if (primarySkill.skillId !== PRIMARY_SKILL_ID_BY_ELEMENT[element]) {
    throw new Error(
      `primary skill ${primarySkill.skillId} does not match ${element} caster`,
    )
  }
}

function advanceProjectile(
  spell: PrimarySpellProjectileState,
  targets: readonly PrimarySpellTarget[],
): PrimarySpellProjectileState {
  if (spell.phase === 'held') {
    return { ...spell, ageTicks: spell.ageTicks + 1 }
  }
  if (spell.kind === 'ether') {
    const candidate = spell.targetId === null
      ? undefined
      : targets.find(({ id }) => id === spell.targetId)
    const target = candidate && nativePrimaryTargetEligible(candidate, NATIVE_PRIMARY_HOSTILE_FLAG)
      ? candidate
      : undefined
    const advanced = advanceEtherPrimaryHoming({
      headingDegrees: spell.headingDegrees,
      movementScalar: 1,
      position: spell.position,
      speed: spell.underpowered ? PRIMARY_SPELL_ETHER_UNDERPOWERED_SPEED : 3,
      targetPosition: target?.position ?? null,
      turnInput: spell.underpowered ? PRIMARY_SPELL_ETHER_UNDERPOWERED_TURN_INPUT : 2,
      turnAccumulator: spell.turnAccumulator,
    })
    return {
      ...spell,
      ageTicks: spell.ageTicks + 1,
      direction: advanced.direction,
      flightTicks: spell.flightTicks + 1,
      headingDegrees: advanced.headingDegrees,
      position: advanced.position,
      targetId: target?.id ?? null,
      turnAccumulator: advanced.turnAccumulator,
      velocity: {
        x: Math.fround(advanced.direction.x * (
          spell.underpowered ? PRIMARY_SPELL_ETHER_UNDERPOWERED_SPEED : 3
        )),
        y: Math.fround(advanced.direction.y * (
          spell.underpowered ? PRIMARY_SPELL_ETHER_UNDERPOWERED_SPEED : 3
        )),
      },
    }
  }
  if (spell.kind === 'earth') {
    const position = {
      x: Math.fround(spell.position.x + spell.velocity.x),
      y: Math.fround(spell.position.y + spell.velocity.y),
    }
    const storedDelta = {
      x: Math.fround(position.x - spell.position.x),
      y: Math.fround(position.y - spell.position.y),
    }
    return {
      ...spell,
      ageTicks: spell.ageTicks + 1,
      flightTicks: spell.flightTicks + 1,
      orientation: earthBoulderFlightOrientationStep(
        spell.orientation,
        spell.direction,
        storedDelta,
        spell.charge,
      ),
      position,
    }
  }
  return {
    ...spell,
    ageTicks: spell.ageTicks + 1,
    flightTicks: spell.flightTicks + 1,
    position: {
      x: spell.position.x + spell.velocity.x,
      y: spell.position.y + spell.velocity.y,
    },
  }
}

function transientLifetime(effect: PrimarySpellTransientState): number {
  switch (effect.kind) {
    case 'air': return effect.underpowered
      ? PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS
      : PRIMARY_SPELL_AIR_LIFETIME_TICKS
    case 'earth-called-rock': throw new Error('Called-rock lifetime is state driven')
    case 'earth-impact': return effect.lifetimeTicks
    case 'ether-impact': return PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS
    case 'fire': return nativeFireParticleLifetimeTicks(effect.id)
    case 'fire-impact': return PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS
    case 'water': return waterFrostJetLifetimeTicks(effect.id)
  }
}

function etherImpact(
  id: number,
  spell: PrimarySpellProjectileState,
  birthTick: number,
  lightRegistration: NativeLightProviderRegistration,
): PrimarySpellEtherImpactState {
  return {
    ageTicks: 0,
    birthTick,
    id,
    kind: 'ether-impact',
    lightRegistration,
    origin: { ...spell.position },
    ownerId: spell.ownerId,
    worldKey: spell.worldKey,
  }
}

function earthImpact(
  id: number,
  spell: PrimarySpellEarthProjectileState,
  birthTick: number,
): PrimarySpellEarthImpactState {
  const seed = {
    ageTicks: 0,
    birthTick,
    charge: spell.charge,
    id,
    kind: 'earth-impact',
    lightRegistration: null,
    lifetimeTicks: 0,
    origin: { ...spell.position },
    ownerId: spell.ownerId,
    worldKey: spell.worldKey,
  } satisfies PrimarySpellEarthImpactState
  return { ...seed, lifetimeTicks: earthImpactLifetimeTicks(seed) }
}

function fireImpact(
  id: number,
  spell: PrimarySpellProjectileState,
  lightRegistration: NativeLightProviderRegistration,
): PrimarySpellFireImpactState {
  return {
    ageTicks: 0,
    id,
    kind: 'fire-impact',
    lightRegistration,
    origin: { ...spell.position },
    ownerId: spell.ownerId,
    worldKey: spell.worldKey,
  }
}

export function createPrimarySpellContactImpact(
  id: number,
  spell: PrimarySpellProjectileState,
  origin: Readonly<Vector2>,
  birthTick: number,
  registerLightProvider: RegisterNativeLightProvider = (managerLane) => ({
    managerLane,
    registrationOrdinal: id,
  }),
): PrimarySpellEarthImpactState | PrimarySpellEtherImpactState | PrimarySpellFireImpactState | null {
  const contactSpell = { ...spell, position: { ...origin } }
  if (contactSpell.kind === 'earth') {
    return earthImpact(id, contactSpell, birthTick)
  }
  if (contactSpell.kind === 'ether') {
    return etherImpact(id, contactSpell, birthTick, registerLightProvider('transient'))
  }
  return contactSpell.kind === 'fire'
    ? fireImpact(id, contactSpell, registerLightProvider('transient'))
    : null
}

function earthCalledRockEmits(
  boulder: PrimarySpellEarthProjectileState,
  tick: number,
): boolean {
  return boulder.charge < 0.25
    || earthVisualRandomInt(boulder.id, 0x3000 + tick, 3) === 1
}

function createEarthCalledRock(
  id: number,
  boulder: PrimarySpellEarthProjectileState,
): PrimarySpellEarthCalledRockState {
  const angle = earthVisualUnitRandom(id, 0x4000) * Math.PI * 2
  const spawnRadius = earthVisualUnitRandom(id, 0x5000)
    * Math.max(5, Math.min(120, 50 * boulder.charge))
  return {
    ageTicks: 0,
    falling: false,
    fallVelocity: 0,
    height: -2,
    id,
    kind: 'earth-called-rock',
    lightRegistration: null,
    lateralMagnitude: Math.fround(earthVisualUnitRandom(id, 0x6000) * 4),
    ownerId: boulder.ownerId,
    parentId: boulder.id,
    position: {
      x: Math.fround(boulder.position.x + Math.cos(angle) * spawnRadius),
      y: Math.fround(boulder.position.y + Math.sin(angle) * spawnRadius),
    },
    rotation: Math.fround(earthVisualUnitRandom(id, 0x7000) * 360),
    rotationStep: Math.fround((earthVisualUnitRandom(id, 0x7100) * 2 - 1) * 30),
    scale: Math.fround(0.75 * Math.min(boulder.charge, 0.75)),
    speed: PRIMARY_SPELL_EARTH_CALLED_ROCK_INITIAL_SPEED,
    targetHeight: Math.fround(
      -40 - 30 * boulder.charge + earthVisualUnitRandom(id, 0x7200) * 5,
    ),
    variant: earthVisualRandomInt(id, 0x7300, 3),
    worldKey: boulder.worldKey,
  }
}

function advanceEarthCalledRock(
  rock: PrimarySpellEarthCalledRockState,
  parent: PrimarySpellEarthProjectileState | undefined,
): PrimarySpellEarthCalledRockState | null {
  if (rock.falling) {
    const height = Math.fround(rock.height + rock.fallVelocity)
    const accelerated = Math.fround(rock.fallVelocity + 1)
    const fallVelocity = height > 0 ? Math.fround(0.25) : accelerated
    if (height > 10) return null
    return { ...rock, ageTicks: rock.ageTicks + 1, fallVelocity, height }
  }

  const speed = Math.min(
    PRIMARY_SPELL_EARTH_CALLED_ROCK_SPEED_CAP,
    Math.fround(rock.speed * PRIMARY_SPELL_EARTH_CALLED_ROCK_SPEED_MULTIPLIER),
  )
  let position = rock.position
  let falling = parent?.phase !== 'held'
  if (!falling && parent) {
    const dx = parent.position.x - rock.position.x
    const dy = parent.position.y - rock.position.y
    const distance = Math.hypot(dx, dy)
    if (distance < PRIMARY_SPELL_EARTH_CALLED_ROCK_REMOVE_DISTANCE) return null
    const toward = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 }
    position = {
      x: Math.fround(rock.position.x + toward.x * speed),
      y: Math.fround(rock.position.y + toward.y * speed),
    }
    const nextDx = parent.position.x - position.x
    const nextDy = parent.position.y - position.y
    const nextDistance = Math.hypot(nextDx, nextDy)
    if (nextDistance > 0) {
      position = {
        x: Math.fround(position.x - nextDy / nextDistance * rock.lateralMagnitude),
        y: Math.fround(position.y + nextDx / nextDistance * rock.lateralMagnitude),
      }
    }
  } else {
    falling = true
  }

  const heightDirection = Math.sign(rock.targetHeight - rock.height)
  return {
    ...rock,
    ageTicks: rock.ageTicks + 1,
    falling,
    height: heightDirection === 0
      ? rock.height
      : Math.fround(rock.height + heightDirection * 1.5),
    position,
    rotation: Math.fround(rock.rotation + rock.rotationStep),
    speed,
  }
}

function createFireParticle(
  id: number,
  fireball: PrimarySpellProjectileState,
): PrimarySpellFireParticleState {
  return {
    ageTicks: 0,
    direction: { ...fireball.direction },
    id,
    kind: 'fire',
    lightRegistration: null,
    origin: { ...fireball.position },
    ownerId: fireball.ownerId,
    variant: nativeFireParticleVariant(id),
    worldKey: fireball.worldKey,
  }
}
