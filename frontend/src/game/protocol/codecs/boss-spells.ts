import { primarySpellTransient } from './primary-transients.ts'
import { NATIVE_BOSS_SPELL_MANAGER_LANES, type NativeBossSpell } from '../../core-kernels/native-boss-spell.ts'
import { boneyardPoint, nativeWorldManagerRegistration } from './native-state.ts'
import { validatedPlayerId } from './values.ts'
import { MAX_BONEYARD_ENEMY_PROJECTILES } from '../game-protocol-limits.ts'
import { boolean, finite, GameProtocolError, integer, limitedArray, memberString, nonnegativeFinite,
  nonnegativeInteger, onlyKeys, positiveFinite, positiveInteger, record, unitInterval } from './values.ts'

const COMMON_KEYS = ['ageTicks', 'damage', 'id', 'kind', 'painterRegistration', 'ownerActorId', 'position', 'spawnTick']
const KINDS = ['ultra-banish', 'unholy-soul', 'eye-laser', 'unholy-spit', 'green-fire', 'unholy-burst', 'mouth-beam-segment', 'skull-missile', 'dark-fireball', 'rain-of-bones', 'tragic-circle', 'dire-fire', 'falling-bone', 'blightning', 'death-magic', 'heartmonger-flicker', 'heartmonger-soul'] as const

export function nativeBossSpells(value: unknown, field: string, tick: number): readonly NativeBossSpell[] {
  const ids = new Set<number>()
  return limitedArray(value, field, MAX_BONEYARD_ENEMY_PROJECTILES).map((entry, index) => {
    const path = `${field}[${index}]`
    const spell = bossSpell(entry, path)
    if (ids.has(spell.id) || spell.spawnTick > tick) throw new GameProtocolError(`${path} has an invalid birth identity`)
    ids.add(spell.id)
    return spell
  })
}

function bossSpell(value: unknown, field: string): NativeBossSpell {
  const source = record(value, field)
  const kind = memberString(source.kind, `${field}.kind`, KINDS)
  const base = {
    ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
    damage: nonnegativeFinite(source.damage, `${field}.damage`),
    id: positiveInteger(source.id, `${field}.id`),
    painterRegistration: nativeWorldManagerRegistration(source.painterRegistration, `${field}.painterRegistration`, NATIVE_BOSS_SPELL_MANAGER_LANES[kind]),
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    position: boneyardPoint(source.position, `${field}.position`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
  }
  switch (kind) {
    case 'ultra-banish':
      onlyKeys(source, field, [...COMMON_KEYS, 'remainingTicks', 'alpha', 'flashAlpha', 'lightRadius', 'megaDeath'])
      return { ...base, kind, remainingTicks: integer(source.remainingTicks, `${field}.remainingTicks`),
        alpha: unitInterval(source.alpha, `${field}.alpha`), flashAlpha: nonnegativeFinite(source.flashAlpha, `${field}.flashAlpha`),
        lightRadius: positiveFinite(source.lightRadius, `${field}.lightRadius`), megaDeath: boolean(source.megaDeath, `${field}.megaDeath`) }
    case 'unholy-soul':
      onlyKeys(source, field, [...COMMON_KEYS, 'origin', 'angleDeg', 'angularSpeed', 'height', 'verticalSpeed', 'scale', 'life', 'fast'])
      return { ...base, kind, origin: boneyardPoint(source.origin, `${field}.origin`), angleDeg: finite(source.angleDeg, `${field}.angleDeg`),
        angularSpeed: nonnegativeFinite(source.angularSpeed, `${field}.angularSpeed`), height: finite(source.height, `${field}.height`),
        verticalSpeed: nonnegativeFinite(source.verticalSpeed, `${field}.verticalSpeed`), scale: unitInterval(source.scale, `${field}.scale`),
        life: positiveFinite(source.life, `${field}.life`), fast: boolean(source.fast, `${field}.fast`) }

    case 'eye-laser':
      onlyKeys(source, field, [...COMMON_KEYS, 'headingDeg', 'phaseDeg', 'velocity'])
      return { ...base, kind, headingDeg: finite(source.headingDeg, `${field}.headingDeg`),
        phaseDeg: finite(source.phaseDeg, `${field}.phaseDeg`), velocity: boneyardPoint(source.velocity, `${field}.velocity`) }
    case 'unholy-spit':
      onlyKeys(source, field, [...COMMON_KEYS, 'origin', 'travel', 'spreadDirection', 'progress', 'progressPerTick', 'height', 'spawnFire', 'spawnImps'])
      return { ...base, kind, origin: boneyardPoint(source.origin, `${field}.origin`),
        travel: boneyardPoint(source.travel, `${field}.travel`), spreadDirection: boneyardPoint(source.spreadDirection, `${field}.spreadDirection`),
        progress: unitInterval(source.progress, `${field}.progress`), progressPerTick: positiveFinite(source.progressPerTick, `${field}.progressPerTick`),
        height: nonnegativeFinite(source.height, `${field}.height`), spawnFire: boolean(source.spawnFire, `${field}.spawnFire`),
        spawnImps: boolean(source.spawnImps, `${field}.spawnImps`) }
    case 'green-fire': {
      onlyKeys(source, field, [...COMMON_KEYS, 'fire', 'glow'])
      const fire = primarySpellTransient(source.fire, `${field}.fire`)
      if (fire.kind !== 'fire-patch' || fire.id !== base.id || fire.position.x !== base.position.x || fire.position.y !== base.position.y
        || fire.painterRegistrations[0]?.registrationOrdinal !== base.painterRegistration.registrationOrdinal) {
        throw new GameProtocolError(`${field}.fire does not match its GreenFire owner`)
      }
      return { ...base, kind, fire, glow: boolean(source.glow, `${field}.glow`) }
    }
    case 'unholy-burst':
      onlyKeys(source, field, [...COMMON_KEYS, 'framePhase', 'frameVelocity', 'offsetY', 'offsetStepY', 'lightIntensity'])
      return { ...base, kind, framePhase: nonnegativeFinite(source.framePhase, `${field}.framePhase`),
        frameVelocity: nonnegativeFinite(source.frameVelocity, `${field}.frameVelocity`), offsetY: finite(source.offsetY, `${field}.offsetY`),
        offsetStepY: finite(source.offsetStepY, `${field}.offsetStepY`), lightIntensity: nonnegativeFinite(source.lightIntensity, `${field}.lightIntensity`) }
    case 'mouth-beam-segment': {
      onlyKeys(source, field, [...COMMON_KEYS, 'vertices', 'uvOffset', 'startAlpha', 'endAlpha'])
      const vertices = limitedArray(source.vertices, `${field}.vertices`, 4).map((value, index) => boneyardPoint(value, `${field}.vertices[${index}]`))
      if (vertices.length !== 4) throw new GameProtocolError(`${field}.vertices requires a quad`)
      return { ...base, kind, vertices, uvOffset: unitInterval(source.uvOffset, `${field}.uvOffset`),
        startAlpha: unitInterval(source.startAlpha, `${field}.startAlpha`), endAlpha: unitInterval(source.endAlpha, `${field}.endAlpha`) }
    }

    case 'heartmonger-flicker':
      onlyKeys(source, field, [...COMMON_KEYS, 'phaseDeg'])
      return { ...base, kind, phaseDeg: nonnegativeFinite(source.phaseDeg, `${field}.phaseDeg`) }
    case 'heartmonger-soul':
      onlyKeys(source, field, [...COMMON_KEYS, 'lifePhaseDeg', 'bobPhaseDeg'])
      return { ...base, kind, lifePhaseDeg: nonnegativeFinite(source.lifePhaseDeg, `${field}.lifePhaseDeg`),
        bobPhaseDeg: finite(source.bobPhaseDeg, `${field}.bobPhaseDeg`) }
    case 'blightning':
      onlyKeys(source, field, [...COMMON_KEYS, 'endpoint', 'midpoint'])
      return { ...base, kind, endpoint: boneyardPoint(source.endpoint, `${field}.endpoint`),
        midpoint: boneyardPoint(source.midpoint, `${field}.midpoint`) }
    case 'death-magic': {
      onlyKeys(source, field, [...COMMON_KEYS, 'scale', 'alpha', 'alphaLossPerTick', 'painterSortBias', 'light'])
      const light = source.light === null ? null : record(source.light, `${field}.light`)
      if (light !== null) onlyKeys(light, `${field}.light`, ['radius', 'intensity', 'lossPerTick'])
      return { ...base, kind, scale: positiveFinite(source.scale, `${field}.scale`),
        alpha: positiveFinite(source.alpha, `${field}.alpha`),
        alphaLossPerTick: positiveFinite(source.alphaLossPerTick, `${field}.alphaLossPerTick`),
        painterSortBias: finite(source.painterSortBias, `${field}.painterSortBias`),
        light: light === null ? null : { radius: positiveFinite(light.radius, `${field}.light.radius`),
          intensity: unitInterval(light.intensity, `${field}.light.intensity`),
          lossPerTick: positiveFinite(light.lossPerTick, `${field}.light.lossPerTick`) },
      }
    }
    case 'falling-bone': {
      onlyKeys(source, field, [...COMMON_KEYS, 'entry', 'height', 'colorRamp', 'rotationDeg'])
      const entry = integer(source.entry, `${field}.entry`)
      if (!(entry >= 113 && entry <= 121 || entry >= 1819 && entry <= 1822)) {
        throw new GameProtocolError(`${field}.entry is not a falling bone`)
      }
      return { ...base, kind, entry, height: finite(source.height, `${field}.height`),
        colorRamp: unitInterval(source.colorRamp, `${field}.colorRamp`),
        rotationDeg: finite(source.rotationDeg, `${field}.rotationDeg`) }
    }
    case 'skull-missile':
      onlyKeys(source, field, [...COMMON_KEYS, 'headingDeg', 'minimumSpeed', 'phaseDeg', 'remainingTicks',
        'speed', 'targetPlayerId', 'turnRate', 'visualScale'])
      return { ...base, kind,
        headingDeg: finite(source.headingDeg, `${field}.headingDeg`),
        minimumSpeed: nonnegativeFinite(source.minimumSpeed, `${field}.minimumSpeed`),
        phaseDeg: finite(source.phaseDeg, `${field}.phaseDeg`),
        remainingTicks: positiveFinite(source.remainingTicks, `${field}.remainingTicks`),
        speed: nonnegativeFinite(source.speed, `${field}.speed`),
        targetPlayerId: source.targetPlayerId === null ? null : validatedPlayerId(source.targetPlayerId, `${field}.targetPlayerId`),
        turnRate: positiveFinite(source.turnRate, `${field}.turnRate`),
        visualScale: positiveFinite(source.visualScale, `${field}.visualScale`),
      }
    case 'dark-fireball':
      onlyKeys(source, field, [...COMMON_KEYS, 'arcPhase', 'arcPhaseStep', 'groundFireDamage', 'headingDeg',
        'remainingTicks', 'velocity'])
      return { ...base, kind,
        arcPhase: nonnegativeFinite(source.arcPhase, `${field}.arcPhase`),
        arcPhaseStep: nonnegativeFinite(source.arcPhaseStep, `${field}.arcPhaseStep`),
        groundFireDamage: nonnegativeFinite(source.groundFireDamage, `${field}.groundFireDamage`),
        headingDeg: finite(source.headingDeg, `${field}.headingDeg`),
        remainingTicks: positiveFinite(source.remainingTicks, `${field}.remainingTicks`),
        velocity: boneyardPoint(source.velocity, `${field}.velocity`),
      }
    case 'rain-of-bones':
      onlyKeys(source, field, [...COMMON_KEYS, 'alpha', 'phase', 'remainingTicks', 'rotationSign', 'scale'])
      return { ...base, kind, alpha: unitInterval(source.alpha, `${field}.alpha`),
        phase: nonnegativeFinite(source.phase, `${field}.phase`),
        remainingTicks: integer(source.remainingTicks, `${field}.remainingTicks`),
        rotationSign: sign(source.rotationSign, `${field}.rotationSign`),
        scale: positiveFinite(source.scale, `${field}.scale`),
      }
    case 'tragic-circle':
      onlyKeys(source, field, [...COMMON_KEYS, 'remainingTicks'])
      return { ...base, kind, remainingTicks: positiveInteger(source.remainingTicks, `${field}.remainingTicks`) }
    case 'dire-fire':
      onlyKeys(source, field, [...COMMON_KEYS, 'alpha', 'glow', 'phase', 'ramp', 'rotationPhases', 'rotationRates',
        'rotationSigns', 'scale', 'scaleSign'])
      return { ...base, kind,
        alpha: positiveFinite(source.alpha, `${field}.alpha`), glow: boolean(source.glow, `${field}.glow`),
        phase: nonnegativeFinite(source.phase, `${field}.phase`), ramp: unitInterval(source.ramp, `${field}.ramp`),
        rotationPhases: pair(source.rotationPhases, `${field}.rotationPhases`, finite),
        rotationRates: pair(source.rotationRates, `${field}.rotationRates`, finite),
        rotationSigns: pair(source.rotationSigns, `${field}.rotationSigns`, sign),
        scale: positiveFinite(source.scale, `${field}.scale`), scaleSign: sign(source.scaleSign, `${field}.scaleSign`),
      }
  }
}

function pair(value: unknown, field: string, read: (value: unknown, field: string) => number): readonly [number, number] {
  const entries = limitedArray(value, field, 2)
  if (entries.length !== 2) throw new GameProtocolError(`${field} requires two values`)
  return [read(entries[0], field), read(entries[1], field)]
}

function sign(value: unknown, field: string): number {
  const result = integer(value, field)
  if (result !== -1 && result !== 1) throw new GameProtocolError(`${field} must be a sign`)
  return result
}
