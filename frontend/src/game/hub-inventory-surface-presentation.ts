import { nativeDyeMixedTint } from './core-kernels/hub-economy.ts'
import type { HubInventoryUiNotice } from './hub-inventory-notices.ts'
import { HUB_INTERACTION_DIALOGUES, hubInteractionDialogue } from './hub-inventory-presentation.ts'
import type { HubNpcChatPresentation, HubUiSurface } from './hub-inventory-ui-model.ts'
import { serviceInspectionTooltipText } from './hub-inventory-service-presentation.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from './protocol/game-state.ts'
import { hubStandardNoticeLayout } from './renderer/hub-inventory-render-contract.ts'
import type {
  HubInventoryDragModel,
  HubInventoryDyeModalModel,
  HubInventoryPressedControl,
  HubInventorySackTransitionModel,
  HubInventorySelectionModel,
  HubServiceInspectionModel,
} from './renderer/hub-inventory/model.ts'

export function hubInventorySurfaceLabel(surface: Exclude<HubUiSurface, null>, storyOffice: boolean): string {
  if (surface.kind === 'inventory') return 'Inventory'
  return surface.kind === 'dialogue'
    ? `Talking to ${hubInteractionDialogue(surface.interaction, storyOffice).name}`
    : HUB_INTERACTION_DIALOGUES[surface.trader].title
}

export function hubInventorySurfaceTooltip(
  surface: Exclude<HubUiSurface, null>,
  inspection: HubServiceInspectionModel | null,
  economy: ProtocolPlayerEconomy,
  progression: ProtocolPlayerProgression,
): string | null {
  return surface.kind !== 'dialogue' && inspection
    ? serviceInspectionTooltipText(inspection, economy, progression,
        surface.kind === 'service' ? surface.trader : 'hagatha')
    : null
}

function noticeDiagnostics(notice: HubInventoryUiNotice | null) {
  const layout = notice?.variant === 'standard' ? hubStandardNoticeLayout(notice) : null
  const rectangle = (bounds: { left: number; top: number; width: number; height: number }) => (
    [bounds.left, bounds.top, bounds.width, bounds.height].join(',')
  )
  return {
    'data-native-notice': notice?.title ?? '',
    'data-native-msgbox-action': layout ? rectangle(layout.actionBounds) : '',
    'data-native-msgbox-lines': layout
      ? layout.lines.map(({ text }) => text.replaceAll('\n', '\\n')).join('|') : '',
    'data-native-msgbox-frame': layout ? rectangle(layout.frameBounds) : '',
    'data-native-msgbox-panel': layout ? rectangle(layout.panelBounds) : '',
  }
}

function dyeDiagnostics(dyeModal: HubInventoryDyeModalModel | null) {
  return {
    'data-native-dye-modal': dyeModal
      ? `${dyeModal.targetItemId === null ? 'mix' : 'layer'}:${dyeModal.closingAtMs === null ? 'open' : 'closing'}`
      : '',
    'data-native-dye-selections': dyeModal?.swatchRows.join(',') ?? '',
    'data-native-dye-tub': dyeModal
      ? (nativeDyeMixedTint(dyeModal.swatchRows)?.toString(16).padStart(6, '0') ?? '') : '',
  }
}

export function hubInventorySurfaceDiagnostics({
  chat, dyeModal, inventoryDrag, inventorySelection, notice, pressedControl,
  sackPath, sackTransition, semanticTooltip, statsPage, surface,
}: {
  chat: HubNpcChatPresentation
  dyeModal: HubInventoryDyeModalModel | null
  inventoryDrag: HubInventoryDragModel | null
  inventorySelection: HubInventorySelectionModel | null
  notice: HubInventoryUiNotice | null
  pressedControl: HubInventoryPressedControl
  sackPath: readonly number[]
  sackTransition: HubInventorySackTransitionModel | null
  semanticTooltip: string | null
  statsPage: number
  surface: Exclude<HubUiSurface, null>
}) {
  return {
    ...noticeDiagnostics(notice),
    ...dyeDiagnostics(dyeModal),
    'data-native-pressed-control': pressedControl ?? 'none',
    'data-native-chat-phase': surface.kind === 'dialogue' ? chat.content.kind : '',
    'data-native-chat-record': surface.kind === 'dialogue' && chat.content.kind === 'speech'
      ? chat.content.key : '',
    'data-native-inventory-selection': inventorySelection
      ? `${inventorySelection.owner}:${inventorySelection.equipmentSlot ?? inventorySelection.id}` : '',
    'data-native-inventory-dragging': inventoryDrag
      ? `${inventoryDrag.owner}:${inventoryDrag.equipmentSlot ?? inventoryDrag.itemId}` : '',
    'data-native-sack-path': sackPath.join('/'),
    'data-native-sack-transition': sackTransition?.direction ?? '',
    'data-native-stats-page': statsPage,
    'data-native-tooltip': semanticTooltip ?? '',
  }
}
