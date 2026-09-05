import assert from 'node:assert/strict'
import { join } from 'node:path'

import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'
import { createBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import {
  canPlaceBoneyardBody,
  resolveBoneyardSpawnPosition,
  withBoneyardGateCollision,
} from '../src/game/core-server/boneyard-collision.ts'
import {
  activateBoneyardGoodie,
  createBoneyardLootStore,
} from '../src/game/core-server/boneyard-loot-store.ts'
import { getPlayerCharacter, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { EntityReplicationReconstructor } from '../src/game/protocol/entity-replication.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'

export function observeGoldPlacementWire(page, endpoint) {
  const reconstructor = new EntityReplicationReconstructor()
  const receipt = { errors: [], snapshot: null }
  page.on('websocket', (socket) => {
    if (new URL(socket.url()).href !== new URL(endpoint).href) return
    socket.on('framereceived', ({ payload }) => {
      try {
        const message = decodeServerGameMessage(Buffer.isBuffer(payload) ? payload.toString() : payload)
        if (message.type === 'server-welcome') {
          reconstructor.reset(message.snapshot, message.snapshotSequence)
          receipt.snapshot = message.snapshot
        } else if (message.type === 'server-snapshot') {
          receipt.snapshot = reconstructor.apply(message.frame, message.sequence)
        }
      } catch (error) {
        receipt.errors.push(error.message)
      }
    })
  })
  return receipt
}

export async function proveGoldPlacement({
  host, hostPage, guestPage, hostPlayerId, guestPlayerId, screenshotRoot, wires,
}) {
  const world = host.state().world
  assert.equal(world.kind, 'boneyard')
  const chest = world.loot.goodies[0]
  assert.ok(chest, 'the generated Boneyard must contain a chest')
  const grave = world.scenerySpellTargets[0]
  assert.ok(grave, 'the generated Boneyard must contain a grave')
  const cases = [
    { name: 'chest', position: chest.position },
    { name: 'grave', position: { x: grave.position.x, y: grave.position.y - 25 } },
  ]
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  const receipts = []
  for (const scenario of cases) {
    const origin = { x: scenario.position.x, y: scenario.position.y + 25 }
    const state = host.state()
    const before = getPlayerEconomy(state, hostPlayerId).gold
    const guestBefore = getPlayerEconomy(state, guestPlayerId).gold
    Object.assign(state, { world: {
      ...state.world,
      arenaTransition: null,
      encounter: null,
      enemies: createBoneyardEnemyStore('gold-placement-browser'),
      enemyEvents: [],
      loot: activateBoneyardGoodie(createBoneyardLootStore('gold-chest-repro', [{
        eid: chest.id,
        position: scenario.position,
        rewardSeed: 13,
        sceneryRegistrationOrdinal: chest.sceneryRegistrationOrdinal,
        subtype: 0,
      }]), chest.id, hostPlayerId),
      lootEvents: [],
      waves: null,
    } })
    for (const [playerId, heading] of [[hostPlayerId, -90], [guestPlayerId, 90]]) {
      movePlayer(host, playerId, observerPosition(origin, heading, world.bounds, collision))
    }
    await waitUntil(() => {
      const loot = host.state().world.loot
      return loot.goodies[0]?.exhausted && loot.actors.length > 1
        && loot.actors.every((actor) => !actor.scatterActive && actor.activationDelayTicks < 1)
    }, `${scenario.name}: Gold did not materialize and settle`)
    assert.equal(getPlayerEconomy(host.state(), hostPlayerId).gold, before, 'host collected before the observation')
    assert.equal(getPlayerEconomy(host.state(), guestPlayerId).gold, guestBefore, 'guest collected before the observation')
    const actors = host.state().world.loot.actors
    assert.ok(actors.every(({ kind }) => kind === 'gold'))
    assert.equal(new Set(actors.map(({ position }) => JSON.stringify(position))).size, actors.length)
    assert.ok(actors.every(({ position }) => canPlaceBoneyardBody(position, world.bounds, collision, 1)))
    const width = Math.max(...actors.map(({ position }) => position.x))
      - Math.min(...actors.map(({ position }) => position.x))
    const height = Math.max(...actors.map(({ position }) => position.y))
      - Math.min(...actors.map(({ position }) => position.y))
    assert.ok(width > 80 && height > 50, `${scenario.name}: Gold remained clumped (${width} x ${height})`)
    const expected = actors.map(({ id, position }) => ({
      id, x: Math.round(position.x * 16) / 16, y: Math.round(position.y * 16) / 16,
    })).sort((left, right) => left.id - right.id)
    await waitUntil(() => wires.every(({ snapshot }) => (
      snapshot?.world.kind === 'boneyard' && snapshot.world.loot.length === actors.length
    )), `${scenario.name}: both clients did not receive the complete Gold batch`)
    for (const wire of wires) {
      assert.deepEqual(wire.errors, [])
      assert.deepEqual(wire.snapshot.world.loot.map(({ id, position }) => ({
        id, x: position.x, y: position.y,
      })).sort((left, right) => left.id - right.id), expected)
    }
    const screenshots = []
    const browser = []
    for (const [index, page] of [hostPage, guestPage].entries()) {
      await page.bringToFront()
      await page.waitForFunction((count) => (
        Number(document.querySelector('.boneyard-world-canvas')?.dataset.lootCount) === count
      ), actors.length)
      const canvas = page.locator('.boneyard-world-canvas')
      browser.push(await canvas.evaluate((node) => ({
        context: (node.getContext('webgl2') || node.getContext('webgl'))?.constructor.name,
        lootCount: Number(node.dataset.lootCount),
        playerCount: node.__sdrBoneyardFrame.playerCount,
      })))
      const path = join(screenshotRoot, `gold-${scenario.name}-${index}.png`)
      await page.screenshot({ path })
      screenshots.push(path)
    }
    assert.ok(browser.every(({ context, playerCount }) => (
      context === 'WebGL2RenderingContext' && playerCount === 2
    )))
    const amount = actors.reduce((total, actor) => total + actor.amount, 0)
    while (host.state().world.loot.actors.length > 0) {
      const actor = host.state().world.loot.actors[0]
      const position = pickupPosition(actor.position, world.bounds, collision)
      assert.ok(position, `${scenario.name}: no clear pickup point within 37.5 of Gold ${actor.id} at ${JSON.stringify(actor.position)}`)
      movePlayer(host, hostPlayerId, position)
      await waitUntil(() => !host.state().world.loot.actors.some(({ id }) => id === actor.id),
        `${scenario.name}: Gold ${actor.id} could not be collected from clear ground`)
    }
    assert.equal(getPlayerEconomy(host.state(), hostPlayerId).gold, before + amount)
    assert.equal(getPlayerEconomy(host.state(), guestPlayerId).gold, guestBefore)
    receipts.push({ name: scenario.name, amount, actorCount: actors.length, width, height, browser, screenshots })
  }
  return receipts
}

function movePlayer(host, playerId, position) {
  const state = host.state()
  Object.assign(state, { playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
    ...getPlayerCharacter(state, playerId), position, velocity: { x: 0, y: 0 },
  }) })
}

async function waitUntil(predicate, message) {
  const deadline = performance.now() + 15_000
  while (performance.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(message)
}

function pickupPosition(origin, bounds, collision) {
  // Search the actual pickup neighborhood; the general spawn resolver uses
  // sparse angular samples and can return a farther valid spawn.
  if (canPlaceBoneyardBody(origin, bounds, collision, PLAYER_CHARACTER_RADIUS)) return origin
  for (let radius = 2; radius <= 36; radius += 2) {
    for (let degrees = 0; degrees < 360; degrees += 5) {
      const angle = degrees * Math.PI / 180
      const candidate = { x: origin.x + Math.sin(angle) * radius, y: origin.y + Math.cos(angle) * radius }
      if (canPlaceBoneyardBody(candidate, bounds, collision, PLAYER_CHARACTER_RADIUS)) return candidate
    }
  }
  return null
}

function observerPosition(origin, heading, bounds, collision) {
  for (const offset of [0, 90, 180, 270]) {
    const angle = (heading + offset) * Math.PI / 180
    const position = resolveBoneyardSpawnPosition({
      x: origin.x + Math.sin(angle) * 350,
      y: origin.y + Math.cos(angle) * 350,
    }, bounds, collision, PLAYER_CHARACTER_RADIUS)
    if (Math.hypot(position.x - origin.x, position.y - origin.y) >= 300) return position
  }
  throw new Error('No clear observer position outside the Gold pickup neighborhood')
}
