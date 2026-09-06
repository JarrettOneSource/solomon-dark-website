import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import { createBossSpellOwner } from './boss-spell-construction.ts'
import { spawnSimpleDeathEffect, spawnSpriteArray, type DeathEffectOwner } from './death-effects.ts'
import type { BoneyardDemonSkullActor, WorkingStep } from './model.ts'
import { drawEnemyFloat, randomEnemyOffset } from './random.ts'

export const UNHOLY_GREEN = 0x8cff0c

export function spawnDemonSkullWarmup(work: WorkingStep, actor: BoneyardDemonSkullActor,
  tick: number, kind: 'eyes' | 'mouth'): void {
  const scale = Math.fround(.5 + drawEnemyFloat(work, .5)) * (kind === 'eyes' ? 2 : 1)
  const length = kind === 'eyes' ? Math.fround(90 + drawEnemyFloat(work, 40)) : Math.fround(100 + drawEnemyFloat(work, 70))
  const offset = randomEnemyOffsetAtRadius(work, length)
  const position = { x: Math.fround(actor.position.x + offset.x), y: Math.fround(actor.position.y - 60 + offset.y) }
  const velocity = kind === 'eyes' ? { x: 0, y: 0 } : {
    x: Math.fround(-offset.x / length * 3), y: Math.fround(-offset.y / length * 3) }
  spawnSimpleDeathEffect(work, actor, tick, { alpha: 1, alphaLossPerTick: kind === 'eyes' ? .02 : .005,
    atlas: 'Unholy', entry: kind === 'eyes' ? 2 : 0, blendMode: 'add', kind: kind === 'eyes' ? 'fade-additive' : 'move-fade',
    lifetimeTicks: 1000, position, presentationOwner: 'late-world-overlay', role: `discorporeal-${kind}-warmup`,
    rotationDeg: kind === 'eyes' ? 0 : actorHeadingFromVector(velocity.x, velocity.y), scale, tint: UNHOLY_GREEN,
    velocity, velocityDamping: Math.fround(.95) })
}

export function spawnUnholyEyeTrail(work: WorkingStep, owner: DeathEffectOwner, tick: number, headingDeg: number): void {
  const alpha = Math.fround(1 - drawEnemyFloat(work, Math.fround(.95)))
  const alphaLossPerTick = Math.fround(Math.fround(.025) + drawEnemyFloat(work, Math.fround(.035)))
  spawnSimpleDeathEffect(work, owner, tick, { alpha, alphaLossPerTick: Math.fround(alphaLossPerTick * .5), atlas: 'Unholy', entry: 0,
    blendMode: 'add', kind: 'fade-perspective', lifetimeTicks: 1000, role: 'eye-laser-trail',
    rotationDeg: headingDeg, scale: 1, tint: UNHOLY_GREEN })
}

export function spawnUnholySpitTrail(work: WorkingStep, owner: DeathEffectOwner, tick: number,
  progress: number, height: number): void {
  const offset = randomEnemyOffset(work, 10)
  const position = { x: Math.fround(owner.position.x + offset.x),
    y: Math.fround(owner.position.y - Math.sin(progress * Math.PI) * height + offset.y) }
  spawnSimpleDeathEffect(work, owner, tick, { alpha: 1, opacityTimer: 1.5, alphaLossPerTick: Math.fround(.02) * Math.fround(.65),
    atlas: 'Unholy', entry: 9 + Math.floor(tick / 2) % 32, blendMode: 'add', kind: 'fade-additive',
    lifetimeTicks: 1000, position, role: 'unholy-spit-trail', scale: Math.fround(.5 + drawEnemyFloat(work, .5)) })
}

export function spawnUnholyImpactGround(work: WorkingStep, owner: DeathEffectOwner, tick: number,
  kind: 'eye' | 'spit'): void {
  if (kind === 'eye') spawnSimpleDeathEffect(work, owner, tick, { alpha: 1, alphaLossPerTick: Math.fround(.1),
    atlas: 'BadGuys', entry: 15, blendMode: 'normal', kind: 'fade', lifetimeTicks: 1000,
    position: { x: owner.position.x, y: owner.position.y - 25 }, presentationOwner: 'direct-post-world',
    role: 'eye-impact-flash', scale: 9, tint: UNHOLY_GREEN })
  spawnSpriteArray(work, owner, tick, `unholy-${kind}-ground-burst`, 401, 19, 1,
    { frameVelocity: kind === 'eye' ? .75 : .5, frameVelocityDamping: Math.fround(.98),
      presentationOwner: 'pre-world-queue', scale: 3, tint: UNHOLY_GREEN, blendMode: 'add' })
}

function randomEnemyOffsetAtRadius(work: WorkingStep, radius: number) {
  const angle = drawEnemyFloat(work, 360) * Math.PI / 180
  return { x: Math.fround(Math.sin(angle) * radius), y: Math.fround(-Math.cos(angle) * radius) }
}

/** Anim_BeamSegment 0x00454500; its transient child survives exactly two ticks. */
export function spawnDemonSkullBeamSegments(work: WorkingStep, actor: BoneyardDemonSkullActor,
  tick: number, length: number, power: number): void {
  const angle = actor.headingDeg * Math.PI / 180
  const dx = Math.sin(angle)
  const dy = -Math.cos(angle)
  const jitter = randomEnemyOffsetAtRadius(work, 1)
  spawnSimpleDeathEffect(work, actor, tick, { alpha: 1, alphaLossPerTick: .5,
    atlas: 'Unholy', entry: 2, blendMode: 'add', kind: 'fade-additive', lifetimeTicks: 1000,
    position: { x: actor.position.x + dx * 32, y: actor.position.y + dy * 32 },
    role: 'mouth-beam-source', scale: (2 + drawEnemyFloat(work, .5)) * 2, tint: UNHOLY_GREEN })
  for (let distance = 0; distance < length; distance += 128) {
    const center = { x: actor.position.x + dx * (distance + 64), y: actor.position.y + dy * (distance + 64) }
    const vertices = [[-32, -64], [32, -64], [-32, 64], [32, 64]].map(([x, y]) => ({
      x: Math.fround(center.x + Math.cos(angle) * x! - Math.sin(angle) * y!),
      y: Math.fround(center.y + Math.sin(angle) * x! + Math.cos(angle) * y! - 40),
    }))
    const fade = (along: number) => Math.max(0, Math.min(1, 1 - (along - (length - 200)) / 200)) * Math.min(1, power)
    work.bossSpells.push({ ...createBossSpellOwner(work, actor.id, tick, 0, 'mouth-beam-segment'),
      position: { x: Math.fround(center.x + jitter.x), y: Math.fround(center.y + jitter.y) }, vertices,
      // +0x60 colors the far pair; +0x64 colors the near pair and clears it on segment zero.
      uvOffset: (tick % 25) / 25, startAlpha: fade(distance + 128), endAlpha: distance === 0 ? 0 : fade(distance) })
  }
}
