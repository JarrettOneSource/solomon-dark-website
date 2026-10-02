export function stableInclusiveUnit(
  enemy: Readonly<{ id: number; spawnTick: number }>,
  channel: number,
  epoch = 0,
): number {
  let value = (
    (enemy.id >>> 0)
    ^ Math.imul((Math.floor(enemy.spawnTick) + 1) >>> 0, 0x9e3779b1)
    ^ Math.imul((channel + 1) >>> 0, 0x85ebca6b)
    ^ Math.imul((epoch + 1) >>> 0, 0xc2b2ae35)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value = (value ^ (value >>> 16)) >>> 0
  return value / 0xffff_ffff
}

