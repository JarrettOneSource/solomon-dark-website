import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveActorMotion, type ActorPhysicsBody } from './actor-physics.ts'
import { DynamicActorGrid } from './dynamic-actor-grid.ts'

const freePhysicsWorld = {
  canPlace: () => true,
  move: (
    _bodyId: string,
    position: { x: number; y: number },
    delta: { x: number; y: number },
  ) => ({ x: position.x + delta.x, y: position.y + delta.y }),
}
const allBodiesCollide = () => true

test('actor strength thresholds produce yielding, pushing, and player dominance', () => {
  const heavyObstacle: ActorPhysicsBody[] = [
    { id: 'mover', position: { x: 0, y: 0 }, delta: { x: 20, y: 0 }, radius: 15, pushStrength: 5, pushResistance: 5 },
    { id: 'heavy', position: { x: 38, y: 0 }, delta: { x: 0, y: 0 }, radius: 15, pushStrength: 5, pushResistance: 10 },
  ]
  const yielded = resolveActorMotion(heavyObstacle, freePhysicsWorld, allBodiesCollide)
  assert.ok(yielded[0].position.x < 20)
  assert.equal(yielded[1].position.x, 38)

  let bodies: ActorPhysicsBody[] = [
    { id: 'student', position: { x: 0, y: 0 }, delta: { x: 1.2, y: 0 }, radius: 15, pushStrength: 11, pushResistance: 6 },
    { id: 'player', position: { x: 39, y: 0 }, delta: { x: 0, y: 0 }, radius: 25, pushStrength: 12, pushResistance: 10 },
  ]
  bodies = resolveActorMotion(bodies, freePhysicsWorld, allBodiesCollide)
  assert.ok(bodies[1].position.x > 39)
  const afterStudentPush = bodies[1].position.x

  for (let frame = 0; frame < 90; frame += 1) {
    bodies = resolveActorMotion([
      { ...bodies[0], delta: { x: 0, y: 0 } },
      { ...bodies[1], delta: { x: -1, y: 0 } },
    ], freePhysicsWorld, allBodiesCollide)
  }
  assert.ok(bodies[0].position.x < 0)
  assert.ok(bodies[1].position.x < afterStudentPush)
})

test('dynamic grid reproduces all-pairs ordering across cell edges and chained pushes', () => {
  const bodies: ActorPhysicsBody[] = [
    { id: 'negative', position: { x: -65, y: 0 }, delta: { x: 40, y: 0 }, radius: 18, pushStrength: 15, pushResistance: 5 },
    { id: 'first', position: { x: -20, y: 0 }, delta: { x: 0, y: 0 }, radius: 18, pushStrength: 8, pushResistance: 5 },
    { id: 'second', position: { x: 16, y: 0 }, delta: { x: 0, y: 0 }, radius: 18, pushStrength: 8, pushResistance: 5 },
    { id: 'fixed', position: { x: 60, y: 0 }, delta: { x: 0, y: 0 }, driven: false, radius: 18, pushStrength: 0, pushResistance: 90 },
  ]
  assert.deepEqual(
    resolveActorMotion(bodies, freePhysicsWorld, allBodiesCollide, new DynamicActorGrid(32)),
    resolveActorMotion(bodies, freePhysicsWorld, allBodiesCollide),
  )
})

test('dynamic grid is an exact all-pairs oracle over deterministic mixed crowds', () => {
  let randomState = 0x51d07e57
  for (let trial = 0; trial < 80; trial += 1) {
    const bodies: ActorPhysicsBody[] = []
    for (let index = 0; index < 48; index += 1) {
      const x = randomSigned(500)
      const y = randomSigned(300)
      const deltaX = randomSigned(12)
      const deltaY = randomSigned(12)
      const radius = 8 + random() * 24
      bodies.push({
        delta: { x: deltaX, y: deltaY },
        driven: index % 11 !== 0,
        id: `body-${index}`,
        position: { x, y },
        pushEnabled: index % 13 !== 0,
        pushResistance: 1 + random() * 14,
        pushStrength: 1 + random() * 18,
        radius,
      })
    }
    const filter = (first: ActorPhysicsBody, second: ActorPhysicsBody) => (
      Number(first.id.slice(5)) % 3 === Number(second.id.slice(5)) % 3
    )
    assert.deepEqual(
      resolveActorMotion(bodies, freePhysicsWorld, filter, new DynamicActorGrid(64)),
      resolveActorMotion(bodies, freePhysicsWorld, filter),
      `trial ${trial}`,
    )
  }

  function random(): number {
    randomState ^= randomState << 13
    randomState ^= randomState >>> 17
    randomState ^= randomState << 5
    randomState >>>= 0
    return randomState / 0x1_0000_0000
  }

  function randomSigned(maximum: number): number {
    return (random() * 2 - 1) * maximum
  }
})
