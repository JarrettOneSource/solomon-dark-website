import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  NATIVE_LEVEL_UP_EFFECT_TICKS,
  LEVEL_UP_PICKER_BACKGROUND_VISIBILITY,
  NATIVE_LEVEL_UP_PARTICLE_MAX_TICKS,
  NATIVE_LEVEL_UP_PRESENTATION_DURATION_MS,
  NATIVE_SKILL_PICKER_REVEAL_TICKS,
  nativeLevelUpPresentationFrame,
  nativeSkillPickerClose,
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

test('replays the distinct stock card and Save Skill close rates', () => {
  assert.equal(nativeSkillPickerClose(0, -0.75).revealAlpha, 1)
  assert.equal(nativeSkillPickerClose(100, -0.75).revealAlpha, 0.8125)
  assert.equal(nativeSkillPickerClose(530, -0.75).revealAlpha, 0.006249999999999867)
  assert.equal(nativeSkillPickerClose(540, -0.75).revealAlpha, 0)
  assert.equal(nativeSkillPickerClose(390, -1).revealAlpha, 0.02499999999999991)
  assert.equal(nativeSkillPickerClose(400, -1).revealAlpha, 0)
  assert.equal(nativeSkillPickerClose(100, -0.75).interactive, false)
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

test('keeps the complete frozen world visible behind the level-up picker', () => {
  assert.deepEqual(LEVEL_UP_PICKER_BACKGROUND_VISIBILITY, {
    enemyDeathEffects: true,
    enemyLightning: true,
    enemyProjectiles: true,
    enemies: true,
    localPlayer: true,
    localPlayerLevelUpEffect: true,
    maggots: true,
    nonPlayerActors: true,
    playerDeathBursts: true,
    primarySpells: true,
    remotePlayers: true,
    scenery: true,
  })
})

test('retains picker presentation without any Hub, private-room, or Boneyard suppression branch', () => {
  const source = (relativePath: string) => readFileSync(
    new URL(relativePath, import.meta.url),
    'utf8',
  )
  const main = source('../MainMenuScene.tsx')
  const picker = source('../SkillPicker.tsx')
  const boneyard = source('./boneyard-world-renderer.ts')
  const hub = source('./hub-world-scene.ts')
  const privateRooms = source('./hub-private-room-scene.ts')
  const pickerRenderer = source('./skill-picker-renderer.ts')

  assert.match(main, /const levelUpModalActive = Boolean\(runtimeSnapshot\?\.levelUpBarrier\)/)
  assert.ok(main.includes('|| levelUpPickerClosing'))
  assert.ok(main.includes('&& (runtimeProgression?.pendingOffer || levelUpPickerClosing)'))
  assert.equal((main.match(/levelUpModalActive=\{levelUpModalActive\}/g) ?? []).length, 0)
  assert.equal((picker.match(/audio\.playSound\('pick-skill'/g) ?? []).length, 1)
  assert.equal((picker.match(/audio\.playSound\('click'/g) ?? []).length, 1)
  assert.match(picker, /audio\.playSound\('summon', \{ playbackRate: 0\.8 \}\)/)
  assert.match(picker, /audio\.playSound\('unlock-skill', \{ playbackRate: 1 \}\)/)
  assert.equal((picker.match(/playbackRate: 0\.75/g) ?? []).length, 2)
  assert.match(picker, /const NATIVE_QUEUED_REBUILD_DELAY_MS = 100/)
  assert.match(
    picker,
    /subscribeGamePresentationFrames\(\(nowMs\) => \{\s+if \(!renderer\) return\s+const currentPhase/,
    'the cold picker consumed reveal time before its renderer existed',
  )
  assert.ok(picker.includes("phaseRef.current = 'queued-wait'"))
  assert.ok(picker.includes('setContentVisible(false)'))
  assert.match(picker, /const offerContentVisible = phase !== 'queued-wait'/)
  assert.ok(pickerRenderer.includes('offerLayer.visible = visible'))
  assert.ok(boneyard.includes('(levelUpFrame.lightRadius - 2.6)'))
  assert.equal(boneyard.includes('levelUpEffectTicksRemaining'), false)
  assert.ok(boneyard.includes('camera.y - viewport.height / (2 * camera.zoom)'))
  assert.ok(hub.includes('levelUpPresentation.playerScreenY'))
  for (const [label, implementation] of [
    ['Boneyard', boneyard],
    ['Hub', hub],
    ['private room', privateRooms],
  ] as const) {
    assert.doesNotMatch(implementation, /modalActive/,
      `${label} still contains a level-up modal suppression branch`)
  }
  for (const member of [
    'this.enemies.update(',
    'this.enemyDeathEffects.update(',
    'this.enemyProjectiles.update(',
    'this.maggots.update(',
    'this.loot.update(',
    'this.goodies.update(',
    'this.mageLightningPulses.update(',
    'this.playerDeathBursts.update(',
    'this.playerDeathWeapons.update(',
    'this.weatherView.update(',
    'this.solomon?.update(',
  ]) assert.ok(boneyard.includes(member), `missing live Boneyard member: ${member}`)
  for (const member of [
    'this.updateStudents(snapshot)',
    'this.updatePlayers(snapshot)',
    'this.updateFountain(snapshot)',
    'this.primarySpells.update(',
    'this.secondaryAbilities.update(',
  ]) assert.ok(hub.includes(member), `missing live Hub member: ${member}`)
  for (const member of [
    'this.updatePlayers(snapshot, localParticipant.region)',
    'this.updateRoomPresentation(',
    'this.primarySpells[region].update(',
    'this.secondaryAbilities[region].update(',
  ]) assert.ok(privateRooms.includes(member), `missing live private-room member: ${member}`)
})
