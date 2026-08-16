import type {
  EquipmentSlot,
  HubInventoryItem,
  HubTraderId,
} from './core-kernels/hub-economy.ts'
import type { HubRegionId } from './core-kernels/hub-regions.ts'
import type { Vector2 } from './core-kernels/vector.ts'

export interface HubTraderDialogueDefinition {
  readonly actionLabel: string
  readonly intro: readonly string[]
  readonly name: string
  readonly priceExplanation: readonly string[]
  readonly priceLabel: string | null
  readonly title: string
}

export const HUB_TRADER_DIALOGUES: Readonly<Record<HubTraderId, HubTraderDialogueDefinition>> = {
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
    title: "FOMENTIUS' USEFUL THYNGS",
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
    title: "LUTHACUS' SCAVENGED GOODS",
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
    title: "SHLORIO'S DISCOUNT DOWSING",
  },
}

export const HUB_TRADER_GRID_CAPACITY = {
  fomentius: 28,
  shlorio: 9,
} as const

export const HUB_TRADER_NATIVE_UI_RECORDS = {
  Inventory: 84,
  Skills: 166,
  UI: 113,
} as const

export const HUB_TRADER_GEOMETRY: Readonly<Record<HubTraderId, {
  readonly position: Vector2
  readonly radius: number
  readonly region: HubRegionId
}>> = {
  fomentius: { position: { x: 1397, y: 664 }, radius: 30, region: 'courtyard' },
  hagatha: { position: { x: 1340, y: 280 }, radius: 15, region: 'courtyard' },
  luthacus: { position: { x: 1700.5, y: 449.5 }, radius: 25, region: 'courtyard' },
  shlorio: { position: { x: 900, y: 642.5 }, radius: 25, region: 'library' },
}

export function hubTraderWithinServiceRange(
  trader: HubTraderId,
  region: HubRegionId,
  playerPosition: Vector2,
): boolean {
  const geometry = HUB_TRADER_GEOMETRY[trader]
  if (region !== geometry.region) return false
  const dx = playerPosition.x - geometry.position.x
  const dy = playerPosition.y - geometry.position.y
  return dx * dx + dy * dy <= 5 * geometry.radius * geometry.radius + 1500
}

export function nearestHubTrader(
  region: HubRegionId,
  playerPosition: Vector2,
): HubTraderId | null {
  let nearest: { distanceSquared: number; trader: HubTraderId } | null = null
  for (const trader of Object.keys(HUB_TRADER_GEOMETRY) as HubTraderId[]) {
    if (!hubTraderWithinServiceRange(trader, region, playerPosition)) continue
    const geometry = HUB_TRADER_GEOMETRY[trader]
    const dx = playerPosition.x - geometry.position.x
    const dy = playerPosition.y - geometry.position.y
    const distanceSquared = dx * dx + dy * dy
    if (!nearest || distanceSquared < nearest.distanceSquared) {
      nearest = { distanceSquared, trader }
    }
  }
  return nearest?.trader ?? null
}

export function hubTraderAtPoint(
  region: HubRegionId,
  point: Vector2,
): HubTraderId | null {
  let nearest: { distanceSquared: number; trader: HubTraderId } | null = null
  for (const trader of Object.keys(HUB_TRADER_GEOMETRY) as HubTraderId[]) {
    const geometry = HUB_TRADER_GEOMETRY[trader]
    if (geometry.region !== region) continue
    const dx = point.x - geometry.position.x
    const dy = point.y - geometry.position.y
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared > geometry.radius * geometry.radius) continue
    if (!nearest || distanceSquared < nearest.distanceSquared) {
      nearest = { distanceSquared, trader }
    }
  }
  return nearest?.trader ?? null
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
