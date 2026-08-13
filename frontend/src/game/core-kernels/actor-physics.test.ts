import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveActorMotion, type ActorPhysicsBody } from './actor-physics.ts'

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
