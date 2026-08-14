export interface NativeRngState {
  readonly indexA: number
  readonly indexB: number
  readonly words: readonly number[]
}

const NATIVE_RNG_MASK = 0x3fffffff
const NATIVE_RNG_WORD_COUNT = 55

export function createNativeRng(seed: number): NativeRngState {
  if (!Number.isSafeInteger(seed)) throw new RangeError('native RNG seed must be a safe integer')
  const words = new Array<number>(NATIVE_RNG_WORD_COUNT)
  words[0] = seed & NATIVE_RNG_MASK
  words[1] = 1
  for (let index = 2; index < words.length; index += 1) {
    words[index] = (words[index - 1]! + words[index - 2]!) & NATIVE_RNG_MASK
  }
  return { indexA: 0, indexB: 31, words }
}

export function drawNativeInteger(
  source: NativeRngState,
  bound: number,
): { state: NativeRngState; value: number } {
  if (!Number.isSafeInteger(bound) || bound < 0) {
    throw new RangeError('native RNG bound must be a non-negative safe integer')
  }
  if (bound === 0) return { state: source, value: 0 }

  const words = [...source.words]
  const word = (words[source.indexA]! + words[source.indexB]!) & NATIVE_RNG_MASK
  words[source.indexA] = word
  let powerOfTwo = 2
  while (powerOfTwo < bound) powerOfTwo *= 2
  return {
    state: {
      indexA: (source.indexA + 1) % NATIVE_RNG_WORD_COUNT,
      indexB: (source.indexB + 1) % NATIVE_RNG_WORD_COUNT,
      words,
    },
    value: ((word >>> 6) & (powerOfTwo - 1)) % bound,
  }
}
