import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import type { NativeFlameCameraProposal } from '../core-kernels/native-weld-flame-state.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import { NATIVE_FLAME_CAMERA_MAX_PRESENTATION_TICKS } from '../core-kernels/native-weld-flame-camera.ts'
import { createFlamePresentationReplay } from '../protocol/flame-presentation-history.ts'
import { flamePresentationBirth, materializeFlamePresentation, type FlamePresentationFrame, type FlamePresentationRecipe } from '../protocol/flame-presentation.ts'

export function createRetainedFlamePresentation(initial?: FlamePresentationFrame) {
  const replay = createFlamePresentationReplay<FlamePresentationRecipe>(undefined, birth =>
    birth.recipe.kind === 'ribbon' && birth.recipe.birth.cameraDisplacement !== null
      ? birth.birthTick + NATIVE_FLAME_CAMERA_MAX_PRESENTATION_TICKS : birth.endTickExclusive)
  let resetTick = initial?.throughTick ?? 0
  let epoch = initial?.epoch ?? 0
  // A newly created timeline has no interpolation history. Hub Region changes
  // can recreate it from a continuous connection snapshot; start locally at
  // that boundary and let the snapshot's complete live actors supply visuals.
  if (initial) replay.accept({ kind: 'reset', epoch: initial.epoch,
    worldKey: initial.worldKey, throughTick: initial.throughTick, births: [] })
  return {
    cameraDisplacements(state: PrimarySpellSimulationState, stoppedWorldTick: number,
      liveRegionTick = stoppedWorldTick): readonly NativeFlameCameraProposal[] {
      if (stoppedWorldTick < resetTick) return []
      const known = new Map(replay.historyAt(stoppedWorldTick).map(birth => [birth.id, birth]))
      for (const actor of state.transients) {
        const birth = flamePresentationBirth(actor)
        if (birth && !known.has(birth.id)) known.set(birth.id, birth)
      }
      return [...known.values()].flatMap(birth => {
        if (birth.recipe.kind !== 'ribbon' || birth.recipe.birth.cameraDisplacement === null
          || birth.birthTick > stoppedWorldTick
          || liveRegionTick >= birth.birthTick + NATIVE_FLAME_CAMERA_MAX_PRESENTATION_TICKS) return []
        return [{ id: birth.id, birthTick: birth.birthTick, worldKey: birth.worldKey,
          displacement: birth.recipe.birth.cameraDisplacement }]
      }).sort((left, right) => left.birthTick - right.birthTick || left.id - right.id)
    },
    accept(frame: FlamePresentationFrame | undefined, oldestTick: number): boolean {
      if (!frame || frame.epoch < epoch
        || (frame.kind === 'reset' && frame.epoch === epoch && frame.throughTick < replay.throughTick())) return false
      const replaced = epoch !== 0 && frame.epoch !== epoch
      if (frame.kind === 'reset') resetTick = frame.throughTick
      replay.discardBeforeTick(Math.max(0, Math.floor(oldestTick)))
      replay.accept(frame)
      epoch = frame.epoch
      return replaced
    },
    sample(state: PrimarySpellSimulationState, stoppedWorldTick: number): PrimarySpellSimulationState {
      const retained = new Map(replay.sample(stoppedWorldTick).map(birth => [birth.id, birth]))
      const ordinary = state.transients.filter(actor => {
        const birth = flamePresentationBirth(actor)
        if (!birth) return true
        const admitted = replay.retained(birth) ?? birth
        if (stoppedWorldTick >= resetTick && admitted.birthTick <= stoppedWorldTick
          && stoppedWorldTick < admitted.endTickExclusive && !retained.has(admitted.id)) retained.set(admitted.id, admitted)
        return false
      })
      const flames = [...retained.values()].flatMap(birth => {
        if (stoppedWorldTick < resetTick) return []
        const actor = materializeFlamePresentation(birth, stoppedWorldTick)
        return actor ? [actor] : []
      })
      return { ...state, transients: [...ordinary, ...flames].sort((a, b) => a.id - b.id) }
    },
  }
}

/** Client-frame metadata only: never part of object/compact wire codecs or saves. */
export function flameCameraDisplacements(snapshot: GameSnapshot): readonly NativeFlameCameraProposal[] {
  return (snapshot as GameSnapshot & { flameCameraDisplacements?: readonly NativeFlameCameraProposal[] }).flameCameraDisplacements ?? []
}

export function flamePresentationEpoch(snapshot: GameSnapshot): number | undefined {
  return (snapshot as GameSnapshot & { flamePresentationEpoch?: number }).flamePresentationEpoch
    ?? snapshot.flamePresentation?.epoch
}
