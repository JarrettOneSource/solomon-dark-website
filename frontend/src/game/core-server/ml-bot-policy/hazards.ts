import type { Vector2 } from '../../core-kernels/vector.ts'
import type {
  BoneyardEnemyProjectile,
  BoneyardEnemyStore,
  BoneyardMageLightningPulse,
} from '../boneyard-enemy-store.ts'
import { ML_BOT_POLICY_ENEMY_PROJECTILE_CLASSES } from './closed-unions.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'

export interface MlBotPolicyHazardObserver {
  readonly playerId: string
  readonly position: Readonly<Vector2>
  readonly radius: number
}

interface HazardRow {
  readonly alreadyHit: boolean
  readonly appliesCold: boolean
  readonly appliesPoison: boolean
  readonly damage: number
  readonly distance: number
  readonly homing: boolean
  readonly id: number
  readonly kind: 'area' | 'beam' | 'projectile'
  readonly kindName: BoneyardEnemyProjectile['kind'] | 'mage-lightning'
  readonly position: Readonly<Vector2>
  readonly radius: number
  readonly remainingSeconds: number
  readonly targetingSelf: boolean
  readonly timeToContactSeconds: number
  readonly velocity: Readonly<Vector2>
}

export function observeMlBotPolicyHazards(
  world: Readonly<{ enemies: BoneyardEnemyStore }>,
  observer: MlBotPolicyHazardObserver,
): Float32Array {
  const rows = [
    ...world.enemies.projectiles.map((projectile) => projectileRow(projectile, observer)),
    ...world.enemies.mageLightningPulses.map((pulse) => beamRow(pulse, world.enemies, observer)),
  ].sort((left, right) => left.distance - right.distance || left.id - right.id)
  const block = new Float32Array(12 * 24 + 1)
  for (let slot = 0; slot < Math.min(12, rows.length); slot += 1) {
    const row = rows[slot]!
    const start = slot * 24
    const relative = {
      x: row.position.x - observer.position.x,
      y: row.position.y - observer.position.y,
    }
    const direction = normalized(relative.x, relative.y)
    block[start] = 1
    block[start + 1] = Number(row.kindName === 'arrow')
    block[start + 2] = Number(row.kindName === 'demon-bomb')
    block[start + 3] = Number(row.kindName === 'firebolt')
    block[start + 4] = Number(row.kindName === 'guided-missile')
    block[start + 5] = Number(row.kindName === 'poison-pool')
    block[start + 6] = Number(row.kindName === 'mage-lightning')
    block[start + 7] = direction.x
    block[start + 8] = direction.y
    block[start + 9] = scaledUnsigned(row.distance, ML_BOT_POLICY_SCALES.range)
    block[start + 10] = scaledSigned(row.velocity.x, ML_BOT_POLICY_SCALES.velocity)
    block[start + 11] = scaledSigned(row.velocity.y, ML_BOT_POLICY_SCALES.velocity)
    block[start + 12] = scaledUnsigned(row.radius, ML_BOT_POLICY_SCALES.radius)
    block[start + 13] = scaledUnsigned(
      row.timeToContactSeconds,
      ML_BOT_POLICY_SCALES.hazardContactSeconds,
    )
    block[start + 14] = scaledUnsigned(
      row.remainingSeconds,
      ML_BOT_POLICY_SCALES.hazardLifetimeSeconds,
    )
    block[start + 15] = Number(row.kind === 'projectile')
    block[start + 16] = Number(row.kind === 'area')
    block[start + 17] = Number(row.kind === 'beam')
    block[start + 18] = Number(row.homing)
    block[start + 19] = Number(row.targetingSelf)
    block[start + 20] = scaledUnsigned(row.damage, ML_BOT_POLICY_SCALES.skillDamage)
    block[start + 21] = Number(row.appliesCold)
    block[start + 22] = Number(row.appliesPoison)
    block[start + 23] = Number(row.alreadyHit)
  }
  block[12 * 24] = Math.min(rows.length, 12) / 12
  return block
}

function projectileRow(
  projectile: BoneyardEnemyProjectile,
  observer: MlBotPolicyHazardObserver,
): HazardRow {
  const heading = headingVector(projectile.headingDeg)
  const velocity = {
    x: heading.x * projectile.speed,
    y: heading.y * projectile.speed,
  }
  const relative = {
    x: projectile.position.x - observer.position.x,
    y: projectile.position.y - observer.position.y,
  }
  return {
    alreadyHit: projectile.hitPlayerIds.includes(observer.playerId),
    appliesCold: projectile.coldSlowTicks > 0,
    appliesPoison: projectile.poisonDamage > 0,
    damage: projectile.damage,
    distance: Math.max(0, Math.hypot(relative.x, relative.y) - projectile.contactRadius),
    homing: projectile.homing,
    id: projectile.id,
    kind: ML_BOT_POLICY_ENEMY_PROJECTILE_CLASSES[projectile.kind],
    kindName: projectile.kind,
    position: projectile.position,
    radius: projectile.contactRadius,
    remainingSeconds: Math.max(0, projectile.lifetimeTicks - projectile.ageTicks)
      / ML_BOT_POLICY_SCALES.tickRate,
    targetingSelf: projectile.targetPlayerId === observer.playerId,
    timeToContactSeconds: impactTime(
      relative,
      velocity,
      projectile.contactRadius + observer.radius,
    ),
    velocity,
  }
}

function beamRow(
  pulse: BoneyardMageLightningPulse,
  enemies: BoneyardEnemyStore,
  observer: MlBotPolicyHazardObserver,
): HazardRow {
  const closest = closestPointOnSegment(observer.position, pulse.source, pulse.endpoint)
  const owner = enemies.actors.find(({ id }) => id === pulse.ownerActorId)
  const distance = Math.hypot(
    closest.x - observer.position.x,
    closest.y - observer.position.y,
  )
  return {
    alreadyHit: pulse.contact.kind === 'target-attached'
      && pulse.contact.targetPlayerId === observer.playerId,
    appliesCold: false,
    appliesPoison: false,
    damage: owner?.config.secondaryDamage ?? 0,
    distance,
    homing: false,
    id: pulse.id,
    kind: 'beam',
    kindName: 'mage-lightning',
    position: closest,
    radius: 0,
    remainingSeconds: 1 / ML_BOT_POLICY_SCALES.tickRate,
    targetingSelf: pulse.contact.kind === 'target-attached'
      && pulse.contact.targetPlayerId === observer.playerId,
    timeToContactSeconds: 0,
    velocity: { x: 0, y: 0 },
  }
}

function impactTime(
  relative: Readonly<Vector2>,
  velocity: Readonly<Vector2>,
  combinedRadius: number,
): number {
  const a = velocity.x ** 2 + velocity.y ** 2
  if (a <= 1e-9) return 0
  const b = 2 * (relative.x * velocity.x + relative.y * velocity.y)
  const c = relative.x ** 2 + relative.y ** 2 - combinedRadius ** 2
  if (c <= 0) return 0
  const discriminant = b ** 2 - 4 * a * c
  if (discriminant < 0) return 0
  const root = (-b - Math.sqrt(discriminant)) / (2 * a)
  return root >= 0 ? root : 0
}

function closestPointOnSegment(
  point: Readonly<Vector2>,
  start: Readonly<Vector2>,
  end: Readonly<Vector2>,
): Vector2 {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return { ...start }
  const progress = Math.max(0, Math.min(1, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / lengthSquared))
  return { x: start.x + dx * progress, y: start.y + dy * progress }
}

function normalized(x: number, y: number): Vector2 {
  const length = Math.hypot(x, y)
  return length > 1e-9 ? { x: x / length, y: y / length } : { x: 0, y: 0 }
}

function headingVector(degrees: number): Vector2 {
  const radians = degrees * Math.PI / 180
  return { x: Math.sin(radians), y: -Math.cos(radians) }
}

function scaledSigned(value: number, scale: number): number {
  return Math.max(-1, Math.min(1, value / scale))
}

function scaledUnsigned(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale))
}
