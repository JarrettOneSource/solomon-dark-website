import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  NATIVE_LEVEL_UP_EFFECT_TICKS,
  NATIVE_LEVEL_UP_MODAL_VISIBILITY,
  NATIVE_LEVEL_UP_PARTICLE_MAX_TICKS,
  NATIVE_LEVEL_UP_PRESENTATION_DURATION_MS,
  NATIVE_SKILL_PICKER_REVEAL_TICKS,
  nativeLevelUpPresentationFrame,
  nativeSkillPickerReveal,
} from './level-up-presentation.ts'

test('replays the stock 40-tick picker reveal and its three alpha lanes', () => {
  assert.equal(NATIVE_SKILL_PICKER_REVEAL_TICKS, 40)
  assert.deepEqual(nativeSkillPickerReveal(0), {
    ambientAlpha: 0,
    curtainAlpha: 0,
    interactive: false,
    panelAlpha: 0,
    revealAlpha: 0,
  })
  assert.deepEqual(nativeSkillPickerReveal(100), {
    ambientAlpha: 0.025,
    curtainAlpha: 0.125,
    interactive: false,
    panelAlpha: 0.015625,
    revealAlpha: 0.25,
  })
  assert.equal(nativeSkillPickerReveal(399).interactive, false)
  assert.deepEqual(nativeSkillPickerReveal(400), {
    ambientAlpha: 0.1,
    curtainAlpha: 0.5,
    interactive: true,
    panelAlpha: 1,
    revealAlpha: 1,
  })
})

test('replays the exact BadGuys-73 birth geometry, decay, and sine envelopes', () => {
  assert.equal(NATIVE_LEVEL_UP_EFFECT_TICKS, 180)
  assert.equal(NATIVE_LEVEL_UP_PARTICLE_MAX_TICKS, 60)
  assert.equal(NATIVE_LEVEL_UP_PRESENTATION_DURATION_MS, 2_390)
  const first = nativeLevelUpPresentationFrame(7, 0, 400)
  assert.equal(first.emitting, true)
  assert.equal(first.particles.length, 1)
  assert.deepEqual(first.particles[0], {
    alpha: 0.010118686970762741,
    atlas: 'BadGuys',
    entry: 73,
    offsetX: 6.808500289916992,
    offsetY: -311.2879943847656,
    rotationRadians: 1.9043077185310457,
    scale: 1.2246467991473532e-16,
  })
  assert.equal(first.lightRadius, 2.6 + Math.sin(179 * Math.PI / 180))

  const next = nativeLevelUpPresentationFrame(7, 10, 400).particles[0]!
  assert.equal(next.alpha, first.particles[0]!.alpha)
  assert.equal(next.offsetX, first.particles[0]!.offsetX)
  assert.equal(next.offsetY, -311.38800048828125)
  assert.equal(next.rotationRadians, first.particles[0]!.rotationRadians)
  assert.ok(next.scale > 0)

  const zeroHeight = nativeLevelUpPresentationFrame(7, 0, 0).particles[0]!
  assert.equal(zeroHeight.offsetY, -20)
  assert.equal(zeroHeight.offsetX, first.particles[0]!.offsetX)
  assert.equal(zeroHeight.rotationRadians, first.particles[0]!.rotationRadians)

  assert.equal(nativeLevelUpPresentationFrame(7, 350, 400).particles.length, 36)
  assert.equal(nativeLevelUpPresentationFrame(7, 590, 400).particles.length, 49)
  assert.equal(nativeLevelUpPresentationFrame(7, 1_790, 400).particles.length, 48)
  assert.equal(nativeLevelUpPresentationFrame(7, 1_800, 400).emitting, false)
  assert.equal(nativeLevelUpPresentationFrame(7, 1_800, 400).particles.length, 47)
  assert.equal(nativeLevelUpPresentationFrame(61_454, 2_380, 400).particles.length, 1)
  assert.equal(nativeLevelUpPresentationFrame(61_454, 2_390, 400).particles.length, 0)
  assert.equal(nativeLevelUpPresentationFrame(7, 890, 400).lightRadius, 3.6)
  assert.equal(nativeLevelUpPresentationFrame(7, 1_790, 400).lightRadius, 2.6)

  assert.equal(nativeLevelUpPresentationFrame(126_789, 0, 400).particles[0]!.offsetX, 30)
  assert.equal(nativeLevelUpPresentationFrame(211_839, 0, 400).particles[0]!.offsetX, -30)
  assert.equal(
    nativeLevelUpPresentationFrame(28_745, 0, 400).particles[0]!.rotationRadians,
    Math.PI * 2,
  )
  assert.equal(nativeLevelUpPresentationFrame(221_125, 0, 400).particles[0]!.offsetY, -420)

  assert.deepEqual(
    nativeLevelUpPresentationFrame(7, 730, 400),
    nativeLevelUpPresentationFrame(7, 730, 400),
  )
  assert.notDeepEqual(
    nativeLevelUpPresentationFrame(7, 730, 400).particles[0],
    nativeLevelUpPresentationFrame(8, 730, 400).particles[0],
  )
})

test('keeps the local threshold owner and scenery while suppressing modal clutter', () => {
  assert.deepEqual(NATIVE_LEVEL_UP_MODAL_VISIBILITY, {
    enemyDeathEffects: false,
    enemyLightning: false,
    enemyProjectiles: false,
    enemies: false,
    localPlayer: true,
    localPlayerLevelUpEffect: true,
    maggots: false,
    nonPlayerActors: false,
    playerDeathBursts: false,
    primarySpells: false,
    remotePlayers: false,
    scenery: true,
  })
})

test('wires modal suppression through Hub, private rooms, and the complete Boneyard dynamic family', () => {
  const source = (relativePath: string) => readFileSync(
    new URL(relativePath, import.meta.url),
    'utf8',
  )
  const main = source('../MainMenuScene.tsx')
  const boneyard = source('./boneyard-world-renderer.ts')
  const hub = source('./hub-world-scene.ts')
  const privateRooms = source('./hub-private-room-scene.ts')

  assert.match(main, /const levelUpModalActive = Boolean\(runtimeSnapshot\?\.levelUpBarrier\)/)
  assert.equal((main.match(/levelUpModalActive=\{levelUpModalActive\}/g) ?? []).length, 2)
  for (const witness of [
    'this.primarySpells.setRenderable(!modalActive)',
    'this.enemies.setRenderable(!modalActive)',
    'this.enemyDeathEffects.setRenderable(!modalActive)',
    'this.enemyProjectiles.setRenderable(!modalActive)',
    'this.maggots.setRenderable(!modalActive)',
    'this.mageLightningPulses.setRenderable(!modalActive)',
    'this.playerDeathBursts.setRenderable(!modalActive)',
    'this.solomon?.setActorRenderable(!modalActive)',
  ]) {
    assert.ok(boneyard.includes(witness), `missing Boneyard modal witness: ${witness}`)
  }
  assert.ok(boneyard.includes('(levelUpFrame.lightRadius - 2.6)'))
  assert.equal(boneyard.includes('levelUpEffectTicksRemaining'), false)
  assert.ok(boneyard.includes('camera.y - viewport.height / (2 * camera.zoom)'))
  assert.ok(boneyard.includes('view.container.renderable = !modalActive || id === localPlayerId'))
  assert.ok(hub.includes('levelUpPresentation.playerScreenY'))
  assert.ok(hub.includes('view.container.renderable = !modalActive || id === localPlayerId'))
  for (const witness of [
    'for (const view of this.students.values()) view.container.renderable = !modalActive',
    'for (const actor of this.nonPlayerActors) actor.renderable = !modalActive',
    'for (const particle of this.fountain.values()) particle.renderable = !modalActive',
    'this.hagatha.container.renderable = !modalActive',
    'this.luthacus.container.renderable = !modalActive',
    'this.potion.actor.renderable = !modalActive',
    'this.potion.balloons.renderable = !modalActive',
    'this.potion.marker.renderable = !modalActive',
    'this.teacher.container.renderable = !modalActive',
    'this.astronomer.behind.renderable = !modalActive',
    'this.astronomer.telescope.renderable = !modalActive',
    'this.astronomer.front.renderable = !modalActive',
    'this.primarySpells.setRenderable(!modalActive)',
  ]) {
    assert.ok(hub.includes(witness), `missing Hub modal witness: ${witness}`)
  }
  assert.ok(privateRooms.includes('view.container.renderable = !modalActive || playerId === localPlayerId'))
  for (const witness of [
    'for (const actor of this.nonPlayerActors[region]) actor.renderable = !modalActive',
    'flame.renderable = !modalActive',
    'this.nonPlayerActors.mortuary.push(memorator)',
    'this.nonPlayerActors.library.push(librarian)',
    'this.nonPlayerActors.library.push(dowser)',
    'this.nonPlayerActors.office.push(archChancellor)',
    'this.primarySpells[region].setRenderable(!modalActive)',
  ]) {
    assert.ok(privateRooms.includes(witness), `missing private-room modal witness: ${witness}`)
  }
})
