import type {
  AuthoredBoneyardEnemyFamilyRecipe,
  AuthoredBoneyardEnemyRecipe,
  MutableConfig,
} from './boneyard-enemy-config-model.ts'
import { BOUNDED_ARCHER_MAXIMUM_EXTRA_ARROWS } from './boneyard-enemy-modifiers.ts'
import type { BoneyardWaveEnemyToken } from './boneyard-wave-schema.ts'
import { nativeFacultyColor } from './native-faculty.ts'

export function validatedAuthoredRecipe(
  enemyToken: BoneyardWaveEnemyToken,
  recipe: AuthoredBoneyardEnemyRecipe | undefined,
): AuthoredBoneyardEnemyRecipe | null {
  if (!recipe) return null
  if (!Number.isSafeInteger(recipe.uid) || recipe.uid < 1 || recipe.name.length === 0) {
    throw new RangeError('authored enemy recipe identity is invalid')
  }
  if (!Number.isFinite(recipe.experienceBonus)) {
    throw new RangeError('authored enemy recipe experienceBonus must be finite')
  }
  for (const [field, value] of Object.entries({
    attackSpeed: recipe.attackSpeed,
    chaseSpeed: recipe.chaseSpeed,
    extraDamage: recipe.extraDamage,
    maximumHealth: recipe.maximumHealth,
    movementScale: recipe.movementScale,
    primaryDamage: recipe.primaryDamage,
    secondaryDamage: recipe.secondaryDamage,
    tertiaryDamage: recipe.tertiaryDamage,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`authored enemy recipe ${field} must be finite and non-negative`)
    }
  }
  if (recipe.maximumHealth <= 0 || recipe.movementScale <= 0) {
    throw new RangeError('authored enemy recipe health and movement scale must be positive')
  }
  if (enemyToken !== 'SKELETONARCHER' && recipe.archerAccuracyMode !== 0) {
    throw new Error('authored Archer accuracy is only valid for SKELETONARCHER')
  }
  if (!['boss', 'miniboss', 'multiple-boss', 'normal'].includes(recipe.classification)) {
    throw new Error('authored enemy classification is invalid')
  }
  if (recipe.onDeathProgram !== null && recipe.onDeathProgram !== 'miniboss-die') {
    throw new Error('authored enemy on-death program is invalid')
  }
  validateAuthoredFamily(enemyToken, recipe.family)
  return recipe
}

function validateAuthoredFamily(
  enemyToken: BoneyardWaveEnemyToken,
  family: AuthoredBoneyardEnemyFamilyRecipe,
): void {
  if (family.kind === 'default') return
  if (family.kind === 'demon-skull') {
    if (enemyToken !== 'DEMONSKULL') throw new Error('DemonSkull recipe requires DEMONSKULL')
    if (!Number.isInteger(family.capabilities) || family.capabilities < 0 || family.capabilities > 15) {
      throw new RangeError('DemonSkull capabilities must be within 0..15')
    }
    return
  }
  if (family.kind === 'faculty') {
    if (enemyToken !== 'DIREFACULTY') throw new Error('Faculty recipe requires DIREFACULTY')
    for (const selector of [family.primary, family.secondary]) {
      if (!Number.isInteger(selector) || selector < 0 || selector > 3) throw new RangeError('Faculty selector must be within 0..3')
    }
    if (!Number.isInteger(family.headgear) || family.headgear < 0 || family.headgear > 5) {
      throw new RangeError('Faculty headgear must be within 0..5')
    }
    for (const color of [family.bodyColor, family.headColor]) {
      if (color.length !== 4 || color.some((channel) => !Number.isFinite(channel))) {
        throw new RangeError('Faculty colors require four finite channels')
      }
    }
    return
  }
  if (family.kind === 'heartmonger') {
    if (enemyToken !== 'HEARTMONGER') throw new Error('Heartmonger recipe requires HEARTMONGER')
    if (!Number.isSafeInteger(family.crowCount) || family.crowCount < 0) {
      throw new RangeError('Heartmonger Crow count must be a non-negative integer')
    }
    for (const mode of [family.blindMode, family.summonMode]) {
      if (!Number.isInteger(mode) || mode < 0 || mode > 4) throw new RangeError('Heartmonger mode must be within 0..4')
    }
    return
  }
  if (family.kind === 'skeleton' || family.kind === 'archer') {
    const expected = family.kind === 'skeleton' ? 'SKELETON' : 'SKELETONARCHER'
    if (enemyToken !== expected) {
      throw new Error(`authored ${family.kind} family is only valid for ${expected}`)
    }
    validateEquipment(family)
    return
  }
  if (family.kind === 'portal') {
    if (enemyToken !== 'PORTAL') {
      throw new Error('authored Portal family is only valid for PORTAL')
    }
    if (!Number.isSafeInteger(family.frequency) || family.frequency < 0 || family.frequency > 5) {
      throw new RangeError('authored Portal frequency must be within 0..5')
    }
    return
  }
  if (enemyToken !== 'ZOMBIE') {
    throw new Error('authored Zombie family is only valid for ZOMBIE')
  }
  if (family.bodyType !== 0 && family.bodyType !== 1) {
    throw new RangeError('authored Zombie body type must be zero or one')
  }
  for (const [field, value] of Object.entries({
    poisonDuration: family.poisonDuration,
    poisonPoolDamage: family.poisonPoolDamage,
    poisonPunchDamage: family.poisonPunchDamage,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`authored Zombie ${field} must be finite and non-negative`)
    }
  }
}

export function applyAuthoredFamily(
  config: MutableConfig,
  family: AuthoredBoneyardEnemyFamilyRecipe,
): void {
  if (family.kind === 'default') return
  if (family.kind === 'demon-skull') { config.demonSkullCapabilities = family.capabilities; return }
  if (family.kind === 'faculty') {
    const { kind: _kind, ...faculty } = family
    config.faculty = { ...faculty,
      bodyColor: nativeFacultyColor(family.bodyColor, Math.fround(.7)),
      headColor: nativeFacultyColor(family.headColor, Math.fround(.7)),
    }
    return
  }
  if (family.kind === 'heartmonger') {
    config.crowCount = family.crowCount
    config.blindMode = family.blindMode
    config.summonMode = family.summonMode
    return
  }
  if (family.kind === 'skeleton') {
    config.armor = family.armor
    config.headgear = family.headgear
    config.weapon = family.weapon
    return
  }
  if (family.kind === 'archer') {
    config.arrowType = family.arrowType
    config.extraArrows = family.extraArrows
    config.headgear = family.headgear
    config.multiArrowMode = family.multiArrowMode
    config.rangeMode = family.rangeMode
    config.strafing = family.strafing
    return
  }
  if (family.kind === 'portal') {
    config.portalFrequency = family.frequency
    return
  }
  config.bodyType = family.bodyType === 1 ? 3 : 0
  config.poisonDuration = family.poisonDuration
  config.poisonPoolDamage = family.poisonPoolDamage
  config.poisonPunchDamage = family.poisonPunchDamage
  config.rotten = family.flyblown
}

function validateEquipment(
  family: Extract<AuthoredBoneyardEnemyFamilyRecipe, { kind: 'archer' | 'skeleton' }>,
): void {
  if (!Number.isInteger(family.headgear) || family.headgear < 0 || family.headgear > 5) {
    throw new RangeError('authored headgear must be within 0..5')
  }
  if (family.kind === 'skeleton') {
    if (!['axe', 'claw', 'flail', 'mace', 'pike', 'sword'].includes(family.weapon)) {
      throw new Error('authored Skeleton weapon is invalid')
    }
    return
  }
  if (!['normal', 'fire', 'poison'].includes(family.arrowType)) {
    throw new Error('authored Archer arrow type is invalid')
  }
  if (!Number.isInteger(family.extraArrows)
    || family.extraArrows < 0
    || family.extraArrows > BOUNDED_ARCHER_MAXIMUM_EXTRA_ARROWS) {
    throw new RangeError('authored Archer extra-arrow count is invalid')
  }
  for (const mode of [family.multiArrowMode, family.rangeMode]) {
    if (!Number.isInteger(mode) || mode < 0 || mode > 3) {
      throw new RangeError('authored Archer mode must be within 0..3')
    }
  }
}
