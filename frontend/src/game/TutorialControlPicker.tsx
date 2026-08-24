import NativeBitmapText from './native-ui/NativeBitmapText.tsx'
import NativeUiSprite from './native-ui/NativeUiSprite.tsx'
import './tutorial.css'

export type TutorialControlScheme = 'arrows' | 'wasd'

interface TutorialControlPickerProps {
  readonly busy: boolean
  readonly onChoose: (scheme: TutorialControlScheme) => void
  readonly selected: TutorialControlScheme | null
}

export default function TutorialControlPicker({
  busy,
  onChoose,
  selected,
}: TutorialControlPickerProps) {
  return (
    <div
      aria-label="Select a control scheme"
      className="tutorial-control-picker"
      data-committed={selected !== null}
    >
      <NativeBitmapText
        align="center"
        className="tutorial-control-picker-heading"
        font="heading"
        text="SELECT A CONTROL SCHEME"
        tint={0xd9ba70}
      />
      <button
        autoFocus
        aria-label="Arrow keys and mouse"
        className="tutorial-control-choice tutorial-control-choice-arrows"
        data-selected={selected === 'arrows' || undefined}
        disabled={busy}
        onClick={() => onChoose('arrows')}
        type="button"
      >
        <NativeUiSprite atlas="Controls" record={0} />
      </button>
      <button
        aria-label="WASD and mouse"
        className="tutorial-control-choice tutorial-control-choice-wasd"
        data-selected={selected === 'wasd' || undefined}
        disabled={busy}
        onClick={() => onChoose('wasd')}
        type="button"
      >
        <NativeUiSprite atlas="Controls" record={2} />
      </button>
    </div>
  )
}
