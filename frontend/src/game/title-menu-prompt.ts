import {
  nativeUiRect,
  planNativeUiMessage,
  type NativeUiButtonState,
  type NativeUiPlan,
} from './native-ui/core.ts'

export type TitleMenuPromptAction = 'prompt-primary' | 'prompt-secondary'
export type TitleMenuPromptKind = 'kill-wizard' | 'tutorial'

export interface TitleMenuPromptCopy {
  readonly accessibleBody: string
  readonly accessibleTitle: string
  readonly body: string
  readonly primaryLabel: string
  readonly secondaryLabel: string
  readonly title: string
}

export interface TitleMenuPromptFrame {
  readonly busy: boolean
  readonly hoveredAction: TitleMenuPromptAction | null
  readonly kind: TitleMenuPromptKind
  readonly pressedAction: TitleMenuPromptAction | null
}

export const NATIVE_KILL_CHARACTER_TITLE = 'Kill character?'
export const NATIVE_KILL_CHARACTER_BODY =
  'Starting a new game will kill off your current game and character (Lucritius will scavenge his equipment)!'
export const NATIVE_KILL_CHARACTER_QUESTION = 'Are you sure you want to do this?'

export const STOCK_PROMPT_BOUNDS = nativeUiRect(550, 268, 500, 362)
export const STOCK_PROMPT_PRIMARY_BOUNDS = nativeUiRect(595, 484, 200, 69)
export const STOCK_PROMPT_SECONDARY_BOUNDS = nativeUiRect(811, 484, 200, 69)

export const TITLE_MENU_PROMPT_COPY: Readonly<Record<TitleMenuPromptKind, TitleMenuPromptCopy>> = {
  'kill-wizard': {
    accessibleBody: `${NATIVE_KILL_CHARACTER_BODY} ${NATIVE_KILL_CHARACTER_QUESTION}`,
    accessibleTitle: NATIVE_KILL_CHARACTER_TITLE,
    body: [
      'Starting a new game will kill off your',
      'current game and character (Lucritius',
      'will scavenge his equipment)!',
      NATIVE_KILL_CHARACTER_QUESTION,
    ].join('\n'),
    primaryLabel: 'YES',
    secondaryLabel: 'NO',
    title: NATIVE_KILL_CHARACTER_TITLE,
  },
  tutorial: {
    accessibleBody: 'Learn the controls and confront Solomon Dark before beginning your first game.',
    accessibleTitle: 'Play the Tutorial?',
    body: [
      'Learn the controls and confront',
      'Solomon Dark before beginning your',
      'first game.',
    ].join('\n'),
    primaryLabel: 'YES',
    secondaryLabel: 'NO',
    title: 'PLAY THE TUTORIAL?',
  },
}

export function planTitleMenuPrompt(
  frame: TitleMenuPromptFrame,
  dimAlpha: number,
): NativeUiPlan {
  const copy = TITLE_MENU_PROMPT_COPY[frame.kind]
  return planNativeUiMessage({
    actions: [
      {
        bounds: STOCK_PROMPT_PRIMARY_BOUNDS,
        id: 'prompt-primary',
        label: copy.primaryLabel,
        state: promptButtonState(frame, 'prompt-primary'),
      },
      {
        bounds: STOCK_PROMPT_SECONDARY_BOUNDS,
        id: 'prompt-secondary',
        label: copy.secondaryLabel,
        state: promptButtonState(frame, 'prompt-secondary'),
      },
    ],
    body: copy.body,
    bounds: STOCK_PROMPT_BOUNDS,
    dimAlpha,
    height: 900,
    title: copy.title,
    width: 1_600,
  })
}

function promptButtonState(
  frame: TitleMenuPromptFrame,
  action: TitleMenuPromptAction,
): NativeUiButtonState {
  if (frame.busy) return 'disabled'
  if (frame.pressedAction === action) return 'pressed'
  if (frame.hoveredAction === action) return 'focused'
  return 'idle'
}
