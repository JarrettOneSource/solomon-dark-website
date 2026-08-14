import {
  actorHeadingFromVector,
  actorHeadingIndex,
} from './actor-heading.ts'
import {
  playerPrimaryCastOwnsFacing,
  type PlayerCharacterInput,
  type PlayerCharacterState,
  type PlayerPrimaryCastState,
} from './player-character.ts'
import {
  WATER_FROST_PARTICLES_PER_TICK,
  waterFrostJetEmission,
  waterFrostJetLifetimeTicks,
} from './primary-spell-water.ts'
import {
  earthImpactLifetimeTicks,
  earthVisualRandomInt,
  earthVisualUnitRandom,
} from './primary-spell-earth.ts'
import type { Vector2 } from './vector.ts'
import {
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from './primary-spell-fire-native.ts'

export type PrimarySpellProjectileKind = 'earth' | 'ether' | 'fire'
export type PrimarySpellTransientKind =
  | 'air'
  | 'earth-called-rock'
  | 'earth-impact'
  | 'fire'
  | 'water'
export type PrimarySpellProjectilePhase = 'flight' | 'held'

interface PrimarySpellProjectileBaseState {
  ageTicks: number
  charge: number
  direction: Vector2
  flightTicks: number
  id: number
  ownerId: string
  phase: PrimarySpellProjectilePhase
  position: Vector2
  velocity: Vector2
  worldKey: string
}

export interface PrimarySpellEarthProjectileState extends PrimarySpellProjectileBaseState {
  assemblyCharge: number
  kind: 'earth'
}

export interface PrimarySpellFlightProjectileState extends PrimarySpellProjectileBaseState {
  kind: 'ether' | 'fire'
}

export type PrimarySpellProjectileState =
  | PrimarySpellEarthProjectileState
  | PrimarySpellFlightProjectileState

export interface PrimarySpellChannelTransientState {
  ageTicks: number
  direction: Vector2
  id: number
  kind: 'air' | 'water'
  origin: Vector2
  ownerId: string
  variant: number
  worldKey: string
}

export interface PrimarySpellEarthImpactState {
  ageTicks: number
  birthTick: number
  charge: number
  id: number
  kind: 'earth-impact'
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
  origin: Vector2
  ownerId: string
  variant: number
  worldKey: string
}

export type PrimarySpellTransientState =
  | PrimarySpellChannelTransientState
  | PrimarySpellEarthCalledRockState
  | PrimarySpellEarthImpactState
  | PrimarySpellFireParticleState

export interface PrimarySpellSimulationState {
  nextId: number
  projectiles: readonly PrimarySpellProjectileState[]
  transients: readonly PrimarySpellTransientState[]
}

export interface PrimarySpellTickContext {
  canPlaceProjectile: (
    spell: PrimarySpellProjectileState,
    position: Vector2,
    radius: number,
  ) => boolean
  inputs: Readonly<Record<string, PlayerCharacterInput>>
  players: Readonly<Record<string, PlayerCharacterState>>
  previousPlayers: Readonly<Record<string, PlayerCharacterState>>
  spells: PrimarySpellSimulationState
  tick: number
  viewScale: number
  worldKeyForPlayer: (playerId: string) => string
}

export interface PrimarySpellTickResult {
  players: Readonly<Record<string, PlayerCharacterState>>
  spells: PrimarySpellSimulationState
}

export const PRIMARY_CAST_ACTION_END_TICK = 74
export const PRIMARY_CAST_EMISSION_TICK = 19
export const PRIMARY_SPELL_AIR_REACH = 205
export const PRIMARY_SPELL_AIR_LIFETIME_TICKS = 5
export const PRIMARY_SPELL_WATER_REACH = 205
export const PRIMARY_SPELL_POC_FLIGHT_LIFETIME_TICKS = 500
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

export function primaryCastPose(
  actionTick: number,
  channelActive = false,
): 0 | 1 | 7 | 8 {
  if (channelActive) return actionTick <= 0 ? 0 : 7
  if (actionTick < 2 || actionTick >= PRIMARY_CAST_ACTION_END_TICK) return 0
  if (actionTick < PRIMARY_CAST_EMISSION_TICK) return 1
  if (actionTick < 37) return 8
  return 7
}

export function primarySpellEmitter(
  player: Pick<PlayerCharacterState, 'headingIndex' | 'position' | 'primaryCast'>,
): Vector2 {
  const offset = primarySpellEmitterOffset(
    player.headingIndex,
    player.primaryCast.actionTick,
    player.primaryCast.channelActive,
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
): Vector2 {
  const pose = primaryCastPose(actionTick, channelActive)
  const facing = ((Math.round(headingIndex) % 24) + 24) % 24
  return STAFF_PRIMARY_EMITTER_OFFSETS[pose][facing]
}

export function stepPrimarySpells(context: PrimarySpellTickContext): PrimarySpellTickResult {
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
      projectiles.push(advanceProjectile(spell))
      continue
    }
    if (
      spell.kind !== 'earth'
      && spell.flightTicks >= PRIMARY_SPELL_POC_FLIGHT_LIFETIME_TICKS
    ) {
      continue
    }
    const advanced = advanceProjectile(spell)
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
  const players: Record<string, PlayerCharacterState> = { ...context.players }

  for (const spell of projectiles) {
    if (spell.kind !== 'fire') continue
    transients = [...transients, createFireParticle(nextId, spell)]
    nextId += 1
  }

  for (const [playerId, player] of Object.entries(context.players)) {
    const previous = context.previousPlayers[playerId] ?? player
    const input = context.inputs[playerId]
    const rawHeld = input?.cast.primary === true && input.aim !== null
    const pressed = rawHeld && !previous.primaryCast.held
    const released = !rawHeld && previous.primaryCast.held
    const acceptedPress = pressed && previous.primaryCast.actionTick < 0
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
    let primaryCast = advancePrimaryCast(previous.primaryCast, rawHeld, acceptedPress)
    const castOwnsFacing = playerPrimaryCastOwnsFacing(primaryCast)
    let nextPlayer: PlayerCharacterState = {
      ...player,
      headingIndex: castOwnsFacing
        ? actorHeadingIndex(actorHeadingFromVector(aimDirection.x, aimDirection.y))
        : player.headingIndex,
      primaryCast: { ...primaryCast, aimDirection },
    }
    const worldKey = context.worldKeyForPlayer(playerId)

    if (acceptedPress) {
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
            direction: { ...aimDirection },
            flightTicks: 0,
            id: nextId,
            kind: 'earth',
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
      nextPlayer.primaryCast.actionTick === PRIMARY_CAST_EMISSION_TICK
      && previous.primaryCast.actionTick !== PRIMARY_CAST_EMISSION_TICK
      && (player.config.element === 'ether' || player.config.element === 'fire')
    ) {
      const spell = createOneShotProjectile(
        nextId,
        playerId,
        nextPlayer,
        player.config.element,
        worldKey,
      )
      nextId += 1
      projectiles = [...projectiles, spell]
      if (spell.kind === 'fire') {
        transients = [...transients, createFireParticle(nextId, spell)]
        nextId += 1
      }
      nextPlayer = {
        ...nextPlayer,
        primaryCast: {
          ...nextPlayer.primaryCast,
          emissionSequence: nextPlayer.primaryCast.emissionSequence + 1,
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
          const emitter = primarySpellEmitter(nextPlayer)
          transients = [...transients, {
            ageTicks: 0,
            direction: { ...aimDirection },
            id: nextId,
            kind: 'air',
            origin: emitter,
            ownerId: playerId,
            variant: nextId % 4,
            worldKey,
          }]
          nextId += 1
          break
        }
        case 'water': {
          if (!rawHeld) break
          const emitter = primarySpellEmitter(nextPlayer)
          const emitted = Array.from(
            { length: WATER_FROST_PARTICLES_PER_TICK },
            (_, variant): PrimarySpellTransientState => {
              const id = nextId + variant
              const born = waterFrostJetEmission(
                emitter,
                aimDirection,
                context.tick,
                variant,
                id,
              )
              return {
                ageTicks: 0,
                direction: born.direction,
                id,
                kind: 'water',
                origin: born.origin,
                ownerId: playerId,
                variant,
                worldKey,
              }
            },
          )
          transients = [...transients, ...emitted]
          nextId += WATER_FROST_PARTICLES_PER_TICK
          break
        }
        case 'earth': {
          projectiles = projectiles.map((spell) => {
            if (spell.kind !== 'earth' || spell.ownerId !== playerId || spell.phase !== 'held') {
              return spell
            }
            const emitter = primarySpellEmitter(nextPlayer)
            const charge = acceptedPress || (!rawHeld && (
              spell.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE
            ))
              ? spell.charge
              : Math.min(1, Math.fround(spell.charge + PRIMARY_SPELL_EARTH_CHARGE_STEP))
            return {
              ...spell,
              assemblyCharge: Math.floor(30 * spell.charge) === Math.floor(30 * charge)
                ? spell.assemblyCharge
                : charge,
              charge,
              direction: { ...aimDirection },
              position: { x: emitter.x, y: emitter.y + 15 },
              worldKey,
            }
          })
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
        const releasedProjectiles: PrimarySpellProjectileState[] = []
        for (const spell of projectiles) {
          if (spell.kind !== 'earth' || spell.ownerId !== playerId || spell.phase !== 'held') {
            releasedProjectiles.push(spell)
            continue
          }
          const velocity = {
            x: aimDirection.x * 3,
            y: aimDirection.y * 3,
          }
          const releasedSpell: PrimarySpellProjectileState = {
            ...spell,
            direction: { ...aimDirection },
            flightTicks: 1,
            phase: 'flight',
            position: {
              x: spell.position.x + velocity.x,
              y: spell.position.y + velocity.y,
            },
            velocity,
          }
          if (context.canPlaceProjectile(
            releasedSpell,
            releasedSpell.position,
            releasedSpell.charge * PRIMARY_SPELL_EARTH_RELEASE_COLLISION_RADIUS_SCALE,
          )) {
            releasedProjectiles.push(releasedSpell)
          } else {
            transients = [...transients, earthImpact(nextId, releasedSpell, context.tick)]
            nextId += 1
          }
        }
        projectiles = releasedProjectiles
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
    players,
    spells: { nextId, projectiles, transients },
  }
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

function advancePrimaryCast(
  previous: PlayerPrimaryCastState,
  held: boolean,
  acceptedPress: boolean,
): PlayerPrimaryCastState {
  let actionTick = previous.actionTick
  if (actionTick >= 0) {
    if (previous.channelActive) {
      actionTick = Math.min(actionTick + 1, 1)
    } else {
      actionTick += 1
      if (actionTick >= PRIMARY_CAST_ACTION_END_TICK) actionTick = -1
    }
  }
  if (acceptedPress) actionTick = 0
  return {
    ...previous,
    actionTick,
    castSequence: acceptedPress ? previous.castSequence + 1 : previous.castSequence,
    held,
  }
}

function createOneShotProjectile(
  id: number,
  ownerId: string,
  player: PlayerCharacterState,
  kind: 'ether' | 'fire',
  worldKey: string,
): PrimarySpellProjectileState {
  const direction = player.primaryCast.aimDirection
  const emitter = primarySpellEmitter(player)
  const speed = kind === 'ether' ? 3 : 4.5
  const alongAim = kind === 'fire' ? 20 : 0
  const spawn = {
    x: emitter.x + direction.x * alongAim,
    y: emitter.y + 10 + direction.y * alongAim,
  }
  const velocity = { x: direction.x * speed, y: direction.y * speed }
  return {
    ageTicks: 1,
    charge: 1,
    direction: { ...direction },
    flightTicks: 1,
    id,
    kind,
    ownerId,
    phase: 'flight',
    position: { x: spawn.x + velocity.x, y: spawn.y + velocity.y },
    velocity,
    worldKey,
  }
}

function advanceProjectile(
  spell: PrimarySpellProjectileState,
): PrimarySpellProjectileState {
  if (spell.phase === 'held') {
    return { ...spell, ageTicks: spell.ageTicks + 1 }
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
    case 'air': return PRIMARY_SPELL_AIR_LIFETIME_TICKS
    case 'earth-called-rock': throw new Error('Called-rock lifetime is state driven')
    case 'earth-impact': return effect.lifetimeTicks
    case 'fire': return nativeFireParticleLifetimeTicks(effect.id)
    case 'water': return waterFrostJetLifetimeTicks(effect.id)
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
    lifetimeTicks: 0,
    origin: { ...spell.position },
    ownerId: spell.ownerId,
    worldKey: spell.worldKey,
  } satisfies PrimarySpellEarthImpactState
  return { ...seed, lifetimeTicks: earthImpactLifetimeTicks(seed) }
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
    origin: { ...fireball.position },
    ownerId: fireball.ownerId,
    variant: nativeFireParticleVariant(id),
    worldKey: fireball.worldKey,
  }
}
