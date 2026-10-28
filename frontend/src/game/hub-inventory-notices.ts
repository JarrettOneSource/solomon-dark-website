import { nativeUnforgeOutcomeText, type NativeUnforgeOutcome } from './core-kernels/hub-economy.ts'
import type {
  HubInventoryRendererNotice,
} from './renderer/hub-inventory/model.ts'
import {
  hubStandardNoticeLayout,
  type HubStandardNotice,
} from './renderer/hub-inventory-render-contract.ts'

export type HubInventoryUiNotice = HubInventoryRendererNotice & {
  readonly unforgeItemId?: number
}

export function hubStandardNoticeActionRect(
  notice: HubStandardNotice,
): readonly [number, number, number, number] {
  const { height, left, top, width } = hubStandardNoticeLayout(notice).actionBounds
  return [left, top, width, height]
}

export const HUB_UNFORGE_CONFIRMATION_NOTICE: HubInventoryRendererNotice = {
  actionLabel: 'UNFORGE',
  body: 'Unforging grants you a permanent small bonus to your stats, but utterly destroys the item.',
  secondaryActionLabel: 'CANCEL',
  title: 'REALLY UNFORGE THIS?',
  variant: 'unforge-confirmation',
}

export function unforgeResultNotice(outcome: NativeUnforgeOutcome): HubInventoryUiNotice {
  const failed = outcome.kind === 'fizzle'
  return {
    actionLabel: 'OKAY',
    body: nativeUnforgeOutcomeText(outcome),
    outcomeTint: failed ? 0xff4040 : 0x40ff40,
    summary: failed ? 'Spellbreaking fizzles!' : 'Unforging bonus:',
    title: failed ? 'FAILED UNFORGING!' : `${outcome.itemName.toUpperCase()} UNFORGED`,
    variant: 'unforge-result',
  }
}
