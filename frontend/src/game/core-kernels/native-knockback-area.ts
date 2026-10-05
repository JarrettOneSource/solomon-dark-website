import { drawNativeFloat, drawNativeUnitVector, type NativeRngState } from './native-rng.ts'
import type { Vector2 } from './vector.ts'

export function stepNativeKnockbackArea<T extends number | string>(
  source: Readonly<{ origin: Vector2; remainingDistance: number; targetIds: readonly T[] }>,
  sourceRng: NativeRngState,
  context: Readonly<{
    position: (id: T) => Vector2 | null
    move?: (id: T, delta: Vector2) => readonly T[]
  }>,
) {
  const vector = drawNativeUnitVector(sourceRng)
  let rng = vector.state
  const cameraDisplacement = { x: Math.fround(vector.value.x * 10), y: Math.fround(vector.value.y * 10) }
  const targetIds = [...source.targetIds]
  const seen = new Set(targetIds)
  const displacements: { targetId: T; delta: Vector2 }[] = []
  const distance = Math.min(source.remainingDistance, 10)
  for (let index = 0; index < targetIds.length; index += 1) {
    const id = targetIds[index]!
    const position = context.position(id)
    if (position === null) { targetIds.splice(index, 1); index -= 1; continue }
    const dx = Math.fround(position.x - source.origin.x)
    const dy = Math.fround(position.y - source.origin.y)
    const magnitude = Math.fround(Math.sqrt(Math.fround(dx * dx + dy * dy)))
    const reciprocal = magnitude > 0 ? Math.fround(1 / magnitude) : 0
    const delta = { x: Math.fround(distance * reciprocal * dx), y: Math.fround(distance * reciprocal * dy) }
    displacements.push({ targetId: id, delta })
    for (const collided of context.move?.(id, delta) ?? []) {
      if (seen.has(collided)) continue
      seen.add(collided)
      targetIds.push(collided)
    }
  }
  const remainingDistance = Math.fround(source.remainingDistance - 10)
  const terminal = remainingDistance <= 0
  const headingPerturbations: { targetId: T; headingDegrees: number }[] = []
  if (terminal) for (const id of targetIds) {
    if (context.position(id) === null) continue
    const heading = drawNativeFloat(rng, 45, true)
    rng = heading.state
    headingPerturbations.push({ targetId: id, headingDegrees: heading.value })
  }
  return { cameraDisplacement, displacements, headingPerturbations, remainingDistance, rng, targetIds, terminal }
}
