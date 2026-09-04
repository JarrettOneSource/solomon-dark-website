import { nativeWaterHailLifeAtAge } from '../core-kernels/air-water-spell-actors.ts'
import type {
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
  PrimarySpellWaterHailState,
} from '../core-kernels/primary-spells.ts'
import type {
  PrimarySpellSimulationFrameState,
  PrimarySpellWaterHailFrameTable,
} from '../protocol/game-state.ts'
import { lerp } from './primary-spell-presentation-math.ts'
import {
  copyPrimarySpellState,
  interpolatePrimarySpellState,
} from './primary-spell-presentation.ts'
import type { PrimarySpellPresentationTime } from './primary-spell-transient-presentation.ts'

export interface RetainedBoneyardPrimarySpellPresentation {
  copyFrame(
    spells: PrimarySpellSimulationFrameState,
    tick: number,
  ): PrimarySpellSimulationState
  interpolateFrame(
    older: PrimarySpellSimulationFrameState,
    newer: PrimarySpellSimulationFrameState,
    blend: number,
    time: PrimarySpellPresentationTime,
  ): PrimarySpellSimulationState
}

/**
 * Owns ephemeral Hail presentation storage for one Boneyard timeline. Returned
 * Hail objects and the transient array remain valid only until the next call.
 */
export function createRetainedBoneyardPrimarySpellPresentation(
): RetainedBoneyardPrimarySpellPresentation {
  const hail = new RetainedHailPresentation()
  return {
    copyFrame(spells, tick) {
      const copied = copyPrimarySpellState(spells)
      copied.transients = hail.mergeWithNonHail(
        copied.transients,
        hail.copyFrame(spells.hail, tick),
      )
      return copied
    },
    interpolateFrame(older, newer, blend, time) {
      const interpolated = interpolatePrimarySpellState(
        older,
        newer,
        blend,
        time,
      )
      interpolated.transients = hail.mergeWithNonHail(
        interpolated.transients,
        hail.interpolateFrame(older.hail, newer.hail, blend, time),
      )
      return interpolated
    },
  }
}

class RetainedHailPresentation {
  private readonly actors = new Map<number, PrimarySpellWaterHailState>()
  private readonly hailOutput: PrimarySpellWaterHailState[] = []
  private readonly liveIds = new Set<number>()
  private readonly newerRowIndexesById = new Map<number, number>()
  private indexedNewerTable: PrimarySpellWaterHailFrameTable | null = null
  private readonly transientOutput: PrimarySpellTransientState[] = []

  copyFrame(
    table: PrimarySpellWaterHailFrameTable,
    tick: number,
  ): PrimarySpellWaterHailState[] {
    this.begin()
    for (let index = 0; index < table.rows.length; index += 1) {
      this.hailOutput.push(this.retainFrameCopy(table, index, tick))
    }
    this.end()
    return this.hailOutput
  }

  interpolateFrame(
    older: PrimarySpellWaterHailFrameTable,
    newer: PrimarySpellWaterHailFrameTable,
    blend: number,
    time: PrimarySpellPresentationTime,
  ): PrimarySpellWaterHailState[] {
    this.begin()
    if (newer !== this.indexedNewerTable) {
      this.newerRowIndexesById.clear()
      for (let index = 0; index < newer.rows.length; index += 1) {
        this.newerRowIndexesById.set(newer.rows.ids[index]!, index)
      }
      this.indexedNewerTable = newer
    }
    for (let index = 0; index < older.rows.length; index += 1) {
      const nextIndex = this.newerRowIndexesById.get(older.rows.ids[index]!)
      if (nextIndex !== undefined) {
        this.hailOutput.push(this.retainFrameInterpolation(
          older,
          index,
          newer,
          nextIndex,
          blend,
          time,
        ))
      } else if (blend < 1) {
        this.hailOutput.push(this.retainFrameCopy(older, index, time.olderTick))
      }
    }
    if (blend >= 1) {
      for (let index = 0; index < newer.rows.length; index += 1) {
        if (!this.liveIds.has(newer.rows.ids[index]!)) {
          this.hailOutput.push(this.retainFrameCopy(newer, index, time.newerTick))
        }
      }
    }
    this.hailOutput.sort((first, second) => first.id - second.id)
    this.end()
    return this.hailOutput
  }

  mergeWithNonHail(
    nonHail: readonly PrimarySpellTransientState[],
    hail: readonly PrimarySpellWaterHailState[],
  ): PrimarySpellTransientState[] {
    const output = this.transientOutput
    output.length = 0
    let nonHailIndex = 0
    let hailIndex = 0
    while (nonHailIndex < nonHail.length || hailIndex < hail.length) {
      const nonHailActor = nonHail[nonHailIndex]
      const hailActor = hail[hailIndex]
      if (hailActor === undefined || (
        nonHailActor !== undefined && nonHailActor.id < hailActor.id
      )) {
        output.push(nonHailActor!)
        nonHailIndex += 1
      } else {
        output.push(hailActor)
        hailIndex += 1
      }
    }
    return output
  }

  private begin(): void {
    this.hailOutput.length = 0
    this.liveIds.clear()
  }

  private end(): void {
    for (const id of this.actors.keys()) {
      if (!this.liveIds.has(id)) this.actors.delete(id)
    }
  }

  private retainFrameCopy(
    table: PrimarySpellWaterHailFrameTable,
    index: number,
    tick: number,
  ): PrimarySpellWaterHailState {
    const rows = table.rows
    const ownerId = table.ownerIds[rows.ownerIndexes[index]!]
    const worldKey = table.worldKeys[rows.worldKeyIndexes[index]!]
    if (ownerId === undefined || worldKey === undefined) {
      throw new Error('Hail frame row references an unavailable dictionary entry')
    }
    const id = rows.ids[index]!
    const ageTicks = tick - rows.birthTicks[index]!
    let target = this.actors.get(id)
    if (!target) {
      const bounceSoundIndex = rows.bounceSoundIndexes[index]!
      const bounceSoundPitch = rows.bounceSoundPitches[index]!
      target = {
        ageTicks,
        birthTick: rows.birthTicks[index]!,
        bounceProgress: rows.bounceProgresses[index]!,
        bounceSoundIndex: bounceSoundIndex === 0xff ? null : bounceSoundIndex,
        bounceSoundPitch: Number.isNaN(bounceSoundPitch) ? null : bounceSoundPitch,
        bounceSoundSequence: rows.bounceSoundSequences[index]!,
        height: rows.heights[index]!,
        horizontalVelocity: {
          x: rows.horizontalVelocityXs[index]!,
          y: rows.horizontalVelocityYs[index]!,
        },
        id,
        kind: 'water-hail',
        life: nativeWaterHailLifeAtAge(ageTicks),
        ownerId,
        painterRegistrations: Object.freeze([Object.freeze({
          managerLane: 'actor' as const,
          registrationOrdinal: rows.painterRegistrationOrdinals[index]!,
        })]),
        position: { x: rows.positionXs[index]!, y: rows.positionYs[index]! },
        rotationDegrees: rows.rotationDegrees[index]!,
        rotationStepDegrees: rows.rotationStepDegrees[index]!,
        savedBounceVelocity: rows.savedBounceVelocities[index]!,
        scale: rows.scales[index]!,
        verticalVelocity: rows.verticalVelocities[index]!,
        worldKey,
      }
      this.actors.set(id, target)
    } else {
      assignHailFrameCopy(target, table, index, ownerId, worldKey, ageTicks)
    }
    this.liveIds.add(id)
    return target
  }

  private retainFrameInterpolation(
    olderTable: PrimarySpellWaterHailFrameTable,
    olderIndex: number,
    newerTable: PrimarySpellWaterHailFrameTable,
    newerIndex: number,
    blend: number,
    time: PrimarySpellPresentationTime,
  ): PrimarySpellWaterHailState {
    const discreteTable = blend < 1 ? olderTable : newerTable
    const discreteIndex = blend < 1 ? olderIndex : newerIndex
    const discreteTick = blend < 1 ? time.olderTick : time.newerTick
    const target = this.retainFrameCopy(discreteTable, discreteIndex, discreteTick)
    const olderRows = olderTable.rows
    const newerRows = newerTable.rows
    const olderAge = time.olderTick - olderRows.birthTicks[olderIndex]!
    const newerAge = time.newerTick - newerRows.birthTicks[newerIndex]!
    target.ageTicks = lerp(olderAge, newerAge, blend)
    target.height = lerp(
      olderRows.heights[olderIndex]!,
      newerRows.heights[newerIndex]!,
      blend,
    )
    target.horizontalVelocity.x = lerp(
      olderRows.horizontalVelocityXs[olderIndex]!,
      newerRows.horizontalVelocityXs[newerIndex]!,
      blend,
    )
    target.horizontalVelocity.y = lerp(
      olderRows.horizontalVelocityYs[olderIndex]!,
      newerRows.horizontalVelocityYs[newerIndex]!,
      blend,
    )
    target.life = lerp(
      nativeWaterHailLifeAtAge(olderAge),
      nativeWaterHailLifeAtAge(newerAge),
      blend,
    )
    target.position.x = lerp(
      olderRows.positionXs[olderIndex]!,
      newerRows.positionXs[newerIndex]!,
      blend,
    )
    target.position.y = lerp(
      olderRows.positionYs[olderIndex]!,
      newerRows.positionYs[newerIndex]!,
      blend,
    )
    target.rotationDegrees = lerp(
      olderRows.rotationDegrees[olderIndex]!,
      newerRows.rotationDegrees[newerIndex]!,
      blend,
    )
    target.verticalVelocity = lerp(
      olderRows.verticalVelocities[olderIndex]!,
      newerRows.verticalVelocities[newerIndex]!,
      blend,
    )
    return target
  }
}

function assignHailFrameCopy(
  target: PrimarySpellWaterHailState,
  table: PrimarySpellWaterHailFrameTable,
  index: number,
  ownerId: string,
  worldKey: string,
  ageTicks: number,
): void {
  const rows = table.rows
  requireRetainedHailPainterRegistration(
    target,
    rows.painterRegistrationOrdinals[index]!,
  )
  const bounceSoundIndex = rows.bounceSoundIndexes[index]!
  const bounceSoundPitch = rows.bounceSoundPitches[index]!
  target.ageTicks = ageTicks
  target.birthTick = rows.birthTicks[index]!
  target.bounceProgress = rows.bounceProgresses[index]!
  target.bounceSoundIndex = bounceSoundIndex === 0xff ? null : bounceSoundIndex
  target.bounceSoundPitch = Number.isNaN(bounceSoundPitch) ? null : bounceSoundPitch
  target.bounceSoundSequence = rows.bounceSoundSequences[index]!
  target.height = rows.heights[index]!
  target.horizontalVelocity.x = rows.horizontalVelocityXs[index]!
  target.horizontalVelocity.y = rows.horizontalVelocityYs[index]!
  target.life = nativeWaterHailLifeAtAge(ageTicks)
  target.ownerId = ownerId
  target.position.x = rows.positionXs[index]!
  target.position.y = rows.positionYs[index]!
  target.rotationDegrees = rows.rotationDegrees[index]!
  target.rotationStepDegrees = rows.rotationStepDegrees[index]!
  target.savedBounceVelocity = rows.savedBounceVelocities[index]!
  target.scale = rows.scales[index]!
  target.verticalVelocity = rows.verticalVelocities[index]!
  target.worldKey = worldKey
}

function requireRetainedHailPainterRegistration(
  target: PrimarySpellWaterHailState,
  registrationOrdinal: number,
): void {
  const painterRegistrations = target.painterRegistrations
  const registration = painterRegistrations?.[0]
  if (
    painterRegistrations?.length !== 1
    || registration?.managerLane !== 'actor'
    || registration.registrationOrdinal !== registrationOrdinal
  ) {
    throw new Error('Hail changed its retained actor-manager painter registration')
  }
}
