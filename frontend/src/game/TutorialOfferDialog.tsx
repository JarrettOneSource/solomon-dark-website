import NativeBitmapText from './native-ui/NativeBitmapText.tsx'
import './tutorial.css'

interface TutorialOfferDialogProps {
  readonly onNo: () => void
  readonly onYes: () => void
}

export default function TutorialOfferDialog({ onNo, onYes }: TutorialOfferDialogProps) {
  return (
    <div className="tutorial-offer-backdrop">
      <section
        aria-describedby="tutorial-offer-copy"
        aria-labelledby="tutorial-offer-title"
        aria-modal="true"
        className="tutorial-offer-dialog"
        role="dialog"
      >
        <h2 className="tutorial-offer-title" id="tutorial-offer-title">
          <span className="sr-only">Play the Tutorial?</span>
          <NativeBitmapText
            align="center"
            font="menu"
            text="PLAY THE TUTORIAL?"
            tint={0xe7cc71}
          />
        </h2>
        <p className="tutorial-offer-copy" id="tutorial-offer-copy">
          Learn the controls and confront Solomon Dark before beginning your first game.
        </p>
        <div className="tutorial-offer-actions">
          <button autoFocus onClick={onYes} type="button">YES</button>
          <button onClick={onNo} type="button">NO</button>
        </div>
      </section>
    </div>
  )
}
