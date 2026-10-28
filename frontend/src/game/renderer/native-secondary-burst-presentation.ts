import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import type {
  NativeSecondaryActorState,
} from '../core-kernels/native-secondary-abilities.ts'
import type {
  BoneyardEnemyProjectileSnapshot,
} from '../protocol/game-state.ts'
import { nativeDeathMagicLayers } from './native-death-magic-presentation.ts'
import {
  nativeEnemyProjectilePlan,
} from './native-enemy-projectile-presentation.ts'
import type {
  NativeSecondaryAtlas,
} from './native-secondary-assets.ts'
import {
  hashUnit,
  packNormalizedRgb,
  repeatedFloatDecay,
  repeatedFloatMultiply,
} from './native-secondary-draws.ts'
import type {
  NativeSecondarySpriteDraw,
} from './native-secondary-presentation-types.ts'
import type {
  NativeFireActorDraw,
} from './primary-spell-fire-native.ts'

export const MAGIC_TRAP_FULL_DRAW_THRESHOLD = Math.fround(0.9900000095367432)

const MAGIC_TRAP_SELECTOR_COLORS = Object.freeze([
  Object.freeze([1, 0.1, 1] as const),
  Object.freeze([1, 0.35, 0.1] as const),
  Object.freeze([0.1, 1, 1] as const),
  Object.freeze([0.1, 0.5, 1] as const),
  Object.freeze([0.1, 1, 0.1] as const),
  Object.freeze([1, 0.5, 0.1] as const),
  Object.freeze([0.1, 0.5, 0.5] as const),
  Object.freeze([0.75, 0.75, 0.75] as const),
  Object.freeze([1, 1, 1] as const),
])

export const FIRE_DRAW_SCALE = 1.100000023841858

export function nativeEtherFadeScalar(
  initialLife: number,
  decrement: number,
  ageTicks: number,
): number {
  let life = Math.fround(initialLife)
  for (let tick = 0; tick <= Math.floor(ageTicks); tick += 1) {
    life = Math.fround(life - Math.fround(decrement))
  }
  return Math.max(0, life)
}

export function dampenDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Dampen presentation requires its post-gameplay RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []
  let rng = actor.presentationRng
  for (let heading = 0; heading < 360; heading += 1) {
    const record = drawNativeInteger(rng, 2)
    const speed = drawNativeFloat(record.state, 4)
    const dragRoll = drawNativeInteger(speed.state, 6)
    const rotation = drawNativeFloat(dragRoll.state, 360)
    const scale = drawNativeFloat(rotation.state, 0.5)
    const loss = drawNativeFloat(scale.state, 0.02)
    const gray = drawNativeFloat(loss.state, 0.25)
    const registration = drawNativeInteger(gray.state, 5)
    rng = registration.state

    const alpha = repeatedFloatDecay(
      1,
      Math.fround(0.01 + loss.value),
      age,
    )
    if (alpha <= 0 || heading % 10 !== 0) continue
    const drag = dragRoll.value === 3
      ? Math.fround(0.93)
      : Math.fround(0.96)
    let distance = 0
    let velocity = Math.fround(6 + speed.value)
    for (let tick = 0; tick < age; tick += 1) {
      distance = Math.fround(distance + velocity)
      velocity = Math.fround(velocity * drag)
    }
    const headingRadians = heading * Math.PI / 180
    const spriteScale = Math.fround(1.5 + scale.value)
    const x = distance === 0
      ? 0
      : Math.fround(Math.sin(headingRadians) * distance)
    const y = distance === 0
      ? 0
      : Math.fround(-Math.cos(headingRadians) * distance)
    draws.push(draw('BadGuys', 10 + record.value, {
      alpha,
      blend: 'normal',
      offset: { x, y },
      role: `dampen-move-fade-${heading}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: spriteScale,
      scaleY: spriteScale,
      tint: packNormalizedRgb(gray.value, gray.value, gray.value),
    }))
  }

  for (let index = 0; index < 30; index += 1) {
    const rotation = drawNativeFloat(rng, 360)
    const scale = drawNativeFloat(rotation.state, 4.75)
    const life = drawNativeFloat(scale.state, 1)
    rng = life.state
    const alpha = repeatedFloatDecay(
      Math.fround(0.5 + life.value),
      0.1,
      age,
    )
    if (alpha <= 0 || index % 10 !== 0) continue
    const spriteScale = Math.fround(0.75 + scale.value)
    draws.push(draw('BadGuys', 48, {
      alpha: Math.min(alpha, 1),
      blend: 'add',
      role: `dampen-additive-${index}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: spriteScale,
      scaleY: Math.fround(spriteScale * 0.8),
    }))
  }
  return draws
}

export function dampenedProjectileDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.variant === 3) {
    return nativeDeathMagicLayers({ x: 0, y: 0 }, 1.25, actor.phase,
      createNativeRng(actor.id + Math.trunc(actor.ageTicks))).layers.map(layer => {
      if (layer.atlas !== 'BadGuys') throw new TypeError('Dampened dark magic requires BadGuys art')
      return draw(layer.atlas, layer.entry, { alpha: layer.alpha, blend: layer.blendMode,
        offset: layer.offset, role: `dampened-${layer.role}`, rotationRadians: layer.rotationRadians,
        scaleX: layer.scale, scaleY: layer.scaleY, tint: layer.tint })
    })
  }
  const guided = actor.variant !== 0
  const projectile: BoneyardEnemyProjectileSnapshot = {
    ageTicks: 0,
    contactRadius: 0,
    headingDeg: actor.rotationRadians * 180 / Math.PI,
    homing: false,
    id: actor.targetId ?? actor.id,
    kind: guided ? 'guided-missile' : 'firebolt',
    lightRegistration: null,
    lifetimeTicks: 400,
    nativeTypeId: guided ? 0x7ec : 0x7eb,
    ownerActorId: 0,
    painterRegistration: actor.painterRegistrations?.[0] ?? {
      managerLane: 'transient',
      registrationOrdinal: actor.id,
    },
    payload: actor.variant === 1
      ? 'poison'
      : actor.variant === 2
        ? 'cold'
        : 'fire',
    position: { x: 0, y: 0 },
    speed: Math.hypot(actor.velocity.x, actor.velocity.y),
    spawnTick: 0,
    verticalOffset: 0,
    visualPhaseDeg: actor.phase,
    visualScale: 1,
  }
  return nativeEnemyProjectilePlan(projectile, actor.ageTicks).layers.map((layer) => {
    if (layer.atlas !== 'BadGuys' && layer.atlas !== 'DeadHawg') {
      throw new TypeError('Dampened projectiles require native projectile art')
    }
    return draw(layer.atlas, layer.entry, {
      alpha: layer.alpha,
      blend: layer.blendMode,
      offset: layer.offset,
      role: `dampened-projectile-${layer.role}`,
      rotationRadians: layer.rotationRadians,
      scaleX: layer.scale,
      scaleY: layer.scaleY,
      tint: layer.tint,
    })
  })
}

export function shieldExplosionDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Explosive Shield presentation requires its construction RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []

  const flashAlpha = repeatedFloatDecay(1, 0.1, age)
  if (flashAlpha > 0) {
    draws.push(draw('BadGuys', 15, {
      alpha: Math.min(flashAlpha, 1),
      offset: { x: 0, y: -25 },
      role: 'explosive-shield-center-flash',
      scaleX: 12,
      scaleY: 12,
    }))
  }

  const ringAlpha = repeatedFloatDecay(1.5, 0.05, age)
  if (ringAlpha > 0) {
    const ringScale = repeatedFloatMultiply(2.5, 1.01, age)
    draws.push(draw('Clothes', 2, {
      alpha: Math.min(ringAlpha, 1),
      blend: 'add',
      offset: { x: 0, y: -35 },
      role: 'explosive-shield-expanding-ring',
      scaleX: ringScale,
      scaleY: ringScale,
    }))
  }

  draws.push(...fuzzySpearBurstDraws(
    actor,
    draw,
    actor.presentationRng,
    'explosive-shield',
  ))
  return draws
}

export function magicTrapBurstDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Magic Trap presentation requires its construction RNG state')
  }
  const draws: NativeSecondarySpriteDraw[] = []
  const flashAlpha = repeatedFloatDecay(1, 0.1, actor.ageTicks)
  if (flashAlpha > 0) {
    draws.push(draw('BadGuys', 15, {
      alpha: Math.min(flashAlpha, 1),
      offset: { x: 0, y: -25 },
      role: 'magic-trap-center-flash',
      scaleX: 6,
      scaleY: 6,
    }))
  }
  draws.push(...fuzzySpearBurstDraws(
    actor,
    draw,
    actor.presentationRng,
    'magic-trap',
  ))
  return draws
}

export function mindblastBurstDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
): NativeSecondarySpriteDraw[] {
  if (actor.presentationRng === null) {
    throw new TypeError('Mindblast presentation requires its construction RNG state')
  }
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []
  const coreAlpha = repeatedFloatDecay(1, Math.fround(0.025), age)
  if (coreAlpha > 0) {
    draws.push(draw('BadGuys', 15, {
      alpha: Math.min(coreAlpha, 1),
      offset: { x: 0, y: -25 },
      role: 'mindblast-center-flash',
      scaleX: 54,
      scaleY: 54,
    }))
  }

  for (let index = 0; index < 3; index += 1) {
    const alpha = repeatedFloatDecay(1.5, Math.fround(0.025), age)
    if (alpha <= 0) continue
    const growth = [1.1, 1.05, 1.025][index]!
    draws.push(draw('Clothes', 2, {
      alpha: Math.min(alpha, 1),
      blend: 'add',
      offset: { x: 0, y: -35 },
      role: `mindblast-expanding-ring-${index}`,
      scaleX: repeatedFloatMultiply(4.5, growth, age),
      scaleY: repeatedFloatMultiply(4.5, growth, age),
      tint: 0x00ffff,
    }))
  }

  let rng = actor.presentationRng
  for (let index = 0; index < 2; index += 1) {
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    const frameRate = Math.fround(index === 0 ? 0.075 : 0.1125)
    let frame = Math.fround(0)
    for (let tick = 0; tick < age; tick += 1) frame = Math.fround(frame + frameRate)
    if (frame >= 10) continue
    draws.push(draw('BadGuys', 158 + Math.floor(frame), {
      alpha: 1,
      blend: 'add',
      role: `mindblast-sprite-array-${index}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: 10,
      scaleY: 10,
    }))
  }

  for (let index = 0; index < 100; index += 1) {
    const heading = drawNativeFloat(rng, 360)
    const speed = drawNativeFloat(heading.state, 2)
    const doubleSpeed = drawNativeInteger(speed.state, 5)
    const alpha = drawNativeFloat(doubleSpeed.state, 1)
    const scale = drawNativeFloat(alpha.state, 1.5)
    rng = scale.state
    const life = repeatedFloatDecay(
      Math.fround(1 + alpha.value),
      Math.fround(0.00875),
      age,
    )
    if (life <= 0) continue
    const headingRadians = heading.value * Math.PI / 180
    const direction = {
      x: Math.fround(Math.sin(headingRadians)),
      y: Math.fround(-Math.cos(headingRadians)),
    }
    const speedFactor = doubleSpeed.value === 2 ? 2 : 1
    let velocity = {
      x: Math.fround(direction.x * Math.fround(3 + speed.value) * speedFactor),
      y: Math.fround(direction.y * Math.fround(3 + speed.value) * speedFactor),
    }
    const offset = {
      x: Math.fround(direction.x * 75),
      y: Math.fround(direction.y * 75),
    }
    for (let tick = 0; tick < age; tick += 1) {
      offset.x = Math.fround(offset.x + velocity.x)
      offset.y = Math.fround(offset.y + velocity.y)
      velocity = {
        x: Math.fround(velocity.x * Math.fround(0.95)),
        y: Math.fround(velocity.y * Math.fround(0.95)),
      }
    }
    const horizontalSign = hashUnit(actor.id + index, age * 101 + index) < 0.5 ? -1 : 1
    const shared = {
      alpha: Math.min(life, 1),
      blend: 'add' as const,
      offset,
      rotationRadians: headingRadians,
      tint: 0x00ffff,
    }
    draws.push(
      draw('BadGuys', 17, {
        ...shared,
        role: `mindblast-fuzzy-spear-base-${index}`,
        scaleX: horizontalSign,
        scaleY: 1,
      }),
      draw('BadGuys', 74, {
        ...shared,
        role: `mindblast-fuzzy-spear-glow-${index}`,
        scaleX: Math.fround(2 + scale.value),
        scaleY: Math.fround(2 + scale.value),
      }),
    )
  }
  return draws
}

function fuzzySpearBurstDraws(
  actor: NativeSecondaryActorState,
  draw: (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options?: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>>,
  ) => NativeSecondarySpriteDraw,
  sourceRng: NativeRngState,
  rolePrefix: 'explosive-shield' | 'magic-trap',
): NativeSecondarySpriteDraw[] {
  const age = Math.max(0, Math.trunc(actor.ageTicks))
  const draws: NativeSecondarySpriteDraw[] = []
  let rng = sourceRng
  for (let index = 0; index < 2; index += 1) {
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    const frameRate = Math.fround(Math.fround(index * 0.1 + 0.2) * Math.fround(0.75))
    let frame = Math.fround(0)
    for (let tick = 0; tick < age; tick += 1) {
      frame = Math.fround(frame + frameRate)
    }
    if (frame >= 10) continue
    draws.push(draw('BadGuys', 158 + Math.floor(frame), {
      alpha: 1,
      blend: 'add',
      offset: { x: 0, y: -35 },
      role: `${rolePrefix}-sprite-array-${index}`,
      rotationRadians: rotation.value * Math.PI / 180,
      scaleX: 6,
      scaleY: 6,
    }))
  }

  for (let index = 0; index < 100; index += 1) {
    const heading = drawNativeFloat(rng, 360)
    const speed = drawNativeFloat(heading.state, 2)
    const doubleSpeed = drawNativeInteger(speed.state, 5)
    const alpha = drawNativeFloat(doubleSpeed.state, 1)
    const scale = drawNativeFloat(alpha.state, 1.5)
    rng = scale.state

    const life = repeatedFloatDecay(
      Math.fround(1 + alpha.value),
      0.035,
      age,
    )
    if (life <= 0) continue
    const headingRadians = heading.value * Math.PI / 180
    const direction = {
      x: Math.fround(Math.sin(headingRadians)),
      y: Math.fround(-Math.cos(headingRadians)),
    }
    const speedFactor = doubleSpeed.value === 2 ? 2 : 1
    let velocity = {
      x: Math.fround(direction.x * Math.fround(3 + speed.value) * speedFactor),
      y: Math.fround(direction.y * Math.fround(3 + speed.value) * speedFactor),
    }
    const offset = {
      x: Math.fround(direction.x * 75),
      y: Math.fround(direction.y * 75),
    }
    for (let tick = 0; tick < age; tick += 1) {
      offset.x = Math.fround(offset.x + velocity.x)
      offset.y = Math.fround(offset.y + velocity.y)
      velocity = {
        x: Math.fround(velocity.x * Math.fround(0.95)),
        y: Math.fround(velocity.y * Math.fround(0.95)),
      }
    }
    const drawAlpha = Math.min(life, 1)
    const horizontalSign = hashUnit(actor.id + index, age * 101 + index) < 0.5 ? -1 : 1
    draws.push(
      draw('BadGuys', 17, {
        alpha: drawAlpha,
        blend: 'add',
        offset,
        role: `${rolePrefix}-fuzzy-spear-base-${index}`,
        rotationRadians: headingRadians,
        scaleX: horizontalSign,
        scaleY: 1,
      }),
      draw('BadGuys', 74, {
        alpha: drawAlpha,
        blend: 'add',
        offset,
        role: `${rolePrefix}-fuzzy-spear-glow-${index}`,
        rotationRadians: headingRadians,
        scaleX: Math.fround(2 + scale.value),
        scaleY: Math.fround(2 + scale.value),
      }),
    )
  }
  return draws
}

export function magicTrapTint(selector: number): number {
  const color = MAGIC_TRAP_SELECTOR_COLORS[selector]
  if (color === undefined) throw new RangeError(`invalid native Magic Trap selector ${selector}`)
  return packNormalizedRgb(color[0], color[1], color[2])
}

export function secondaryFireDraw(draw: NativeFireActorDraw): NativeSecondarySpriteDraw {
  return {
    alpha: draw.alpha,
    atlas: draw.atlas,
    blend: draw.blend,
    entry: draw.entry,
    offset: { ...draw.offset },
    role: draw.role,
    rotationRadians: draw.rotation,
    scaleX: draw.scaleX ?? draw.scale,
    scaleY: draw.scaleY ?? draw.scale,
    tint: draw.tint,
  }
}
