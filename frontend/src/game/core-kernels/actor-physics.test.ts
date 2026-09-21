import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveActorMotion,
  resolveUnpushedMoverMotion,
  type ActorPhysicsBody,
  type ActorPhysicsWorld,
} from './actor-physics.ts'
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

test('actor solver returns detached closed records without epoch scratch', () => {
  const source: ActorPhysicsBody[] = [
    {
      delta: { x: 0, y: 0 },
      driven: false,
      id: 'fixed',
      position: { x: 10, y: 20 },
      pushEnabled: false,
      pushResistance: 90,
      pushStrength: 0,
      radius: 15,
    },
    {
      delta: { x: 0, y: 0 },
      id: 'ordinary',
      position: { x: 100, y: 200 },
      pushResistance: 5,
      pushStrength: 10,
      radius: 20,
    },
  ]
  const before = structuredClone(source)

  const resolved = resolveActorMotion(source, freePhysicsWorld, allBodiesCollide)

  assert.deepEqual(source, before)
  assert.deepEqual(resolved, before)
  assert.notEqual(resolved[0], source[0])
  assert.notEqual(resolved[0].delta, source[0].delta)
  assert.notEqual(resolved[0].position, source[0].position)
  assert.deepEqual(Object.keys(resolved[0]).sort(), [
    'delta', 'driven', 'id', 'position', 'pushEnabled', 'pushResistance',
    'pushStrength', 'radius',
  ])
  assert.deepEqual(Object.keys(resolved[1]).sort(), [
    'delta', 'id', 'position', 'pushResistance', 'pushStrength', 'radius',
  ])
  assert.equal('currentPushStrength' in resolved[0], false)
})

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

test('actor response reports ordered root contacts without leaking recursive recipients', () => {
  const contacts: Array<readonly [string, string]> = []
  const bodies: ActorPhysicsBody[] = [
    { id: 'root', position: { x: 0, y: 0 }, delta: { x: 15, y: 0 }, radius: 10, pushStrength: 20, pushResistance: 5 },
    { id: 'first', position: { x: 25, y: 0 }, delta: { x: 0, y: 0 }, driven: false, radius: 10, pushStrength: 10, pushResistance: 5 },
    { id: 'recursive', position: { x: 43, y: 0 }, delta: { x: 0, y: 0 }, driven: false, radius: 10, pushStrength: 10, pushResistance: 5 },
  ]

  resolveActorMotion(
    bodies,
    freePhysicsWorld,
    allBodiesCollide,
    undefined,
    (moverId, otherId) => contacts.push([moverId, otherId]),
  )

  assert.deepEqual(contacts, [['root', 'first']])
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

test('dynamic grid preserves idle Boneyard roots, dense passive crowds and contact order', () => {
  for (const offset of [-64, 0, 63.9]) {
    const bodies: ActorPhysicsBody[] = [0, 1].map((index) => ({
      delta: { x: 0, y: 0 },
      id: `player-${index}`,
      position: { x: offset + index * 160, y: 0 },
      pushResistance: 10,
      pushStrength: 12,
      radius: 25,
    }))
    for (let coffin = 0; coffin < 12; coffin += 1) {
      const center = { x: offset + (coffin % 4) * 160, y: Math.floor(coffin / 4) * 130 }
      for (let child = 0; child < 51; child += 1) {
        bodies.push({
          delta: { x: 0, y: 0 },
          driven: false,
          id: `coffin-${coffin}-body-${child}`,
          position: child === 50
            ? { x: center.x + 85, y: center.y + 15 }
            : { x: center.x + (child % 10 - 4.5) * 11,
                y: center.y + (Math.floor(child / 10) - 2) * 11 },
          pushEnabled: false,
          pushResistance: 0,
          pushStrength: 0,
          radius: child === 50 ? 45 : 8,
        })
      }
    }
    const before = structuredClone(bodies)
    let rejectedPlacements = 0
    const world: ActorPhysicsWorld = {
      canPlace: (_bodyId, position, radius) => {
        const allowed = position.y - radius >= -30
        rejectedPlacements += Number(!allowed)
        return allowed
      },
      move: (_bodyId, position, delta, radius) => ({
        x: position.x + delta.x,
        y: Math.max(-30 + radius, position.y + delta.y),
      }),
    }
    const referenceContacts: Array<readonly [string, string]> = []
    const actualContacts: Array<readonly [string, string]> = []
    const reference = resolveActorMotion(bodies, world, allBodiesCollide, undefined,
      (moverId, otherId) => referenceContacts.push([moverId, otherId]))
    const actual = resolveActorMotion(bodies, world, allBodiesCollide, new DynamicActorGrid(64),
      (moverId, otherId) => actualContacts.push([moverId, otherId]))

    assert.deepEqual(actual, reference, `offset ${offset}`)
    assert.deepEqual(actualContacts, referenceContacts)
    assert.deepEqual(bodies, before)
    assert.ok(rejectedPlacements > 0)
    assert.ok(actualContacts.length > 0)
    assert.ok(actual.filter((body, index) => index >= 2 && (
      body.position.x !== bodies[index]!.position.x
      || body.position.y !== bodies[index]!.position.y
    )).length > 30)
  }
})

test('unpushed mover fast path is an exact single-driver oracle over crowded worlds', () => {
  let randomState = 0x2f6e2b1d
  const blockedWorld = {
    canPlace: (_bodyId: string, position: { x: number; y: number }) => (
      Math.abs(position.x) < 180 || position.y > -40
    ),
    move: (
      _bodyId: string,
      position: { x: number; y: number },
      delta: { x: number; y: number },
    ) => ({
      x: Math.max(-320, Math.min(320, position.x + delta.x)),
      y: Math.max(-200, Math.min(200, position.y + delta.y)),
    }),
  }
  let contactedTrials = 0
  for (let trial = 0; trial < 120; trial += 1) {
    const bodies: ActorPhysicsBody[] = []
    for (let index = 0; index < 40; index += 1) {
      const player = index < 2
      const body: ActorPhysicsBody = {
        delta: { x: 0, y: 0 },
        driven: false,
        id: player ? `player-${index}` : `enemy-${index}`,
        position: { x: randomSigned(160), y: randomSigned(120) },
        pushResistance: player ? 10 : 0,
        pushStrength: player ? 12 : 0,
        radius: player ? 25 : 8 + random() * 24,
      }
      if (!player) body.pushEnabled = false
      bodies.push(body)
    }
    const moverIndex = 2 + Math.floor(random() * (bodies.length - 2))
    const delta = { x: randomSigned(14), y: randomSigned(14) }
    const reference = resolveActorMotion(
      bodies.map((body) => ({
        ...body,
        delta: body === bodies[moverIndex] ? { ...delta } : { x: 0, y: 0 },
        driven: body === bodies[moverIndex],
      })),
      blockedWorld,
      allBodiesCollide,
    )[moverIndex]!.position
    const before = structuredClone(bodies)
    const resolved = resolveUnpushedMoverMotion(bodies, moverIndex, delta, blockedWorld)
    assert.deepEqual(resolved, reference, `trial ${trial}`)
    for (const cellSize of [8, 32, 128]) {
      const grid = new DynamicActorGrid(cellSize)
      grid.rebuild(bodies)
      const indexed = resolveUnpushedMoverMotion(bodies, moverIndex, delta, blockedWorld,
        (position, radius) => grid.candidateIndicesAt(position, radius))
      assert.deepEqual(indexed, reference, `indexed trial ${trial}, cell size ${cellSize}`)
    }
    assert.deepEqual(bodies, before, `trial ${trial} mutated the crowd`)
    const mover = bodies[moverIndex]!
    if (
      resolved.x !== mover.position.x + delta.x
      || resolved.y !== mover.position.y + delta.y
    ) contactedTrials += 1
  }
  assert.ok(contactedTrials > 40, `only ${contactedTrials} trials separated the mover`)

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

test('indexed unpushed motion re-queries after correction without revisiting earlier bodies', () => {
  const bodies: ActorPhysicsBody[] = [0, -9, 30].map((x, index) => ({
    id: `enemy-${index}`, position: { x, y: 0 }, radius: 10,
    pushEnabled: false, pushStrength: 0, pushResistance: 0, delta: { x: 0, y: 0 },
  }))
  const grid = new DynamicActorGrid(5)
  grid.rebuild(bodies)
  assert.equal(grid.candidateIndicesAt(bodies[0]!.position, 10).includes(2), false)
  const expected = resolveUnpushedMoverMotion(bodies, 0, { x: 0, y: 0 }, freePhysicsWorld)
  let queries = 0
  const actual = resolveUnpushedMoverMotion(bodies, 0, { x: 0, y: 0 }, freePhysicsWorld,
    (position, radius) => { queries += 1; return grid.candidateIndicesAt(position, radius) })
  assert.deepEqual(actual, expected)
  assert.ok(queries >= 3, 'both successful corrections refresh candidate membership')
  assert.ok(actual.x < 10, 'earlier collision indices must not be revisited after the second correction')
})

test('dynamic grid appends, grows and tracks sequential non-pushing moves exactly', () => {
  const bodies: ActorPhysicsBody[] = []
  const grid = new DynamicActorGrid(32)
  grid.rebuild(bodies)
  for (let index = 0; index < 130; index += 1) {
    const body: ActorPhysicsBody = { id: `enemy-${index}`, position: {
      x: (index % 13) * 17 - 100, y: Math.floor(index / 13) * 19 - 100,
    }, radius: 12, pushEnabled: false, pushStrength: 0, pushResistance: 0, delta: { x: 0, y: 0 } }
    bodies.push(body)
    assert.equal(grid.append(body), index)
  }
  for (let step = 0; step < 260; step += 1) {
    const index = step % bodies.length
    const delta = { x: step % 2 === 0 ? 23 : -11, y: step % 3 === 0 ? 15 : -7 }
    const expected = resolveUnpushedMoverMotion(bodies, index, delta, freePhysicsWorld)
    const actual = resolveUnpushedMoverMotion(bodies, index, delta, freePhysicsWorld,
      (position, radius) => grid.candidateIndicesAt(position, radius))
    assert.deepEqual(actual, expected, `sequential move ${step}`)
    bodies[index]!.position = actual
    grid.update(index, bodies)
  }
})

test('unpushed mover fast path preserves blocked and strict response edges', () => {
  const crowd = (otherX: number): ActorPhysicsBody[] => [
    {
      delta: { x: 0, y: 0 },
      driven: false,
      id: 'mover',
      position: { x: 0, y: 0 },
      pushEnabled: false,
      pushResistance: 0,
      pushStrength: 0,
      radius: 10,
    },
    {
      delta: { x: 0, y: 0 },
      driven: false,
      id: 'other',
      position: { x: otherX, y: 0 },
      pushResistance: 10,
      pushStrength: 12,
      radius: 10,
    },
  ]
  const reference = (
    bodies: readonly ActorPhysicsBody[],
    delta: Readonly<{ x: number; y: number }>,
    world: ActorPhysicsWorld,
  ) => resolveActorMotion(
    bodies.map((body, index) => ({
      ...body,
      delta: index === 0 ? { ...delta } : { x: 0, y: 0 },
      driven: index === 0,
    })),
    world,
    allBodiesCollide,
  )[0]!.position
  const assertEquivalent = (
    label: string,
    bodies: ActorPhysicsBody[],
    delta: Readonly<{ x: number; y: number }>,
    world: ActorPhysicsWorld,
  ) => assert.deepEqual(
    resolveUnpushedMoverMotion(bodies, 0, delta, world),
    reference(bodies, delta, world),
    label,
  )

  const blockedSweepWorld: ActorPhysicsWorld = {
    canPlace: () => true,
    move: (_bodyId, position, delta) => ({
      x: delta.x > 0 ? position.x : position.x + delta.x,
      y: position.y + delta.y,
    }),
  }
  const blocked = crowd(100)
  assertEquivalent('blocked sweep', blocked, { x: 5, y: 0 }, blockedSweepWorld)
  assert.deepEqual(
    resolveUnpushedMoverMotion(blocked, 0, { x: 5, y: 0 }, blockedSweepWorld),
    { x: 0, y: 0 },
  )

  const rejectedPlacementWorld: ActorPhysicsWorld = {
    canPlace: () => false,
    move: freePhysicsWorld.move,
  }
  const rejected = crowd(15)
  assertEquivalent('rejected placement', rejected, { x: 0, y: 0 }, rejectedPlacementWorld)
  assert.deepEqual(
    resolveUnpushedMoverMotion(rejected, 0, { x: 0, y: 0 }, rejectedPlacementWorld),
    { x: 0, y: 0 },
  )

  const coincident = crowd(0)
  assertEquivalent('coincident centers', coincident, { x: 0, y: 0 }, freePhysicsWorld)
  assert.deepEqual(
    resolveUnpushedMoverMotion(coincident, 0, { x: 0, y: 0 }, freePhysicsWorld),
    { x: 0, y: 0 },
  )

  const exactEdge = crowd(20)
  assertEquivalent('strict overlap edge', exactEdge, { x: 0, y: 0 }, freePhysicsWorld)
  assert.deepEqual(
    resolveUnpushedMoverMotion(exactEdge, 0, { x: 0, y: 0 }, freePhysicsWorld),
    { x: 0, y: 0 },
  )
  const overlapping = crowd(19.999)
  assertEquivalent('inside strict overlap edge', overlapping, { x: 0, y: 0 }, freePhysicsWorld)
  assert.notDeepEqual(
    resolveUnpushedMoverMotion(overlapping, 0, { x: 0, y: 0 }, freePhysicsWorld),
    { x: 0, y: 0 },
  )
})
