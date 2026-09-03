import { NativeDarkCloudPanelArt } from './native-ui/react.ts'

interface DarkCloudPanelOrnamentsProps {
  /** Pentagram-skull flourishes outside the left/right frame lines. */
  flourishes?: boolean
}

/**
 * Dressing shared by every framed Dark Cloud panel (search, sort, mod details):
 * the native dialog's gold filigree corners and its side flourishes. Purely
 * decorative, so every image is alt="".
 */
export default function DarkCloudPanelOrnaments({
  flourishes = true,
}: DarkCloudPanelOrnamentsProps) {
  return <NativeDarkCloudPanelArt flourishes={flourishes} />
}
