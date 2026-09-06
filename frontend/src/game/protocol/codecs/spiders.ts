import type { NativeFadeLineActor } from '../../core-kernels/native-silk-force.ts'
import type { NativeNaturalSpline } from '../../native-natural-spline.ts'
import type { NativeDeadSpiderState, NativeSpiderDecal } from '../../core-kernels/native-dead-spider.ts'
import type { NativeSilkState } from '../../core-kernels/native-silk.ts'
import type { NativeSpiderAppearance } from '../../core-kernels/native-spider-appearance.ts'
import type { NativeWebbedState } from '../../core-kernels/native-webbed.ts'
import type { BoneyardSilkSnapshot, BoneyardSpiderRemainsSnapshot } from '../spider-state.ts'
import { MAX_BONEYARD_ENEMY_DEATH_EFFECTS, MAX_PLAYERS } from '../game-protocol-limits.ts'
import { nativeWorldManagerRegistration, vector } from './native-state.ts'
import {
  GameProtocolError, boolean, finite, finiteWithin, integerWithin, limitedArray,
  nonnegativeFinite, nonnegativeInteger, onlyKeys, positiveInteger,
  record, unitInterval, validatedPlayerId,
} from './values.ts'

export function spiderAppearance(source: ReturnType<typeof record>, field: string): NativeSpiderAppearance {
  onlyKeys(source, field, ['bodyHeadingDeg', 'outlineAlpha', 'outlineTint'])
  return {
    bodyHeadingDeg: finiteWithin(source.bodyHeadingDeg, `${field}.bodyHeadingDeg`, 0, 360),
    outlineAlpha: unitInterval(source.outlineAlpha, `${field}.outlineAlpha`),
    outlineTint: integerWithin(source.outlineTint, `${field}.outlineTint`, 0, 0xffffff),
  }
}

export function spiderWorldFields(source: ReturnType<typeof record>, field: string, tick: number): {
  spiderSilks: readonly BoneyardSilkSnapshot[]
  silkFragments: readonly NativeFadeLineActor[]
  spiderRemains: readonly BoneyardSpiderRemainsSnapshot[]
  webbedPlayers: Readonly<Record<string, NativeWebbedState>>
} {
  const silkIds = new Set<number>()
  const spiderSilks = limitedArray(source.spiderSilks, `${field}.spiderSilks`, 4).map((value, index) => {
    const name = `${field}.spiderSilks[${index}]`
    const row = record(value, name)
    onlyKeys(row, name, ['id', 'ownerActorId', 'spawnTick', 'painterRegistration', 'state'])
    const id = positiveInteger(row.id, `${name}.id`)
    if (silkIds.has(id)) throw new GameProtocolError(`${field}.spiderSilks repeats an id`)
    silkIds.add(id)
    return {
      id, ownerActorId: positiveInteger(row.ownerActorId, `${name}.ownerActorId`),
      spawnTick: integerWithin(row.spawnTick, `${name}.spawnTick`, 0, tick),
      painterRegistration: nativeWorldManagerRegistration(row.painterRegistration, `${name}.painterRegistration`, 'actor'),
      state: silkState(record(row.state, `${name}.state`), `${name}.state`),
    }
  })
  const remainsIds = new Set<number>()
  const spiderRemains = limitedArray(source.spiderRemains, `${field}.spiderRemains`, MAX_BONEYARD_ENEMY_DEATH_EFFECTS).map((value, index) => {
    const name = `${field}.spiderRemains[${index}]`
    const row = record(value, name)
    onlyKeys(row, name, ['id', 'spawnTick', 'state'])
    const id = positiveInteger(row.id, `${name}.id`)
    if (remainsIds.has(id)) throw new GameProtocolError(`${field}.spiderRemains repeats an id`)
    remainsIds.add(id)
    return {
      id, spawnTick: integerWithin(row.spawnTick, `${name}.spawnTick`, 0, tick),
      state: remainsState(record(row.state, `${name}.state`), `${name}.state`),
    }
  })
  const fragmentIds = new Set<number>()
  const silkFragments = limitedArray(source.silkFragments, `${field}.silkFragments`, MAX_BONEYARD_ENEMY_DEATH_EFFECTS).map((value, index) => {
    const name = `${field}.silkFragments[${index}]`
    const row = record(value, name)
    onlyKeys(row, name, ['id', 'spawnTick', 'state'])
    const id = positiveInteger(row.id, `${name}.id`)
    if (fragmentIds.has(id)) throw new GameProtocolError(`${field}.silkFragments repeats an id`)
    fragmentIds.add(id)
    const stateName = `${name}.state`
    const state = record(row.state, stateName)
    onlyKeys(state, stateName, ['start', 'middle', 'end', 'velocity', 'opacity', 'opacityLossPerTick'])
    return {
      id, spawnTick: integerWithin(row.spawnTick, `${name}.spawnTick`, 0, tick),
      state: {
        start: vector(state.start, `${stateName}.start`),
        middle: vector(state.middle, `${stateName}.middle`),
        end: vector(state.end, `${stateName}.end`),
        velocity: vector(state.velocity, `${stateName}.velocity`),
        opacity: nonnegativeFinite(state.opacity, `${stateName}.opacity`),
        opacityLossPerTick: nonnegativeFinite(state.opacityLossPerTick, `${stateName}.opacityLossPerTick`),
      },
    }
  })
  const webs = record(source.webbedPlayers, `${field}.webbedPlayers`)
  if (Object.keys(webs).length > MAX_PLAYERS) throw new GameProtocolError(`${field}.webbedPlayers exceeds the player limit`)
  const webbedPlayers = Object.fromEntries(Object.entries(webs).map(([id, value]) => {
    validatedPlayerId(id, `${field}.webbedPlayers player id`)
    const name = `${field}.webbedPlayers.${id}`
    const web = record(value, name)
    onlyKeys(web, name, ['severity', 'strength', 'cocoonHealth', 'hitPulse'])
    return [id, {
      severity: finiteWithin(web.severity, `${name}.severity`, Number.MIN_VALUE, 3),
      strength: nonnegativeFinite(web.strength, `${name}.strength`),
      cocoonHealth: nonnegativeFinite(web.cocoonHealth, `${name}.cocoonHealth`),
      hitPulse: unitInterval(web.hitPulse, `${name}.hitPulse`),
    }]
  }))
  return { spiderSilks, silkFragments, spiderRemains, webbedPlayers }
}

function silkState(source: ReturnType<typeof record>, field: string): NativeSilkState {
  onlyKeys(source, field, ['forceAccumulator', 'ageTicks', 'phase', 'ended', 'position', 'center', 'wave', 'height', 'alpha', 'waveScale', 'drift', 'driftVelocity', 'cocoonHealth'])
  return {
    forceAccumulator: unitInterval(source.forceAccumulator, `${field}.forceAccumulator`),
    ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
    phase: finiteWithin(source.phase, `${field}.phase`, 0, 20),
    ended: boolean(source.ended, `${field}.ended`),
    position: vector(source.position, `${field}.position`),
    center: naturalSpline(record(source.center, `${field}.center`), `${field}.center`),
    wave: naturalSpline(record(source.wave, `${field}.wave`), `${field}.wave`),
    height: nonnegativeFinite(source.height, `${field}.height`),
    alpha: unitInterval(source.alpha, `${field}.alpha`),
    waveScale: finiteWithin(source.waveScale, `${field}.waveScale`, Number.MIN_VALUE, 0.5),
    drift: vector(source.drift, `${field}.drift`),
    driftVelocity: vector(source.driftVelocity, `${field}.driftVelocity`),
    cocoonHealth: nonnegativeFinite(source.cocoonHealth, `${field}.cocoonHealth`),
  }
}

function naturalSpline(source: ReturnType<typeof record>, field: string): NativeNaturalSpline {
  onlyKeys(source, field, ['extent', 'x', 'y'])
  const axes = (['x', 'y'] as const).map((key) => {
    const name = `${field}.${key}`
    const axis = record(source[key], name)
    onlyKeys(axis, name, ['points', 'coefficients'])
    const points = limitedArray(axis.points, `${name}.points`, 20).map((point, index) => finite(point, `${name}.points[${index}]`))
    const coefficients = limitedArray(axis.coefficients, `${name}.coefficients`, 19).map((value, index): readonly [number, number, number] => {
      const row = limitedArray(value, `${name}.coefficients[${index}]`, 3)
      if (row.length !== 3) throw new GameProtocolError(`${name}.coefficients requires three coefficients per segment`)
      return [finite(row[0], name), finite(row[1], name), finite(row[2], name)]
    })
    if (points.length !== 20 || coefficients.length !== 19) throw new GameProtocolError(`${name} requires the complete twenty-point Silk spline`)
    return { points, coefficients }
  })
  return { extent: integerWithin(source.extent, `${field}.extent`, 19, 19), x: axes[0], y: axes[1] }
}

function remainsState(source: ReturnType<typeof record>, field: string): NativeDeadSpiderState {
  onlyKeys(source, field, ['position', 'headingDeg', 'slideSpeed', 'frame', 'life', 'decalGrowth', 'decal'])
  return {
    position: vector(source.position, `${field}.position`),
    headingDeg: finite(source.headingDeg, `${field}.headingDeg`),
    slideSpeed: vector(source.slideSpeed, `${field}.slideSpeed`),
    frame: finiteWithin(source.frame, `${field}.frame`, 0, 2),
    life: finiteWithin(source.life, `${field}.life`, Number.MIN_VALUE, 20),
    decalGrowth: unitInterval(source.decalGrowth, `${field}.decalGrowth`),
    decal: source.decal === null ? null : spiderDecal(record(source.decal, `${field}.decal`), `${field}.decal`),
  }
}

function spiderDecal(source: ReturnType<typeof record>, field: string): NativeSpiderDecal {
  onlyKeys(source, field, ['entry', 'position', 'rotationDeg', 'scale', 'alpha'])
  const entry = source.entry
  if (entry !== 140 && entry !== 141 && entry !== 142) throw new GameProtocolError(`${field}.entry is not a Spider decal`)
  return {
    entry, position: vector(source.position, `${field}.position`),
    rotationDeg: finite(source.rotationDeg, `${field}.rotationDeg`),
    scale: unitInterval(source.scale, `${field}.scale`),
    alpha: unitInterval(source.alpha, `${field}.alpha`),
  }
}
