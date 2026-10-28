import assert from 'node:assert/strict'
import { getPlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import { canPlaceBoneyardBody, withBoneyardGateCollision } from '../src/game/core-server/boneyard-collision.ts'
import { NATIVE_SKILL_CATALOG } from '../src/game/core-kernels/player-progression.ts'

// Invoked by smoke-secondary-abilities with SDR_LANTERN_CURSOR_ACCEPTANCE=1.
// The existing harness owns the real browser, host, error collection and cleanup.
export async function acceptLanternAndCursor({
  page, canvas, host, playerId, baseSkillBook, armQuickbar, setHostPlayerPosition, screenshotRoot,
}) {
  const initial = host.state()
  assert.equal(initial.world.kind, 'boneyard')
  assert.ok(initial.world.lanternPosition)
  const index = initial.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  const originalPlayer = { ...getPlayerCharacter(initial, playerId).position }
  const before = { ...initial.world.lanternPosition }
  const bounds = initial.world.arenaTransition?.phase === 'sealed'
    ? initial.world.arenaTransition.combatBounds : initial.world.bounds
  const collision = withBoneyardGateCollision(initial.world.collision, initial.world.gateLeaves)
  const direction = [
    { x: 1, y: 0, key: 'd' }, { x: -1, y: 0, key: 'a' },
    { x: 0, y: 1, key: 's' }, { x: 0, y: -1, key: 'w' },
  ].find((direction) => (
    // This spawn has ten clear units before terrain. Test one native radius;
    // the world regressions cover longer movement and wall collision.
    [-60, -50, -40, -30, -20].every((offset) => canPlaceBoneyardBody({
      x: before.x + direction.x * offset,
      y: before.y + direction.y * offset,
    }, bounds, collision, 25))
    && [0, 4, 8].every((offset) => canPlaceBoneyardBody({
      x: before.x + direction.x * offset,
      y: before.y + direction.y * offset,
    }, bounds, collision, 8))
  ))
  assert.ok(direction, 'native Lantern needs an eight-unit push path in this acceptance seed')
  setHostPlayerPosition(host, index, {
    x: before.x - direction.x * 60, y: before.y - direction.y * 60,
  })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${screenshotRoot}/lantern-before-push.png` })
  await page.keyboard.down(direction.key)
  try {
    await waitUntil(() => {
      const point = host.state().world.lanternPosition
      return Math.hypot(point.x - before.x, point.y - before.y) >= 8
    }, 'real keyboard movement did not push the Lantern')
  } finally {
    await page.keyboard.up(direction.key)
  }
  await page.waitForTimeout(300)
  const after = { ...host.state().world.lanternPosition }
  await page.waitForFunction(({ x, y }) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame && Math.abs(frame.lanternWorldX - x) < 0.001
      && Math.abs(frame.lanternWorldY - y) < 0.001
      && Math.abs(frame.lanternLightX - x) < 0.001
      && Math.abs(frame.lanternLightY - y) < 0.001
  }, after, { timeout: 10_000 })
  const lanternPresentation = await canvas.evaluate((node) => {
    const frame = node.__sdrBoneyardFrame
    return {
      sprite: { x: frame.lanternWorldX, y: frame.lanternWorldY },
      light: { x: frame.lanternLightX, y: frame.lanternLightY },
      painterRow: frame.lanternPainterRow, intensity: frame.lanternLightIntensity,
    }
  })
  assert.ok(lanternPresentation.intensity > 0)
  await page.screenshot({ path: `${screenshotRoot}/lantern-after-push.png` })
  setHostPlayerPosition(host, index, originalPlayer)

  const casts = []
  const cases = [
    { skillId: 50, device: 'keyboard', width: 1600, height: 900, fx: 0.67, fy: 0.43 },
    { skillId: 50, device: 'keyboard', width: 800, height: 450, fx: 0.35, fy: 0.57, walk: true },
    { skillId: 49, device: 'keyboard', width: 1200, height: 700, fx: 0.61, fy: 0.60 },
    { skillId: 50, device: 'mouse', width: 800, height: 450, fx: 0.58, fy: 0.36 },
  ]
  for (const entry of cases) {
    await page.setViewportSize({ width: entry.width, height: entry.height })
    armQuickbar(host, playerId, baseSkillBook,
      entry.device === 'mouse' ? [entry.skillId] : [21, entry.skillId])
    const slot = entry.device === 'mouse' ? 0 : 1
    await page.waitForFunction(({ slot, name }) => {
      const node = document.querySelectorAll('.hub-hud-quickbar-slot')[slot]
      return node?.getAttribute('aria-label')?.includes(name)
        || node?.getAttribute('title')?.includes(name)
        || node?.textContent?.includes(name)
    }, { slot, name: NATIVE_SKILL_CATALOG[entry.skillId].name }, { timeout: 10_000 })
    await page.waitForTimeout(400)
    const rect = await canvas.boundingBox()
    assert.ok(rect)
    const screen = { x: rect.x + rect.width * entry.fx, y: rect.y + rect.height * entry.fy }
    await page.mouse.move(screen.x, screen.y)
    if (entry.walk) {
      await page.keyboard.down('d')
      await page.waitForTimeout(350)
      await page.keyboard.up('d')
      await page.waitForTimeout(400)
    }
    const expected = await canvas.evaluate((node, screen) => {
      const frame = node.__sdrBoneyardFrame
      const rect = node.getBoundingClientRect()
      const width = Number(node.dataset.viewportWidth)
      const height = Number(node.dataset.viewportHeight)
      return {
        x: frame.cameraX + ((screen.x - rect.left) * width / rect.width - width / 2) / frame.cameraZoom,
        y: frame.cameraY + ((screen.y - rect.top) * height / rect.height - height / 2) / frame.cameraZoom,
      }
    }, screen)
    assert.ok(Number.isFinite(expected.x) && Number.isFinite(expected.y))
    let actor
    if (entry.device === 'keyboard') await page.keyboard.down('1')
    else await page.mouse.down({ button: 'right' })
    try {
      await waitUntil(() => {
        actor = host.state().secondaryAbilities.actors.find((candidate) => (
          candidate.skillId === entry.skillId && candidate.ownerId === playerId
        ))
        return actor !== undefined
      }, `skill ${entry.skillId} did not cast from the ${entry.device}`)
    } finally {
      if (entry.device === 'keyboard') await page.keyboard.up('1')
      else await page.mouse.up({ button: 'right' })
    }
    const actual = { ...actor.position }
    const error = Math.hypot(actual.x - expected.x, actual.y - expected.y)
    assert.ok(error < 2, `cursor placement error ${error}: ${JSON.stringify({ entry, expected, actual })}`)
    await page.screenshot({ path: `${screenshotRoot}/cursor-${entry.skillId}-${entry.device}-${entry.width}.png` })
    casts.push({ ...entry, screen, expected, actual, error })
  }
  setHostPlayerPosition(host, index, originalPlayer)
  return { lantern: { before, after, ...lanternPresentation }, casts }
}

async function waitUntil(predicate, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(message)
}
