import { NativeUiText } from './native-ui/react-raw.ts'
import './loot-message-presentation.css'

interface NativeLootBitmapTextProps {
  readonly text: string
  readonly tint: number
  readonly scale: number
}

export default function NativeLootBitmapText({ text, tint, scale }: NativeLootBitmapTextProps) {
  return (
    <NativeUiText
      className="boneyard-loot-bitmap-text"
      font="body"
      align="center"
      placement="baseline"
      scale={scale}
      text={text}
      tint={tint}
    />
  )
}
