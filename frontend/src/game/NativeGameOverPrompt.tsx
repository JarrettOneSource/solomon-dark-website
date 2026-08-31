import { NativeBitmapText } from './native-ui/react-raw.ts'

export default function NativeGameOverPrompt() {
  return (
    <NativeBitmapText
      className="game-over-prompt-text"
      font="menu"
      text="CLICK TO CONTINUE..."
      tint={0xd9ba70}
    />
  )
}
