/**
 * Ephemeral 0x81C70C damage-context payload consumed only by the admitted
 * Badguy terminal dispatcher (0x477020). It is never an actor status/cooldown.
 */
export interface NativeSpellSpecialDeathPayload {
  readonly kind: 'fire' | 'steam'
  readonly explodeDamage: number
  readonly explodeRadius: number
  readonly emberDamage: number
  readonly emberFragments: number
  readonly privateSeed: number
}
