export const NATIVE_ETHER_IMPACT_VISIBLE_TICKS = 19

export function nativeEtherImpactPitch(id: number): number {
  return Math.fround(1 + nativeEtherImpactRandom(id, 0) * Math.fround(0.1))
}

function nativeEtherImpactRandom(id: number, channel: number): number {
  let value = (
    Math.imul(Math.trunc(id), 0x9e3779b1)
    ^ Math.imul(Math.trunc(channel) + 1, 0xc2b2ae35)
  ) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000
}
