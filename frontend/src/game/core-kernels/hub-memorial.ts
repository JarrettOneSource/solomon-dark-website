import type { PlayerCharacterConfig } from './player-character.ts'
import type { PlayerLivingEquipmentAppearance } from './player-equipment-appearance.ts'

export const HUB_MEMORIAL_SLOT_COUNT = 10
export const HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID = 100
export const HUB_MEMORIAL_LAST_EXTERNAL_PORTRAIT_ID = 109
export const HUB_MEMORIAL_INITIAL_SLOT_AGES = Object.freeze([
  9, 1, 0, 2, 7, 4, 3, 8, 5, 6,
])
export const HUB_MEMORIAL_INITIAL_MARKERS = Object.freeze([
  false, true, true, true, false, true, true, false, false, true,
])
export const HUB_MEMORIAL_INTERACTION_IDS = Object.freeze([
  'painting-0',
  'painting-1',
  'painting-100',
  'painting-3',
  'painting-4',
  'painting-5',
  'painting-6',
  'painting-7',
  'painting-8',
  'painting-9',
])

export interface HubMemorialPortrait {
  readonly capturedAtTick: number
  readonly config: PlayerCharacterConfig
  readonly equipment: PlayerLivingEquipmentAppearance
  readonly headingIndex: number
  readonly playerId: string
  readonly portraitScale: number
  readonly runId: string
}

export interface HubMemorialSlot {
  readonly age: number
  readonly marker: boolean
  readonly portrait: HubMemorialPortrait | null
  readonly portraitId: number
}

export interface HubMemorialState {
  readonly nextAge: number
  readonly nextPortraitId: number
  readonly slots: readonly HubMemorialSlot[]
}

export function createHubMemorialState(): HubMemorialState {
  return {
    nextAge: 1001,
    nextPortraitId: HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID,
    slots: HUB_MEMORIAL_INITIAL_SLOT_AGES.map((age, index) => ({
      age,
      marker: HUB_MEMORIAL_INITIAL_MARKERS[index]!,
      portrait: null,
      portraitId: index,
    })),
  }
}

export function archiveHubMemorialPortrait(
  state: HubMemorialState,
  portrait: HubMemorialPortrait,
  markerDraw: number,
): HubMemorialState {
  if (!Number.isSafeInteger(markerDraw) || markerDraw < 0 || markerDraw >= 5) {
    throw new RangeError('Memorial marker draw must be an integer within 0..4')
  }
  if (state.slots.some(({ portrait: current }) => (
    current?.runId === portrait.runId && current.playerId === portrait.playerId
  ))) return state

  let replacementIndex = 0
  for (let index = 1; index < state.slots.length; index += 1) {
    if (state.slots[index]!.age < state.slots[replacementIndex]!.age) {
      replacementIndex = index
    }
  }
  const slots = state.slots.map((slot, index): HubMemorialSlot => index === replacementIndex
    ? {
        age: state.nextAge,
        marker: markerDraw !== 3,
        portrait: copyHubMemorialPortrait(portrait),
        portraitId: state.nextPortraitId,
      }
    : slot)
  return {
    nextAge: state.nextAge + 1,
    nextPortraitId: state.nextPortraitId === HUB_MEMORIAL_LAST_EXTERNAL_PORTRAIT_ID
      ? HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID
      : state.nextPortraitId + 1,
    slots,
  }
}

export function copyHubMemorialState(state: HubMemorialState): HubMemorialState {
  return {
    nextAge: state.nextAge,
    nextPortraitId: state.nextPortraitId,
    slots: state.slots.map((slot) => ({
      ...slot,
      portrait: slot.portrait === null
        ? null
        : copyHubMemorialPortrait(slot.portrait),
    })),
  }
}

export function hubMemorialSlotIndexForInteraction(interactionId: string): number | null {
  const index = HUB_MEMORIAL_INTERACTION_IDS.indexOf(interactionId)
  return index < 0 ? null : index
}

function copyHubMemorialPortrait(portrait: HubMemorialPortrait): HubMemorialPortrait {
  return {
    ...portrait,
    config: { ...portrait.config },
    equipment: {
      ...portrait.equipment,
      hat: portrait.equipment.hat === null ? null : { ...portrait.equipment.hat },
      robe: portrait.equipment.robe === null ? null : { ...portrait.equipment.robe },
      weapon: portrait.equipment.weapon === null ? null : { ...portrait.equipment.weapon },
    },
  }
}
