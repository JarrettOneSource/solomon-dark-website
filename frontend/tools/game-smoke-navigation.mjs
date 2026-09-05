import assert from 'node:assert/strict'

export async function enterElementHub(page, baseUrl, element) {
  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'Play' }).click()
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'New Game' }).click()
  await enterCreateAfterCollegeOffice(page)
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 30_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 90_000 })
  await page.locator('.match-loading-screen').waitFor({ state: 'detached', timeout: 90_000 })
}

export async function enterBoneyard(page) {
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const scene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  const picker = page.locator('.hub-boneyard-picker')
  await Promise.race([
    scene.waitFor({ timeout: 90_000 }),
    picker.waitFor({ timeout: 90_000 }),
  ])
  if (await picker.isVisible()) {
    const option = page.locator('.hub-boneyard-option').first()
    await option.waitFor({ timeout: 30_000 })
    await option.click()
  }
  await scene.waitFor({ timeout: 90_000 })
}

export async function openBoneyardCombat(host, playerId) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')) return
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const solomon = state.world.encounter?.position
  assert.ok(solomon, 'Combat acceptance requires the authentic Solomon encounter')
  setHostPlayerPosition(host, index, solomon)
  await waitUntil(() => {
    const current = host.state()
    return current.world.kind === 'boneyard' && current.world.encounter?.phase === 'speaking'
  }, 'Solomon did not enter the speaking phase', 10_000)
  setHostPlayerPosition(host, index, { x: solomon.x, y: solomon.y + 250 })
  await waitUntil(() => {
    const current = host.state()
    return current.world.kind === 'boneyard'
      && (current.world.encounter?.runEventId ?? 0) > 0
      && current.world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')
  }, 'Solomon did not release the opening combat wave', 30_000)
}

function setHostPlayerPosition(host, index, position) {
  const state = host.state()
  const locomotions = [...state.playerEntities.locomotions]
  locomotions[index] = {
    ...locomotions[index],
    position: { ...position },
    velocity: { x: 0, y: 0 },
  }
  Object.assign(state, {
    playerEntities: {
      ...state.playerEntities,
      locomotions: Object.freeze(locomotions),
    },
  })
}

export async function waitUntil(predicate, message, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(message)
}

async function declineTutorialOffer(page) {
  const offer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (!await offer.isVisible()) return
  await offer.getByRole('button', { exact: true, name: 'NO' }).click()
  await offer.waitFor({ state: 'hidden', timeout: 15_000 })
}

async function enterCreateAfterCollegeOffice(page) {
  const create = page.locator('.create-menu-scene[data-motion-settled="true"]')
  const office = page.locator('.hub-scene[data-hub-region="office"][data-story-office="true"]')
  const first = await Promise.race([
    create.waitFor({ timeout: 90_000 }).then(() => 'create'),
    office.waitFor({ timeout: 90_000 }).then(() => 'office'),
  ])
  if (first === 'create') return

  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.hub-world-canvas')
    return canvas?.getAttribute('data-hub-region') === 'office'
      && canvas?.getAttribute('data-transition-phase') === 'none'
  }, undefined, { timeout: 30_000 })
  await page.locator('.main-menu-page[data-hub-player-activity="none"]')
    .waitFor({ timeout: 30_000 })
  await completeCollegeIntroDialogue(page)
  await moveHubAxis(page, 'a', 'playerX', 300, 'at-most')
  await moveHubAxis(page, 's', 'playerY', 800, 'at-least')
  await moveHubAxis(page, 'd', 'playerX', 540, 'at-least')
  await page.keyboard.down('s')
  try {
    await create.waitFor({ timeout: 30_000 })
  } finally {
    await page.keyboard.up('s')
  }
}

async function completeCollegeIntroDialogue(page) {
  const dialog = page.getByRole('dialog', { name: 'Talking to The Archchancellor' })
  if (!await dialog.isVisible()) {
    await page.keyboard.press('e')
    await dialog.waitFor({ timeout: 15_000 })
  }
  await dialog.getByRole('button', { name: 'Skip' }).click()
  for (const label of ['Solomon Dark?', 'Collateral Damage?', 'Assistance?']) {
    await dialog.getByRole('button', { exact: true, name: label }).click()
    await dialog.getByRole('button', { name: 'Skip' }).click()
  }
  await dialog.getByRole('button', { exact: true, name: 'Done' }).click()
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
}

async function moveHubAxis(page, key, axis, target, direction) {
  await page.locator('.main-menu-page[data-hub-player-activity="none"]')
    .waitFor({ timeout: 30_000 })
  await page.keyboard.down(key)
  try {
    await page.waitForFunction(({ axis, direction, target }) => {
      const value = document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.[axis]
      return typeof value === 'number'
        && (direction === 'at-least' ? value >= target : value <= target)
    }, { axis, direction, target }, { timeout: 15_000 })
  } finally {
    await page.keyboard.up(key)
    await page.waitForTimeout(150)
  }
}
