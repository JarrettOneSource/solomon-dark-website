import {
  spawnBouncer,
  spawnSimpleDeathEffect,
  spawnSpriteArray,
  spawnUnbind,
  type DeathEffectOwner,
} from './death-effects.ts'
import {
  type BoneyardEnemyActor,
  type WorkingStep,
} from './model.ts'
import {
  drawInteger,
  drawUnit,
  radialVector,
  signedUnit,
} from './random.ts'
import {
  SKELETON_BASE_FRAGMENT_ENTRIES,
} from './skeleton-death.ts'

/** 0x0049D0D0 and 0x0049E8F0 share the smoke constructor with different authored parameters. */
export function spawnFacultySmoke(work: WorkingStep, owner: DeathEffectOwner, tick: number,
  phase: 'living' | 'start' | 'dying' | 'terminal'): void {
  const entry = 10 + drawInteger(work, 2)
  const speed = drawUnit(work) * (phase === 'living' ? 4 : 8)
  const velocity = radialVector(drawUnit(work) * 360, speed)
  const rareDamping = drawInteger(work, 6) === 3
  const velocityDamping = phase === 'terminal'
    ? rareDamping ? .9800000190734863 : .949999988079071
    : rareDamping ? .949999988079071 : .8999999761581421
  const rotationDeg = drawUnit(work) * 360
  const scale = phase === 'living' || phase === 'dying'
    ? Math.fround(.8999999761581421 + drawUnit(work) * .20000004768371582)
    : Math.fround(1.5 + drawUnit(work) * .5)
  const alphaLossPerTick = Math.fround((.009999999776482582 + drawUnit(work) * .019999999552965164)
    * (phase === 'terminal' ? .5 : 1))
  const tint = Math.round(drawUnit(work) * .15000000596046448 * 255) << 16
  const presentationOwner = drawInteger(work, 5) === 3 ? 'world-sorted' : 'pre-world-queue'
  spawnSimpleDeathEffect(work, owner, tick, { alpha: 1, opacityTimer: phase === 'terminal' ? 3 : 2,
    alphaLossPerTick, atlas: 'BadGuys', blendMode: 'normal', entry, kind: 'move-fade',
    lifetimeTicks: 1000, presentationOwner, role: `faculty-${phase}-smoke`, rotationDeg,
    scale, tint, velocity, velocityDamping })
}

export function spawnFacultyDyingEffects(work: WorkingStep, actor: BoneyardEnemyActor, tick: number,
  deathTick: number): void {
  if (deathTick === 1) {
    for (let angle = 0; angle < 360; angle += 5) spawnFacultySmoke(work, actor, tick, 'start')
  }
  if ((250 - deathTick) % 2 === 0) {
    spawnBouncer(work, actor, tick, 118, 'faculty-dying-bone', () => {
      const unit = radialVector(drawUnit(work) * 360, 1)
      const velocity = { x: unit.x * 1.5, y: unit.y }
      const distance = 15 + drawUnit(work) * 30
      const position = { x: actor.position.x + velocity.x * (distance + 2),
        y: actor.position.y + velocity.y * distance }
      const launch = drawInteger(work, 3) === 2 ? 4 : 2
      return { bounceVelocityScale: launch, kind: 'black-smoky-bouncer', position,
        velocity: { x: velocity.x * launch, y: velocity.y * launch } }
    })
  }
  spawnFacultySmoke(work, actor, tick, 'dying')
}

export function spawnFacultyFinale(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  if (actor.config.enemyToken !== 'DIREFACULTY') throw new Error('Faculty finale requires Faculty config')
  const entries: number[] = [...SKELETON_BASE_FRAGMENT_ENTRIES]
  for (let index = 0; index < entries.length; index += 1) {
    const other = drawInteger(work, entries.length)
    ;[entries[index], entries[other]] = [entries[other]!, entries[index]!]
  }
  let angle = drawUnit(work) * 360
  for (const entry of entries) {
    spawnBouncer(work, actor, tick, entry, 'faculty-bone', () => {
      const unit = radialVector(angle, 1)
      const velocity = { x: unit.x * 3, y: unit.y * 2 }
      const distance = 15 + drawUnit(work) * 10
      return { bounceVelocityScale: 2, heightScale: 2, scale: 1.2000000476837158,
        position: { x: actor.position.x + velocity.x * (distance + 2), y: actor.position.y + velocity.y * distance },
        velocity }
    })
    angle = Math.fround(angle + 72 + signedUnit(drawUnit(work)) * 10)
  }
  spawnBouncer(work, actor, tick, () => 1819 + drawInteger(work, 4), 'faculty-skull',
    { bounceVelocityScale: 2, heightScale: 2, velocity: radialVector(angle, 4) })
  spawnUnbind(work, actor, tick)
  spawnSimpleDeathEffect(work, actor, tick, { alpha: 1, opacityTimer: 2,
    alphaLossPerTick: .009999999776482582, atlas: 'BadGuys', blendMode: 'add', entry: 15,
    kind: 'banish-black', lifetimeTicks: 1000, role: 'faculty-banish', scale: 2 })
  spawnSpriteArray(work, actor, tick, 'faculty-terminal-burst', 401, 19, 1,
    { blendMode: 'normal', frameVelocity: .5, frameVelocityDamping: .9800000190734863,
      presentationOwner: 'pre-world-queue', scale: 4, tint: 0 })
  for (let degrees = 0; degrees < 360; degrees += 5) {
    spawnFacultySmoke(work, actor, tick, 'terminal')
    const opacityTimer = Math.fround(2 + drawUnit(work) * 2)
    const scale = Math.fround(.25 + drawUnit(work) * .7999999523162842)
    const phaseDeg = drawUnit(work) * 360
    const amplitudeDeg = Math.fround(10 + drawUnit(work) * 40)
    const stepDeg = Math.fround(1 + drawUnit(work) * 4)
    const color = drawInteger(work, 4) === 1 ? actor.config.family.headColor : actor.config.family.bodyColor
    const distance = Math.fround(30 + drawUnit(work) * 20)
    const direction = radialVector(degrees, 1)
    const position = { x: Math.fround(actor.position.x + direction.x * distance),
      y: Math.fround(actor.position.y - 35 + direction.y * distance) }
    const velocity = radialVector(degrees, Math.fround(1 + drawUnit(work) * 9))
    const painterSortBias = Math.fround(drawUnit(work) * 100 - 50)
    spawnSimpleDeathEffect(work, actor, tick, { alpha: 1, opacityTimer, alphaLossPerTick: .009999999776482582,
      atlas: 'BadGuys', blendMode: 'normal', entry: 66, kind: 'scrap', lifetimeTicks: 1000,
      painterSortBias, position, role: 'faculty-scrap', rotationDeg: Math.sin(phaseDeg * Math.PI / 180) * amplitudeDeg,
      scale, scrapOscillation: { phaseDeg, amplitudeDeg, stepDeg },
      tint: Math.round(color[0] * 255) << 16 | Math.round(color[1] * 255) << 8 | Math.round(color[2] * 255),
      velocity, velocityDamping: .9200000166893005 })
  }
}
