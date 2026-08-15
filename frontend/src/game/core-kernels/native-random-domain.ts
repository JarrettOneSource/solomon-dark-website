export const NATIVE_RANDOM_FLOAT_DENOMINATOR = 100_000
export const NATIVE_RANDOM_FLOAT_INTEGER_BOUND = (
  NATIVE_RANDOM_FLOAT_DENOMINATOR + 1
)

const NATIVE_RANDOM_WORD_MASK = 0x3fff_ffff
const NATIVE_RANDOM_WORD_SHIFT = 6

/**
 * Stock uses one shared generator. Replicated presentation cannot share that
 * draw stream, so callers supply a stable semantic hash as the raw word.
 * The native integer reduction, endpoint domain, and float32 stores stay exact.
 */
export function nativeRandomIntFromSemanticWord(
  semanticWord: number,
  exclusiveBound: number,
): number {
  let reductionWidth = 2
  while (reductionWidth < exclusiveBound) reductionWidth *= 2
  const nativeWord = ((semanticWord >>> 0) & NATIVE_RANDOM_WORD_MASK)
    >>> NATIVE_RANDOM_WORD_SHIFT
  return (nativeWord & (reductionWidth - 1)) % exclusiveBound
}

export function nativeRandomFloatFromSemanticWord(
  semanticWord: number,
  maximum = 1,
): number {
  const integerSample = Math.fround(nativeRandomIntFromSemanticWord(
    semanticWord,
    NATIVE_RANDOM_FLOAT_INTEGER_BOUND,
  ))
  const unitSample = Math.fround(integerSample / NATIVE_RANDOM_FLOAT_DENOMINATOR)
  return Math.fround(unitSample * Math.fround(maximum))
}

export function nativeSignedRandomFloatFromSemanticWords(
  magnitudeWord: number,
  signWord: number,
  maximum: number,
): number {
  const magnitude = nativeRandomFloatFromSemanticWord(magnitudeWord, maximum)
  return nativeRandomIntFromSemanticWord(signWord, 2) === 1
    ? Math.fround(-magnitude)
    : magnitude
}
