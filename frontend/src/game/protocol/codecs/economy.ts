import {
  DOWSING_EQUIPMENT_RECIPES,
  type DowsingOffer,
  HAGATHA_PERKS,
  HUB_INVENTORY_SLOT_CAPACITY,
  HUB_STORAGE_SLOT_CAPACITY,
  type HagathaOffer,
  type HubInventoryAction,
  type HubShopItem,
  MAX_NATIVE_DYE_SELECTIONS,
  NATIVE_HAGATHA_MAX_OUTCOME_CAPACITY,
  NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT,
  NATIVE_UNFORGE_OUTCOME_KINDS,
  type NativeUnforgeOutcome,
  nativeHagathaBundleStateIsValid,
  nativeHagathaOutcomeStateIsValid,
} from '../../core-kernels/hub-economy.ts'
import {
  NATIVE_BELT_ITEM_TYPE_IDS,
  type PlayerBeltComponent,
  nativeInventoryItemCanBindToBelt,
} from '../../core-kernels/native-belt.ts'
import { isNativeBeltSkill } from '../../core-kernels/player-progression.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from '../game-state.ts'
import { nativeHubNpcState } from './hub.ts'
import {
  equipmentSlot,
  equippedItems,
  flattenInventoryItem,
  inventoryItem,
  inventoryItems,
  playerEquipment,
  protocolInventoryRootSlotsAreValid,
} from './items.ts'
import { boastSelection } from './mod-content.ts'
import {
  GameProtocolError,
  boolean,
  boundedInteger,
  finite,
  integer,
  integerWithin,
  limitedArray,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveInteger,
  record,
} from './values.ts'

export function hubInventoryAction(value: unknown): HubInventoryAction {
  const source = record(value, 'action')
  const type = limitedString(source.type, 'action.type', 64)
  if (type === 'acknowledge-college-intro-dialogue') {
    onlyKeys(source, 'action', ['type'])
    return { type }
  }
  if (type === 'acknowledge-npc-hint') {
    onlyKeys(source, 'action', ['type', 'interactionId'])
    const interactionId = limitedString(source.interactionId, 'action.interactionId', 32)
    if (
      interactionId !== 'annalist'
      && interactionId !== 'fomentius'
      && interactionId !== 'luthacus'
    ) throw new GameProtocolError('action.interactionId has no native profile hint')
    return { type, interactionId }
  }
  if (type === 'buy-dowsing') {
    onlyKeys(source, 'action', ['type', 'offerId'])
    return { type, offerId: positiveInteger(source.offerId, 'action.offerId') }
  }
  if (type === 'buy-fomentius') {
    onlyKeys(source, 'action', ['type', 'itemId'])
    return { type, itemId: positiveInteger(source.itemId, 'action.itemId') }
  }
  if (type === 'buy-hagatha') {
    onlyKeys(source, 'action', ['type', 'selector'])
    const selector = integer(source.selector, 'action.selector')
    if (selector < -1 || selector > 27 || selector === 8) {
      throw new GameProtocolError('action.selector is unavailable')
    }
    return { type, selector }
  }
  if (type === 'remove-hagatha') {
    onlyKeys(source, 'action', ['type', 'selector'])
    return {
      type,
      selector: integerWithin(source.selector, 'action.selector', 0, 26),
    }
  }
  if (type === 'buy-teacher-spell') {
    onlyKeys(source, 'action', ['type', 'skillId'])
    return { type, skillId: integerWithin(source.skillId, 'action.skillId', 72, 79) }
  }
  if (type === 'activate-belt-slot') {
    onlyKeys(source, 'action', ['type', 'slot'])
    return { type, slot: integerWithin(source.slot, 'action.slot', 0, 7) }
  }
  if (type === 'bind-belt-item') {
    onlyKeys(source, 'action', ['type', 'itemId', 'slot'])
    return {
      type,
      itemId: positiveInteger(source.itemId, 'action.itemId'),
      slot: integerWithin(source.slot, 'action.slot', 0, 7),
    }
  }
  if (type === 'read-librarian-book') {
    onlyKeys(source, 'action', ['type', 'bookId'])
    return { type, bookId: integerWithin(source.bookId, 'action.bookId', 0, 25) }
  }
  if (type === 'select-boast') {
    onlyKeys(source, 'action', ['type', 'boastId'])
    return { type, boastId: boastSelection(source.boastId, 'action.boastId') }
  }
  if (
    type === 'close-dowsing'
    || type === 'close-hagatha'
    || type === 'dowse'
    || type === 'interact-goodie'
  ) {
    onlyKeys(source, 'action', ['type'])
    return { type }
  }
  if (type === 'consume' || type === 'read-skill-book') {
    onlyKeys(source, 'action', ['type', 'itemId'])
    return { type, itemId: positiveInteger(source.itemId, 'action.itemId') }
  }
  if (type === 'dye') {
    onlyKeys(source, 'action', ['type', 'dyeItemId', 'layer', 'swatchRows', 'targetItemId'])
    const layer = limitedString(source.layer, 'action.layer', 16)
    if (layer !== 'cloth' && layer !== 'trim') {
      throw new GameProtocolError('action.layer is not supported')
    }
    const swatchRows = limitedArray(
      source.swatchRows,
      'action.swatchRows',
      MAX_NATIVE_DYE_SELECTIONS,
    ).map((row, index) => integerWithin(row, `action.swatchRows[${index}]`, 0, 17))
    if (swatchRows.length === 0) {
      throw new GameProtocolError('action.swatchRows must not be empty')
    }
    return {
      type,
      dyeItemId: positiveInteger(source.dyeItemId, 'action.dyeItemId'),
      layer,
      swatchRows,
      targetItemId: positiveInteger(source.targetItemId, 'action.targetItemId'),
    }
  }
  if (type === 'unforge') {
    onlyKeys(source, 'action', ['type', 'itemId'])
    return { type, itemId: positiveInteger(source.itemId, 'action.itemId') }
  }
  if (type === 'equip') {
    onlyKeys(source, 'action', ['type', 'itemId', 'slot'])
    return {
      type,
      itemId: positiveInteger(source.itemId, 'action.itemId'),
      slot: equipmentSlot(source.slot, 'action.slot'),
    }
  }
  if (type === 'move-inventory-item') {
    onlyKeys(source, 'action', ['type', 'destinationSackId', 'destinationSlot', 'itemId'])
    return {
      type,
      destinationSackId: source.destinationSackId === null
        ? null
        : positiveInteger(source.destinationSackId, 'action.destinationSackId'),
      destinationSlot: source.destinationSlot === null
        ? null
        : integerWithin(
            source.destinationSlot,
            'action.destinationSlot',
            0,
            HUB_INVENTORY_SLOT_CAPACITY - 1,
          ),
      itemId: positiveInteger(source.itemId, 'action.itemId'),
    }
  }
  if (type === 'transfer') {
    onlyKeys(source, 'action', ['type', 'direction', 'gesture', 'itemId'])
    const direction = limitedString(source.direction, 'action.direction', 32)
    if (direction !== 'to-backpack' && direction !== 'to-storage') {
      throw new GameProtocolError('action.direction is not supported')
    }
    const gesture = limitedString(source.gesture, 'action.gesture', 32)
    if (gesture !== 'double-activation' && gesture !== 'drag') {
      throw new GameProtocolError('action.gesture is not supported')
    }
    if (direction === 'to-storage' && gesture !== 'drag') {
      throw new GameProtocolError('action.gesture must be drag for a to-storage transfer')
    }
    return {
      type,
      direction,
      gesture,
      itemId: positiveInteger(source.itemId, 'action.itemId'),
    }
  }
  if (type === 'unequip') {
    onlyKeys(source, 'action', ['type', 'slot'])
    return { type, slot: equipmentSlot(source.slot, 'action.slot') }
  }
  throw new GameProtocolError('unknown hub inventory action')
}

export function playerBelt(
  value: unknown,
  field: string,
  progression: ProtocolPlayerProgression,
  economy: ProtocolPlayerEconomy | undefined,
): PlayerBeltComponent {
  const entries = limitedArray(value, field, 8).map((value, index) => {
    if (value === null) return null
    const entryField = `${field}[${index}]`
    const source = record(value, entryField)
    const kind = limitedString(source.kind, `${entryField}.kind`, 32)
    if (kind === 'skill') {
      onlyKeys(source, entryField, ['kind', 'skillId'])
      const skillId = nonnegativeInteger(source.skillId, `${entryField}.skillId`)
      if (!isNativeBeltSkill(skillId)) {
        throw new GameProtocolError(`${entryField}.skillId is not belt-eligible`)
      }
      const permanentRank = progression.learnedSkills.find(([id]) => id === skillId)?.[1] ?? 0
      if (permanentRank < 1) throw new GameProtocolError(`${entryField}.skillId is not learned`)
      return Object.freeze({ kind, skillId })
    }
    if (kind === 'health-potion' || kind === 'mana-potion') {
      onlyKeys(source, entryField, ['kind'])
      return Object.freeze({ kind })
    }
    if (kind === 'item') {
      onlyKeys(source, entryField, ['itemId', 'kind', 'nativeTypeId'])
      const itemId = positiveInteger(source.itemId, `${entryField}.itemId`)
      const nativeTypeId = nonnegativeInteger(source.nativeTypeId, `${entryField}.nativeTypeId`)
      if (!(NATIVE_BELT_ITEM_TYPE_IDS as readonly number[]).includes(nativeTypeId)) {
        throw new GameProtocolError(`${entryField}.nativeTypeId is not belt-eligible`)
      }
      if (economy) {
        const owned = [
          ...economy.backpack.flatMap(flattenInventoryItem),
          ...equippedItems(economy.equipment),
        ].find((item) => item.id === itemId)
        if (!owned || owned.nativeTypeId !== nativeTypeId
          || !nativeInventoryItemCanBindToBelt(owned)) {
          throw new GameProtocolError(`${entryField} does not identify an owned belt item`)
        }
      }
      return Object.freeze({ itemId, kind, nativeTypeId })
    }
    throw new GameProtocolError(`${entryField}.kind is not supported`)
  })
  if (entries.length !== 8) throw new GameProtocolError(`${field} must contain exactly eight slots`)
  return Object.freeze(entries) as PlayerBeltComponent
}

export function playerEconomy(value: unknown, field: string): ProtocolPlayerEconomy {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actionFeedback',
    'backpack',
    'charmCapacity',
    'collegeIntroPending',
    'dowsingFee',
    'dowsingOffers',
    'equipment',
    'fomentiusStock',
    'gold',
    'hagathaOffers',
    'npc',
    'ownedPerkSelectors',
    'revision',
    'storage',
    'tonicPurchases',
    'tutorialPending',
    'unforgeBonuses',
  ])
  const backpack = inventoryItems(
    source.backpack,
    `${field}.backpack`,
    NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT,
  )
  const storage = inventoryItems(
    source.storage,
    `${field}.storage`,
    HUB_STORAGE_SLOT_CAPACITY,
  )
  if (
    !protocolInventoryRootSlotsAreValid(backpack, NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT)
    || !protocolInventoryRootSlotsAreValid(storage, HUB_STORAGE_SLOT_CAPACITY)
  ) throw new GameProtocolError(`${field} inventory slots are invalid`)
  const equipment = playerEquipment(source.equipment, `${field}.equipment`)
  const fomentiusStock = limitedArray(
    source.fomentiusStock,
    `${field}.fomentiusStock`,
    24,
  ).map((item, index) => shopItem(item, `${field}.fomentiusStock[${index}]`))
  const allItemIds = [
    ...backpack,
    ...storage,
    ...fomentiusStock,
    ...equippedItems(equipment),
  ].flatMap(flattenInventoryItem).map(({ id }) => id)
  if (new Set(allItemIds).size !== allItemIds.length) {
    throw new GameProtocolError(`${field} contains a duplicate item id`)
  }
  const dowsingOffers = limitedArray(
    source.dowsingOffers,
    `${field}.dowsingOffers`,
    4,
  ).map((offer, index) => dowsingOffer(offer, `${field}.dowsingOffers[${index}]`))
  if (
    new Set(dowsingOffers.map(({ id }) => id)).size !== dowsingOffers.length
    || new Set(dowsingOffers.map(({ recipeIndex }) => recipeIndex)).size
      !== dowsingOffers.length
  ) throw new GameProtocolError(`${field}.dowsingOffers contains a duplicate`)
  const hagathaOffers = limitedArray(
    source.hagathaOffers,
    `${field}.hagathaOffers`,
    29,
  ).map((offer, index) => hagathaOffer(offer, `${field}.hagathaOffers[${index}]`))
  if (new Set(hagathaOffers.map(({ selector }) => selector)).size !== hagathaOffers.length) {
    throw new GameProtocolError(`${field}.hagathaOffers contains a duplicate selector`)
  }
  const ownedPerkSelectors = hagathaOutcomeArray(
    source.ownedPerkSelectors,
    `${field}.ownedPerkSelectors`,
  )
  const charmCapacity = integer(source.charmCapacity, `${field}.charmCapacity`)
  if (charmCapacity !== 3 && charmCapacity !== 6 && charmCapacity !== 9) {
    throw new GameProtocolError(`${field}.charmCapacity is invalid`)
  }
  const tonicPurchases = nonnegativeInteger(
    source.tonicPurchases,
    `${field}.tonicPurchases`,
  )
  if (!nativeHagathaOutcomeStateIsValid(
    ownedPerkSelectors,
    tonicPurchases,
    charmCapacity,
  )) {
    throw new GameProtocolError(`${field}.Hagatha outcomes do not match Tonic capacity`)
  }
  return {
    actionFeedback: source.actionFeedback === null
      ? null
      : hubActionFeedback(source.actionFeedback, `${field}.actionFeedback`),
    backpack,
    charmCapacity,
    collegeIntroPending: boolean(
      source.collegeIntroPending,
      `${field}.collegeIntroPending`,
    ),
    dowsingFee: boundedInteger(source.dowsingFee, `${field}.dowsingFee`, 500, 950),
    dowsingOffers,
    equipment,
    fomentiusStock,
    gold: boundedInteger(source.gold, `${field}.gold`, 0, 10_000_000),
    hagathaOffers,
    npc: nativeHubNpcState(source.npc, `${field}.npc`),
    ownedPerkSelectors,
    revision: nonnegativeInteger(source.revision, `${field}.revision`),
    storage,
    tonicPurchases,
    tutorialPending: boolean(source.tutorialPending, `${field}.tutorialPending`),
    unforgeBonuses: nativeUnforgeBonuses(source.unforgeBonuses, `${field}.unforgeBonuses`),
  }
}

function nativeUnforgeBonuses(
  value: unknown,
  field: string,
): ProtocolPlayerEconomy['unforgeBonuses'] {
  const source = record(value, field)
  onlyKeys(source, field, [
    'experience',
    'manaCostReduction',
    'maximumHealth',
    'maximumMana',
    'offensiveDamage',
    'recipeAttemptCount',
  ])
  return {
    experience: nonnegativeFinite(source.experience, `${field}.experience`),
    manaCostReduction: nonnegativeInteger(
      source.manaCostReduction,
      `${field}.manaCostReduction`,
    ),
    maximumHealth: nonnegativeInteger(source.maximumHealth, `${field}.maximumHealth`),
    maximumMana: nonnegativeInteger(source.maximumMana, `${field}.maximumMana`),
    offensiveDamage: nonnegativeInteger(source.offensiveDamage, `${field}.offensiveDamage`),
    recipeAttemptCount: nonnegativeInteger(
      source.recipeAttemptCount,
      `${field}.recipeAttemptCount`,
    ),
  }
}

function hubActionFeedback(
  value: unknown,
  field: string,
): NonNullable<ProtocolPlayerEconomy['actionFeedback']> {
  const source = record(value, field)
  onlyKeys(source, field, [
    'accepted',
    'action',
    'dowsingPitch',
    'reason',
    'sequence',
    'transferDirection',
    'transferGesture',
    'unforgeOutcome',
  ])
  const action = limitedString(source.action, `${field}.action`, 32)
  if (![
    'activate-belt-slot',
    'bind-belt-item',
    'buy-dowsing',
    'buy-fomentius',
    'buy-hagatha',
    'buy-teacher-spell',
    'close-dowsing',
    'close-hagatha',
    'consume',
    'dye',
    'dowse',
    'equip',
    'interact-goodie',
    'move-inventory-item',
    'read-librarian-book',
    'read-skill-book',
    'remove-hagatha',
    'select-boast',
    'transfer',
    'unforge',
    'unequip',
  ].includes(action)) throw new GameProtocolError(`${field}.action is not supported`)
  const reason = source.reason === null
    ? null
    : limitedString(source.reason, `${field}.reason`, 32)
  if (reason !== null && ![
    'capacity-full',
    'ineligible-item',
    'insufficient-gold',
    'invalid-inventory',
    'invalid-offer',
    'invalid-slot',
    'invalid-target',
    'item-not-found',
    'offers-active',
    'perk-capacity-full',
    'required-clothing',
    'slot-empty',
    'slot-locked',
  ].includes(reason)) throw new GameProtocolError(`${field}.reason is not supported`)
  const transferDirection = source.transferDirection === null
    ? null
    : limitedString(source.transferDirection, `${field}.transferDirection`, 32)
  const transferGesture = source.transferGesture === null
    ? null
    : limitedString(source.transferGesture, `${field}.transferGesture`, 32)
  if (transferDirection !== null
    && transferDirection !== 'to-backpack' && transferDirection !== 'to-storage') {
    throw new GameProtocolError(`${field}.transferDirection is not supported`)
  }
  if (transferGesture !== null
    && transferGesture !== 'double-activation' && transferGesture !== 'drag') {
    throw new GameProtocolError(`${field}.transferGesture is not supported`)
  }
  if ((action === 'transfer') !== (transferDirection !== null && transferGesture !== null)) {
    throw new GameProtocolError(`${field} transfer metadata does not match action`)
  }
  const accepted = boolean(source.accepted, `${field}.accepted`)
  if (accepted !== (reason === null)) {
    throw new GameProtocolError(`${field}.accepted does not match reason`)
  }
  if (transferDirection === 'to-storage' && transferGesture !== 'drag') {
    throw new GameProtocolError(`${field}.transferGesture must be drag for to-storage`)
  }
  const dowsingPitch = source.dowsingPitch === null
    ? null
    : finite(source.dowsingPitch, `${field}.dowsingPitch`)
  const ownsDowsingPitch = accepted && (action === 'dowse' || action === 'buy-dowsing')
  if (ownsDowsingPitch !== (dowsingPitch !== null)
    || (dowsingPitch !== null && (dowsingPitch < 0.8 || dowsingPitch > 1.1))) {
    throw new GameProtocolError(`${field}.dowsingPitch does not match action`)
  }
  const unforgeOutcome = source.unforgeOutcome === null
    ? null
    : nativeUnforgeOutcome(source.unforgeOutcome, `${field}.unforgeOutcome`)
  if ((accepted && action === 'unforge') !== (unforgeOutcome !== null)) {
    throw new GameProtocolError(`${field}.unforgeOutcome does not match action`)
  }
  return {
    accepted,
    action: action as NonNullable<ProtocolPlayerEconomy['actionFeedback']>['action'],
    dowsingPitch,
    reason: reason as NonNullable<ProtocolPlayerEconomy['actionFeedback']>['reason'],
    sequence: positiveInteger(source.sequence, `${field}.sequence`),
    transferDirection: transferDirection as NonNullable<ProtocolPlayerEconomy['actionFeedback']>['transferDirection'],
    transferGesture: transferGesture as NonNullable<ProtocolPlayerEconomy['actionFeedback']>['transferGesture'],
    unforgeOutcome,
  }
}

function nativeUnforgeOutcome(value: unknown, field: string): NativeUnforgeOutcome {
  const source = record(value, field)
  onlyKeys(source, field, ['amount', 'itemName', 'kind'])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(NATIVE_UNFORGE_OUTCOME_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const amount = source.amount === null
    ? null
    : positiveInteger(source.amount, `${field}.amount`)
  const nullAmount = kind === 'fizzle' || kind === 'full-rejuvenation'
  if (nullAmount !== (amount === null)) {
    throw new GameProtocolError(`${field}.amount does not match kind`)
  }
  if (kind === 'mind-dredge' && amount !== 1) {
    throw new GameProtocolError(`${field}.amount does not match Mind Dredge`)
  }
  return {
    amount,
    itemName: limitedString(source.itemName, `${field}.itemName`, 128),
    kind: kind as NativeUnforgeOutcome['kind'],
  }
}

function shopItem(value: unknown, field: string): HubShopItem {
  const source = record(value, field)
  return {
    ...inventoryItem(source, field, ['price']),
    price: boundedInteger(source.price, `${field}.price`, 1, 100_000),
  }
}

function dowsingOffer(value: unknown, field: string): DowsingOffer {
  const source = record(value, field)
  onlyKeys(source, field, ['id', 'price', 'recipeIndex'])
  const price = boundedInteger(source.price, `${field}.price`, 5_000, 5_700)
  if (price % 50 !== 0) throw new GameProtocolError(`${field}.price is not a 50-gold step`)
  return {
    id: positiveInteger(source.id, `${field}.id`),
    price,
    recipeIndex: boundedInteger(
      source.recipeIndex,
      `${field}.recipeIndex`,
      0,
      DOWSING_EQUIPMENT_RECIPES.length - 1,
    ),
  }
}

function hagathaOffer(value: unknown, field: string): HagathaOffer {
  const source = record(value, field)
  onlyKeys(source, field, [
    'basePrice',
    'behaviorFamily',
    'description',
    'members',
    'name',
    'price',
    'selector',
  ])
  const selector = integer(source.selector, `${field}.selector`)
  if (selector < -1 || selector >= HAGATHA_PERKS.length || selector === 8) {
    throw new GameProtocolError(`${field}.selector is unavailable`)
  }
  const members = selector === -1
    ? hagathaOutcomeArray(source.members, `${field}.members`)
    : selectorArray(source.members, `${field}.members`)
  if (selector === -1 && !nativeHagathaBundleStateIsValid(members)) {
    throw new GameProtocolError(`${field}.members is not a native Hagatha bundle`)
  }
  if (members.length < 1 || (selector >= 0 && (members.length !== 1 || members[0] !== selector))) {
    throw new GameProtocolError(`${field}.members does not match selector`)
  }
  return {
    basePrice: positiveInteger(source.basePrice, `${field}.basePrice`),
    behaviorFamily: limitedString(source.behaviorFamily, `${field}.behaviorFamily`, 64),
    description: limitedString(source.description, `${field}.description`, 512),
    members,
    name: limitedString(source.name, `${field}.name`, 64),
    price: positiveInteger(source.price, `${field}.price`),
    selector,
  }
}

function selectorArray(value: unknown, field: string): readonly number[] {
  const selectors = limitedArray(value, field, 28).map((selector, index) => (
    boundedInteger(selector, `${field}[${index}]`, 0, 27)
  ))
  if (selectors.some((selector, index) => (
    selector === 8 || (index > 0 && selector <= selectors[index - 1]!)
  ))) throw new GameProtocolError(`${field} must be sorted, unique, and available`)
  return selectors
}

function hagathaOutcomeArray(value: unknown, field: string): readonly number[] {
  const selectors = limitedArray(
    value,
    field,
    NATIVE_HAGATHA_MAX_OUTCOME_CAPACITY,
  ).map((selector, index) => boundedInteger(selector, `${field}[${index}]`, 0, 27))
  const ordinary = selectors.filter(selector => selector !== 27)
  if (
    selectors.includes(8)
    || new Set(ordinary).size !== ordinary.length
    || selectors.filter(selector => selector === 27).length > 2
  ) throw new GameProtocolError(`${field} is not a native Hagatha outcome list`)
  return selectors
}
