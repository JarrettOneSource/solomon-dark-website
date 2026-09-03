import { useState } from 'react'

import { NATIVE_BOASTS } from '../core-kernels/native-hub-npc.ts'
import NativeUiBoastMenu from './NativeUiBoastMenu.tsx'
import NativeUiButton from './NativeUiButton.tsx'
import NativeUiMessageBox from './NativeUiMessageBox.tsx'
import {
  NativeUiSettingsAction,
  NativeUiSettingsRange,
  NativeUiSettingsToggle,
} from './NativeUiSettings.tsx'
import NativeUiSimpleMenu from './NativeUiSimpleMenu.tsx'
import NativeUiStoneButton from './NativeUiStoneButton.tsx'
import NativeUiTabs from './NativeUiTabs.tsx'
import { nativeUiRect } from './native-ui-plan.ts'

export default function NativeUiDomWorkbenchPreview() {
  const [enabled, setEnabled] = useState(true)
  const [selectedTab, setSelectedTab] = useState('messages')
  const [selectedBoast, setSelectedBoast] = useState<string | null>(null)
  const [volume, setVolume] = useState(65)
  return (
    <>
      <NativeUiTabs
        ariaLabel="UI Kit examples"
        height={900}
        onSelect={setSelectedTab}
        selectedId={selectedTab}
        tabs={[
          { bounds: nativeUiRect(185, 28, 220, 69), id: 'messages', label: 'MESSAGES' },
          { bounds: nativeUiRect(405, 28, 260, 69), id: 'menus', label: 'SIMPLE MENUS' },
          { bounds: nativeUiRect(665, 28, 250, 69), id: 'settings', label: 'SETTINGS' },
          { bounds: nativeUiRect(915, 28, 260, 69), id: 'boasts', label: 'BOAST MENU' },
        ]}
        width={1_600}
      />
      <div style={{ visibility: selectedTab === 'boasts' ? 'hidden' : undefined }}>
        <NativeUiMessageBox
        body="Every panel, glyph, button, and tab in this preview is composed from the stock atlas record and bitmap-font ABI."
        bounds={nativeUiRect(500, 125, 600, 400)}
        dimAlpha={0.35}
        title="STOCK UI BUILDING BLOCKS"
      >
        <NativeUiButton name="accept">ACCEPT</NativeUiButton>
        <NativeUiButton name="cancel">CANCEL</NativeUiButton>
      </NativeUiMessageBox>
      <NativeUiButton
        disabled
        name="disabled-example"
        nativeBounds={nativeUiRect(623.5, 790, 353, 69)}
        style={{ zIndex: 2 }}
      >
        DISABLED STOCK ACTION
      </NativeUiButton>
      <NativeUiStoneButton
        name="stone-action"
        style={{ left: 650, position: 'absolute', top: 730, zIndex: 2 }}
      >
        DONE
      </NativeUiStoneButton>
      <NativeUiSimpleMenu
        ariaLabel="SimpleMenu example"
        centerX={270}
        dimAlpha={0}
        firstRowTop={610}
        onAction={() => undefined}
        reveal={1}
        rows={[
          { id: 'resume', label: 'RESUME GAME' },
          { id: 'settings', label: 'GAME SETTINGS' },
        ]}
      />
        <div
          data-native-ui-settings-controls
          style={{ left: 1_010, position: 'absolute', top: 610, width: 560, zIndex: 2 }}
        >
          <NativeUiSettingsToggle
            checked={enabled}
            label="ENHANCED EFFECTS"
            onChange={setEnabled}
          />
          <NativeUiSettingsRange
            label="SOUND VOL:"
            maximum={100}
            minimum={0}
            onChange={setVolume}
            value={volume}
          />
          <NativeUiSettingsAction label="CUSTOMIZE CONTROLS" onClick={() => undefined} />
        </div>
      </div>
      {selectedTab === 'boasts' ? (
        <NativeUiBoastMenu
          items={NATIVE_BOASTS.map(boast => ({
            detail: boast.statement,
            id: `native:${boast.id}`,
            label: boast.label,
            stockIconRecord: boast.iconRecord,
          }))}
          onDone={() => setSelectedTab('messages')}
          onSelect={setSelectedBoast}
          selectedId={selectedBoast}
        />
      ) : null}
    </>
  )
}
