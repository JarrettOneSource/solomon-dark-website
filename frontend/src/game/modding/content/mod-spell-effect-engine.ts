import type { LuaConsoleObject, LuaConsoleValue } from '../../protocol/game-protocol.ts'
import type { WebLuaScopeKind } from '../definition/index.ts'

const MAXIMUM_EFFECTS = 1_024
const MAXIMUM_TARGETS_PER_PULSE = 256

export interface ActiveModSpellEffect {
  readonly contentId: string
  readonly effects: readonly ModEffectTemplate[]
  readonly expiresTick: number
  readonly hitTargets: readonly string[]
  readonly id: number
  readonly intervalTicks: number
  readonly kind: 'area' | 'channel' | 'projectile'
  readonly lastTick: number
  readonly modId: string
  readonly nextPulseTick: number
  readonly ownerPlayerId: string
  readonly radius: number
  readonly scope: ModSpellEffectScope
  readonly speedPerTick: number
  readonly startedTick: number
  readonly targetX: number
  readonly targetY: number
  readonly x: number
  readonly y: number
}

export interface ModEffectTemplate {
  readonly fields: LuaConsoleObject
  readonly kind: string
}

export interface ModSpellEffectCheckpoint {
  readonly effects: readonly ActiveModSpellEffect[]
  readonly nextId: number
  readonly nextSequence: number
  readonly revision: number
}

export interface ModSpellEffectTarget {
  readonly id: number
  readonly kind: 'mod-enemy' | 'native-enemy'
  readonly x: number
  readonly y: number
}

export interface ModSpellEffectBatch {
  readonly context: LuaConsoleObject
  readonly intents: readonly ModSpellEffectIntent[]
  readonly scope: ModSpellEffectScope
}

export interface ModSpellEffectIntent {
  readonly fields: LuaConsoleObject
  readonly kind: string
  readonly modId: string
  readonly owner: string
  readonly scope: ModSpellEffectScope
  readonly sequence: number
}

export interface ModSpellEffectScope {
  readonly id: string
  readonly kind: WebLuaScopeKind
}

export class ModSpellEffectEngine {
  readonly #ticksPerSecond: number
  #effects: ActiveModSpellEffect[] = []
  #nextId = 1
  #nextSequence = 1_000_000_000
  #revision = 0

  constructor(ticksPerSecond: number) {
    if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond < 1 || ticksPerSecond > 1_000) {
      throw new Error('mod spell effect tick rate is invalid')
    }
    this.#ticksPerSecond = ticksPerSecond
  }

  get revision(): number {
    return this.#revision
  }

  checkpoint(): ModSpellEffectCheckpoint {
    return Object.freeze({
      effects: this.project(),
      nextId: this.#nextId,
      nextSequence: this.#nextSequence,
      revision: this.#revision,
    })
  }

  project(): readonly ActiveModSpellEffect[] {
    return Object.freeze(this.#effects.map(effect => freezeEffect(effect)))
  }

  restore(checkpoint: ModSpellEffectCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.nextId) || checkpoint.nextId < 1 ||
        !Number.isSafeInteger(checkpoint.nextSequence) || checkpoint.nextSequence < 1 ||
        !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        checkpoint.effects.length > MAXIMUM_EFFECTS) {
      throw new Error('mod spell effect checkpoint is invalid')
    }
    const ids = new Set<number>()
    this.#effects = checkpoint.effects.map(effect => {
      validateEffect(effect)
      if (ids.has(effect.id)) throw new Error('mod spell effect checkpoint contains duplicates')
      ids.add(effect.id)
      return freezeEffect(effect)
    })
    this.#nextId = checkpoint.nextId
    this.#nextSequence = checkpoint.nextSequence
    this.#revision = checkpoint.revision
  }

  retire(id: number): boolean {
    const index = this.#effects.findIndex(effect => effect.id === id)
    if (index < 0) return false
    this.#effects.splice(index, 1)
    this.#revision += 1
    return true
  }

  spawn(input: Readonly<{
    contentId: string
    fields: LuaConsoleObject
    modId: string
    origin: Readonly<{ x: number; y: number }>
    ownerPlayerId: string
    scope: ModSpellEffectScope
    target: Readonly<{ x: number; y: number }>
    tick: number
  }>): ActiveModSpellEffect {
    if (this.#effects.length >= MAXIMUM_EFFECTS) throw new Error('active mod spell effect limit reached')
    const kind = input.fields.prefab
    if (kind !== 'area' && kind !== 'projectile' && kind !== 'channel') {
      throw new Error('mod spell effect prefab is invalid')
    }
    exactKeys(input.fields, kind === 'area'
      ? ['duration', 'effects', 'every', 'prefab', 'radius', 'spell_content_id']
      : kind === 'channel'
        ? ['duration', 'effects', 'every', 'prefab', 'spell_content_id', 'width']
        : ['duration', 'effects', 'prefab', 'radius', 'speed', 'spell_content_id'])
    const durationTicks = ticks(input.fields.duration ?? defaultDuration(kind), this.#ticksPerSecond, 'effect duration')
    const intervalTicks = ticks(input.fields.every ?? defaultInterval(kind), this.#ticksPerSecond, 'effect interval')
    const radius = finite(input.fields.radius ?? input.fields.width ?? 32, 1, 1_024, 'effect radius')
    const dx = input.target.x - input.origin.x
    const dy = input.target.y - input.origin.y
    const length = Math.hypot(dx, dy)
    const speedPerTick = kind === 'projectile'
      ? finite(input.fields.speed ?? 600, 1, 10_000, 'projectile speed') / this.#ticksPerSecond
      : 0
    const effect = freezeEffect({
      contentId: input.contentId,
      effects: templates(input.fields.effects),
      expiresTick: input.tick + durationTicks,
      hitTargets: Object.freeze([]),
      id: this.#nextId++,
      intervalTicks,
      kind,
      lastTick: input.tick,
      modId: input.modId,
      nextPulseTick: input.tick,
      ownerPlayerId: input.ownerPlayerId,
      radius,
      scope: Object.freeze({ ...input.scope }),
      speedPerTick,
      startedTick: input.tick,
      targetX: input.target.x,
      targetY: input.target.y,
      x: kind === 'area' ? input.target.x : input.origin.x,
      y: kind === 'area' ? input.target.y : input.origin.y,
    })
    if (kind === 'projectile' && length === 0) throw new Error('projectile requires a distinct target')
    this.#effects.push(effect)
    this.#revision += 1
    return effect
  }

  tick(input: Readonly<{
    players: ReadonlyMap<string, Readonly<{ x: number; y: number }>>
    targets: readonly ModSpellEffectTarget[]
    tick: number
  }>): readonly ModSpellEffectBatch[] {
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new Error('mod spell effect tick is invalid')
    const batches: ModSpellEffectBatch[] = []
    const retained: ActiveModSpellEffect[] = []
    for (const source of this.#effects) {
      if (source.expiresTick <= input.tick) {
        this.#revision += 1
        continue
      }
      if (source.kind === 'channel' && !input.players.has(source.ownerPlayerId)) {
        this.#revision += 1
        continue
      }
      const effect = advance(source, input.players, input.tick)
      let retired = false
      let next = effect
      if (effect.kind === 'projectile') {
        const target = nearestAlongPath(source, effect, input.targets.filter(candidate => (
          !effect.hitTargets.includes(targetId(candidate)) && inProjectilePath(source, effect, candidate)
        )))
        if (target) {
          batches.push(this.#batch(effect, [target]))
          next = freezeEffect({ ...effect, hitTargets: Object.freeze([targetId(target)]) })
          retired = true
        } else if (effect.x === effect.targetX && effect.y === effect.targetY) {
          retired = true
        }
      } else if (effect.nextPulseTick <= input.tick) {
        const targets = input.targets.filter(target => effect.kind === 'area'
          ? inRadius(effect, target)
          : inChannel(effect, target)).slice(0, MAXIMUM_TARGETS_PER_PULSE)
        batches.push(this.#batch(effect, targets))
        next = freezeEffect({ ...effect, nextPulseTick: effect.nextPulseTick + effect.intervalTicks })
      }
      if (!retired) retained.push(next)
      if (next !== source || retired) this.#revision += 1
    }
    this.#effects = retained
    return Object.freeze(batches)
  }

  #batch(
    effect: ActiveModSpellEffect,
    targets: readonly ModSpellEffectTarget[],
  ): ModSpellEffectBatch {
    const intents = effect.effects.flatMap(template => {
      const targeted = template.fields.target === 'hostiles_in_area'
        || template.fields.target === 'hostiles_in_channel'
        || template.fields.target === 'target_enemy'
      const rows = targeted ? targets : [null]
      return rows.map(target => Object.freeze({
        fields: Object.freeze({
          ...template.fields,
          effect_id: effect.id,
          ...(target ? { target: Object.freeze({ id: target.id, kind: target.kind }) } : {}),
          x: effect.x,
          y: effect.y,
        }),
        kind: template.kind,
        modId: effect.modId,
        owner: `spell-effect.${effect.id}`,
        scope: effect.scope,
        sequence: this.#nextSequence++,
      } as ModSpellEffectIntent))
    })
    return Object.freeze({
      context: Object.freeze({
        effect_id: effect.id,
        participant_id: effect.ownerPlayerId,
        target_x: effect.targetX,
        target_y: effect.targetY,
      }),
      intents: Object.freeze(intents),
      scope: effect.scope,
    })
  }
}

function exactKeys(fields: LuaConsoleObject, allowed: readonly string[]): void {
  const accepted = new Set(allowed)
  const unknown = Object.keys(fields).filter(key => !accepted.has(key))
  if (unknown.length > 0) throw new Error(`spell effect contains unknown fields: ${unknown.join(', ')}`)
}

function templates(value: LuaConsoleValue | undefined): readonly ModEffectTemplate[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) {
    throw new Error('spell effect prefab requires 1..32 effects')
  }
  return Object.freeze(value.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('spell effect entry is invalid')
    }
    const row = candidate as LuaConsoleObject
    const operation = row.operation
    if (typeof operation !== 'string' || !operation.startsWith('effect.') ||
        !row.fields || typeof row.fields !== 'object' || Array.isArray(row.fields)) {
      throw new Error('spell effect entry must be created by sd.effect')
    }
    return Object.freeze({
      fields: Object.freeze({ ...(row.fields as LuaConsoleObject) }),
      kind: operation.slice('effect.'.length),
    })
  }))
}

function advance(
  source: ActiveModSpellEffect,
  players: ReadonlyMap<string, Readonly<{ x: number; y: number }>>,
  tick: number,
): ActiveModSpellEffect {
  if (source.kind === 'area') return source
  const owner = players.get(source.ownerPlayerId)
  if (source.kind === 'channel') {
    return owner ? freezeEffect({ ...source, lastTick: tick, x: owner.x, y: owner.y }) : source
  }
  const elapsed = tick - source.lastTick
  const dx = source.targetX - source.x
  const dy = source.targetY - source.y
  const length = Math.hypot(dx, dy)
  const distance = Math.min(length, source.speedPerTick * elapsed)
  return freezeEffect({
    ...source,
    lastTick: tick,
    x: length === 0 ? source.x : source.x + dx / length * distance,
    y: length === 0 ? source.y : source.y + dy / length * distance,
  })
}

function nearestAlongPath(
  source: ActiveModSpellEffect,
  effect: ActiveModSpellEffect,
  targets: readonly ModSpellEffectTarget[],
): ModSpellEffectTarget | null {
  return [...targets].sort((left, right) => (
    pathProgress(source, effect, left) - pathProgress(source, effect, right)
      || left.kind.localeCompare(right.kind)
      || left.id - right.id
  ))[0] ?? null
}

function inProjectilePath(
  source: ActiveModSpellEffect,
  effect: ActiveModSpellEffect,
  target: ModSpellEffectTarget,
): boolean {
  const progress = pathProgress(source, effect, target)
  const x = source.x + (effect.x - source.x) * progress - target.x
  const y = source.y + (effect.y - source.y) * progress - target.y
  return x * x + y * y <= effect.radius * effect.radius
}

function pathProgress(
  source: Pick<ActiveModSpellEffect, 'x' | 'y'>,
  effect: Pick<ActiveModSpellEffect, 'x' | 'y'>,
  target: Pick<ModSpellEffectTarget, 'x' | 'y'>,
): number {
  const dx = effect.x - source.x
  const dy = effect.y - source.y
  const lengthSquared = dx * dx + dy * dy
  return lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (
    (target.x - source.x) * dx + (target.y - source.y) * dy
  ) / lengthSquared))
}

function inRadius(effect: ActiveModSpellEffect, target: ModSpellEffectTarget): boolean {
  return distanceSquared(effect, target) <= effect.radius * effect.radius
}

function inChannel(effect: ActiveModSpellEffect, target: ModSpellEffectTarget): boolean {
  const dx = effect.targetX - effect.x
  const dy = effect.targetY - effect.y
  const lengthSquared = dx * dx + dy * dy
  const progress = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (
    (target.x - effect.x) * dx + (target.y - effect.y) * dy
  ) / lengthSquared))
  const x = effect.x + dx * progress - target.x
  const y = effect.y + dy * progress - target.y
  return x * x + y * y <= effect.radius * effect.radius
}

function distanceSquared(
  effect: Pick<ActiveModSpellEffect, 'x' | 'y'>,
  target: Pick<ModSpellEffectTarget, 'x' | 'y'>,
): number {
  const x = target.x - effect.x
  const y = target.y - effect.y
  return x * x + y * y
}

function targetId(target: ModSpellEffectTarget): string {
  return `${target.kind}:${target.id}`
}

function freezeEffect(value: ActiveModSpellEffect): ActiveModSpellEffect {
  return Object.freeze({
    ...value,
    effects: Object.freeze(value.effects.map(template => Object.freeze({
      ...template,
      fields: Object.freeze({ ...template.fields }),
    }))),
    hitTargets: Object.freeze([...value.hitTargets]),
    scope: Object.freeze({ ...value.scope }),
  })
}

function validateEffect(effect: ActiveModSpellEffect): void {
  if (!Number.isSafeInteger(effect.id) || effect.id < 1 ||
      !Number.isSafeInteger(effect.startedTick) || effect.startedTick < 0 ||
      !Number.isSafeInteger(effect.expiresTick) || effect.expiresTick <= effect.startedTick ||
      !Number.isSafeInteger(effect.lastTick) || effect.lastTick < effect.startedTick ||
      !Number.isSafeInteger(effect.nextPulseTick) || effect.nextPulseTick < effect.startedTick ||
      !Number.isSafeInteger(effect.intervalTicks) || effect.intervalTicks < 1 ||
      !['area', 'channel', 'projectile'].includes(effect.kind) ||
      !effect.contentId || !effect.modId || !effect.ownerPlayerId || !effect.scope.id ||
      ![effect.x, effect.y, effect.targetX, effect.targetY, effect.radius, effect.speedPerTick].every(Number.isFinite)) {
    throw new Error('mod spell effect checkpoint contains an invalid effect')
  }
  templates(effect.effects.map(template => ({
    fields: template.fields,
    kind: 'rule-definition',
    operation: `effect.${template.kind}`,
  })))
}

function ticks(value: LuaConsoleValue, rate: number, field: string): number {
  let milliseconds: number
  if (Number.isSafeInteger(value) && Number(value) >= 0) milliseconds = Number(value)
  else if (typeof value === 'string') {
    const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?(ms|s|m|h)$/.exec(value)
    if (!match) throw new Error(`${field} is invalid`)
    const amount = Number(`${match[1]}.${match[2] ?? 0}`)
    const scale = match[3] === 'ms' ? 1 : match[3] === 's' ? 1_000 : match[3] === 'm' ? 60_000 : 3_600_000
    milliseconds = amount * scale
  } else throw new Error(`${field} is invalid`)
  if (!Number.isFinite(milliseconds) || milliseconds > 86_400_000) throw new Error(`${field} exceeds 24 hours`)
  return Math.max(1, Math.ceil(milliseconds * rate / 1_000))
}

function finite(value: LuaConsoleValue, minimum: number, maximum: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be finite within ${minimum}..${maximum}`)
  }
  return value
}

function defaultDuration(kind: ActiveModSpellEffect['kind']): string {
  return kind === 'area' ? '100ms' : kind === 'projectile' ? '2s' : '1s'
}

function defaultInterval(kind: ActiveModSpellEffect['kind']): string {
  return kind === 'projectile' ? '10ms' : '100ms'
}
