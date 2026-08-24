const encoder = new TextEncoder()

export const WEB_LUA_CONTENT_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/

export function validWebLuaContentKey(value: string): boolean {
  return WEB_LUA_CONTENT_KEY_PATTERN.test(value)
}

export function stableWebLuaContentId(modId: string, key: string): string {
  let hash = 0xcbf29ce484222325n
  const append = (bytes: Uint8Array): void => {
    for (const byte of bytes) {
      hash ^= BigInt(byte)
      hash = BigInt.asUintN(64, hash * 0x100000001b3n)
    }
  }
  append(encoder.encode('sd.content.v1'))
  for (const value of [modId, key]) {
    const bytes = encoder.encode(value)
    append(Uint8Array.of(
      bytes.length & 0xff,
      bytes.length >>> 8 & 0xff,
      bytes.length >>> 16 & 0xff,
      bytes.length >>> 24 & 0xff,
    ))
    append(bytes)
  }
  return ((hash & ((1n << 62n) - 1n)) | (1n << 62n)).toString()
}
