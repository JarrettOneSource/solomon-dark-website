import { NativeUiText } from './native-ui/react-raw.ts'

export default function NativeGameOverPrompt() {
  return (
    <NativeUiText
      align="center"
      className="game-over-prompt-text"
      font="menu"
      placement="baseline"
      text="CLICK TO CONTINUE..."
      tint={0xd9ba70}
    />
  )
}
