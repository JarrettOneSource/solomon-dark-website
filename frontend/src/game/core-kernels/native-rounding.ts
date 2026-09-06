export function roundHalfToEven(value: number): number {
  if (!Number.isFinite(value)) throw new Error('native facing value must be finite')
  const integer = Math.trunc(value)
  const fraction = value - integer
  const distance = Math.abs(fraction)
  if (distance < 0.5) return integer
  const direction = Math.sign(fraction)
  if (distance > 0.5) return integer + direction
  return Math.abs(integer % 2) === 0 ? integer : integer + direction
}
