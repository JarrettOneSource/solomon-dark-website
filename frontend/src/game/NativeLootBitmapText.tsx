import NativeBitmapText from './native-ui/NativeBitmapText.tsx'

interface NativeLootBitmapTextProps {
  readonly text: string
  readonly tint: number
}

export default function NativeLootBitmapText({ text, tint }: NativeLootBitmapTextProps) {
  return (
    <NativeBitmapText
      className="boneyard-loot-bitmap-text"
      font="body"
      text={text}
      tint={tint}
    />
  )
}
