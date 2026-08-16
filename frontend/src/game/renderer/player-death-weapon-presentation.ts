import type { Vector2 } from '../core-kernels/vector.ts'
import type { PlayerDeathEquipmentAppearance } from '../player-character-presentation.ts'

export const NATIVE_PLAYER_DEATH_WEAPON_BOUNCER = Object.freeze({
  bounceDamping: 0.65,
  gravity: 0.4,
  initialHorizontalSpeed: 1.5,
  initialRadius: 15,
  initialRadiusRange: 10,
  initialVerticalSpeed: 2,
  initialVerticalSpeedRange: 3,
  maximumInitialHeight: 20,
  maximumInitialRotationDegrees: 360,
  maximumInitialRotationSpeed: 11,
  minimumInitialRotationSpeed: 1,
  settleVerticalSpeed: 0.75,
  updatePeriod: 3,
  updatesPerPeriod: 2,
})

export interface PlayerDeathWeaponTrigger {
  readonly deathEpoch: number
  readonly headingIndex: number
  readonly playerId: string
  readonly runId: string
  readonly weapon: PlayerDeathEquipmentAppearance['weapon']
}

export interface PlayerDeathWeaponSample {
  readonly height: number
  readonly offset: Readonly<Vector2>
  readonly rotationRadians: number
  readonly settled: boolean
}

export function playerDeathWeaponSample(
  trigger: PlayerDeathWeaponTrigger,
  ageTicks: number,
): PlayerDeathWeaponSample {
  if (!Number.isFinite(ageTicks)) throw new RangeError('Death-weapon age must be finite')
  const age = Math.max(0, Math.trunc(ageTicks))
  const seed = stableHash(
    `${trigger.runId}:${trigger.playerId}:${trigger.deathEpoch}:${trigger.weapon.kind}:${trigger.weapon.selector}`,
  )
  const headingRadians = normalizedHeading(trigger.headingIndex) * 15 * Math.PI / 180
  const direction = {
    x: Math.sin(headingRadians),
    y: -Math.cos(headingRadians),
  }
  const horizontalSpeed = NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.initialHorizontalSpeed
  const initialRadius = NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.initialRadius
    + unit(mix(seed, 1)) * NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.initialRadiusRange
  let x = direction.x * horizontalSpeed * (initialRadius + 2)
  let y = direction.y * horizontalSpeed * initialRadius
  let velocityX = direction.x * horizontalSpeed
  let velocityY = direction.y * horizontalSpeed
  let height = -unit(mix(seed, 2))
    * NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.maximumInitialHeight
  let verticalVelocity = -(
    NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.initialVerticalSpeed
    + unit(mix(seed, 3))
      * NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.initialVerticalSpeedRange
  )
  let bounceVelocity = verticalVelocity
  let rotationDegrees = unit(mix(seed, 4))
    * NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.maximumInitialRotationDegrees
  let rotationSpeed = NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.minimumInitialRotationSpeed
    + unit(mix(seed, 5)) * (
      NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.maximumInitialRotationSpeed
      - NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.minimumInitialRotationSpeed
    )
  let settled = false
  let bounce = 0
  const skippedPhase = mix(seed, 6) % NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.updatePeriod

  for (let tick = 0; tick < age && !settled; tick += 1) {
    if (tick % NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.updatePeriod === skippedPhase) continue
    x += velocityX
    y += velocityY
    height += verticalVelocity
    verticalVelocity += NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.gravity
    if (height > 0) {
      bounceVelocity *= NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.bounceDamping
      verticalVelocity = bounceVelocity
      height = verticalVelocity
      if ((mix(seed, 100 + bounce * 2) & 1) === 1) {
        velocityX *= NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.bounceDamping
        velocityY *= NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.bounceDamping
      }
      rotationSpeed = NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.minimumInitialRotationSpeed
        + unit(mix(seed, 101 + bounce * 2)) * (
          NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.maximumInitialRotationSpeed
          - NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.minimumInitialRotationSpeed
        )
      bounce += 1
      if (
        verticalVelocity
        > -NATIVE_PLAYER_DEATH_WEAPON_BOUNCER.settleVerticalSpeed
      ) {
        height = 0
        velocityX = 0
        velocityY = 0
        rotationSpeed = 0
        settled = true
      }
    }
    rotationDegrees += rotationSpeed
  }

  return {
    height,
    offset: { x, y },
    rotationRadians: rotationDegrees * Math.PI / 180,
    settled,
  }
}

function normalizedHeading(headingIndex: number): number {
  return ((Math.round(headingIndex) % 24) + 24) % 24
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mix(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

function unit(value: number): number {
  return value / 0x1_0000_0000
}
