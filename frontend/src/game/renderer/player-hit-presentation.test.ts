import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./hub-actors.ts', import.meta.url), 'utf8')

test('player renderer owns a separate native-red living-body redraw pass', () => {
  assert.match(source, /new Container\(\{ label: 'player-hit-overlay' \}\)/)
  assert.match(source, /this\.hitOverlay\.zIndex = 8/)
  assert.match(source, /playerHitOverlayAlpha\(player\.progression, tick\)/)
  assert.match(source, /this\.hitOverlay\.visible = !death\.visible && hitAlpha > 0/)
  assert.match(source, /sprite\.tint = 0xff0000/)

  const membership = source.match(/this\.hitOverlay\.addChild\(([\s\S]*?)\n    \)/)?.[1]
  assert.ok(membership)
  assert.match(membership, /this\.hitStaffBack/)
  assert.match(membership, /this\.hitRobe/)
  assert.match(membership, /this\.hitRobeSecondary/)
  assert.match(membership, /this\.hitFixed/)
  assert.match(membership, /this\.hitFixedSecondary/)
  assert.match(membership, /this\.hitStaffFront/)
  assert.match(membership, /this\.hitHead/)
  assert.match(membership, /this\.hitHeadSecondary/)
  assert.doesNotMatch(membership, /shadow|orb|death/i)

  const worldTint = source.match(/setWorldTint\(tint: number\): void \{([\s\S]*?)\n  \}/)?.[1]
  assert.ok(worldTint)
  assert.doesNotMatch(worldTint, /hit/)
})

test('hit redraw mirrors current textures, offsets, and item-owned depth-mask passes', () => {
  assert.match(source, /this\.hitStaffBack\.visible = hasWeapon/)
  assert.match(source, /this\.hitStaffFront\.visible = hasWeapon/)
  assert.match(source, /this\.hitStaffBack\.texture = weaponTextures\.back\[heading\]!\[attachmentPose\]!/)
  assert.match(source, /this\.hitRobe\.texture = this\.robe\.texture/)
  assert.match(source, /this\.hitRobeSecondary\.texture = this\.robeSecondary\.texture/)
  assert.match(source, /this\.hitFixed\.texture = this\.fixed\.texture/)
  assert.match(source, /this\.hitFixedSecondary\.texture = this\.fixedSecondary\.texture/)
  assert.match(source, /this\.hitFixed\.position\.set\(fixedOffset\.x, fixedOffset\.y\)/)
  assert.match(source, /this\.hitStaffFront\.texture = weaponTextures\.front\[heading\]!\[attachmentPose\]!/)
  assert.match(source, /this\.hitStaffFront\.position\.set\(attachmentOffset\.x, attachmentOffset\.y\)/)
  assert.match(source, /this\.hitHead\.texture = this\.head\.texture/)
  assert.match(source, /this\.hitHeadSecondary\.texture = this\.headSecondary\.texture/)
  assert.match(source, /this\.hitHead\.position\.set\(headOffset\.x, headOffset\.y\)/)
})
