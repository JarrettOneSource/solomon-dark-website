import boneditAtlas from '../../assets/game/native-ui-bonedit-atlas.png'
import controlPanelAtlas from '../../assets/game/settings-control-panel-atlas.png'
import controlsAtlas from '../../assets/game/native-ui-controls-atlas.png'
import createAtlas from '../../assets/game/native-ui-create-atlas.png'
import fontsAtlas from '../../assets/game/skill-picker-fonts-atlas.png'
import gameOverAtlas from '../../assets/game/native-ui-game-over-atlas.png'
import inventoryAtlas from '../../assets/game/hub-trader-inventory-atlas.png'
import levelPickerAtlas from '../../assets/game/native-ui-level-picker-atlas.png'
import libraryAtlas from '../../assets/game/native-ui-library-atlas.png'
import loaderAtlas from '../../assets/game/native-ui-loader-atlas.png'
import skillsAtlas from '../../assets/game/skill-picker-skills-atlas.png'
import titleAtlas from '../../assets/game/native-ui-title-atlas.png'
import uiAtlas from '../../assets/game/skill-picker-ui-atlas.png'
import type { NativeUiAtlasName } from './native-ui-catalog.ts'

export const NATIVE_UI_ATLAS_SOURCES = Object.freeze({
  Bonedit: boneditAtlas,
  ControlPanel: controlPanelAtlas,
  Controls: controlsAtlas,
  Create: createAtlas,
  Fonts: fontsAtlas,
  GameOver: gameOverAtlas,
  Inventory: inventoryAtlas,
  LevelPicker: levelPickerAtlas,
  Library: libraryAtlas,
  Loader: loaderAtlas,
  Skills: skillsAtlas,
  Title: titleAtlas,
  UI: uiAtlas,
} satisfies Readonly<Record<NativeUiAtlasName, string>>)

export function nativeUiAtlasSource(name: NativeUiAtlasName): string {
  return NATIVE_UI_ATLAS_SOURCES[name]
}
