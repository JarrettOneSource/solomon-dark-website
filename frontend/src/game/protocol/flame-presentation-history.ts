import { MAX_PRIMARY_SPELL_TRANSIENTS } from './game-protocol-limits.ts'
/**
 * Connection presentation storage, never PrimarySpellSimulationState or save
 * state. The host uses its existing acknowledged snapshot baseline as the
 * cursor. No actor IDs, RNG, damage, or authoritative light are advanced here.
 */
export interface FlamePresentationBirth<Recipe> {
  readonly id: number
  readonly kind: 'ribbon' | 'fade' | 'path'
  readonly ownerId: string
  readonly worldKey: string
  readonly birthTick: number
  readonly endTickExclusive: number
  readonly recipe: Recipe
}

export interface FlamePresentationBaseline {
  readonly epoch: number
  readonly worldTick: number
}

export type FlamePresentationHistoryFrame<Recipe> = Readonly<{
  epoch: number
  worldKey: string
  throughTick: number
}> & (
  | Readonly<{ kind: 'reset'; births: readonly [] }>
  | Readonly<{
      kind: 'continuous'
      afterTick: number
      births: readonly FlamePresentationBirth<Recipe>[]
    }>
)

interface RetainedBirth<Recipe> {
  readonly birth: FlamePresentationBirth<Recipe>
  readonly changedTick: number
  readonly bytes: number
}

export function createFlamePresentationHistory<Recipe>(options: Readonly<{
  worldKey: string
  tick: number
  maximumBirths: number
  initialEpoch?: number
  maximumBytes?: number
}>) {
  requireTick(options.tick)
  if (!Number.isSafeInteger(options.maximumBirths) || options.maximumBirths < 1) {
    throw new RangeError('Flame presentation history needs a positive birth limit')
  }
  let worldKey = options.worldKey
  let tick = options.tick
  let epoch = options.initialEpoch ?? 1
  let coveredAfterTick = tick
  let retainedBytes = 0
  if (!Number.isSafeInteger(epoch) || epoch < 1) throw new RangeError('Invalid Flame history epoch')
  if (options.maximumBytes !== undefined && (!Number.isSafeInteger(options.maximumBytes) || options.maximumBytes < 1)) throw new RangeError('Invalid Flame history byte budget')
  const births = new Map<string, RetainedBirth<Recipe>>()
  const enforceBudget = () => {
    while (births.size > options.maximumBirths || retainedBytes > (options.maximumBytes ?? Infinity)) {
      let oldestTick = Infinity
      for (const item of births.values()) oldestTick = Math.min(oldestTick, item.birth.birthTick)
      // Remove the whole birth tick: never claim coverage for a partial batch.
      for (const [key, item] of births) if (item.birth.birthTick === oldestTick) {
        coveredAfterTick = Math.max(coveredAfterTick, item.changedTick)
        retainedBytes -= item.bytes; births.delete(key)
      }
      coveredAfterTick = Math.max(coveredAfterTick, oldestTick)
    }
  }

  const resetFrame = (): FlamePresentationHistoryFrame<Recipe> => Object.freeze({
    kind: 'reset', epoch, worldKey, throughTick: tick, births: Object.freeze([] as const),
  })
  return {
    epoch: () => epoch,
    reset(nextWorldKey: string, nextTick: number): void {
      requireTick(nextTick)
      if (!Number.isSafeInteger(epoch + 1)) throw new RangeError('Flame history epoch exhausted')
      worldKey = nextWorldKey
      tick = nextTick
      coveredAfterTick = nextTick
      epoch += 1
      births.clear()
      retainedBytes = 0
    },
    recordTick(nextTick: number, incoming: readonly FlamePresentationBirth<Recipe>[]): void {
      requireTick(nextTick)
      if (nextTick < tick || nextTick > tick + 1) {
        throw new RangeError('Flame history must observe each admitted world update')
      }
      const batch = new Map<string, FlamePresentationBirth<Recipe>>()
      const prepared = incoming.map(birth => {
        validateBirth(birth, worldKey)
        if (birth.birthTick !== nextTick) throw new RangeError('Flame birth does not belong to this update')
        const key = birthKey(birth)
        const prior = births.get(key)
        const inBatch = batch.get(key)
        if ((prior && !sameRecipe(prior.birth, birth)) || (inBatch && !sameRecipe(inBatch, birth))) throw new Error('Flame birth recipe changed')
        batch.set(key, birth)
        return { key, birth: prior?.birth ?? copyBirth(birth) }
      })
      tick = nextTick
      for (const item of prepared) {
        if (!births.has(item.key)) {
          const bytes = JSON.stringify(item.birth).length * 2
          births.set(item.key, { birth: item.birth, changedTick: tick, bytes })
          retainedBytes += bytes
        }
      }
      enforceBudget()
    },
    retireBirth(birth: FlamePresentationBirth<Recipe>, atTick: number): void {
      requireTick(atTick)
      if (atTick !== tick) throw new RangeError('Flame retirement must use the admitted world tick')
      validateBirth(birth, worldKey)
      const key = birthKey(birth), item = births.get(key)
      if ((item?.birth ?? birth).endTickExclusive <= atTick) return
      // A reset/load can expose a complete live actor without replaying its
      // birth. Retain its authoritative shortening receipt when it disappears.
      const retired = copyBirth({ ...(item?.birth ?? birth), endTickExclusive: atTick })
      const bytes = item?.bytes ?? JSON.stringify(retired).length * 2
      births.set(key, { birth: retired, changedTick: atTick, bytes })
      if (!item) retainedBytes += bytes
      enforceBudget()
    },
    retireOwner(ownerId: string, atTick: number): void {
      requireTick(atTick)
      if (atTick !== tick) throw new RangeError('Flame retirement must use the admitted world tick')
      for (const [key, item] of births) {
        if (item.birth.ownerId !== ownerId || item.birth.endTickExclusive <= atTick) continue
        births.set(key, {
          birth: Object.freeze({ ...item.birth, endTickExclusive: atTick }),
          changedTick: atTick, bytes: item.bytes,
        })
      }
    },
    discardThroughTick(oldestRetainedBaselineTick: number): void {
      requireTick(oldestRetainedBaselineTick)
      if (oldestRetainedBaselineTick > tick) throw new RangeError('Cannot prune future Flame history')
      for (const [key, item] of births) {
        if (item.birth.endTickExclusive <= oldestRetainedBaselineTick
          && item.changedTick <= oldestRetainedBaselineTick) {
          retainedBytes -= item.bytes; births.delete(key)
        }
      }
      coveredAfterTick = Math.max(coveredAfterTick, oldestRetainedBaselineTick)
    },
    frame(baseline: FlamePresentationBaseline | null, throughTick: number): FlamePresentationHistoryFrame<Recipe> {
      if (throughTick !== tick) throw new RangeError('Flame frame must use the committed world tick')
      if (!baseline || baseline.epoch !== epoch || baseline.worldTick < coveredAfterTick
        || baseline.worldTick > tick) return resetFrame()
      const retained = Array.from(births.values())
        .filter(item => item.birth.birthTick > baseline.worldTick || item.changedTick > baseline.worldTick)
        .map(item => item.birth)
      return Object.freeze({ kind: 'continuous', epoch, worldKey,
        afterTick: baseline.worldTick, throughTick: tick, births: Object.freeze(retained) })
    },
  }
}

export function createFlamePresentationReplay<Recipe>(maximumBirths = MAX_PRIMARY_SPELL_TRANSIENTS,
  retainedEndTick?: (birth: FlamePresentationBirth<Recipe>) => number) {
  let epoch = 0
  let worldKey = ''
  let throughTick = 0
  let retainedFloor = 0
  const births = new Map<string, FlamePresentationBirth<Recipe>>()
  const retainedUntil = (birth: FlamePresentationBirth<Recipe>) => Math.max(maximumNativeEndTick(birth), retainedEndTick?.(birth) ?? 0)
  return {
    historyAt(targetWorldTick: number): readonly FlamePresentationBirth<Recipe>[] {
      const sampleTick = Math.floor(Math.min(targetWorldTick, throughTick))
      if (sampleTick < retainedFloor) return []
      return Array.from(births.values()).filter(birth => birth.birthTick <= sampleTick && retainedUntil(birth) > sampleTick)
    },
    throughTick: () => throughTick,
    retained(birth: FlamePresentationBirth<Recipe>): FlamePresentationBirth<Recipe> | null {
      return births.get(birthKey(birth)) ?? null
    },
    accept(frame: FlamePresentationHistoryFrame<Recipe>): void {
      requireTick(frame.throughTick)
      if (!Number.isSafeInteger(frame.epoch) || frame.epoch < 1) throw new RangeError('Invalid Flame history epoch')
      if (frame.epoch < epoch) return
      if (frame.kind === 'reset') {
        if (frame.epoch === epoch && frame.throughTick < throughTick) return
        epoch = frame.epoch
        worldKey = frame.worldKey
        throughTick = frame.throughTick
        retainedFloor = throughTick
        births.clear()
        return
      }
      if (frame.epoch !== epoch || frame.worldKey !== worldKey) {
        throw new Error('Flame history needs the existing snapshot recovery keyframe')
      }
      requireTick(frame.afterTick)
      if (frame.afterTick > throughTick || frame.afterTick > frame.throughTick) {
        throw new Error('Flame history has a snapshot coverage gap')
      }
      if (frame.births.length > maximumBirths) throw new RangeError('Flame replay exceeds its birth budget')
      const batch = new Map<string, FlamePresentationBirth<Recipe>>()
      const prepared = frame.births.map(birth => {
        validateBirth(birth, worldKey)
        if (birth.birthTick > frame.throughTick) throw new RangeError('Flame history contains a future birth')
        const key = birthKey(birth)
        const prior = births.get(key)
        const inBatch = batch.get(key)
        if ((prior && !sameRecipe(prior, birth)) || (inBatch && !sameRecipe(inBatch, birth))) throw new Error('Flame birth recipe changed')
        batch.set(key, birth)
        return { key, birth: copyBirth(birth), prior }
      })
      const newKeys = new Set(prepared.filter(item => !births.has(item.key)
        && retainedUntil(item.birth) > retainedFloor).map(item => item.key))
      if (births.size + newKeys.size > maximumBirths) throw new Error('Flame replay needs snapshot recovery after overflow')
      for (const item of prepared) {
        // Pre-reset births may carry a later lifetime shortening. Keeping that
        // receipt prevents fallback actors from outliving it; retainedFloor
        // still forbids replaying any sample before the reset boundary.
        if (retainedUntil(item.birth) <= retainedFloor) continue
        const endTickExclusive = Math.min(item.birth.endTickExclusive,
          item.prior?.endTickExclusive ?? item.birth.endTickExclusive)
        births.set(item.key, Object.freeze({ ...item.birth, endTickExclusive }))
      }
      throughTick = Math.max(throughTick, frame.throughTick)
    },
    sample(targetWorldTick: number): readonly FlamePresentationBirth<Recipe>[] {
      if (!Number.isFinite(targetWorldTick)) throw new RangeError('Invalid Flame presentation tick')
      const sampleTick = Math.floor(Math.min(targetWorldTick, throughTick))
      if (sampleTick < retainedFloor) return []
      return Array.from(births.values()).filter(birth => (
        birth.birthTick <= sampleTick && sampleTick < birth.endTickExclusive
      ))
    },
    discardBeforeTick(oldestPresentationTick: number): void {
      requireTick(oldestPresentationTick)
      retainedFloor = Math.max(retainedFloor, oldestPresentationTick)
      for (const [key, birth] of births) {
        // A shortened interval is a tombstone until its original native
        // maximum has passed. Otherwise an older duplicate can resurrect it.
        if (retainedUntil(birth) <= oldestPresentationTick) births.delete(key)
      }
    },
  }
}

function requireTick(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Flame world tick must be a nonnegative safe integer')
}

function maximumNativeEndTick<Recipe>(birth: FlamePresentationBirth<Recipe>): number {
  return birth.birthTick + (birth.kind === 'fade' ? 5 : 1)
}

function birthKey<Recipe>(birth: FlamePresentationBirth<Recipe>): string {
  return JSON.stringify([birth.worldKey, birth.ownerId, birth.kind, birth.id, birth.birthTick])
}

function validateBirth<Recipe>(birth: FlamePresentationBirth<Recipe>, worldKey: string): void {
  requireTick(birth.birthTick)
  requireTick(birth.endTickExclusive)
  if (!Number.isSafeInteger(birth.id) || birth.id < 1 || !(birth.worldKey === worldKey || (worldKey === 'hub' && birth.worldKey.startsWith('hub:')))
    || birth.ownerId.length === 0 || !['ribbon', 'fade', 'path'].includes(birth.kind)
    || birth.endTickExclusive < birth.birthTick
    || birth.endTickExclusive - birth.birthTick > (birth.kind === 'fade' ? 5 : 1)) {
    throw new RangeError('Invalid Flame presentation birth interval or identity')
  }
}

function sameRecipe<Recipe>(left: FlamePresentationBirth<Recipe>, right: FlamePresentationBirth<Recipe>): boolean {
  return birthKey(left) === birthKey(right) && JSON.stringify(left.recipe) === JSON.stringify(right.recipe)
}

function copyBirth<Recipe>(birth: FlamePresentationBirth<Recipe>): FlamePresentationBirth<Recipe> {
  return Object.freeze({ ...birth, recipe: freezeRecipe(structuredClone(birth.recipe)) })
}

function freezeRecipe<Value>(value: Value): Value {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeRecipe(child)
    Object.freeze(value)
  }
  return value
}
