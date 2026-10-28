/**
 * Small "did you mean" helper shared by the definition runtime, the schema
 * validators, and the graph compiler. It is deliberately conservative: a
 * suggestion is offered only when one candidate is clearly close to the input.
 */

const MAXIMUM_CANDIDATES = 4_096

export function suggestWebLuaName(
  input: string,
  candidates: Iterable<string>,
): string | null {
  const needle = normalize(input)
  if (needle.length === 0) return null
  const limit = Math.min(3, Math.max(1, Math.floor(needle.length / 3)))
  let best: string | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  let seen = 0
  for (const candidate of candidates) {
    seen += 1
    if (seen > MAXIMUM_CANDIDATES) break
    if (candidate === input) continue
    const target = normalize(candidate)
    if (target.length === 0) continue
    if (Math.abs(target.length - needle.length) > limit) continue
    const distance = target === needle ? 0 : levenshtein(needle, target, limit)
    if (distance > limit) continue
    if (
      distance < bestDistance
      || (distance === bestDistance && best !== null && compareCandidates(candidate, best) < 0)
    ) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

export function didYouMean(
  input: string,
  candidates: Iterable<string>,
  format: (candidate: string) => string = candidate => candidate,
): string {
  const suggestion = suggestWebLuaName(input, candidates)
  return suggestion === null ? '' : `; did you mean ${format(suggestion)}?`
}

export function listChoices(candidates: Iterable<string>, maximum = 12): string {
  const values = [...candidates]
  if (values.length <= maximum) return values.join(', ')
  return `${values.slice(0, maximum).join(', ')}, and ${values.length - maximum} more`
}

function normalize(value: string): string {
  return value.toLowerCase().replaceAll('-', '_').replaceAll(' ', '_')
}

function compareCandidates(left: string, right: string): number {
  if (left.length !== right.length) return left.length - right.length
  return left < right ? -1 : left > right ? 1 : 0
}

function levenshtein(left: string, right: string, limit: number): number {
  // Optimal string alignment distance: an adjacent swap such as "icno" for
  // "icon" costs one edit, because that is the most common typing slip.
  if (left === right) return 0
  if (left.length === 0) return right.length
  if (right.length === 0) return left.length
  let twoBack: number[] | null = null
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    let rowMinimum = row
    for (let column = 1; column <= right.length; column += 1) {
      const substitution = previous[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1)
      let value = Math.min(previous[column]! + 1, current[column - 1]! + 1, substitution)
      if (
        twoBack !== null
        && row > 1
        && column > 1
        && left[row - 1] === right[column - 2]
        && left[row - 2] === right[column - 1]
      ) {
        value = Math.min(value, twoBack[column - 2]! + 1)
      }
      current.push(value)
      if (value < rowMinimum) rowMinimum = value
    }
    if (rowMinimum > limit) return limit + 1
    twoBack = previous
    previous = current
  }
  return previous[right.length]!
}
