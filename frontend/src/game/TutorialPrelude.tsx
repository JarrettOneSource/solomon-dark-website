import NativeUiSprite from './native-ui/NativeUiSprite.tsx'
import './tutorial.css'

const TUTORIAL_GOLD = 0xd9ba70

interface TutorialPreludeProps {
  readonly blend?: number
  readonly fade?: number
}

export default function TutorialPrelude({
  blend = 0,
  fade = 1,
}: TutorialPreludeProps) {
  return (
    <div
      aria-label="Midnight, six months ago"
      className="tutorial-prelude"
      role="img"
      style={{ backgroundColor: `rgb(0 0 0 / ${fade})` }}
    >
      <NativeUiSprite
        atlas="UI"
        className="tutorial-prelude-skull"
        record={68}
        style={{
          opacity: blend * blend,
          top: `calc(50% - ${100 * (1 + blend)}px)`,
        }}
      />
      <NativeUiSprite
        atlas="UI"
        className="tutorial-prelude-record"
        maskTint={TUTORIAL_GOLD}
        record={43}
      />
    </div>
  )
}
