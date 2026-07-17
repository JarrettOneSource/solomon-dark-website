/**
 * Client-side credential derivation for warded (password) lobbies.
 * The site only ever transmits this derived hash — never the password —
 * per backend/LOBBY_API.md. Nothing here may be persisted or logged.
 */
export async function deriveLobbyPasswordHash(
  password: string,
  saltHex: string,
  iterations: number,
): Promise<string> {
  const salt = hexDecode(saltHex)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return hexEncode(new Uint8Array(bits))
}

function hexDecode(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
