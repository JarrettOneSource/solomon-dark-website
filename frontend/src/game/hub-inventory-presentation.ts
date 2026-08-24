import type {
  EquipmentSlot,
  HubInventoryAction,
  HubInventoryItem,
  HubTraderId,
} from './core-kernels/hub-economy.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import type { Vector2 } from './core-kernels/vector.ts'

type HubPotionShortcutItem = Pick<HubInventoryItem, 'id' | 'kind' | 'quantity'> & {
  readonly contents?: readonly HubPotionShortcutItem[]
}

export type HubInteractionId =
  | HubTraderId
  | 'annalist'
  | 'teacher'
  | 'memorator'
  | 'painting-0'
  | 'painting-1'
  | 'painting-100'
  | 'painting-3'
  | 'painting-4'
  | 'painting-5'
  | 'painting-6'
  | 'painting-7'
  | 'painting-8'
  | 'painting-9'
  | 'librarian'
  | 'arch-chancellor'

export interface HubInteractionDialogueDefinition {
  readonly actionLabel: string | null
  readonly intro: readonly string[]
  readonly name: string
  readonly priceExplanation: readonly string[]
  readonly priceLabel: string | null
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

export const HUB_INTERACTION_IDS: readonly HubInteractionId[] = Object.freeze([
  'hagatha', 'fomentius', 'annalist', 'luthacus', 'teacher',
  'memorator',
  'painting-0', 'painting-1', 'painting-100', 'painting-3', 'painting-4',
  'painting-5', 'painting-6', 'painting-7', 'painting-8', 'painting-9',
  'librarian', 'shlorio', 'arch-chancellor',
])

export const HUB_INTERACTION_DIALOGUES: Readonly<
  Record<HubInteractionId, HubInteractionDialogueDefinition>
> = {
  hagatha: {
    actionLabel: 'Buy Charms and Curses',
    intro: [
      'All right then wizard, what do you want?',
      'I have a wide variety of charms, blessings, curses and talismans.  Good for the digestion, good for the soul.',
    ],
    name: 'Hagatha',
    priceExplanation: [
      'Well, see here: Mixing up these things is a lot of work.',
      "But it's a lot *less* work once I've opened the right bags and cleaned the right tools and measured out the right ingredients.",
      "So, fair do's, my embellishments are a lot less expensive if I've mixed them up recently.",
    ],
    priceLabel: 'Charm Prices?',
    service: 'hagatha',
    title: "HAGATHA'S CHARMS AND CURSES",
  },
  fomentius: {
    actionLabel: 'Buy',
    intro: [
      'Hello Hello!',
      'Can I interest you in a high quality and *very legal* herbal potion? Brewed with all the best natural magicks, minimal chance of causing intestinal combustion!',
    ],
    name: 'Fomentius',
    priceExplanation: [],
    priceLabel: null,
    service: 'fomentius',
    title: "FOMENTIUS' USEFUL THYNGS",
  },
  annalist: {
    actionLabel: null,
    intro: [
      'Look at all those blue robes scurrying about.  How many of them do you think will graduate?  One in ten.  How many of them will do anything interesting?  Not one in a hundred... but I still have to write every single thing they do down!',
      "I'm the College Annalist.  That means it's my job to keep records.  Even when the people I'm recording are so dull they make me want to slip into a boredom coma.",
      "...Say, you're the one they're throwing at Solomon Dark, aren't you?  Now that guy, he may be evil, but at least he livens up the history!  And hey, good on you for making an epic struggle out of it.",
      "So, give me your name and specialty, I'll (sigh) write it down.",
    ],
    name: 'Provokatus',
    priceExplanation: [],
    priceLabel: null,
    service: null,
    title: 'PROVOKATUS',
  },
  luthacus: {
    actionLabel: 'Examine Items',
    intro: [
      "Pleased to meet you, mate.  I'm the College's Official Unreal Crime Scene Investigator.",
      "Basically, that means it's my humble jobbing duty to trudge out into the field and retrieve the remains-- and by remains, I mean little bits and pieces-- of wizards and witches who've gone and done themselves a magical mishap.  So they can get buried proper.",
      "Now, between you and me, there's no point burying the dead with all their stuff, eh?  They don't need it.  Other people might.  Have a look here and see if there's anything you can use.  By order of the Archchancellor, o'course.",
    ],
    name: 'Luthacus',
    priceExplanation: [],
    priceLabel: null,
    service: 'luthacus',
    title: "LUTHACUS' SCAVENGED GOODS",
  },
  teacher: {
    actionLabel: null,
    intro: [
      'Oh hello.',
      "Don't mind me, if you stay outside the circle you're perfectly safe.",
      "I'm just testing a few of the experimental spells that students have come up with over the years.",
      'No, no-- don\'t ask me to teach you these spells.  It would be both unethical and dangerous.  Many have asked, none recieve-- it would be a great dereliction of my duty to put these spells into the wild without painstaking testing, peer review, certification, licensing, MAG approval, and blessings from the archchancellor.  The process takes centuries.',
      "Yes, yes, you hunger for these spells now, I can see it.  But alas, they're not ready yet.  I am a professional, and it would take considerable persuasion to get me to put them on the roster early.",
    ],
    name: 'Machinimbus',
    priceExplanation: [],
    priceLabel: null,
    service: null,
    title: 'MACHINIMBUS',
  },
  memorator: {
    actionLabel: null,
    intro: [
      'Welcome to the palace of dead careers.',
      "But I shouldn't be here.",
      'I am Declarias--son of High Sorcerer Decantus, who famously slew the Last Unicorn... Grandson of War Wizard Delantus, who singlehandedly defeated the Frost Orphans of the North.',
      'Battle magic is in my veins!  I should be out inventing deadly new spells, not indoors babysitting urns.',
    ],
    name: 'Declarius',
    priceExplanation: [],
    priceLabel: null,
    service: null,
    title: 'DECLARIUS',
  },
  'painting-0': paintingDialogue('This portrait is of Sirmin the Wizard.'),
  'painting-1': paintingDialogue('This portrait is of Lucritius the Fire Mage.'),
  'painting-100': paintingDialogue(),
  'painting-3': paintingDialogue('This portrait is of Morth the Icebinder.'),
  'painting-4': paintingDialogue('This portrait is of Griselda the Sorceress.'),
  'painting-5': paintingDialogue('This portrait is of Vorpus the Magician.'),
  'painting-6': paintingDialogue("This portrait is of Wegnus, called 'The White'."),
  'painting-7': paintingDialogue('This portrait is of Wazoo the Storm Mage.'),
  'painting-8': paintingDialogue('This portrait is of Athicus the Diviner.'),
  'painting-9': paintingDialogue('This portrait is of Andra the Medium.'),
  librarian: {
    actionLabel: null,
    intro: [
      "Oh, hum, good morning.  Is it morning?  Well then, good morning, student.  Are you a student?  No, you're faculty, aren't you?",
      'Just a moment, I know who you are.  Yes.  The Archchancellor has advised me, yes.',
      'Very well, what can I do for you today?  Are you seeking books?  I cannot, of course, permit you to check them out, circumstances being what they are.',
    ],
    name: 'Professor Semicus',
    priceExplanation: [],
    priceLabel: null,
    service: null,
    title: 'PROFESSOR SEMICUS',
  },
  shlorio: {
    actionLabel: 'Dowse',
    intro: [
      'Good morning.',
      'Are you interested in what can be found within the luminiferous ether?',
      'My magic mirror and I are eager to assist you.  ',
    ],
    name: 'Shlorio',
    priceExplanation: [
      'I am sure you appreciate that dowsing is an inexact science.  The price varies.',
      'Peering into the mirror is so mentally taxing that I must charge you even to take a look.  ',
      'Drawing an item out causes actual physical pain, and is understandably expensive.  The price of retrieving an item will depend on how entangled it is, as well as how many vapor burns I expect to sustain.',
      'Disturbing the ether changes the entire ethereal contour, so the price will fluctuate depending on the state of the infirmament as well.',
    ],
    priceLabel: 'Dowsing Prices?',
    service: 'shlorio',
    title: "SHLORIO'S DISCOUNT DOWSING",
  },
  'arch-chancellor': {
    actionLabel: null,
    intro: [
      'Oh, good morning, do help yourself to a glass of brandy.  While you are at it, help me to one as well.',
      'Now then, you are likely wondering why I have summoned you.  In fact, I want you to go out and destroy one of our recent graduates.',
      'Have you heard the name Solomon Dark?  Yes?  Well, our Solomon Dark is beginning to make a bit of a mess.  Despite the official line, the disturbances on the edge of Dratmoor are not a natural phenomenon.',
      "Solomon Dark is dabbling in necromancy.  He's upsetting the peasants, and setting off every magical alarm bell we have in this university.",
      "We've sent several junior mages out to settle things down, but none have returned, at least not in any useful form.  Although Solomon Dark was not an exemplary student, we are beginning to suspect that we have underestimated him.",
      "Things took an even less pleasant turn recently when some king began threatening to get involved.  We'd rather kings didn't bother holding opinions on wizards, so I want you to find and dispatch Solomon Dark yourself.",
      "It goes without saying that this is confidential.  We're trying to downplay the university's role in training a, er, potential force of evil.",
    ],
    name: 'The ArchChancellor',
    priceExplanation: [],
    priceLabel: null,
    service: null,
    title: 'THE ARCHCHANCELLOR',
  },
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
  readonly region: HubRegionId
}

export const HUB_INTERACTION_GEOMETRY: Readonly<Record<HubInteractionId, HubInteractionGeometry>> = {
  fomentius: { position: { x: 1397, y: 664 }, radius: 30, region: 'courtyard' },
  hagatha: { position: { x: 1340, y: 280 }, radius: 15, region: 'courtyard' },
  annalist: { position: { x: 895.5, y: 455.5 }, radius: 8, region: 'courtyard' },
  luthacus: { position: { x: 1700.5, y: 449.5 }, radius: 25, region: 'courtyard' },
  teacher: { position: { x: 576.5, y: 710.5 }, radius: 25, region: 'courtyard' },
  memorator: { position: { x: 628, y: 770 }, radius: 25, region: 'mortuary' },
  'painting-0': { position: { x: 512, y: 697 }, radius: 15, region: 'mortuary' },
  'painting-1': { position: { x: 350, y: 683 }, radius: 15, region: 'mortuary' },
  'painting-100': { position: { x: 673, y: 683 }, radius: 15, region: 'mortuary' },
  'painting-3': { position: { x: 744, y: 540 }, radius: 15, region: 'mortuary' },
  'painting-4': { position: { x: 590, y: 540 }, radius: 15, region: 'mortuary' },
  'painting-5': { position: { x: 434, y: 540 }, radius: 15, region: 'mortuary' },
  'painting-6': { position: { x: 279, y: 540 }, radius: 15, region: 'mortuary' },
  'painting-7': { position: { x: 354, y: 400 }, radius: 15, region: 'mortuary' },
  'painting-8': { position: { x: 512, y: 400 }, radius: 15, region: 'mortuary' },
  'painting-9': { position: { x: 670, y: 400 }, radius: 15, region: 'mortuary' },
  librarian: { position: { x: 512, y: 595 }, radius: 55, region: 'library' },
  shlorio: { position: { x: 900, y: 642.5 }, radius: 25, region: 'library' },
  'arch-chancellor': { position: { x: 514, y: 467 }, radius: 55, region: 'office' },
}

const HUB_TRADER_IDS: readonly HubTraderId[] = ['hagatha', 'fomentius', 'luthacus', 'shlorio']
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
): boolean {
  const geometry = HUB_INTERACTION_GEOMETRY[interaction]
  if (region !== geometry.region) return false
  const distanceSquared = squaredDistance(playerPosition, geometry.position)
  return distanceSquared <= 5 * geometry.radius * geometry.radius + 1500
}

export function nearestHubInteraction(
  region: HubRegionId,
  playerPosition: Vector2,
): HubInteractionId | null {
  return nearestInteraction(HUB_INTERACTION_IDS, region, playerPosition, true)
}

export function hubInteractionAtPoint(
  region: HubRegionId,
  point: Vector2,
): HubInteractionId | null {
  return nearestInteraction(HUB_INTERACTION_IDS, region, point, false)
}

export function hubInteractionPromptLabel(interaction: HubInteractionId): string {
  return interaction.startsWith('painting-')
    ? 'Hear memorial eulogy'
    : `Talk to ${HUB_INTERACTION_DIALOGUES[interaction].name}`
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

function nearestInteraction<T extends HubInteractionId>(
  interactions: readonly T[],
  region: HubRegionId,
  point: Vector2,
  serviceRange: boolean,
): T | null {
  let nearest: { distanceSquared: number; interaction: T } | null = null
  for (const interaction of interactions) {
    const geometry = HUB_INTERACTION_GEOMETRY[interaction]
    if (geometry.region !== region) continue
    const distanceSquared = squaredDistance(point, geometry.position)
    const maximumDistanceSquared = serviceRange
      ? 5 * geometry.radius * geometry.radius + 1500
      : geometry.radius * geometry.radius
    if (distanceSquared > maximumDistanceSquared) continue
    if (!nearest || distanceSquared < nearest.distanceSquared) {
      nearest = { distanceSquared, interaction }
    }
  }
  return nearest?.interaction ?? null
}

function squaredDistance(left: Vector2, right: Vector2): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function paintingDialogue(line?: string): HubInteractionDialogueDefinition {
  return {
    actionLabel: null,
    intro: line === undefined ? [] : [line],
    name: 'Declarius',
    priceExplanation: [],
    priceLabel: null,
    service: null,
    title: 'DECLARIUS',
  }
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

export function hubEquipmentClickAction(
  item: Pick<HubInventoryItem, 'equipmentType' | 'id'>,
  slot: EquipmentSlot,
  thirdRingUnlocked: boolean,
): Extract<HubInventoryAction, { readonly type: 'equip' }> | null {
  if (!equipmentSlotsForItem(item, thirdRingUnlocked).includes(slot)) return null
  return { itemId: item.id, slot, type: 'equip' }
}
