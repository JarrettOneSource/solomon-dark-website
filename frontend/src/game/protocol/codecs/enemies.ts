import { BONEYARD_ENEMY_FLAGS } from '../../core-kernels/boneyard-enemy-config.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../../core-kernels/boneyard-wave-director.ts'
import { GAME_PROTOCOL_VERSION } from '../game-protocol-contract.ts'
import { MAX_BONEYARD_ENEMY_EFFECTS, MAX_BONEYARD_ENEMY_FLAGS } from '../game-protocol-limits.ts'
import {
  BONEYARD_ENEMY_EFFECT_ROLES,
  type BoneyardEnemyAction,
  type BoneyardEnemyAnimationSnapshot,
  type BoneyardEnemyCoffinState,
  type BoneyardEnemyEffectSnapshot,
  type BoneyardEnemySnapshot,
} from '../game-state.ts'
import { boneyardPoint, nativeWorldManagerRegistration } from './native-state.ts'
import { spiderAppearance } from './spiders.ts'
import {
  GameProtocolError,
  boolean,
  finite,
  integer,
  integerWithin,
  limitedArray,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
} from './values.ts'

const BONEYARD_ENEMY_ANIMATION_STATES = ['idle', 'locomotion', 'action', 'death'] as const

const BONEYARD_ENEMY_ACTIONS = [
  'skeleton-claw-a',
  'skeleton-claw-b',
  'skeleton-weapon',
  'skeleton-pike',
  'archer-shot',
  'mage-cast-short',
  'mage-cast-long',
  'zombie-beat',
  'wraith-drain',
  'demon-bomb',
] as const satisfies readonly BoneyardEnemyAction[]

const BONEYARD_ENEMY_COFFIN_STATES = [
  'hidden',
  'closed',
  'opening',
  'transition-delay',
  'open',
] as const satisfies readonly BoneyardEnemyCoffinState[]

export function boneyardEnemySnapshot(value: unknown, field: string): BoneyardEnemySnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'animation',
    'armored',
    'currentHealth',
    'enemyToken',
    'flags',
    'headingDeg',
    'id',
    'lightRegistration',
    'lighting',
    'mageCloak',
    'maximumHealth',
    'nativeTypeId',
    'position',
    'scale',
    'shieldHealth',
    'shieldMaximumHealth',
    'spawnTick',
  ])
  const enemyToken = limitedString(source.enemyToken, `${field}.enemyToken`, 32)
  const expectedTypeId = BONEYARD_WAVE_ENEMY_TYPES[
    enemyToken as keyof typeof BONEYARD_WAVE_ENEMY_TYPES
  ]
  if (expectedTypeId === undefined) {
    throw new GameProtocolError(`${field}.enemyToken is not supported`)
  }
  const nativeTypeId = positiveInteger(source.nativeTypeId, `${field}.nativeTypeId`)
  if (nativeTypeId !== expectedTypeId) {
    throw new GameProtocolError(`${field}.nativeTypeId does not match enemyToken`)
  }
  const flags = limitedArray(
    source.flags,
    `${field}.flags`,
    MAX_BONEYARD_ENEMY_FLAGS,
  ).map((flag, index) => {
    const decoded = limitedString(flag, `${field}.flags[${index}]`, 64)
    if (!(BONEYARD_ENEMY_FLAGS as readonly string[]).includes(decoded)) {
      throw new GameProtocolError(`${field}.flags[${index}] is not supported`)
    }
    return decoded
  })
  if (new Set(flags).size !== flags.length) {
    throw new GameProtocolError(`${field}.flags must be unique`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg >= 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360)`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const scale = positiveFinite(source.scale, `${field}.scale`)
  const currentHealth = finite(source.currentHealth, `${field}.currentHealth`)
  if (currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth exceeds maximumHealth`)
  }
  const shieldHealth = nonnegativeFinite(source.shieldHealth, `${field}.shieldHealth`)
  const shieldMaximumHealth = nonnegativeFinite(
    source.shieldMaximumHealth,
    `${field}.shieldMaximumHealth`,
  )
  if (shieldHealth > shieldMaximumHealth) {
    throw new GameProtocolError(`${field}.shieldHealth exceeds shieldMaximumHealth`)
  }
  const armored = boolean(source.armored, `${field}.armored`)
  if (armored && enemyToken !== 'SKELETON') {
    throw new GameProtocolError(`${field}.armored is only valid for SKELETON`)
  }
  const mageCloak = boolean(source.mageCloak, `${field}.mageCloak`)
  if (mageCloak && enemyToken !== 'SKELETONMAGE') {
    throw new GameProtocolError(`${field}.mageCloak is only valid for SKELETONMAGE`)
  }
  const animation = boneyardEnemyAnimation(source.animation, `${field}.animation`)
  if ((enemyToken === 'SPIDER') !== (animation.spider !== null)) {
    throw new GameProtocolError(`${field}.animation.spider does not match the enemy family`)
  }
  if (enemyToken === 'SPIDER' && (!Number.isInteger(animation.bodyPose) || animation.bodyPose > 3)) {
    throw new GameProtocolError(`${field}.animation.bodyPose is outside the four Spider banks`)
  }
  if (
    enemyToken !== 'DEMON'
    && (
      animation.demonFrontExtremityOffset.x !== 0
      || animation.demonFrontExtremityOffset.y !== 0
      || animation.demonRearExtremityOffset.x !== 0
      || animation.demonRearExtremityOffset.y !== 0
    )
  ) {
    throw new GameProtocolError(
      `${field}.animation Demon endpoint offsets require a Demon family`,
    )
  }
  if (
    animation.headFacingOffset !== 0
    && (
      animation.state !== 'action'
      || (enemyToken !== 'SKELETON' && enemyToken !== 'SKELETONMAGE')
    )
  ) {
    throw new GameProtocolError(
      `${field}.animation.headFacingOffset requires an active Skeleton or Mage action`,
    )
  }
  return {
    animation,
    armored,
    currentHealth,
    enemyToken: enemyToken as BoneyardEnemySnapshot['enemyToken'],
    flags,
    headingDeg,
    id: positiveInteger(source.id, `${field}.id`),
    lightRegistration: nativeWorldManagerRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    lighting: boneyardEnemyLighting(source.lighting, `${field}.lighting`),
    mageCloak,
    maximumHealth,
    nativeTypeId,
    position: boneyardPoint(source.position, `${field}.position`),
    scale,
    shieldHealth,
    shieldMaximumHealth,
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
  }
}

function boneyardEnemyLighting(
  value: unknown,
  field: string,
): BoneyardEnemySnapshot['lighting'] {
  const source = record(value, field)
  onlyKeys(source, field, ['charge', 'glow', 'providerCopies'])
  const charge = finite(source.charge, `${field}.charge`)
  const glow = finite(source.glow, `${field}.glow`)
  if (charge < 0 || charge > 1) {
    throw new GameProtocolError(`${field}.charge must be within [0,1]`)
  }
  if (glow < 0 || glow > 1) {
    throw new GameProtocolError(`${field}.glow must be within [0,1]`)
  }
  const providerCopies = nonnegativeInteger(
    source.providerCopies,
    `${field}.providerCopies`,
  )
  if (providerCopies > 2) {
    throw new GameProtocolError(`${field}.providerCopies must be within [0,2]`)
  }
  return { charge, glow, providerCopies: providerCopies as 0 | 1 | 2 }
}

function boneyardEnemyAnimation(
  value: unknown,
  field: string,
): BoneyardEnemyAnimationSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'spider',
    'action',
    'actionProgress',
    'alpha',
    'bodyPose',
    'coffinPose',
    'coffinRotationRadians',
    'coffinScaleX',
    'coffinSecondaryPose',
    'coffinState',
    'deathEpoch',
    'deathTick',
    'demonFrontExtremityOffset',
    'demonFrontRotationRadians',
    'demonRearExtremityOffset',
    'demonRearRotationRadians',
    'effects',
    'gaitPose',
    'headFacingOffset',
    'hitFlash',
    'impBodyRotationRadians',
    'impEffectAlpha',
    'impEffectFrame',
    'maggots',
    'state',
    'stridePhaseDeg',
    'verticalOffset',
    'zombieAngularOffsetDeg',
    'zombieAttackSide',
    'zombieBodyRotationRadians',
    'zombieBodyType',
    'zombieFrontArmPose',
    'zombieFrontArmRotationRadians',
    'zombieHeadType',
    'zombieHeadRotationRadians',
    'zombieRearArmPose',
    'zombieRearArmRotationRadians',
  ])
  const state = limitedString(source.state, `${field}.state`, 32)
  if (!(BONEYARD_ENEMY_ANIMATION_STATES as readonly string[]).includes(state)) {
    throw new GameProtocolError(`${field}.state is not supported`)
  }
  const action = source.action === null
    ? null
    : limitedString(source.action, `${field}.action`, 64)
  if (action !== null && !(BONEYARD_ENEMY_ACTIONS as readonly string[]).includes(action)) {
    throw new GameProtocolError(`${field}.action is not supported`)
  }
  if ((state === 'action') !== (action !== null)) {
    throw new GameProtocolError(`${field}.action does not match animation state`)
  }
  const coffinState = limitedString(source.coffinState, `${field}.coffinState`, 32)
  if (!(BONEYARD_ENEMY_COFFIN_STATES as readonly string[]).includes(coffinState)) {
    throw new GameProtocolError(`${field}.coffinState is not supported`)
  }
  const coffinScaleX = integerWithin(source.coffinScaleX, `${field}.coffinScaleX`, -1, 1)
  if (coffinScaleX === 0) {
    throw new GameProtocolError(`${field}.coffinScaleX must be -1 or 1`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  const hitFlash = finite(source.hitFlash, `${field}.hitFlash`)
  const impEffectAlpha = finite(source.impEffectAlpha, `${field}.impEffectAlpha`)
  if (
    alpha < 0 || alpha > 1
    || hitFlash < 0 || hitFlash > 1
    || impEffectAlpha < 0 || impEffectAlpha > 1
  ) {
    throw new GameProtocolError(`${field} alpha channels must be within [0,1]`)
  }
  const effects = limitedArray(
    source.effects,
    `${field}.effects`,
    MAX_BONEYARD_ENEMY_EFFECTS,
  ).map((effect, index) => boneyardEnemyEffect(
    effect,
    `${field}.effects[${index}]`,
  ))
  if (new Set(effects.map((effect) => effect.id)).size !== effects.length) {
    throw new GameProtocolError(`${field}.effects must have unique ids`)
  }
  if (new Set(effects.map((effect) => effect.role)).size !== effects.length) {
    throw new GameProtocolError(`${field}.effects must have unique roles`)
  }
  if (limitedArray(source.maggots, `${field}.maggots`, 0).length !== 0) {
    throw new GameProtocolError(
      `${field}.maggots must be empty in protocol ${GAME_PROTOCOL_VERSION}`,
    )
  }
  return {
    spider: source.spider === null ? null : spiderAppearance(record(source.spider, `${field}.spider`), `${field}.spider`),
    action: action as BoneyardEnemyAction | null,
    actionProgress: nonnegativeFinite(source.actionProgress, `${field}.actionProgress`),
    alpha,
    bodyPose: nonnegativeFinite(source.bodyPose, `${field}.bodyPose`),
    coffinPose: nonnegativeFinite(source.coffinPose, `${field}.coffinPose`),
    coffinRotationRadians: finite(
      source.coffinRotationRadians,
      `${field}.coffinRotationRadians`,
    ),
    coffinScaleX: coffinScaleX as -1 | 1,
    coffinSecondaryPose: source.coffinSecondaryPose === null
      ? null
      : nonnegativeFinite(source.coffinSecondaryPose, `${field}.coffinSecondaryPose`),
    coffinState: coffinState as BoneyardEnemyCoffinState,
    deathEpoch: nonnegativeInteger(source.deathEpoch, `${field}.deathEpoch`),
    deathTick: nonnegativeInteger(source.deathTick, `${field}.deathTick`),
    demonFrontExtremityOffset: boneyardPoint(
      source.demonFrontExtremityOffset,
      `${field}.demonFrontExtremityOffset`,
    ),
    demonFrontRotationRadians: finite(
      source.demonFrontRotationRadians,
      `${field}.demonFrontRotationRadians`,
    ),
    demonRearExtremityOffset: boneyardPoint(
      source.demonRearExtremityOffset,
      `${field}.demonRearExtremityOffset`,
    ),
    demonRearRotationRadians: finite(
      source.demonRearRotationRadians,
      `${field}.demonRearRotationRadians`,
    ),
    effects,
    gaitPose: nonnegativeFinite(source.gaitPose, `${field}.gaitPose`),
    headFacingOffset: integerWithin(
      source.headFacingOffset,
      `${field}.headFacingOffset`,
      -1,
      1,
    ) as BoneyardEnemyAnimationSnapshot['headFacingOffset'],
    hitFlash,
    impBodyRotationRadians: finite(
      source.impBodyRotationRadians,
      `${field}.impBodyRotationRadians`,
    ),
    impEffectAlpha,
    impEffectFrame: integer(source.impEffectFrame, `${field}.impEffectFrame`),
    maggots: [],
    state: state as BoneyardEnemyAnimationSnapshot['state'],
    stridePhaseDeg: nonnegativeFinite(
      source.stridePhaseDeg,
      `${field}.stridePhaseDeg`,
    ),
    verticalOffset: finite(source.verticalOffset, `${field}.verticalOffset`),
    zombieAngularOffsetDeg: finite(
      source.zombieAngularOffsetDeg,
      `${field}.zombieAngularOffsetDeg`,
    ),
    zombieAttackSide: integerWithin(
      source.zombieAttackSide,
      `${field}.zombieAttackSide`,
      0,
      1,
    ) as 0 | 1,
    zombieBodyRotationRadians: finite(
      source.zombieBodyRotationRadians,
      `${field}.zombieBodyRotationRadians`,
    ),
    zombieBodyType: integerWithin(
      source.zombieBodyType,
      `${field}.zombieBodyType`,
      -1,
      3,
    ),
    zombieFrontArmPose: nonnegativeFinite(
      source.zombieFrontArmPose,
      `${field}.zombieFrontArmPose`,
    ),
    zombieFrontArmRotationRadians: finite(
      source.zombieFrontArmRotationRadians,
      `${field}.zombieFrontArmRotationRadians`,
    ),
    zombieHeadType: integerWithin(
      source.zombieHeadType,
      `${field}.zombieHeadType`,
      -1,
      3,
    ),
    zombieHeadRotationRadians: finite(
      source.zombieHeadRotationRadians,
      `${field}.zombieHeadRotationRadians`,
    ),
    zombieRearArmPose: nonnegativeFinite(
      source.zombieRearArmPose,
      `${field}.zombieRearArmPose`,
    ),
    zombieRearArmRotationRadians: finite(
      source.zombieRearArmRotationRadians,
      `${field}.zombieRearArmRotationRadians`,
    ),
  }
}

function boneyardEnemyEffect(
  value: unknown,
  field: string,
): BoneyardEnemyEffectSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha',
    'atlas',
    'blendMode',
    'entry',
    'id',
    'offset',
    'role',
    'rotationRadians',
    'scale',
  ])
  const role = limitedString(source.role, `${field}.role`, 32)
  if (!(BONEYARD_ENEMY_EFFECT_ROLES as readonly string[]).includes(role)) {
    throw new GameProtocolError(`${field}.role is not supported`)
  }
  const atlas = limitedString(source.atlas, `${field}.atlas`, 16)
  const blendMode = limitedString(source.blendMode, `${field}.blendMode`, 16)
  if (atlas !== 'BadGuys' && atlas !== 'DeadHawg') {
    throw new GameProtocolError(`${field}.atlas is not supported`)
  }
  if (blendMode !== 'add' && blendMode !== 'normal') {
    throw new GameProtocolError(`${field}.blendMode is not supported`)
  }
  const entry = nonnegativeInteger(source.entry, `${field}.entry`)
  if (atlas !== 'BadGuys' || blendMode !== 'add' || entry !== 49) {
    throw new GameProtocolError(`${field} fields do not match role`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  const maximumAlpha = 1.25
  if (alpha < 0 || alpha > maximumAlpha) {
    throw new GameProtocolError(`${field}.alpha must be within [0,${maximumAlpha}]`)
  }
  return {
    alpha,
    atlas,
    blendMode,
    entry,
    id: positiveInteger(source.id, `${field}.id`),
    offset: boneyardPoint(source.offset, `${field}.offset`),
    role: role as BoneyardEnemyEffectSnapshot['role'],
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: positiveFinite(source.scale, `${field}.scale`),
  }
}
