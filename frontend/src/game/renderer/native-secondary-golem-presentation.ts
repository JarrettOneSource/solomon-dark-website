import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import {
  roundHalfToEven,
} from '../core-kernels/native-rounding.ts'
import type {
  NativeSecondaryActorState,
} from '../core-kernels/native-secondary-abilities.ts'
import type {
  Vector2,
} from '../core-kernels/vector.ts'
import {
  degreesToRadians,
  hashUnit,
  positiveModulo,
  secondarySprite,
  WHITE,
} from './native-secondary-draws.ts'
import type {
  NativeSecondaryPresentationPlan,
  NativeSecondaryQuadDraw,
  NativeSecondarySpriteDraw,
} from './native-secondary-presentation-types.ts'

const GOLEM_IRON_TINT = 0x595959

const GOLEM_DRAW_SCALE = 1.1109999418258667

const GOLEM_HALF_DRAW_SCALE = 0.5554999709129333

const GOLEM_STAR_TINT = 0xa6ffa6

const EMPTY_GOLEM_FRONT_GLOW_RECORDS = new Set([81, 83, 84, 94, 96])

export function nativeGolemPresentationPlan(
  actor: NativeSecondaryActorState,
  presentationFrame = actor.ageTicks,
): NativeSecondaryPresentationPlan {
  if (actor.kind !== 'golem' || actor.golem === null) {
    throw new TypeError('Native Golem presentation requires authoritative Golem state')
  }
  const pose = nativeGolemPose(actor)
  const baseHeadingDegrees = actor.rotationRadians * 180 / Math.PI
  const drawHeadingDegrees = baseHeadingDegrees + pose.headingOffsetDegrees
  const facing = nativeGolemFacing(drawHeadingDegrees)
  const oppositeFacing = nativeGolemFacing(drawHeadingDegrees + 180)
  const elevation = actor.ageTicks < 100 ? 0 : actor.ageTicks < 200 ? -20 : -40
  const tint = actor.golem.iron ? GOLEM_IRON_TINT : WHITE
  const leftFoot = {
    x: actor.golem.leftFoot.x + actor.golem.leftFootBob.x - actor.position.x,
    y: actor.golem.leftFoot.y + actor.golem.leftFootBob.y - actor.position.y,
  }
  const rightFoot = {
    x: actor.golem.rightFoot.x + actor.golem.rightFootBob.x - actor.position.x,
    y: actor.golem.rightFoot.y + actor.golem.rightFootBob.y - actor.position.y,
  }
  const center = {
    x: (leftFoot.x + rightFoot.x) * 0.5,
    y: (leftFoot.y + rightFoot.y) * 0.5,
  }
  const records: GolemDrawRecord[] = []
  const part = (
    entry: number,
    role: string,
    forward: number,
    lateral: number,
    vertical: number,
    options: Readonly<{
      rotationDegrees?: number
      scale?: number
      tint?: number
    }> = {},
  ): NativeSecondarySpriteDraw => {
    const offset = golemPoint(
      center,
      drawHeadingDegrees,
      forward,
      lateral,
      elevation + vertical,
    )
    return secondarySprite(actor, 'Golem', entry, role, {
      offset,
      rotationRadians: degreesToRadians(options.rotationDegrees ?? 0),
      scaleX: actor.scale * GOLEM_DRAW_SCALE * (options.scale ?? 1),
      scaleY: actor.scale * GOLEM_DRAW_SCALE * (options.scale ?? 1),
      tint: options.tint ?? tint,
    })
  }
  const addRecord = (
    sortYOffset: number,
    ...draws: NativeSecondarySpriteDraw[]
  ): void => {
    records.push({
      draws,
      sortY: draws[0]!.offset.y + sortYOffset,
      sourceOrder: records.length,
    })
  }

  const front = part(
    113 + facing,
    'golem-chassis-front',
    pose.leftMode === 3 ? 10 : 15,
    0,
    pose.leftMode === 3 ? -5 : 0,
  )
  const frontDraws = [front]
  const frontGlowEntry = 81 + facing
  if (hasGolemRecord(frontGlowEntry)) {
    frontDraws.push(secondarySprite(actor, 'Golem', frontGlowEntry, 'golem-chassis-front-additive', {
      alpha: actor.alpha,
      blend: 'add',
      offset: front.offset,
      scaleX: actor.scale * GOLEM_DRAW_SCALE,
      scaleY: actor.scale * GOLEM_DRAW_SCALE,
      tint: nativeGolemGreenTint(cosmeticGolemUnit(actor, presentationFrame, 1)),
    }))
  }
  addRecord(0, ...frontDraws)
  addRecord(0, part(129 + facing, 'golem-chassis-rear', -5, 0, 0))

  const sideLeft = part(145 + facing, 'golem-chassis-left', -5, -30, 5)
  addRecord(
    0,
    sideLeft,
    ...(actor.golem.iron
      ? [part(177 + facing, 'iron-golem-left-overlay', -5, -30, 5, { tint: WHITE })]
      : []),
  )
  const sideRight = part(161 + facing, 'golem-chassis-right', -5, 30, 5)
  addRecord(
    0,
    sideRight,
    ...(actor.golem.iron
      ? [part(193 + facing, 'iron-golem-right-overlay', -5, 30, 5, { tint: WHITE })]
      : []),
  )

  if (actor.ageTicks >= 100) {
    const coreOffset = golemPoint(center, drawHeadingDegrees, 0, 0, elevation + 10)
    const coreRed = cosmeticGolemUnit(actor, presentationFrame, 2)
    addRecord(
      -50,
      secondarySprite(actor, 'BadGuys', 15, 'golem-core-lower', {
        offset: coreOffset,
        scaleX: actor.scale * (2 + cosmeticGolemUnit(actor, presentationFrame, 3) * 0.25),
        scaleY: actor.scale * (2 + cosmeticGolemUnit(actor, presentationFrame, 3) * 0.25),
        tint: nativeGolemGreenTint(coreRed),
      }),
      secondarySprite(actor, 'BadGuys', 15, 'golem-core-upper', {
        offset: { x: coreOffset.x, y: coreOffset.y + 5 },
        scaleX: actor.scale * (1.5 + cosmeticGolemUnit(actor, presentationFrame, 4) * 0.25),
        scaleY: actor.scale * (1.5 + cosmeticGolemUnit(actor, presentationFrame, 4) * 0.25),
        tint: nativeGolemGreenTint(coreRed),
      }),
    )

    addRecord(
      -50,
      part(
        (pose.leftMode > 1 ? 17 : 1) + facing,
        'golem-limb-left',
        -5,
        -38,
        5,
        { rotationDegrees: pose.leftRotationDegrees },
      ),
    )
    addRecord(
      -50,
      part(
        (pose.rightMode > 1 ? 49 : 33) + facing,
        'golem-limb-right',
        -5,
        38,
        5,
        { rotationDegrees: pose.rightRotationDegrees },
      ),
    )
    addRecord(-50, part(65 + facing, 'golem-piece-forward-right', -20, 12, 5))
    addRecord(-50, part(65 + facing, 'golem-piece-forward-left', -20, -12, 8, {
      rotationDegrees: 10,
    }))
    addRecord(-70, part(65 + facing, 'golem-piece-center', -15, 0, 15, { scale: 0.8 }))
    addRecord(-50, part(65 + oppositeFacing, 'golem-piece-rear-right', 1, 12, 15))
    addRecord(-50, part(65 + oppositeFacing, 'golem-piece-rear-left', 1, -12, 12))
  }

  const sortedBody = records
    .sort((left, right) => left.sortY - right.sortY || left.sourceOrder - right.sourceOrder)
    .flatMap(({ draws }) => draws)
  const connectors = actor.ageTicks >= 200
    ? nativeGolemConnectorDraws(
        actor,
        presentationFrame,
        leftFoot,
        rightFoot,
        drawHeadingDegrees,
        facing,
        tint,
      )
    : []
  const quads: NativeSecondaryQuadDraw[] = actor.ageTicks < 200
    ? [{
        alpha: actor.alpha * Math.sin((200 - actor.ageTicks) / 200 * Math.PI) * 0.5,
        atlas: 'BadGuys',
        blend: 'normal',
        entry: 36,
        role: 'golem-assembly-beam',
        tint: 0x80ff80,
        vertices: [-35, -200, 35, -200, -40, 25, 40, 25],
      }]
    : []
  return {
    draws: [...connectors, ...sortedBody],
    gradients: [],
    meshes: [],
    quads,
    queueFamily: 'ordinary-dynamic',
    root: { ...actor.position },
    sortBias: 0,
    stormComposite: null,
    underlayDraws: [],
    worldY: actor.position.y + center.y,
  }
}

export function nativeGolemDeathPresentationPlan(
  actor: NativeSecondaryActorState,
): NativeSecondaryPresentationPlan {
  if (actor.kind !== 'golem-death' || actor.presentationRng === null) {
    throw new TypeError('Native Golem death presentation requires its pre-consumption RNG state')
  }
  const created = createGolemDeathParticles(actor.presentationRng)
  const stepped = stepGolemDeathParticles(created.particles, created.rng, actor.ageTicks)
  const tint = actor.variant === 1 ? GOLEM_IRON_TINT : WHITE
  const draws = stepped.particles.flatMap((particle, index) => {
    const alpha = Math.max(0, Math.min(1, particle.life))
    return alpha <= 0 ? [] : [secondarySprite(
      actor,
      'DeadHawg',
      78 + index % 10,
      `golem-death-rock-${index}`,
      {
        alpha,
        offset: {
          x: particle.position.x,
          y: particle.position.y + particle.height,
        },
        rotationRadians: degreesToRadians(particle.rotation),
        tint,
      },
    )]
  })
  if (actor.ageTicks < 15) {
    draws.push(secondarySprite(actor, 'BadGuys', 86, 'golem-death-star', {
      alpha: 0.75 - actor.ageTicks * 0.05,
      blend: 'add',
      offset: { x: 0, y: -15 },
      rotationRadians: degreesToRadians(created.starRotation + created.starStep * actor.ageTicks),
      scaleX: 2,
      scaleY: 2,
      tint: GOLEM_STAR_TINT,
    }))
  }
  return {
    draws,
    gradients: [],
    meshes: [],
    quads: [],
    queueFamily: 'ordinary-dynamic',
    root: { ...actor.position },
    sortBias: 0,
    stormComposite: null,
    underlayDraws: [],
    worldY: actor.position.y,
  }
}

export function nativeGolemFacing(headingDegrees: number): number {
  const normalized = positiveModulo(headingDegrees, 360)
  return positiveModulo(Math.floor((roundHalfToEven(normalized) + 9) / 22), 16)
}

interface GolemDrawRecord {
  readonly draws: readonly NativeSecondarySpriteDraw[]
  readonly sortY: number
  readonly sourceOrder: number
}

interface GolemPose {
  readonly headingOffsetDegrees: number
  readonly leftMode: number
  readonly leftRotationDegrees: number
  readonly rightMode: number
  readonly rightRotationDegrees: number
}

function nativeGolemPose(actor: NativeSecondaryActorState): GolemPose {
  const golem = actor.golem!
  return {
    headingOffsetDegrees: golem.actionHeadingOffsetDegrees,
    leftMode: golem.leftLimbMode,
    leftRotationDegrees: golem.leftLimbMode === 1 ? 45 : golem.leftFootRotationDegrees,
    rightMode: golem.rightLimbMode,
    rightRotationDegrees: golem.rightLimbMode === 1 ? -45 : golem.rightFootRotationDegrees,
  }
}

function nativeGolemConnectorDraws(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  leftFoot: Vector2,
  rightFoot: Vector2,
  drawHeadingDegrees: number,
  facing: number,
  tint: number,
): NativeSecondarySpriteDraw[] {
  const golem = actor.golem!
  const center = {
    x: (leftFoot.x + rightFoot.x) * 0.5,
    y: (leftFoot.y + rightFoot.y) * 0.5,
  }
  const headingRadians = degreesToRadians(drawHeadingDegrees)
  const lateral = {
    x: -Math.cos(headingRadians),
    y: -Math.sin(headingRadians),
  }
  const leftEndpoint = {
    x: leftFoot.x + golem.leftConnectorOffset.x,
    y: leftFoot.y + golem.leftConnectorOffset.y,
  }
  const rightEndpoint = {
    x: rightFoot.x + golem.rightConnectorOffset.x,
    y: rightFoot.y + golem.rightConnectorOffset.y,
  }
  const leftJoint = {
    x: golem.leftConnectorOffset.x
      + (leftFoot.x + center.x + lateral.x * -10) * 0.5,
    y: golem.leftConnectorOffset.y
      + (leftFoot.y + center.y + lateral.y * -10) * 0.5 - 15,
  }
  const rightJoint = {
    x: golem.rightConnectorOffset.x
      + (rightFoot.x + center.x + lateral.x * 10) * 0.5,
    y: golem.rightConnectorOffset.y
      + (rightFoot.y + center.y + lateral.y * 10) * 0.5 - 15,
  }
  const endpoint = (
    offset: Vector2,
    side: string,
  ): NativeSecondarySpriteDraw => secondarySprite(
    actor,
    'Golem',
    97 + facing,
    `golem-connector-endpoint-${side}`,
    {
      offset,
      scaleX: actor.scale * GOLEM_DRAW_SCALE,
      scaleY: actor.scale * GOLEM_DRAW_SCALE,
      tint,
    },
  )
  const glow = (
    joint: Vector2,
    connectorEndpoint: Vector2,
    side: string,
    salt: number,
  ): NativeSecondarySpriteDraw => {
    const scale = 0.75 + cosmeticGolemUnit(actor, presentationFrame, salt + 1) * 0.5
    return secondarySprite(actor, 'BadGuys', 15, `golem-connector-glow-${side}`, {
      offset: {
        x: (joint.x * 3 + connectorEndpoint.x) * 0.25,
        y: (joint.y * 3 + connectorEndpoint.y) * 0.25,
      },
      scaleX: actor.scale * scale,
      scaleY: actor.scale * scale,
      tint: nativeGolemGreenTint(cosmeticGolemUnit(actor, presentationFrame, salt)),
    })
  }
  const cap = (offset: Vector2, side: string): NativeSecondarySpriteDraw => secondarySprite(
    actor,
    'Golem',
    65 + facing,
    `golem-connector-cap-${side}`,
    {
      offset,
      scaleX: actor.scale * GOLEM_HALF_DRAW_SCALE,
      scaleY: actor.scale * GOLEM_HALF_DRAW_SCALE,
      tint,
    },
  )
  const leftFirst = leftFoot.y < rightFoot.y
  return [
    ...(leftFirst
      ? [
          endpoint(leftEndpoint, 'left'),
          endpoint(rightEndpoint, 'right'),
        ]
      : [
          endpoint(rightEndpoint, 'right'),
          endpoint(leftEndpoint, 'left'),
        ]),
    glow(leftJoint, leftEndpoint, 'left', 10),
    glow(rightJoint, rightEndpoint, 'right', 12),
    ...(leftFirst
      ? [cap(leftJoint, 'left'), cap(rightJoint, 'right')]
      : [cap(rightJoint, 'right'), cap(leftJoint, 'left')]),
  ]
}

function golemPoint(
  center: Vector2,
  headingDegrees: number,
  forward: number,
  lateral: number,
  vertical: number,
): Vector2 {
  const radians = degreesToRadians(headingDegrees)
  const forwardX = Math.sin(radians)
  const forwardY = -Math.cos(radians)
  const lateralX = forwardY
  const lateralY = -forwardX
  return {
    x: center.x + forwardX * forward + lateralX * lateral,
    y: center.y + forwardY * forward + lateralY * lateral + vertical,
  }
}

function hasGolemRecord(entry: number): boolean {
  return !EMPTY_GOLEM_FRONT_GLOW_RECORDS.has(entry)
}

function cosmeticGolemUnit(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  salt: number,
): number {
  return hashUnit(actor.id, Math.floor(presentationFrame) * 31 + salt)
}

function nativeGolemGreenTint(unit: number): number {
  return (Math.round((0.5 + unit * 0.3) * 255) << 16) | 0x00ff80
}

interface GolemDeathParticle {
  bounceProgress: number
  bounceVelocity: number
  height: number
  life: number
  position: Vector2
  rotation: number
  rotationStep: number
  velocity: Vector2
  verticalVelocity: number
}

function createGolemDeathParticles(sourceRng: NativeRngState): Readonly<{
  particles: readonly GolemDeathParticle[]
  rng: NativeRngState
  starRotation: number
  starStep: number
}> {
  const shuffled = nativeFullRangeShuffle(
    Array.from({ length: 30 }, (_, index) => index * 18),
    sourceRng,
  )
  let rng = shuffled.rng
  const particles: GolemDeathParticle[] = []
  for (let index = 0; index < 30; index += 1) {
    const fall = drawNativeFloat(rng, 3)
    rng = fall.state
    const height = drawNativeFloat(rng, 20)
    rng = height.state
    const rotation = drawNativeFloat(rng, 360)
    rng = rotation.state
    const rotationStep = drawNativeFloat(rng, 10)
    rng = rotationStep.state
    const speed = drawNativeFloat(rng, 1)
    rng = speed.state
    const radius = drawNativeFloat(rng, 10)
    rng = radius.state
    const angular = drawNativeFloat(rng, 20, true)
    rng = angular.state
    const radians = degreesToRadians(shuffled.values[index]!)
    const magnitude = 1.5 * (speed.value + 0.5)
    const velocity = { x: Math.sin(radians) * magnitude, y: -Math.cos(radians) * magnitude }
    const positionFactor = radius.value + 17
    particles.push({
      bounceProgress: 0,
      bounceVelocity: -(fall.value + 2),
      height: -height.value,
      life: 2,
      position: {
        x: velocity.x * positionFactor,
        y: velocity.y * positionFactor,
      },
      rotation: rotation.value,
      rotationStep: angular.value,
      velocity,
      verticalVelocity: -(fall.value + 2),
    })
  }
  const starRotation = drawNativeFloat(rng, 360)
  rng = starRotation.state
  const starPitch = drawNativeFloat(rng, 5)
  rng = starPitch.state
  const starSample = drawNativeInteger(rng, 10)
  rng = starSample.state
  return {
    particles,
    rng,
    starRotation: starRotation.value,
    starStep: (starSample.value + starPitch.value) * 0.5,
  }
}

function stepGolemDeathParticles(
  source: readonly GolemDeathParticle[],
  sourceRng: NativeRngState,
  ageTicks: number,
): Readonly<{ particles: readonly GolemDeathParticle[]; rng: NativeRngState }> {
  const particles = source.map((particle) => ({
    ...particle,
    position: { ...particle.position },
    velocity: { ...particle.velocity },
  }))
  let rng = sourceRng
  for (let tick = 0; tick < Math.floor(ageTicks); tick += 1) {
    for (const particle of particles) {
      if (particle.life <= 0) continue
      if (particle.height !== 0) {
        particle.position.x += particle.velocity.x
        particle.position.y += particle.velocity.y
        particle.height += 2 * particle.verticalVelocity
        particle.verticalVelocity += 2 * particle.bounceProgress * 0.4
        particle.bounceProgress = Math.min(1, particle.bounceProgress + 0.02)
        if (particle.height > 0) {
          const rotationStep = drawNativeFloat(rng, 10)
          rng = rotationStep.state
          particle.rotationStep = rotationStep.value + 1
          particle.bounceVelocity *= 0.65
          particle.verticalVelocity = particle.bounceVelocity
          const sound = drawNativeInteger(rng, 3)
          rng = sound.state
          if (sound.value === 1) {
            rng = drawNativeFloat(rng, 0.2).state
            rng = drawNativeInteger(rng, 4).state
          }
          const damp = drawNativeInteger(rng, 2)
          rng = damp.state
          if (damp.value === 1) {
            particle.velocity.x *= 0.65
            particle.velocity.y *= 0.65
          }
          if (particle.verticalVelocity > -0.75) {
            particle.bounceVelocity = 0
            particle.bounceProgress = 0
            particle.verticalVelocity = 0
            particle.velocity.x = 0
            particle.velocity.y = 0
            particle.rotationStep = 0
          }
          particle.height = particle.verticalVelocity
        }
      }
      particle.rotation += particle.rotationStep
      particle.life -= 0.015
    }
  }
  return { particles, rng }
}

function nativeFullRangeShuffle<T>(
  source: readonly T[],
  sourceRng: NativeRngState,
): Readonly<{ rng: NativeRngState; values: readonly T[] }> {
  const values = [...source]
  let rng = sourceRng
  for (let index = 0; index < values.length; index += 1) {
    const draw = drawNativeInteger(rng, values.length)
    rng = draw.state
    const swap = values[index]!
    values[index] = values[draw.value]!
    values[draw.value] = swap
  }
  return { rng, values }
}
