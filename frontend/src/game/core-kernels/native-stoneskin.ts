import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'

export const NATIVE_STONESKIN_GRID_SIDE = 10
export const NATIVE_STONESKIN_GRID_COMPONENTS = 200
export const NATIVE_STONESKIN_JITTER = 4

/** Game::MakeStoneCoords 0x005A7A70. Both quality modes consume this same birth program. */
export function createNativeStoneskinWarp(source: NativeRngState): {
  readonly positions: readonly number[]
  readonly rng: NativeRngState
} {
  let rng = source
  const positions: number[] = []
  for (let x = 0; x < NATIVE_STONESKIN_GRID_SIDE; x++) {
    for (let y = 0; y < NATIVE_STONESKIN_GRID_SIDE; y++) {
      // The native optional grey color bank is generated even though this
      // painter passes a null color pointer. Its draws still belong to birth.
      const grey = drawNativeInteger(rng, 3)
      rng = grey.state
      if (grey.value === 1) rng = drawNativeFloat(rng, .5).state
      const distance = drawNativeFloat(rng, NATIVE_STONESKIN_JITTER)
      const angle = drawNativeFloat(distance.state, 360)
      rng = angle.state
      const radians = angle.value * Math.PI / 180
      positions.push(
        Math.fround(Math.fround(Math.fround(x * Math.fround(12.8)) - 64)
          + Math.fround(Math.fround(Math.sin(radians)) * distance.value)),
        Math.fround(Math.fround(Math.fround(y * Math.fround(12.8)) - 64)
          + Math.fround(Math.fround(-Math.cos(radians)) * distance.value)),
      )
    }
  }
  return { positions: Object.freeze(positions), rng }
}

export function nativeStoneskinGeometry(positions: readonly number[], enhancedEffects: boolean): {
  readonly positions: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint32Array
} {
  if (positions.length !== NATIVE_STONESKIN_GRID_COMPONENTS) throw new RangeError('invalid native Stoneskin grid')
  if (!enhancedEffects) {
    // DrawSpecial 0x546DAD/0x546DC3 uses the generated RenderToSprite quad;
    // Create 0x417310 subtracts .5 from its corners. The On grid below is custom.
    return { positions: new Float32Array([-128.5, -128.5, 127.5, -128.5, -128.5, 127.5, 127.5, 127.5]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), indices: new Uint32Array([0, 1, 2, 2, 1, 3]) }
  }
  const uvs: number[] = []
  const indices: number[] = []
  for (let x = 0; x < NATIVE_STONESKIN_GRID_SIDE; x++) {
    for (let y = 0; y < NATIVE_STONESKIN_GRID_SIDE; y++) {
      uvs.push(Math.fround(Math.fround(x * Math.fround(.05)) + .25),
        Math.fround(Math.fround(y * Math.fround(.05)) + .25))
      if (x < 9 && y < 9) {
        const a = x * 10 + y
        indices.push(a, a + 10, a + 1, a + 1, a + 10, a + 11)
      }
    }
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) }
}
