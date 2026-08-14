import {
  actorHeadingFromVector,
  actorHeadingIndex,
} from './actor-heading.ts'
import type {
  PlayerCharacterInput,
  PlayerCharacterState,
  PlayerPrimaryCastState,
} from './player-character.ts'
import type { Vector2 } from './vector.ts'

export type PrimarySpellProjectileKind = 'earth' | 'ether' | 'fire'
export type PrimarySpellTransientKind = 'air' | 'water'
export type PrimarySpellProjectilePhase = 'flight' | 'held'

export interface PrimarySpellProjectileState {
  ageTicks: number
  charge: number
  direction: Vector2
  flightTicks: number
  id: number
  kind: PrimarySpellProjectileKind
  ownerId: string
  phase: PrimarySpellProjectilePhase
  position: Vector2
  velocity: Vector2
  worldKey: string
}

export interface PrimarySpellTransientState {
  ageTicks: number
  direction: Vector2
  id: number
  kind: PrimarySpellTransientKind
  origin: Vector2
  ownerId: string
  variant: number
  worldKey: string
}

export interface PrimarySpellSimulationState {
  nextId: number
  projectiles: readonly PrimarySpellProjectileState[]
  transients: readonly PrimarySpellTransientState[]
}

export interface PrimarySpellTickContext {
  inputs: Readonly<Record<string, PlayerCharacterInput>>
  players: Readonly<Record<string, PlayerCharacterState>>
  previousPlayers: Readonly<Record<string, PlayerCharacterState>>
  spells: PrimarySpellSimulationState
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
export const PRIMARY_SPELL_AIR_LIFETIME_TICKS = 10
export const PRIMARY_SPELL_WATER_REACH = 205
export const PRIMARY_SPELL_WATER_LIFETIME_TICKS = 33
export const PRIMARY_SPELL_POC_FLIGHT_LIFETIME_TICKS = 500
export const PRIMARY_SPELL_EARTH_INITIAL_CHARGE = Math.fround(0.18)
export const PRIMARY_SPELL_EARTH_CHARGE_STEP = Math.fround(0.00125)
export const PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE = Math.fround(0.3)
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
  let projectiles = context.spells.projectiles
    .filter((spell) => (
      spell.phase === 'held'
      || spell.flightTicks < PRIMARY_SPELL_POC_FLIGHT_LIFETIME_TICKS
    ))
    .map(advanceProjectile)
  let transients = context.spells.transients
    .filter((effect) => effect.ageTicks + 1 < transientLifetime(effect.kind))
    .map((effect) => ({ ...effect, ageTicks: effect.ageTicks + 1 }))
  const players: Record<string, PlayerCharacterState> = { ...context.players }

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
    const castOwnsFacing = (
      primaryCast.actionTick >= 0 || primaryCast.channelActive
    )
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
        case 'air':
        case 'water': {
          if (!rawHeld) break
          const emitter = primarySpellEmitter(nextPlayer)
          transients = [...transients, {
            ageTicks: 0,
            direction: { ...aimDirection },
            id: nextId,
            kind: player.config.element,
            origin: emitter,
            ownerId: playerId,
            variant: nextId % 4,
            worldKey,
          }]
          nextId += 1
          break
        }
        case 'earth': {
          projectiles = projectiles.map((spell) => {
            if (spell.kind !== 'earth' || spell.ownerId !== playerId || spell.phase !== 'held') {
              return spell
            }
            const emitter = primarySpellEmitter(nextPlayer)
            return {
              ...spell,
              charge: acceptedPress || (!rawHeld && (
                spell.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE
              ))
                ? spell.charge
                : Math.min(1, Math.fround(spell.charge + PRIMARY_SPELL_EARTH_CHARGE_STEP)),
              direction: { ...aimDirection },
              position: { x: emitter.x, y: emitter.y + 15 },
              worldKey,
            }
          })
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
        projectiles = projectiles.map((spell) => {
          if (spell.kind !== 'earth' || spell.ownerId !== playerId || spell.phase !== 'held') {
            return spell
          }
          const velocity = {
            x: aimDirection.x * 3,
            y: aimDirection.y * 3,
          }
          return {
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
        })
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

function transientLifetime(kind: PrimarySpellTransientKind): number {
  return kind === 'air'
    ? PRIMARY_SPELL_AIR_LIFETIME_TICKS
    : PRIMARY_SPELL_WATER_LIFETIME_TICKS
}
