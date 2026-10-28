import type {
  BoneyardEnemyConfigRandom,
  BoneyardEnemyFlag,
  BoneyardSkeletonWeapon,
  MutableConfig,
} from './boneyard-enemy-config-model.ts'
import { inclusiveThreeWayIndex } from './boneyard-enemy-config.ts'

export function applyFlag(
  config: MutableConfig,
  flag: BoneyardEnemyFlag,
  random: BoneyardEnemyConfigRandom,
  waveOrdinal: number,
): void {
  switch (flag) {
    case 'FLAG_COCOON': config.secondaryDamage *= 5; break
    case 'FLAG_NOSPIT': config.spitWebs = false; break
    case 'FLAG_HPUP': config.maximumHealth *= 1.5; break
    case 'FLAG_HPDOWN': config.maximumHealth *= 0.5; break
    case 'FLAG_STRONG': multiplyDamage(config, 1.5); break
    case 'FLAG_WEAK': multiplyDamage(config, 0.5); break
    case 'FLAG_FAST': config.chaseSpeed *= 1.25; break
    case 'FLAG_SLOW':
      config.chaseSpeed *= 0.5
      config.attackSpeed *= 0.5
      break
    case 'FLAG_XPBONUS': config.experienceBonus = 2; break
    case 'FLAG_BURNING':
      config.burning = true
      config.chaseSpeed *= 1.5
      config.attackSpeed *= 1.5
      break
    case 'FLAG_HELM':
      config.headgear = 1
      config.maximumHealth += 6
      break
    case 'FLAG_HORNED':
      config.headgear = 2
      config.maximumHealth += 10
      break
    case 'FLAG_HOODED':
      config.headgear = 3
      config.maximumHealth += 3
      break
    case 'FLAG_LEADING': config.accuracyMode = 1; break
    case 'FLAG_SCATTERSHOT': config.accuracyMode = 2; break
    case 'FLAG_RANDOMSHOT': config.accuracyMode = 3; break
    case 'FLAG_RANGEUP': config.rangeMode = 2; break
    case 'FLAG_RANGEDOWN': config.rangeMode = 1; break
    case 'FLAG_RANGEEASY': config.rangeMode = 3; break
    case 'FLAG_SHIELD':
      config.selfShield = true
      config.selfShieldHealth = 50
      config.shieldInterval = 10
      break
    case 'FLAG_SHIELDOTHERS':
      config.otherShield = true
      config.otherShieldHealth = 50
      config.shieldInterval = 10
      break
    case 'FLAG_SHIELDSTRONG':
      config.selfShieldHealth *= 9
      config.otherShieldHealth *= 9
      break
    case 'FLAG_SHIELDFAST': config.shieldInterval *= 0.5; break
    case 'FLAG_SPLIT': config.splitCount = random.splitUnit + 1; break
    case 'FLAG_SPLITMANY':
      config.splitCount = nativeSplitManyDepth(waveOrdinal, random)
      break
    case 'FLAG_MANYMAGGOTS': config.maximumMaggots = 50; break
    case 'FLAG_STRONGMAGGOTS':
      config.maggotHealth = 5
      config.maggotDamage = 5
      break
    case 'FLAG_POISONARROW':
      config.arrowType = 'poison'
      config.secondaryDamage = config.primaryDamage * 3
      break
    case 'FLAG_FIREARROW':
      config.arrowType = 'fire'
      config.secondaryDamage = config.primaryDamage
      break
    case 'FLAG_ARMOR': applyArmor(config); break
    case 'FLAG_SWORD': applyWeapon(config, 'sword', 15, 10); break
    case 'FLAG_MACE': applyWeapon(config, 'mace', 25, 10); break
    case 'FLAG_FLAIL': applyWeapon(config, 'flail', 35, 10); break
    case 'FLAG_AXE': applyWeapon(config, 'axe', 18, 10); break
    case 'FLAG_PIKE': applyWeapon(config, 'pike', 25, 35); break
    case 'FLAG_CASTFIRE':
      config.mageElement = 'fire'
      config.primaryDamage *= 8
      break
    case 'FLAG_CASTLIGHTNING':
      config.mageElement = 'lightning'
      config.primaryDamage *= 4
      break
    case 'FLAG_CASTFROST':
      config.mageElement = 'frost'
      config.primaryDamage *= 2
      break
    case 'FLAG_CASTPOISON':
      config.mageElement = 'poison'
      config.primaryDamage *= 8
      break
    case 'FLAG_ROTTEN':
      config.rotten = true
      config.poisonPunchDamage = config.primaryDamage / 6
      config.poisonPoolDamage = config.primaryDamage / 5
      config.poisonDuration = 10
      break
    case 'FLAG_DEATHIMPS': config.splitCount = 5; break
    case 'FLAG_DEATHIMPSMANY': config.splitCount = 15; break
    case 'FLAG_ARMORMAYBE':
      if (random.randomArmor) applyArmor(config)
      break
    case 'FLAG_NOSKELETONS': config.skeletonPolicy = 'none'; break
    case 'FLAG_MORESKELETONS':
      config.skeletonPolicy = 'more'
      config.selfShield = false
      config.rotten = false
      break
    case 'FLAG_IGNITE':
    case 'FLAG_IMMORTALIZE':
      break
  }
}

function multiplyDamage(config: MutableConfig, multiplier: number): void {
  config.primaryDamage *= multiplier
  config.secondaryDamage *= multiplier
  config.tertiaryDamage *= multiplier
  config.extraDamage *= multiplier
}

function applyArmor(config: MutableConfig): void {
  config.armor = true
  config.maximumHealth = (config.maximumHealth + 10) * 2
}

function applyWeapon(
  config: MutableConfig,
  weapon: Exclude<BoneyardSkeletonWeapon, 'claw'>,
  damageAddition: number,
  healthAddition: number,
): void {
  config.weapon = weapon
  config.maximumHealth = (config.maximumHealth + healthAddition) * 2
  config.primaryDamage += damageAddition
}

function nativeSplitManyDepth(
  waveOrdinal: number,
  random: BoneyardEnemyConfigRandom,
): number {
  const lower = Math.trunc((waveOrdinal - 25) / 5) + 1
  const gate = lower + inclusiveThreeWayIndex(random.splitManyGateUnit)
  return gate < 2
    ? 2
    : lower + inclusiveThreeWayIndex(random.splitManyUnit)
}
