import type {
  EquipmentSlot,
  HubInventoryAction,
  HubInventoryItem,
  HubTraderId,
} from './core-kernels/hub-economy.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import {
  NATIVE_HUB_INTERACTION_IDS,
  NATIVE_HUB_NPC_CATALOG,
  nativeHubNpcHintIndex,
  type NativeHubDialogueRecord,
  type NativeHubInteractionDefinition,
  type NativeHubInteractionId,
  type NativeHubNpcCommand,
} from './core-kernels/native-hub-npc.ts'
import type { Vector2 } from './core-kernels/vector.ts'
import {
  hubMemorialSlotIndexForInteraction,
  type HubMemorialPortrait,
  type HubMemorialState,
} from './core-kernels/hub-memorial.ts'

type HubPotionShortcutItem = Pick<HubInventoryItem, 'id' | 'kind' | 'quantity'> & {
  readonly contents?: readonly HubPotionShortcutItem[]
}

export type HubInteractionId = NativeHubInteractionId | 'polisher'

export interface HubInteractionDialogueDefinition {
  readonly actionLabel: string | null
  readonly commands: readonly NativeHubNpcCommand[]
  readonly dismissals: readonly NativeHubDialogueRecord[]
  readonly eulogyIndex: number | null
  readonly eulogyLine: string | null
  readonly intro: readonly string[]
  readonly introRecord: NativeHubDialogueRecord | null
  readonly name: string
  readonly priceExplanation: readonly string[]
  readonly priceLabel: string | null
  readonly questions: readonly NativeHubDialogueRecord[]
  readonly service: HubTraderId | null
  readonly title: string
}

export interface HubHudShortcutDefinition {
  readonly interaction: 'annalist' | HubTraderId
  readonly levelPickerRecord: 0 | 2 | 4 | 5 | 6
  readonly mode: 'dialogue' | 'service'
  readonly name: string
}

export interface HubPotionShortcut {
  readonly count: number
  readonly itemId: number | null
}

export interface HubInteractionAvailability {
  readonly skorchaPosition: Vector2 | null
  readonly storyOffice?: boolean
}

export const NATIVE_HEALTH_POTION_BELT_SLOT = 3
export const NATIVE_MANA_POTION_BELT_SLOT = 4

export function hubPotionShortcut(
  backpack: readonly HubPotionShortcutItem[],
  kind: 'health-potion' | 'mana-potion',
): HubPotionShortcut {
  const flatten = (items: readonly HubPotionShortcutItem[]): readonly HubPotionShortcutItem[] => (
    items.flatMap((item) => [item, ...flatten(item.contents ?? [])])
  )
  const stacks = flatten(backpack).filter((item) => item.kind === kind)
  return {
    count: stacks.reduce((total, item) => total + item.quantity, 0),
    itemId: stacks[0]?.id ?? null,
  }
}

export function hubPotionBeltShortcut(
  backpack: readonly HubPotionShortcutItem[],
  slot: number,
): HubPotionShortcut | null {
  if (slot === NATIVE_HEALTH_POTION_BELT_SLOT) {
    return hubPotionShortcut(backpack, 'health-potion')
  }
  if (slot === NATIVE_MANA_POTION_BELT_SLOT) {
    return hubPotionShortcut(backpack, 'mana-potion')
  }
  return null
}

export const HUB_INTERACTION_IDS: readonly HubInteractionId[] =
  Object.freeze([...NATIVE_HUB_INTERACTION_IDS, 'polisher'])
const HUB_TRADER_IDS: readonly HubTraderId[] = ['hagatha', 'fomentius', 'luthacus', 'shlorio']

function interactionDialogue(
  interaction: NativeHubInteractionDefinition,
  dialogue: Readonly<Record<string, NativeHubDialogueRecord>>,
): HubInteractionDialogueDefinition {
  const introRecord = interaction.intro === null ? null : dialogue[interaction.intro]!
  const questions = interaction.questions.map(question => dialogue[question]!)
  const dismissals = interaction.dismissals.map(dismissal => dialogue[dismissal]!)
  const service = interaction.commands
    .map(({ selector }) => selector)
    .find(isHubTraderId) ?? null
  return Object.freeze({
    actionLabel: interaction.commands[0]?.label ?? null,
    commands: interaction.commands,
    dismissals,
    eulogyIndex: null,
    eulogyLine: null,
    intro: introRecord?.lines ?? [],
    introRecord,
    name: interaction.name,
    priceExplanation: [],
    priceLabel: null,
    questions,
    service,
    title: interaction.serviceTitle ?? interaction.name.toUpperCase(),
  })
}

export const HUB_INTERACTION_DIALOGUES: Readonly<
  Record<HubInteractionId, HubInteractionDialogueDefinition>
> = Object.freeze(Object.fromEntries(HUB_INTERACTION_IDS.map((interactionId) => {
  if (interactionId === 'polisher') {
    return [interactionId, interactionDialogue(
      NATIVE_HUB_NPC_CATALOG.storyOffice.interactions.polisher,
      NATIVE_HUB_NPC_CATALOG.storyOffice.dialogue,
    )]
  }
  const interaction = NATIVE_HUB_NPC_CATALOG.interactions[interactionId]
  const introRecord = interaction.intro === null
    ? null
    : NATIVE_HUB_NPC_CATALOG.dialogue[interaction.intro]!
  const questions = interaction.questions.map(
    question => NATIVE_HUB_NPC_CATALOG.dialogue[question]!,
  )
  const dismissals = interaction.dismissals.map(
    dismissal => NATIVE_HUB_NPC_CATALOG.dialogue[dismissal]!,
  )
  const traderCommand = interaction.commands.find(
    ({ selector }) => isHubTraderId(selector),
  )
  const priceQuestion = questions.length === 1 && isHubTraderId(interactionId)
    ? questions[0]!
    : null
  const eulogyIndex = interaction.eulogyIndex ?? null
  const eulogyLine = eulogyIndex === null
    ? null
    : NATIVE_HUB_NPC_CATALOG.eulogies[`${eulogyIndex}`] ?? null
  return [interactionId, Object.freeze({
    actionLabel: interaction.commands[0]?.label ?? null,
    commands: interaction.commands,
    dismissals,
    eulogyIndex,
    eulogyLine,
    intro: introRecord?.lines ?? (eulogyLine === null ? [] : [eulogyLine]),
    introRecord,
    name: interaction.name,
    priceExplanation: priceQuestion?.lines ?? [],
    priceLabel: priceQuestion?.label ?? null,
    questions,
    service: traderCommand?.selector ?? null,
    title: interaction.serviceTitle ?? interaction.name.toUpperCase(),
  })]
})) as unknown as Record<HubInteractionId, HubInteractionDialogueDefinition>)

export const HUB_STORY_OFFICE_DIALOGUES: Readonly<
  Record<'arch-chancellor' | 'polisher', HubInteractionDialogueDefinition>
> = Object.freeze({
  'arch-chancellor': interactionDialogue(
    NATIVE_HUB_NPC_CATALOG.storyOffice.interactions['arch-chancellor'],
    NATIVE_HUB_NPC_CATALOG.storyOffice.dialogue,
  ),
  polisher: HUB_INTERACTION_DIALOGUES.polisher,
})

export function hubInteractionDialogue(
  interactionId: HubInteractionId,
  storyOffice = false,
): HubInteractionDialogueDefinition {
  return storyOffice && (interactionId === 'arch-chancellor' || interactionId === 'polisher')
    ? HUB_STORY_OFFICE_DIALOGUES[interactionId]
    : HUB_INTERACTION_DIALOGUES[interactionId]
}

export const HUB_TRADER_DIALOGUES: Readonly<Record<HubTraderId, HubInteractionDialogueDefinition>> = {
  hagatha: HUB_INTERACTION_DIALOGUES.hagatha,
  fomentius: HUB_INTERACTION_DIALOGUES.fomentius,
  luthacus: HUB_INTERACTION_DIALOGUES.luthacus,
  shlorio: HUB_INTERACTION_DIALOGUES.shlorio,
}

export const HUB_HUD_SHORTCUTS: readonly HubHudShortcutDefinition[] = Object.freeze([
  { interaction: 'annalist', levelPickerRecord: 0, mode: 'dialogue', name: 'Provokatus' },
  { interaction: 'hagatha', levelPickerRecord: 6, mode: 'service', name: 'Hagatha' },
  { interaction: 'luthacus', levelPickerRecord: 4, mode: 'service', name: 'Luthacus' },
  { interaction: 'fomentius', levelPickerRecord: 5, mode: 'service', name: 'Fomentius' },
  { interaction: 'shlorio', levelPickerRecord: 2, mode: 'service', name: 'Shlorio' },
])

export const HUB_TRADER_GRID_CAPACITY = {
  fomentius: 28,
  shlorio: 9,
} as const

export const HUB_TRADER_NATIVE_UI_RECORDS = {
  Inventory: 84,
  Skills: 166,
  UI: 113,
} as const

interface HubInteractionGeometry {
  readonly position: Vector2
  readonly radius: number
  readonly rangeRadius?: number
  readonly region: HubRegionId
}

export const HUB_INTERACTION_GEOMETRY: Readonly<Record<HubInteractionId, HubInteractionGeometry>> =
  Object.freeze(Object.fromEntries(HUB_INTERACTION_IDS.map((interactionId) => [
    interactionId,
    interactionId === 'polisher'
      ? NATIVE_HUB_NPC_CATALOG.storyOffice.interactions.polisher.geometry
      : NATIVE_HUB_NPC_CATALOG.interactions[interactionId].geometry,
  ])) as Record<HubInteractionId, HubInteractionGeometry>)

export const HUB_TRADER_GEOMETRY: Readonly<Record<HubTraderId, HubInteractionGeometry>> = {
  fomentius: HUB_INTERACTION_GEOMETRY.fomentius,
  hagatha: HUB_INTERACTION_GEOMETRY.hagatha,
  luthacus: HUB_INTERACTION_GEOMETRY.luthacus,
  shlorio: HUB_INTERACTION_GEOMETRY.shlorio,
}

export function hubInteractionWithinRange(
  interaction: HubInteractionId,
  region: HubRegionId,
  playerPosition: Vector2,
  availability: HubInteractionAvailability = { skorchaPosition: null },
): boolean {
  if (interaction === 'skorcha' && availability.skorchaPosition === null) return false
  const geometry = interactionGeometry(interaction, availability)
  if (region !== geometry.region) return false
  const distanceSquared = squaredDistance(playerPosition, geometry.position)
  const rangeRadius = geometry.rangeRadius ?? geometry.radius
  return distanceSquared <= 5 * rangeRadius * rangeRadius + 1500
}

export function nearestHubInteraction(
  region: HubRegionId,
  playerPosition: Vector2,
  availability: HubInteractionAvailability = { skorchaPosition: null },
): HubInteractionId | null {
  return nearestInteraction(
    availableInteractionIds(availability),
    region,
    playerPosition,
    true,
    availability,
  )
}

export function hubInteractionAtPoint(
  region: HubRegionId,
  point: Vector2,
  availability: HubInteractionAvailability = { skorchaPosition: null },
): HubInteractionId | null {
  return nearestInteraction(
    availableInteractionIds(availability),
    region,
    point,
    false,
    availability,
  )
}

export function hubInteractionPromptLabel(interaction: HubInteractionId): string {
  return interaction.startsWith('painting-')
    ? 'Hear memorial eulogy'
    : `Talk to ${HUB_INTERACTION_DIALOGUES[interaction].name}`
}

export function hubMemorialEulogyIndex(
  interaction: HubInteractionId,
  memorial: HubMemorialState,
): number | null {
  const slotIndex = hubMemorialSlotIndexForInteraction(interaction)
  return slotIndex === null ? null : memorial.slots[slotIndex]?.portraitId ?? null
}

export function hubMemorialPortraitForInteraction(
  interaction: HubInteractionId,
  memorial: HubMemorialState,
): HubMemorialPortrait | null {
  const slotIndex = hubMemorialSlotIndexForInteraction(interaction)
  return slotIndex === null ? null : memorial.slots[slotIndex]?.portrait ?? null
}

export function hubNpcHintAcknowledgementAction(
  interactionId: HubInteractionId,
  helpFlags: readonly boolean[],
): Extract<HubInventoryAction, { readonly type: 'acknowledge-npc-hint' }> | null {
  if (interactionId === 'polisher') return null
  const index = nativeHubNpcHintIndex(interactionId)
  return index === null || helpFlags[index] !== true
    ? null
    : { interactionId, type: 'acknowledge-npc-hint' }
}

export function hubTraderWithinServiceRange(
  trader: HubTraderId,
  region: HubRegionId,
  playerPosition: Vector2,
): boolean {
  return hubInteractionWithinRange(trader, region, playerPosition)
}

export function nearestHubTrader(
  region: HubRegionId,
  playerPosition: Vector2,
): HubTraderId | null {
  return nearestInteraction(HUB_TRADER_IDS, region, playerPosition, true)
}

export function hubTraderAtPoint(
  region: HubRegionId,
  point: Vector2,
): HubTraderId | null {
  return nearestInteraction(HUB_TRADER_IDS, region, point, false)
}

function availableInteractionIds(
  availability: HubInteractionAvailability,
): readonly HubInteractionId[] {
  return HUB_INTERACTION_IDS.filter(interaction => (
    (interaction !== 'skorcha' || availability.skorchaPosition !== null)
    && (interaction !== 'polisher' || availability.storyOffice === true)
  ))
}

function nearestInteraction<T extends HubInteractionId>(
  interactions: readonly T[],
  region: HubRegionId,
  point: Vector2,
  serviceRange: boolean,
  availability: HubInteractionAvailability = { skorchaPosition: null },
): T | null {
  let nearest: { distanceSquared: number; interaction: T } | null = null
  for (const interaction of interactions) {
    const geometry = interactionGeometry(interaction, availability)
    if (geometry.region !== region) continue
    const distanceSquared = squaredDistance(point, geometry.position)
    const maximumDistanceSquared = serviceRange
      ? 5 * (geometry.rangeRadius ?? geometry.radius) ** 2 + 1500
      : geometry.radius * geometry.radius
    if (distanceSquared > maximumDistanceSquared) continue
    if (!nearest || distanceSquared < nearest.distanceSquared) {
      nearest = { distanceSquared, interaction }
    }
  }
  return nearest?.interaction ?? null
}

function interactionGeometry(
  interaction: HubInteractionId,
  availability: HubInteractionAvailability,
): HubInteractionGeometry {
  const geometry = HUB_INTERACTION_GEOMETRY[interaction]
  return interaction === 'skorcha' && availability.skorchaPosition !== null
    ? { ...geometry, position: availability.skorchaPosition }
    : geometry
}

function squaredDistance(left: Vector2, right: Vector2): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function isHubTraderId(value: string): value is HubTraderId {
  return (HUB_TRADER_IDS as readonly string[]).includes(value)
}

export function equipmentSlotsForItem(
  item: Pick<HubInventoryItem, 'equipmentType'>,
  thirdRingUnlocked: boolean,
): readonly EquipmentSlot[] {
  switch (item.equipmentType) {
    case 'amulet': return ['amulet']
    case 'hat': return ['hat']
    case 'robe': return ['robe']
    case 'staff':
    case 'wand': return ['weapon']
    case 'ring': return thirdRingUnlocked
      ? ['ring-0', 'ring-1', 'ring-2']
      : ['ring-0', 'ring-1']
    case null: return []
  }
}

export function hubEquipmentItemForAlias<T extends Pick<HubInventoryItem, 'equipmentType'>>(
  item: T | null,
  aliasIndex: number,
): T | null {
  return aliasIndex === 1 && item?.equipmentType === 'wand' ? null : item
}

export function hubEquipmentClickAction(
  item: Pick<HubInventoryItem, 'equipmentType' | 'id'>,
  slot: EquipmentSlot,
  thirdRingUnlocked: boolean,
): Extract<HubInventoryAction, { readonly type: 'equip' }> | null {
  if (!equipmentSlotsForItem(item, thirdRingUnlocked).includes(slot)) return null
  return { itemId: item.id, slot, type: 'equip' }
}
