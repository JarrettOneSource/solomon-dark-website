

const luaTextEncoder = new TextEncoder()

export class GameProtocolError extends Error {
  override name = 'GameProtocolError'
}

export function parseObject(payload: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(payload)
  } catch {
    throw new GameProtocolError('message is not valid JSON')
  }
  return record(value, 'message')
}

export function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GameProtocolError(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

export function onlyKeys(
  value: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
): void {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key))
  if (unexpected) throw new GameProtocolError(`${field}.${unexpected} is not allowed`)
}

export function array(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new GameProtocolError(`${field} must be an array`)
  return value
}

export function limitedArray(value: unknown, field: string, maximum: number): readonly unknown[] {
  const result = array(value, field)
  if (result.length > maximum) {
    throw new GameProtocolError(`${field} may contain at most ${maximum} entries`)
  }
  return result
}

export function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GameProtocolError(`${field} must be finite`)
  }
  return value
}

export function finiteWithin(value: unknown, field: string, minimum: number, maximum: number): number {
  const result = finite(value, field)
  if (result < minimum || result > maximum) {
    throw new GameProtocolError(`${field} must be within [${minimum},${maximum}]`)
  }
  return result
}

export function positiveFinite(value: unknown, field: string): number {
  const result = finite(value, field)
  if (result <= 0) throw new GameProtocolError(`${field} must be positive`)
  return result
}

export function nonnegativeFinite(value: unknown, field: string): number {
  const result = finite(value, field)
  if (result < 0) throw new GameProtocolError(`${field} must be nonnegative`)
  return result
}

export function unitInterval(value: unknown, field: string): number {
  const result = finite(value, field)
  if (result < 0 || result > 1) {
    throw new GameProtocolError(`${field} must be between zero and one`)
  }
  return result
}

export function integer(value: unknown, field: string): number {
  const result = finite(value, field)
  if (!Number.isInteger(result)) throw new GameProtocolError(`${field} must be an integer`)
  return result
}

export function integerWithin(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const result = integer(value, field)
  if (result < minimum || result > maximum) {
    throw new GameProtocolError(`${field} must be within [${minimum},${maximum}]`)
  }
  return result
}

export function nonnegativeInteger(value: unknown, field: string): number {
  const result = integer(value, field)
  if (result < 0) throw new GameProtocolError(`${field} must be nonnegative`)
  return result
}

export function positiveInteger(value: unknown, field: string): number {
  const result = integer(value, field)
  if (result < 1) throw new GameProtocolError(`${field} must be positive`)
  return result
}

export function boundedInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const result = integer(value, field)
  if (result < minimum || result > maximum) {
    throw new GameProtocolError(`${field} is outside [${minimum},${maximum}]`)
  }
  return result
}

export function pingNonce(value: unknown): number {
  const result = positiveInteger(value, 'nonce')
  if (result > 0x7fffffff) throw new GameProtocolError('nonce is out of range')
  return result
}

export function luaRequestId(value: unknown): number {
  const result = positiveInteger(value, 'requestId')
  if (result > 0x7fffffff) throw new GameProtocolError('requestId is out of range')
  return result
}

export function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new GameProtocolError(`${field} must be boolean`)
  return value
}

export function limitedString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new GameProtocolError(
      `${field} must be a nonempty string of at most ${maximum} characters`,
    )
  }
  return value
}

export function boundedString(value: unknown, field: string, maximumBytes: number): string {
  if (typeof value !== 'string' || luaTextEncoder.encode(value).byteLength > maximumBytes) {
    throw new GameProtocolError(`${field} must be a string of at most ${maximumBytes} bytes`)
  }
  return value
}

export function byteLimitedString(value: unknown, field: string, maximumBytes: number): string {
  const result = limitedString(value, field, maximumBytes)
  if (luaTextEncoder.encode(result).byteLength > maximumBytes) {
    throw new GameProtocolError(`${field} may contain at most ${maximumBytes} bytes`)
  }
  return result
}

export function encodedByteLength(value: unknown): number {
  return luaTextEncoder.encode(JSON.stringify(value)).byteLength
}

export function memberString<const T extends readonly string[]>(
  value: unknown,
  field: string,
  members: T,
): T[number] {
  const result = limitedString(value, field, 64)
  if (!(members as readonly string[]).includes(result)) {
    throw new GameProtocolError(`${field} is not supported`)
  }
  return result as T[number]
}

export function validatedPlayerId(value: unknown, field: string): string {
  const result = limitedString(value, field, 128)
  if (Object.hasOwn(Object.prototype, result)) {
    throw new GameProtocolError(`${field} is reserved`)
  }
  return result
}

export function playerReference(value: unknown, field: string): string {
  const result = limitedString(value, field, 43)
  if (!/^player-ref-[A-Za-z0-9_-]{32}$/.test(result)) {
    throw new GameProtocolError(`${field} is not a server-issued player reference`)
  }
  return result
}

export function playerTarget(value: unknown, field: string): string {
  const result = validatedPlayerId(value, field)
  if (result.startsWith('player-ref-') && !isPlayerReference(result)) {
    throw new GameProtocolError(`${field} contains an invalid player reference`)
  }
  return result
}

function isPlayerReference(value: string): boolean {
  return /^player-ref-[A-Za-z0-9_-]{32}$/.test(value)
}

export function sha256(value: unknown, field: string): string {
  const result = limitedString(value, field, 64).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(result)) {
    throw new GameProtocolError(`${field} must be SHA-256 hex`)
  }
  return result
}

export function gitRevision(value: unknown, field: string): string {
  const result = limitedString(value, field, 40).toLowerCase()
  if (!/^[0-9a-f]{40}$/.test(result)) {
    throw new GameProtocolError(`${field} must be a full Git revision`)
  }
  return result
}

export function optionalFinite(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : finite(value, field)
}

export function optionalInteger(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : integer(value, field)
}

export function optionalNumberField(
  source: Record<string, unknown>,
  field: string,
  key: string,
  decode: (value: unknown, field: string) => number | undefined,
): Record<string, number> {
  const value = decode(source[key], `${field}.${key}`)
  return value === undefined ? {} : { [key]: value }
}

export function byte(value: unknown, field: string): number {
  const result = nonnegativeInteger(value, field)
  if (result > 255) throw new GameProtocolError(`${field} must be a byte`)
  return result
}

export function headingDegrees(value: unknown, field: string): number {
  const result = finite(value, field)
  if (result < 0 || result >= 360) {
    throw new GameProtocolError(`${field} must be within [0,360)`)
  }
  return result
}

export type JsonInput = null | boolean | number | string | undefined | readonly JsonInput[] | { [key: string]: JsonInput }
