import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS } from '../core-kernels/native-ether-blast.ts'
import {
  NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS,
  nativeFireParticleLifetimeTicks,
} from '../core-kernels/primary-spell-fire-native.ts'
import { waterFrostJetLifetimeTicks } from '../core-kernels/primary-spell-water.ts'
import type {
  PrimarySpellProjectileState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  PRIMARY_SPELL_AIR_LIFETIME_TICKS,
  PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS,
  PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
  PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS,
} from '../core-kernels/primary-spells.ts'
import {
  copyPrimarySpellState,
  interpolatePrimarySpellState,
} from './primary-spell-presentation.ts'
import {
  orientation,
  registration,
  TRANSIENT_KINDS,
  transient,
  type TransientKind,
} from './primary-spell-presentation-quality.test-support.ts'

interface TransientContract {
  degrees?: readonly string[]
  forwardCycle?: Readonly<{ field: string; period: number }>
  nullableVectors?: readonly string[]
  nullableNumbers?: readonly string[]
  numbers?: readonly string[]
  owned?: readonly string[]
  vectors?: readonly string[]
}

const TRANSIENT_CONTRACTS: Record<TransientKind, TransientContract> = {
  'harden-burst': { numbers: ['ageTicks', 'alpha'], owned: ['position'], vectors: ['position'] },
  'harden-shard': {
    numbers: ['ageTicks', 'height', 'life', 'rotationDegrees', 'verticalVelocity'],
    owned: ['position', 'velocity'], vectors: ['position', 'velocity'],
  },
  air: { numbers: ['ageTicks'], owned: ['direction', 'endpoint', 'lightRegistration', 'midpoint', 'origin'] },
  'air-hurricane': { numbers: ['ageTicks', 'charge', 'contactCharge', 'phaseDegrees'], owned: ['lanes', 'position'], vectors: ['position'] },
  'earth-boulder-bit': { numbers: ['ageTicks'], owned: ['debris', 'debris.position', 'debris.velocity', 'origin', 'position'], vectors: ['origin', 'position'] },
  'earth-called-rock': { numbers: ['ageTicks', 'fallVelocity', 'height', 'rotation', 'speed'], owned: ['position'], vectors: ['position'] },
  'earth-impact': { numbers: ['ageTicks'], owned: ['origin'], vectors: ['origin'] },
  'ether-blast': { numbers: ['ageTicks'], owned: ['origin', 'presentationRng', 'presentationRng.words'], vectors: ['origin'] },
  'ether-impact': { numbers: ['ageTicks'], owned: ['lightRegistration', 'origin'] },
  'ether-pierce-streak': { numbers: ['ageTicks'], owned: ['origin'] },
  fire: { numbers: ['ageTicks'], owned: ['direction', 'origin'] },
  'fire-ember': { forwardCycle: { field: 'phase', period: 4 }, numbers: ['ageTicks', 'height', 'life', 'verticalVelocity'], owned: ['horizontalVelocity', 'lightRegistration', 'position'], vectors: ['horizontalVelocity', 'position'] },
  'fire-explosion': { numbers: ['ageTicks'], owned: ['lightRegistration', 'origin'] },
  'fire-good-imp': { nullableNumbers: ['contactAgeTicks'], numbers: ['ageTicks', 'bodyRotationDeg', 'bodyScale', 'contactScale', 'effectAlpha', 'effectPhase', 'flightSpeed', 'headingDegrees', 'lightGlow', 'remainingTicks', 'verticalOffset', 'verticalVelocity'], owned: ['contactOrigin', 'lightRegistration', 'position'], vectors: ['position'] },
  'fire-impact': { numbers: ['ageTicks'], owned: ['lightRegistration', 'origin'] },
  'fire-patch': { owned: ['position', 'velocity', 'velocityMultiplier'] },
  'player-staff-contact': { numbers: ['ageTicks'], owned: ['impactSoundPitches', 'origin', 'pikeBreakSoundIndexes', 'procSoundPitches', 'targetIds'], vectors: ['origin'] },
  'player-staff-contact-knockback': { owned: ['delta'] },
  'player-staff-knockback': { numbers: ['ageTicks', 'remainingDistance'], owned: ['origin', 'targetIds'] },
  'player-staff-melee': { degrees: ['headingDegrees'], numbers: ['ageTicks', 'progress'], owned: ['origin'], vectors: ['origin'] },
  'player-staff-move-fade': { numbers: ['ageTicks', 'alpha'], owned: ['position', 'velocity'], vectors: ['position', 'velocity'] },
  'player-staff-perspective-fade': { numbers: ['ageTicks', 'alpha'], owned: ['position'] },
  'player-staff-pike-break': { numbers: ['ageTicks'], owned: ['position', 'presentationRng', 'presentationRng.words'] },
  'player-staff-smoke': { degrees: ['rotationDegrees'], numbers: ['ageTicks', 'alpha'], owned: ['position'], vectors: ['position'] },
  'player-staff-spin': { degrees: ['headingDegrees'], numbers: ['ageTicks', 'countdown'], owned: ['origin'], vectors: ['origin'] },
  water: { numbers: ['ageTicks'], owned: ['direction', 'obstructionPoint', 'origin'], vectors: ['direction', 'origin'] },
  'water-aura': { numbers: ['ageTicks'], owned: ['origin'], vectors: ['origin'] },
  'water-hail': { degrees: ['rotationDegrees'], numbers: ['ageTicks', 'height', 'life', 'verticalVelocity'], owned: ['horizontalVelocity', 'position'], vectors: ['horizontalVelocity', 'position'] },
  'weld-blizzard-chain-frost': { owned: ['direction', 'origin', 'vector'] },
  'weld-blizzard-glow': { owned: ['direction', 'origin', 'vector'] },
  'weld-boulder-debris': { numbers: ['ageTicks'], owned: ['debris', 'debris.position', 'debris.velocity', 'direction', 'origin', 'position', 'vector'], vectors: ['direction', 'origin', 'position'] },
  'weld-channel': { nullableVectors: ['endpoint', 'midpoint'], numbers: ['ageTicks'], owned: ['direction', 'endpoint', 'midpoint', 'origin', 'vector'], vectors: ['direction', 'origin'] },
  'weld-flame-lash-fade': { numbers: ['ageTicks', 'alpha'], owned: ['direction', 'origin', 'position', 'vector'], vectors: ['direction', 'origin', 'position'] },
  'weld-frost-fade': { owned: ['direction', 'origin', 'vector'] },
  'weld-ground-spark-fade': { numbers: ['ageTicks', 'alpha'], owned: ['direction', 'origin', 'position', 'vector'], vectors: ['direction', 'origin', 'position'] },
  'weld-hail-flash': { numbers: ['ageTicks', 'alpha'], owned: ['direction', 'origin', 'position', 'vector'], vectors: ['direction', 'origin', 'position'] },
  'weld-hail-knockback': { owned: ['delta', 'direction', 'origin', 'vector'] },
  'weld-hail-line': { numbers: ['ageTicks', 'alpha'], owned: ['direction', 'end', 'origin', 'start', 'vector'], vectors: ['direction', 'end', 'origin', 'start'] },
  'weld-hail-rock-fade': { numbers: ['ageTicks'], owned: ['direction', 'origin', 'position', 'vector'], vectors: ['direction', 'origin', 'position'] },
  'weld-hail-terrain-bouncer': { degrees: ['rotationDegrees'], numbers: ['ageTicks', 'alpha', 'height'], owned: ['direction', 'origin', 'position', 'vector', 'velocity'], vectors: ['direction', 'origin', 'position', 'velocity'] },
  'weld-hail-terrain-particle': { numbers: ['ageTicks', 'alpha'], owned: ['direction', 'origin', 'position', 'vector', 'velocity'], vectors: ['direction', 'origin', 'position', 'velocity'] },
  'weld-impact': { numbers: ['ageTicks', 'alpha'], owned: ['direction', 'origin', 'position', 'vector'], vectors: ['direction', 'origin', 'position'] },
  'weld-meteor': { numbers: ['ageTicks', 'bodyScale', 'fallHeight'], owned: ['cameraDisplacement', 'debris', 'debris.0.position', 'debris.0.velocity', 'direction', 'lightRegistration', 'origin', 'position', 'vector'], vectors: ['direction', 'origin', 'position'] },
  'weld-meteor-flash': { numbers: ['ageTicks', 'alpha'], owned: ['direction', 'origin', 'position', 'vector'], vectors: ['direction', 'origin', 'position'] },
  'weld-meteor-marker': { degrees: ['rotationDegrees'], numbers: ['ageTicks', 'alpha', 'scale'], owned: ['direction', 'origin', 'vector'], vectors: ['direction', 'origin'] },
  'weld-persistent': { numbers: ['ageTicks'], owned: ['direction', 'origin', 'vector'], vectors: ['direction', 'origin'] },
  'weld-steam': { numbers: ['ageTicks', 'blue', 'life', 'phase', 'remainingDistance', 'scale', 'stretch', 'tintFade'], owned: ['direction', 'origin', 'position', 'terminalPosition', 'vector', 'velocity'], vectors: ['direction', 'origin', 'position', 'velocity'] },
}

function state(transients: readonly PrimarySpellTransientState[]): PrimarySpellSimulationState {
  return { nextId: 100, projectiles: [], transients }
}

function valueAt(value: object, path: string) {
  const properties = path.split('.')
  let owner = value
  for (let index = 0; index < properties.length - 1; index += 1) {
    owner = Object(Reflect.get(owner, properties[index]!))
  }
  return Reflect.get(owner, properties.at(-1)!)
}

function numberAt(value: object, path: string): number {
  return Number(valueAt(value, path))
}

function nullableNumberAt(value: object, path: string): number | null {
  const result = valueAt(value, path)
  return result === null ? null : Number(result)
}

function vectorAt(value: object, path: string): Readonly<{ x: number; y: number }> {
  const result = Object(valueAt(value, path))
  return { x: Number(Reflect.get(result, 'x')), y: Number(Reflect.get(result, 'y')) }
}

function nullableVectorAt(
  value: object,
  path: string,
): Readonly<{ x: number; y: number }> | null {
  return valueAt(value, path) === null ? null : vectorAt(value, path)
}

function objectAt(value: object, path: string): object {
  return Object(valueAt(value, path))
}

function lerpValue(first: number, second: number, blend: number): number {
  return first + (second - first) * blend
}

function expectedFixedAge(kind: TransientKind): number | null {
  switch (kind) {
    case 'air':
    case 'earth-impact':
    case 'ether-blast':
    case 'ether-impact':
    case 'water-aura':
    case 'weld-blizzard-chain-frost':
    case 'weld-frost-fade': return 1
    case 'ether-pierce-streak':
    case 'fire':
    case 'fire-explosion':
    case 'fire-impact':
    case 'water': return 3
    case 'weld-blizzard-glow': return 0
    default: return null
  }
}

function expectedPresentation(
  older: PrimarySpellTransientState,
  newer: PrimarySpellTransientState,
  blend: number,
): PrimarySpellTransientState {
  const birthTick = older.kind === 'weld-blizzard-glow' ? 1 : 0
  const previous = { ...older, birthTick } as PrimarySpellTransientState
  const next = { ...newer, birthTick } as PrimarySpellTransientState
  const expected = structuredClone(blend < 1 ? previous : next)
  if (previous.kind !== next.kind) return expected

  const contract = TRANSIENT_CONTRACTS[previous.kind]
  if (previous.kind === 'weld-persistent' && next.kind === 'weld-persistent'
    && previous.buildId !== next.buildId) return expected
  const numbers = [...contract.numbers ?? []]
  const vectors = [...contract.vectors ?? []]
  const nullableNumbers = [...contract.nullableNumbers ?? []]
  if (previous.kind === 'weld-persistent' && next.kind === 'weld-persistent') {
    if (previous.buildId === 1006 && next.buildId === 1006) {
      numbers.push('scale', 'shellScale')
      vectors.push('velocity')
    }
    if (previous.buildId === 1008 && next.buildId === 1008) {
      numbers.push('scale')
      nullableNumbers.push('releaseAgeTicks', 'releaseFadeScale')
    }
  }
  for (const field of numbers) {
    Reflect.set(expected, field, lerpValue(
      numberAt(previous, field),
      numberAt(next, field),
      blend,
    ))
  }
  for (const field of contract.degrees ?? []) {
    const first = numberAt(previous, field)
    const second = numberAt(next, field)
    const delta = ((second - first + 540) % 360) - 180
    Reflect.set(expected, field, first + delta * blend)
  }
  for (const field of vectors) {
    const first = vectorAt(previous, field)
    const second = vectorAt(next, field)
    Reflect.set(expected, field, {
      x: lerpValue(first.x, second.x, blend),
      y: lerpValue(first.y, second.y, blend),
    })
  }
  for (const field of nullableNumbers) {
    const first = nullableNumberAt(previous, field)
    const second = nullableNumberAt(next, field)
    Reflect.set(expected, field, first === null || second === null
      ? (blend < 1 ? first : second)
      : lerpValue(first, second, blend))
  }
  for (const field of contract.nullableVectors ?? []) {
    const first = nullableVectorAt(previous, field)
    const second = nullableVectorAt(next, field)
    if (first !== null && second !== null) {
      Reflect.set(expected, field, {
        x: lerpValue(first.x, second.x, blend),
        y: lerpValue(first.y, second.y, blend),
      })
    }
  }
  if (contract.forwardCycle) {
    const { field, period } = contract.forwardCycle
    const first = numberAt(previous, field)
    const second = numberAt(next, field)
    const delta = ((second - first) % period + period) % period
    Reflect.set(expected, field, ((first + delta * blend) % period + period) % period)
  }
  if (previous.kind === 'air-hurricane' && next.kind === 'air-hurricane') {
    const lanes = (blend < 1 ? previous : next).lanes.map((lane, index) => ({
      ...lane,
      angleDegrees: lerpValue(
        previous.lanes[index]!.angleDegrees,
        next.lanes[index]!.angleDegrees,
        blend,
      ),
    }))
    Reflect.set(expected, 'lanes', lanes)
  }
  const fixedAge = expectedFixedAge(previous.kind)
  if (fixedAge !== null) Reflect.set(expected, 'ageTicks', fixedAge)
  return expected
}

function expectedProjectilePresentation(
  older: PrimarySpellProjectileState,
  newer: PrimarySpellProjectileState,
  blend: number,
): PrimarySpellProjectileState {
  const expected = structuredClone(blend < 1 ? older : newer)
  if (older.kind !== newer.kind) return expected
  for (const field of ['ageTicks', 'direction', 'position', 'velocity'] as const) {
    if (field === 'ageTicks') {
      Reflect.set(expected, field, lerpValue(older[field], newer[field], blend))
    } else {
      Reflect.set(expected, field, {
        x: lerpValue(older[field].x, newer[field].x, blend),
        y: lerpValue(older[field].y, newer[field].y, blend),
      })
    }
  }
  if (older.kind === 'weld' && newer.kind === 'weld') {
    for (const field of [
      'ballLightningAcceleration',
      'basePresentationPhaseDegrees',
      'frostTurnDegrees',
      'groundSparkNativeAgeTicks',
    ] as const) {
      const first = older[field]
      const second = newer[field]
      Reflect.set(expected, field, first === null || second === null
        ? (blend < 1 ? first : second)
        : lerpValue(first, second, blend))
    }
    return expected
  }
  Reflect.set(expected, 'charge', lerpValue(older.charge, newer.charge, blend))
  if (older.kind === 'earth' && newer.kind === 'earth') {
    Reflect.set(expected, 'shellCharge', lerpValue(older.shellCharge, newer.shellCharge, blend))
  }
  return expected
}

function projectile(
  kind: PrimarySpellProjectileState['kind'],
  value = 2,
): PrimarySpellProjectileState {
  const vector = { x: value, y: value }
  return {
    ageTicks: value,
    assemblyCharge: value,
    ballLightningAcceleration: value,
    basePresentationPhaseDegrees: value,
    buildId: 1000,
    burnDamage: value,
    castPlaybackRate: value,
    castSoundVariant: value,
    charge: kind === 'weld' ? 1 : value,
    contactsRemaining: value,
    damage: value,
    damageRetention: value,
    direction: vector,
    emberDamage: value,
    emberFragments: value,
    explodeDamage: value,
    explodeRadius: value,
    flightTicks: value,
    frostPresentationLanes: [
      { aspect: value, rotationDegrees: value, scale: value },
      { aspect: value, rotationDegrees: value, scale: value },
    ],
    frostPulseAspect: value,
    frostTurnDegrees: value,
    groundSparkNativeAgeTicks: value,
    groundSparkTurnTicksRemaining: value,
    headingDegrees: value,
    hitTargetIds: ['enemy:1'],
    id: 7,
    kind,
    lightRegistration: registration,
    maximumCharge: value,
    orientation,
    ownerId: 'wizard',
    phase: 'flight',
    piercesRemaining: value,
    position: vector,
    presentationSeed: 42,
    privateSeed: 42,
    projectileIndex: 0,
    reacquiresTarget: false,
    remainingDamage: value,
    secondaryPresentationPhaseDegrees: value,
    shellCharge: value,
    speed: value,
    spentEmber: { kind: 'none' },
    targetId: 'enemy:1',
    toughness: value,
    turnAccumulator: value,
    turnInput: value,
    underpowered: false,
    vector: [value, value],
    velocity: vector,
    visualScale: value,
    painterRegistrations: [{ ...registration, registrationOrdinal: value }],
    worldKey: 'boneyard:test',
  } as PrimarySpellProjectileState
}

function presentation(
  older: PrimarySpellTransientState,
  newer: PrimarySpellTransientState,
  blend = 0.5,
): PrimarySpellTransientState | undefined {
  const birthTick = older.kind === 'weld-blizzard-glow' ? 1 : 0
  const olderWithTiming = { ...older, birthTick } as PrimarySpellTransientState
  const newerWithTiming = { ...newer, birthTick } as PrimarySpellTransientState
  return interpolatePrimarySpellState(
    state([olderWithTiming]),
    state([newerWithTiming]),
    blend,
    { newerTick: 2, olderTick: 0, targetTick: 1 },
  ).transients[0]
}

function presentationAt(
  effect: PrimarySpellTransientState,
  snapshotTick: number,
  targetTick: number,
): PrimarySpellTransientState | undefined {
  return interpolatePrimarySpellState(
    state([effect]),
    state([effect]),
    0.5,
    { newerTick: snapshotTick, olderTick: snapshotTick, targetTick },
  ).transients[0]
}

test('every replicated transient family copies without sharing its root object', () => {
  for (const kind of TRANSIENT_KINDS) {
    const source = transient(kind)
    const copied = copyPrimarySpellState(state([source])).transients[0]
    assert.ok(copied, kind)
    assert.notEqual(copied, source, kind)
    assert.deepEqual(copied, source, kind)
    for (const path of TRANSIENT_CONTRACTS[kind].owned ?? []) {
      assert.notEqual(objectAt(copied, path), objectAt(source, path), `${kind}:${path}`)
    }
  }
})

test('every transient family accepts consecutive presentation snapshots', () => {
  for (const kind of TRANSIENT_KINDS) {
    const interpolated = presentation(transient(kind, 2), transient(kind, 6))
    assert.ok(interpolated, kind)
    assert.equal(interpolated.kind, kind)
    assert.ok(Number.isFinite(interpolated.ageTicks), kind)
    assert.deepEqual(
      interpolated,
      expectedPresentation(transient(kind, 2), transient(kind, 6), 0.5),
      kind,
    )

    const newer = presentation(transient(kind, 2), transient(kind, 6), 1)
    assert.ok(newer, kind)
    assert.equal(newer.kind, kind)
    assert.deepEqual(
      newer,
      expectedPresentation(transient(kind, 2), transient(kind, 6), 1),
      `${kind}:newer`,
    )
  }
})

test('fire patches remain state-driven across consecutive snapshots', () => {
  const interpolated = presentation(
    transient('fire-patch', 2),
    transient('fire-patch', 6),
  )
  assert.ok(interpolated?.kind === 'fire-patch')
  assert.deepEqual(interpolated.position, { x: 2, y: 2 })
  assert.notEqual(interpolated.position, transient('fire-patch', 2).position)
})

test('nullable presentation lanes preserve discrete ownership at both bracket ends', () => {
  const olderWater = transient('water', 2, { obstructionPoint: null })
  const newerWater = transient('water', 6, { obstructionPoint: null })
  const copiedWater = copyPrimarySpellState(state([olderWater])).transients[0]
  assert.ok(copiedWater?.kind === 'water')
  assert.equal(copiedWater.obstructionPoint, null)

  const olderImp = transient('fire-good-imp', 2, {
    contactAgeTicks: null,
    contactOrigin: null,
  })
  const newerImp = transient('fire-good-imp', 6, {
    contactAgeTicks: null,
    contactOrigin: null,
  })
  const interpolatedImp = presentation(olderImp, newerImp)
  assert.ok(interpolatedImp?.kind === 'fire-good-imp')
  assert.equal(interpolatedImp.contactAgeTicks, null)
  assert.equal(interpolatedImp.contactOrigin, null)
  const copiedImp = copyPrimarySpellState(state([olderImp])).transients[0]
  assert.ok(copiedImp?.kind === 'fire-good-imp')
  assert.equal(copiedImp.contactOrigin, null)

  const impBirth = transient('fire-good-imp', 2, { contactAgeTicks: null })
  const impContact = transient('fire-good-imp', 6)
  assert.deepEqual(
    presentation(impBirth, impContact),
    expectedPresentation(impBirth, impContact, 0.5),
  )
  assert.deepEqual(
    presentation(impBirth, impContact, 1),
    expectedPresentation(impBirth, impContact, 1),
  )
  assert.deepEqual(
    presentation(impContact, impBirth),
    expectedPresentation(impContact, impBirth, 0.5),
  )
  assert.deepEqual(
    presentation(impContact, impBirth, 1),
    expectedPresentation(impContact, impBirth, 1),
  )

  const presentedWater = presentation(olderWater, newerWater)
  assert.deepEqual(presentedWater, expectedPresentation(olderWater, newerWater, 0.5))
})

test('nullable Weld lanes follow the selected snapshot without sharing vectors', () => {
  const olderChannel = transient('weld-channel', 2, {
    endpoint: null,
    midpoint: null,
  })
  const newerChannel = transient('weld-channel', 6)
  const olderPresentation = presentation(olderChannel, newerChannel)
  assert.ok(olderPresentation?.kind === 'weld-channel')
  assert.equal(olderPresentation.endpoint, null)
  assert.equal(olderPresentation.midpoint, null)

  const newerPresentation = presentation(olderChannel, newerChannel, 1)
  assert.ok(newerPresentation?.kind === 'weld-channel')
  assert.deepEqual(newerPresentation.endpoint, { x: 6, y: 6 })
  assert.deepEqual(newerPresentation.midpoint, { x: 6, y: 6 })
  assert.notEqual(newerPresentation.endpoint, newerChannel.endpoint)
  assert.notEqual(newerPresentation.midpoint, newerChannel.midpoint)

  const copiedNullChannel = copyPrimarySpellState(state([olderChannel])).transients[0]
  assert.ok(copiedNullChannel?.kind === 'weld-channel')
  assert.equal(copiedNullChannel.endpoint, null)
  assert.equal(copiedNullChannel.midpoint, null)

  const vectorToNull = presentation(newerChannel, olderChannel)
  assert.deepEqual(vectorToNull, expectedPresentation(newerChannel, olderChannel, 0.5))
  const nullAtEdge = presentation(newerChannel, olderChannel, 1)
  assert.deepEqual(nullAtEdge, expectedPresentation(newerChannel, olderChannel, 1))
})

test('Weld actor copies retain nullable ownership and every persistent build contract', () => {
  const meteor = transient('weld-meteor', 2, { cameraDisplacement: null })
  const copiedMeteor = copyPrimarySpellState(state([meteor])).transients[0]
  assert.ok(copiedMeteor?.kind === 'weld-meteor')
  assert.equal(copiedMeteor.cameraDisplacement, null)
  const presentedMeteor = presentation(meteor, transient('weld-meteor', 6, {
    cameraDisplacement: null,
  }))
  assert.ok(presentedMeteor?.kind === 'weld-meteor')
  assert.equal(presentedMeteor.cameraDisplacement, null)

  const impact = transient('weld-impact', 2, { lightRegistration: registration })
  const copiedImpact = copyPrimarySpellState(state([impact])).transients[0]
  assert.ok(copiedImpact?.kind === 'weld-impact')
  assert.deepEqual(copiedImpact.lightRegistration, registration)
  assert.notEqual(copiedImpact.lightRegistration, impact.lightRegistration)
  const presentedImpact = presentation(impact, transient('weld-impact', 6, {
    lightRegistration: registration,
  }))
  assert.ok(presentedImpact?.kind === 'weld-impact')
  assert.deepEqual(presentedImpact.lightRegistration, registration)

  const boulder = transient('weld-persistent', 2, {
    buildId: 1006,
    lightRegistration: registration,
  })
  const newerBoulder = transient('weld-persistent', 6, {
    buildId: 1006,
    lightRegistration: registration,
  })
  if (boulder.buildId !== 1006 || newerBoulder.buildId !== 1006) assert.fail()
  const copiedBoulder = copyPrimarySpellState(state([boulder])).transients[0]
  assert.ok(copiedBoulder?.kind === 'weld-persistent' && copiedBoulder.buildId === 1006)
  assert.notEqual(copiedBoulder.hitTargetIds, boulder.hitTargetIds)
  assert.notEqual(copiedBoulder.velocity, boulder.velocity)
  const boulderPresentation = presentation(boulder, newerBoulder)
  assert.ok(boulderPresentation?.kind === 'weld-persistent'
    && boulderPresentation.buildId === 1006)
  assert.deepEqual(boulderPresentation, expectedPresentation(boulder, newerBoulder, 0.5))
  assert.equal(boulderPresentation.scale, 4)
  assert.equal(boulderPresentation.shellScale, 4)
  const newerBoulderPresentation = presentation(boulder, newerBoulder, 1)
  assert.ok(newerBoulderPresentation?.kind === 'weld-persistent'
    && newerBoulderPresentation.buildId === 1006)
  assert.deepEqual(newerBoulderPresentation, expectedPresentation(boulder, newerBoulder, 1))
  assert.equal(newerBoulderPresentation.scale, 6)

  const hail = transient('weld-persistent', 2, {
    buildId: 1008,
    lightRegistration: registration,
    releaseAgeTicks: null,
    releaseFadeScale: null,
    rocks: [{
      damageRemaining: 2,
      decay: 2,
      localPosition: { x: 2, y: 2, z: 2 },
      phase: 2,
      releaseOffset: null,
      rockId: 0,
      spriteRecord: 168,
      visualScale: 2,
    }],
  })
  if (hail.buildId !== 1008) assert.fail()
  const copiedHail = copyPrimarySpellState(state([hail])).transients[0]
  assert.ok(copiedHail?.kind === 'weld-persistent' && copiedHail.buildId === 1008)
  assert.deepEqual(copiedHail, hail)
  assert.equal(copiedHail.rocks[0]?.releaseOffset, null)
  assert.notEqual(copiedHail.rocks[0], hail.rocks[0])
  const newerHail = transient('weld-persistent', 6, {
    buildId: 1008,
    lightRegistration: registration,
  })
  const hailPresentation = presentation(hail, newerHail)
  assert.ok(hailPresentation?.kind === 'weld-persistent' && hailPresentation.buildId === 1008)
  assert.deepEqual(hailPresentation, expectedPresentation(hail, newerHail, 0.5))
  assert.equal(hailPresentation.releaseAgeTicks, null)
  const newerHailPresentation = presentation(hail, newerHail, 1)
  assert.ok(newerHailPresentation?.kind === 'weld-persistent'
    && newerHailPresentation.buildId === 1008)
  assert.deepEqual(newerHailPresentation, expectedPresentation(hail, newerHail, 1))
  assert.equal(newerHailPresentation.releaseAgeTicks, 6)
})

test('fixed transient copies preserve only their authored shape', () => {
  const aura = {
    ageTicks: 2,
    alphaDecay: 0.05,
    birthTick: 0,
    durationTicks: 13,
    id: 80,
    initialRotationDegrees: 30,
    kind: 'water-aura',
    origin: { x: 10, y: 20 },
    ownerId: 'wizard',
    rotationStepDegrees: 2,
    worldKey: 'boneyard:test',
  } satisfies PrimarySpellTransientState
  const copiedAura = copyPrimarySpellState(state([aura])).transients[0]
  assert.deepEqual(copiedAura, aura)
  assert.ok(copiedAura?.kind === 'water-aura')
  assert.notEqual(copiedAura.origin, aura.origin)

  const frost = {
    ageTicks: 2,
    birthTick: 0,
    buildId: 1004,
    direction: { x: 1, y: 0 },
    id: 81,
    kind: 'weld-frost-fade',
    lightRegistration: null,
    origin: { x: 10, y: 20 },
    ownerId: 'wizard',
    scale: 1,
    vector: [1, 2, 3],
    worldKey: 'boneyard:test',
  } satisfies PrimarySpellTransientState
  const copiedFrost = copyPrimarySpellState(state([frost])).transients[0]
  assert.deepEqual(copiedFrost, frost)
  assert.ok(copiedFrost?.kind === 'weld-frost-fade')
  assert.notEqual(copiedFrost.direction, frost.direction)
  assert.notEqual(copiedFrost.origin, frost.origin)
  assert.notEqual(copiedFrost.vector, frost.vector)
})

test('kind and persistent-build replacements remain discrete at the snapshot edge', () => {
  const older = transient('fire-patch', 2)
  const newer = transient('water-hail', 6)
  const beforeEdge = presentation(older, newer)
  assert.ok(beforeEdge?.kind === 'fire-patch')
  assert.deepEqual(beforeEdge, expectedPresentation(older, newer, 0.5))
  const atEdge = presentation(older, newer, 1)
  assert.ok(atEdge?.kind === 'water-hail')
  assert.deepEqual(atEdge, expectedPresentation(older, newer, 1))

  const olderField = transient('weld-persistent', 2, { buildId: 1007 })
  const newerBoulder = transient('weld-persistent', 6, {
    buildId: 1006,
    lightRegistration: registration,
  })
  const fieldBeforeEdge = presentation(olderField, newerBoulder)
  assert.ok(fieldBeforeEdge?.kind === 'weld-persistent' && fieldBeforeEdge.buildId === 1007)
  assert.deepEqual(fieldBeforeEdge, expectedPresentation(olderField, newerBoulder, 0.5))
  const boulderAtEdge = presentation(olderField, newerBoulder, 1)
  assert.ok(boulderAtEdge?.kind === 'weld-persistent' && boulderAtEdge.buildId === 1006)
  assert.deepEqual(boulderAtEdge, expectedPresentation(olderField, newerBoulder, 1))

  const olderMelee = transient('player-staff-melee', 2)
  const newerMeteor = transient('weld-meteor', 6)
  assert.deepEqual(
    presentation(olderMelee, newerMeteor),
    expectedPresentation(olderMelee, newerMeteor, 0.5),
  )
  assert.deepEqual(
    presentation(olderMelee, newerMeteor, 1),
    expectedPresentation(olderMelee, newerMeteor, 1),
  )
})

test('fixed timing selects the native Air and Frost lifetimes', () => {
  const underpoweredAir = transient('air', 2, { birthTick: 0, underpowered: true })
  assert.ok(presentation(underpoweredAir, underpoweredAir))

  const hailFrost = transient('weld-frost-fade', 2, {
    birthTick: 0,
    buildId: 1008,
  })
  assert.ok(presentation(hailFrost, hailFrost))
})

test('every fixed transient retires on its owned native lifetime boundary', () => {
  const ageZeroTick = 8
  const fire = transient('fire', 2, { id: 51 })
  const water = transient('water', 2, { id: 53 })
  const chain = transient('weld-blizzard-chain-frost', 2, { id: 55 })
  const cases = [
    { effect: transient('air', 2), label: 'air', lifetime: PRIMARY_SPELL_AIR_LIFETIME_TICKS, zero: 0 },
    { effect: transient('air', 2, { underpowered: true }), label: 'air-underpowered', lifetime: PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS, zero: 0 },
    { effect: transient('earth-impact', 2, { lifetimeTicks: 7 }), label: 'earth-impact', lifetime: 7, zero: 0 },
    { effect: transient('ether-impact', 2), label: 'ether-impact', lifetime: PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS, zero: 0 },
    { effect: transient('ether-blast', 2), label: 'ether-blast', lifetime: NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS, zero: 0 },
    { effect: transient('ether-pierce-streak', 2), label: 'ether-pierce-streak', lifetime: 10, zero: ageZeroTick },
    { effect: fire, label: 'fire', lifetime: nativeFireParticleLifetimeTicks(fire.id), zero: ageZeroTick },
    { effect: transient('fire-explosion', 2), label: 'fire-explosion', lifetime: NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS, zero: ageZeroTick },
    { effect: transient('fire-impact', 2), label: 'fire-impact', lifetime: PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS, zero: ageZeroTick },
    { effect: water, label: 'water', lifetime: waterFrostJetLifetimeTicks(water.id), zero: ageZeroTick },
    { effect: transient('water-aura', 2, { durationTicks: 13 }), label: 'water-aura', lifetime: 13, zero: 0 },
    { effect: chain, label: 'weld-blizzard-chain-frost', lifetime: waterFrostJetLifetimeTicks(chain.id), zero: 0 },
    { effect: transient('weld-blizzard-glow', 2), label: 'weld-blizzard-glow', lifetime: 1, zero: 0 },
    { effect: transient('weld-frost-fade', 2, { buildId: 1004 }), label: 'weld-frost-fade-1004', lifetime: 3, zero: 0 },
    { effect: transient('weld-frost-fade', 2, { buildId: 1008 }), label: 'weld-frost-fade-1008', lifetime: 20, zero: 0 },
  ] as const

  for (const timing of cases) {
    const snapshotTick = timing.zero === ageZeroTick ? 10 : 0
    assert.ok(
      presentationAt(timing.effect, snapshotTick, timing.zero + timing.lifetime - 1),
      `${timing.label}:last-visible`,
    )
    assert.equal(
      presentationAt(timing.effect, snapshotTick, timing.zero + timing.lifetime),
      undefined,
      `${timing.label}:retired`,
    )
  }
})

test('presentation preserves authority allocation and native cross-family birth order', () => {
  const later = transient('earth-impact', 2, { id: 9 })
  const earlier = transient('ether-impact', 2, { id: 3 })
  const halfway = interpolatePrimarySpellState(
    { nextId: 10, projectiles: [], transients: [later, earlier] },
    { nextId: 11, projectiles: [], transients: [later, earlier] },
    0.5,
    { newerTick: 2, olderTick: 0, targetTick: 1 },
  )
  assert.equal(halfway.nextId, 10)
  assert.deepEqual(halfway.transients.map((effect) => effect.id), [3, 9])

  const atEdge = interpolatePrimarySpellState(
    { nextId: 10, projectiles: [], transients: [later, earlier] },
    { nextId: 11, projectiles: [], transients: [later, earlier] },
    1,
    { newerTick: 2, olderTick: 0, targetTick: 1 },
  )
  assert.equal(atEdge.nextId, 11)
  assert.deepEqual(atEdge.transients.map((effect) => effect.id), [3, 9])
})

test('every projectile family owns its copy and interpolates a stable identity', () => {
  const kinds = ['earth', 'ether', 'fire', 'weld'] as const
  for (const kind of kinds) {
    const older = projectile(kind, 2)
    const newer = projectile(kind, 6)
    const copied = copyPrimarySpellState({
      nextId: 8,
      projectiles: [older],
      transients: [],
    }).projectiles[0]
    assert.ok(copied, kind)
    assert.notEqual(copied, older, kind)
    assert.deepEqual(copied, older, kind)
    assert.notEqual(copied.direction, older.direction, `${kind}:direction`)
    assert.notEqual(copied.lightRegistration, older.lightRegistration, `${kind}:light`)
    assert.notEqual(copied.position, older.position, `${kind}:position`)
    assert.notEqual(copied.velocity, older.velocity, `${kind}:velocity`)
    if (copied.kind === 'earth' && older.kind === 'earth') {
      assert.notEqual(copied.hitTargetIds, older.hitTargetIds)
      assert.notEqual(copied.orientation, older.orientation)
    }
    if (copied.kind === 'weld' && older.kind === 'weld') {
      assert.notEqual(copied.frostPresentationLanes, older.frostPresentationLanes)
      assert.notEqual(copied.hitTargetIds, older.hitTargetIds)
      assert.notEqual(copied.vector, older.vector)
    }

    const halfwayState = interpolatePrimarySpellState(
      { nextId: 8, projectiles: [older], transients: [] },
      { nextId: 9, projectiles: [newer], transients: [] },
      0.5,
      { newerTick: 2, olderTick: 0, targetTick: 1 },
    )
    const halfway = halfwayState.projectiles[0]
    assert.equal(halfwayState.nextId, 8)
    assert.ok(halfway, kind)
    assert.equal(halfway.kind, kind)
    assert.equal(halfway.ageTicks, 4)
    assert.deepEqual(halfway.position, { x: 4, y: 4 })
    assert.deepEqual(halfway, expectedProjectilePresentation(older, newer, 0.5), kind)

    const atEdgeState = interpolatePrimarySpellState(
      { nextId: 8, projectiles: [older], transients: [] },
      { nextId: 9, projectiles: [newer], transients: [] },
      1,
      { newerTick: 2, olderTick: 0, targetTick: 1 },
    )
    const atEdge = atEdgeState.projectiles[0]
    assert.equal(atEdgeState.nextId, 9)
    assert.ok(atEdge, kind)
    assert.equal(atEdge.kind, kind)
    assert.deepEqual(atEdge, expectedProjectilePresentation(older, newer, 1), `${kind}:newer`)
  }
})

test('projectile replacements and nullable Weld lanes stay discrete', () => {
  const older = projectile('earth', 2)
  const newer = projectile('fire', 6)
  const beforeEdge = interpolatePrimarySpellState(
    { nextId: 8, projectiles: [older], transients: [] },
    { nextId: 9, projectiles: [newer], transients: [] },
    0.5,
    { newerTick: 2, olderTick: 0, targetTick: 1 },
  ).projectiles[0]
  assert.ok(beforeEdge?.kind === 'earth')
  assert.deepEqual(beforeEdge, expectedProjectilePresentation(older, newer, 0.5))
  const atEdge = interpolatePrimarySpellState(
    { nextId: 8, projectiles: [older], transients: [] },
    { nextId: 9, projectiles: [newer], transients: [] },
    1,
    { newerTick: 2, olderTick: 0, targetTick: 1 },
  ).projectiles[0]
  assert.ok(atEdge?.kind === 'fire')
  assert.deepEqual(atEdge, expectedProjectilePresentation(older, newer, 1))

  const olderWeld = {
    ...projectile('weld', 2),
    ballLightningAcceleration: null,
    frostPresentationLanes: null,
    frostTurnDegrees: null,
    groundSparkNativeAgeTicks: null,
  } as PrimarySpellProjectileState
  const newerWeld = projectile('weld', 6)
  if (newerWeld.kind !== 'weld') assert.fail()
  const weldBeforeEdge = interpolatePrimarySpellState(
    { nextId: 8, projectiles: [olderWeld], transients: [] },
    { nextId: 9, projectiles: [newerWeld], transients: [] },
    0.5,
    { newerTick: 2, olderTick: 0, targetTick: 1 },
  ).projectiles[0]
  assert.ok(weldBeforeEdge?.kind === 'weld')
  assert.equal(weldBeforeEdge.ballLightningAcceleration, null)
  assert.equal(weldBeforeEdge.frostPresentationLanes, null)
  assert.equal(weldBeforeEdge.frostTurnDegrees, null)
  assert.equal(weldBeforeEdge.groundSparkNativeAgeTicks, null)

  const weldAtEdge = interpolatePrimarySpellState(
    { nextId: 8, projectiles: [olderWeld], transients: [] },
    { nextId: 9, projectiles: [newerWeld], transients: [] },
    1,
    { newerTick: 2, olderTick: 0, targetTick: 1 },
  ).projectiles[0]
  assert.ok(weldAtEdge?.kind === 'weld')
  assert.equal(weldAtEdge.ballLightningAcceleration, 6)
  assert.notEqual(weldAtEdge.frostPresentationLanes, newerWeld.frostPresentationLanes)

  const newerNullWeld = {
    ...projectile('weld', 6),
    ballLightningAcceleration: null,
    frostPresentationLanes: null,
    frostTurnDegrees: null,
    groundSparkNativeAgeTicks: null,
  } as PrimarySpellProjectileState
  const nullableBeforeEdge = interpolatePrimarySpellState(
    { nextId: 8, projectiles: [newerWeld], transients: [] },
    { nextId: 9, projectiles: [newerNullWeld], transients: [] },
    0.5,
    { newerTick: 2, olderTick: 0, targetTick: 1 },
  ).projectiles[0]
  assert.deepEqual(
    nullableBeforeEdge,
    expectedProjectilePresentation(newerWeld, newerNullWeld, 0.5),
  )
  const nullableAtEdge = interpolatePrimarySpellState(
    { nextId: 8, projectiles: [newerWeld], transients: [] },
    { nextId: 9, projectiles: [newerNullWeld], transients: [] },
    1,
    { newerTick: 2, olderTick: 0, targetTick: 1 },
  ).projectiles[0]
  assert.deepEqual(nullableAtEdge, expectedProjectilePresentation(newerWeld, newerNullWeld, 1))
})
