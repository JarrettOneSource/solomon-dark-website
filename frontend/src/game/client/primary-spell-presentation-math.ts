export function interpolateNullableNumber(
  older: number | null,
  newer: number | null,
  blend: number,
): number | null {
  return older === null || newer === null ? (blend < 1 ? older : newer) : lerp(older, newer, blend)
}

export function lerp(first: number, second: number, blend: number): number {
  return first + (second - first) * blend
}

export function lerpDegrees(first: number, second: number, blend: number): number {
  const delta = ((second - first + 540) % 360) - 180
  return first + delta * blend
}

export function lerpForwardCycle(
  older: number,
  newer: number,
  blend: number,
  period: number,
): number {
  const delta = ((newer - older) % period + period) % period
  return ((older + delta * blend) % period + period) % period
}

export function lerpNullableVector(
  first: Readonly<{ x: number; y: number }> | null,
  second: Readonly<{ x: number; y: number }> | null,
  blend: number,
): { x: number; y: number } | null {
  if (first !== null && second !== null) return lerpVector(first, second, blend)
  const discrete = blend < 1 ? first : second
  return discrete === null ? null : { ...discrete }
}

export function lerpVector(
  first: Readonly<{ x: number; y: number }>,
  second: Readonly<{ x: number; y: number }>,
  blend: number,
): { x: number; y: number } {
  return {
    x: lerp(first.x, second.x, blend),
    y: lerp(first.y, second.y, blend),
  }
}
