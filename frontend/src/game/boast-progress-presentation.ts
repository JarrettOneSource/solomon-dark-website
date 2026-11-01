import type { BoastState } from './core-kernels/boast.ts'
import { NATIVE_BOASTS } from './core-kernels/native-hub-npc.ts'
import type { ModContentProjection } from './protocol/game-mod-contract.ts'
import {
  layoutNativeUiText,
  nativeUiRect,
  type NativeUiFragment,
  type NativeUiNode,
  type NativeUiTextSpec,
} from './native-ui/core.ts'

export interface BoastProgressPresentation {
  readonly name: string
  readonly statement: string
  readonly status: '' | 'Active' | 'Achieved' | 'Failed'
  readonly tint: number
}

/** Requested Skills-book view shared with the accepted Rust Boast presentation. */
export function boastProgressPresentation(
  state: BoastState,
  content: ModContentProjection | null,
): BoastProgressPresentation {
  const selected = state.selected
  if (selected === null) return {
    name: 'No Boast selected',
    statement: 'Choose a Boast from Provokatus in the College.',
    status: '',
    tint: 0x808080,
  }
  const definition = typeof selected === 'number'
    ? NATIVE_BOASTS.find(boast => boast.id === selected)
    : content?.boasts.find(boast => (
      boast.modId === selected.modId && boast.contentId === selected.contentId
    ))
  if (!definition) return {
    name: 'Boast unavailable',
    statement: "This Boast's content is not installed.",
    status: '',
    tint: 0x808080,
  }
  return {
    name: 'label' in definition ? definition.label : definition.name,
    statement: definition.statement,
    status: state.failed ? 'Failed' : state.succeeded ? 'Achieved' : 'Active',
    tint: state.failed ? 0xe08080 : state.succeeded ? 0x97c797 : 0xd9ba70,
  }
}

export function planBoastProgress(progress: BoastProgressPresentation): NativeUiFragment {
  const name: NativeUiTextSpec = {
    font: 'menu', lineHeight: 32, maxWidth: 560,
    text: progress.name, tint: progress.tint, x: 800, y: 300,
  }
  const statusY = name.y + layoutNativeUiText(name).height + 35
  const statement: NativeUiTextSpec = {
    font: 'body', lineHeight: 24, maxWidth: 560,
    text: progress.statement, tint: 0xbfbfbf, x: 800,
    y: statusY + (progress.status ? 45 : 0),
  }
  const card = nativeUiRect(490, 240, 620,
    statement.y - 240 + layoutNativeUiText(statement).height + 35)
  const nodes: NativeUiNode[] = [
    { alpha: 0.95, bounds: card, color: 0x100d0a, kind: 'solid' },
    ...[
      nativeUiRect(card.left, card.top, card.width, 2),
      nativeUiRect(card.left, card.top + card.height - 2, card.width, 2),
      nativeUiRect(card.left, card.top, 2, card.height),
      nativeUiRect(card.left + card.width - 2, card.top, 2, card.height),
    ].map(bounds => ({ bounds, color: progress.tint, kind: 'solid' as const })),
    { kind: 'text', text: name },
  ]
  if (progress.status) nodes.push({
    kind: 'text',
    text: { font: 'menu', text: progress.status, tint: progress.tint, x: 800, y: statusY },
  })
  nodes.push({ kind: 'text', text: statement })
  return { actions: [], nodes }
}
