import { drawNativeFloat, type NativeRngState } from '../core-kernels/native-rng.ts'
import { directionFromHeading } from '../core-kernels/primary-spell-targeting.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type {
  BoneyardEnemyDeathEffect,
  BoneyardEnemySemanticEvent,
  BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'

export function emitPlayerStatusBurst(
  source: BoneyardEnemyStore,
  request: Readonly<{
    actorId: number
    playerId: string
    position: Readonly<Vector2>
    status: 'cold' | 'poison'
    tick: number
  }>,
  sourceRng: NativeRngState,
): Readonly<{ event: BoneyardEnemySemanticEvent; rng: NativeRngState; store: BoneyardEnemyStore }> {
  let rng = sourceRng
  const effects: BoneyardEnemyDeathEffect[] = []
  for (let heading = 0; heading < 360; heading += 30) {
    const rotation = drawNativeFloat(rng, 360)
    const scale = drawNativeFloat(rotation.state, 0.75)
    const radius = drawNativeFloat(scale.state, 20)
    const positionAngle = drawNativeFloat(radius.state, 10, true)
    const speed = drawNativeFloat(positionAngle.state, 3)
    const velocityAngle = drawNativeFloat(speed.state, 10, true)
    rng = velocityAngle.state
    const radial = directionFromHeading(Math.fround(heading + positionAngle.value))
    const direction = directionFromHeading(Math.fround(heading + velocityAngle.value))
    const distance = Math.fround(10 + radius.value)
    effects.push({
      ageTicks: 0,
      alpha: 0.5,
      alphaLossPerTick: Math.fround(0.00625),
      alphaMultiplier: 1,
      angularVelocityDeg: 0,
      atlas: 'BadGuys',
      blendMode: 'add',
      bounceRetention: 0,
      bounceVelocity: 0,
      entry: 10,
      firstEntry: 10,
      frameCount: 1,
      framePhase: 0,
      frameTicks: 1,
      frameVelocity: 0,
      frameVelocityDamping: 1,
      height: 0,
      id: source.nextDeathEffectId + effects.length,
      kind: 'move-fade-perspective',
      lastStepTick: request.tick,
      lifetimeTicks: 81,
      opacityTimer: 0.5,
      ownerActorId: request.actorId,
      painterRegistration: null,
      position: {
        x: Math.fround(request.position.x + Math.fround(radial.x * distance)),
        y: Math.fround(request.position.y + Math.fround(radial.y * distance)),
      },
      presentationOwner: 'pre-world-queue',
      role: `player-status-${request.status}`,
      rotationDeg: rotation.value,
      scale: Math.fround(0.75 + scale.value),
      scaleMultiplier: 1,
      shadow: false,
      spawnTick: request.tick,
      tint: request.status === 'poison' ? 0x80ff80 : 0x80bfff,
      velocity: {
        x: Math.fround(direction.x * speed.value),
        y: Math.fround(Math.fround(direction.y * speed.value) * Math.fround(0.8)),
      },
      velocityDamping: Math.fround(request.status === 'poison' ? 0.95 : 0.93),
      verticalVelocity: 0,
    })
  }
  const event: BoneyardEnemySemanticEvent = {
    actorId: request.actorId,
    eventId: source.nextEventId,
    gainScale: 1,
    pitch: 1.5,
    sound: request.status === 'poison' ? 'poisoned' : 'frosted',
    sourcePosition: request.position,
    targetPlayerId: request.playerId,
    tick: request.tick,
    type: 'player-status-sound',
  }
  return {
    event,
    rng,
    store: {
      ...source,
      deathEffects: [...source.deathEffects, ...effects],
      nextDeathEffectId: source.nextDeathEffectId + effects.length,
      nextEventId: source.nextEventId + 1,
    },
  }
}
