import fontsAtlas from '../../assets/game/skill-picker-fonts-atlas.png'
import uiAtlas from '../../assets/game/skill-picker-ui-atlas.png'
import type { NativeUiAtlasName } from './native-ui-catalog.ts'

const sources = { Fonts: fontsAtlas, UI: uiAtlas }

export function nativeUiAtlasSource(name: NativeUiAtlasName): string {
  return sources[name]
}
