export interface NativeRngState {
  readonly indexA: number
  readonly indexB: number
  readonly words: readonly number[]
}

const NATIVE_RNG_MASK = 0x3fffffff
const NATIVE_RNG_WORD_COUNT = 55
const NATIVE_FLOAT_DIVISOR = 100_000

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

  const draw = advanceNativeWord(source)
  let powerOfTwo = 2
  while (powerOfTwo < bound) powerOfTwo *= 2
  return {
    state: draw.state,
    value: ((draw.word >>> 6) & (powerOfTwo - 1)) % bound,
  }
}

/** Retail `0x00401310`: inclusive fixed-divisor float draw plus its optional sign word. */
export function drawNativeFloat(
  source: NativeRngState,
  maximum: number,
  signed = false,
): { state: NativeRngState; value: number } {
  if (!Number.isFinite(maximum) || maximum < 0) {
    throw new RangeError('native RNG float maximum must be finite and non-negative')
  }
  const magnitude = drawNativeInteger(source, NATIVE_FLOAT_DIVISOR + 1)
  const value = Math.fround((magnitude.value / NATIVE_FLOAT_DIVISOR) * maximum)
  if (!signed) return { state: magnitude.state, value }

  const sign = advanceNativeWord(magnitude.state)
  return {
    state: sign.state,
    value: ((sign.word >> 6) & 1) === 1 ? Math.fround(-value) : value,
  }
}

function advanceNativeWord(
  source: NativeRngState,
): { state: NativeRngState; word: number } {
  const words = [...source.words]
  const word = (words[source.indexA]! + words[source.indexB]!) & NATIVE_RNG_MASK
  words[source.indexA] = word
  return {
    state: {
      indexA: (source.indexA + 1) % NATIVE_RNG_WORD_COUNT,
      indexB: (source.indexB + 1) % NATIVE_RNG_WORD_COUNT,
      words,
    },
    word,
  }
}
