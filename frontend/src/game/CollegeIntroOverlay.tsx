import type { NativeCollegeIntroState } from './core-kernels/native-college-intro.ts'
import { nativeCollegeTitlePresentation } from './core-kernels/native-college-intro.ts'
import { NativeUiSprite } from './native-ui/react-raw.ts'
import './college-intro.css'

export default function CollegeIntroOverlay({
  state,
}: {
  readonly state: NativeCollegeIntroState
}) {
  if (state.phase !== 'courtyard-walk') return null
  const title = nativeCollegeTitlePresentation(state.titleCursor, state.coverAlpha)
  return (
    <div
      className="college-intro-overlay"
      data-college-intro-phase={state.phase}
      data-college-intro-title-cursor={state.titleCursor}
      data-college-intro-title-record={title.record}
      role="img"
      aria-label={title.record === 7 ? 'Raptisoft Games presents' : 'Solomon Dark'}
    >
      <span
        className="college-intro-cover"
        style={{ opacity: state.coverAlpha }}
        aria-hidden
      />
      <NativeUiSprite
        atlas="Title"
        className="college-intro-title"
        record={title.record}
        style={{ opacity: title.alpha, top: title.y }}
      />
    </div>
  )
}
