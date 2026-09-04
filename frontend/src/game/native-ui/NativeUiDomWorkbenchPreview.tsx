import { useState } from 'react'

import { NATIVE_BOASTS } from '../core-kernels/native-hub-npc.ts'
import NativeUiBoastMenu from './NativeUiBoastMenu.tsx'
import NativeUiPartyMenu from './NativeUiPartyMenu.tsx'
import NativeUiButton from './NativeUiButton.tsx'
import NativeUiMessageBox from './NativeUiMessageBox.tsx'
import NativeUiPartyChip from './NativeUiPartyChip.tsx'
import NativeUiPartyInvitation from './NativeUiPartyInvitation.tsx'
import {
  NativeUiSettingsAction,
  NativeUiSettingsRange,
  NativeUiSettingsToggle,
} from './NativeUiSettings.tsx'
import NativeUiSimpleMenu from './NativeUiSimpleMenu.tsx'
import NativeUiStoneButton from './NativeUiStoneButton.tsx'
import NativeUiTabs from './NativeUiTabs.tsx'
import {
  NativeDarkCloudColumns,
  NativeDarkCloudHeading,
  NativeDarkCloudPrimaryButton,
  NativeDarkCloudRowCells,
  NativeDarkCloudSceneArt,
  NativeDarkCloudStatusRow,
  NativeDarkCloudTabs,
  NativeDarkCloudToolButton,
} from './NativeDarkCloudPresentation.tsx'
import { NATIVE_DARK_CLOUD_COLUMNS, NATIVE_DARK_CLOUD_TEXT } from './native-dark-cloud-contract.ts'
import '../dark-cloud.css'
import { nativeUiRect } from './native-ui-plan.ts'
import type {
  NativeUiPartyMenuMember,
  NativeUiPartyMenuRequest,
  NativeUiPartyMenuVisibilityOption,
} from './native-ui-party-menu.ts'

const WORKBENCH_PARTY_MEMBERS: readonly NativeUiPartyMenuMember[] = [
  { id: 'solomon', name: 'Solomon', removable: false, tags: ['you', 'leader'] },
  { id: 'ash', name: 'Ash Whitlock', removable: true, tags: [] },
  { id: 'mira', name: 'Mira', removable: true, tags: ['offline'] },
  { id: 'ted', name: 'Ted Bramble', removable: true, tags: [] },
  { id: 'una', name: 'Una', removable: true, tags: [] },
  { id: 'vex', name: 'Vex Morrow', removable: true, tags: [] },
  { id: 'wren', name: 'Wren', removable: true, tags: [] },
]
const WORKBENCH_CHIP_MEMBERS = WORKBENCH_PARTY_MEMBERS.slice(0, 3)

const WORKBENCH_PARTY_REQUESTS: readonly NativeUiPartyMenuRequest[] = [
  { id: 'r1', name: 'Zed Halloway' },
]

const WORKBENCH_DARK_CLOUD_ROWS: readonly (readonly [string, string, string, string])[] = [
  ['Monument Crypt', 'Ash Whitlock', 'v1.4.0', 'enabled'],
  ['Cathedral of Rust', 'Mira', 'v0.9.2', 'not subscribed'],
  ['The Long Stair', 'Ted Bramble', 'v2.0.1', 'disabled'],
  ['Bell Tower Sortie', 'Wren', 'v1.0.0', 'not subscribed'],
]

const WORKBENCH_PARTY_VISIBILITY: readonly NativeUiPartyMenuVisibilityOption[] = [
  { id: 'public', label: 'PUBLIC' },
  { id: 'invite-only', label: 'INVITE ONLY' },
  { id: 'private', label: 'PRIVATE' },
]

export default function NativeUiDomWorkbenchPreview() {
  const [chipExpanded, setChipExpanded] = useState(false)
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
          { bounds: nativeUiRect(30, 28, 200, 69), id: 'messages', label: 'MESSAGES' },
          { bounds: nativeUiRect(230, 28, 240, 69), id: 'menus', label: 'SIMPLE MENUS' },
          { bounds: nativeUiRect(470, 28, 200, 69), id: 'settings', label: 'SETTINGS' },
          { bounds: nativeUiRect(670, 28, 230, 69), id: 'boasts', label: 'BOAST MENU' },
          { bounds: nativeUiRect(900, 28, 180, 69), id: 'party', label: 'PARTY' },
          { bounds: nativeUiRect(1080, 28, 230, 69), id: 'chip', label: 'PARTY CHIP' },
          { bounds: nativeUiRect(1310, 28, 260, 69), id: 'darkcloud', label: 'DARK CLOUD' },
        ]}
        width={1_600}
      />
      <div style={{ visibility: selectedTab === 'messages' || selectedTab === 'menus' || selectedTab === 'settings' ? undefined : 'hidden' }}>
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
      {selectedTab === 'party' ? (
        <NativeUiPartyMenu
          code="ABC123"
          leader
          leaveLabel="LEAVE PARTY"
          members={WORKBENCH_PARTY_MEMBERS}
          onClose={() => setSelectedTab('messages')}
          requests={WORKBENCH_PARTY_REQUESTS}
          visibility="invite-only"
          visibilityOptions={WORKBENCH_PARTY_VISIBILITY}
        />
      ) : null}
      {selectedTab === 'chip' ? (
        <>
          <NativeUiPartyChip
            expanded
            members={WORKBENCH_PARTY_MEMBERS}
            requests={WORKBENCH_PARTY_REQUESTS}
            settings
            style={{ left: 11, position: 'absolute', top: 174 }}
          />
          <NativeUiPartyChip
            error="Only the party leader can do that."
            expanded
            members={WORKBENCH_CHIP_MEMBERS}
            style={{ left: 280, position: 'absolute', top: 174 }}
          />
          <NativeUiPartyChip
            collapsible
            expanded={chipExpanded}
            members={WORKBENCH_CHIP_MEMBERS}
            onToggle={() => setChipExpanded(open => !open)}
            settings
            style={{ left: 280, position: 'absolute', top: 420, transform: 'scale(0.55)', transformOrigin: 'top left' }}
          />
          <NativeUiPartyChip
            collapsible
            expanded
            members={WORKBENCH_CHIP_MEMBERS}
            settings
            style={{ left: 420, position: 'absolute', top: 420, transform: 'scale(0.55)', transformOrigin: 'top left' }}
          />
          <NativeUiPartyInvitation
            dimAlpha={0}
            inviter="Wren Holloway"
            onAccept={() => setSelectedTab('messages')}
            onDeny={() => setSelectedTab('messages')}
          />
        </>
      ) : null}
      {selectedTab === 'darkcloud' ? (
        <div
          className="dark-cloud-scene"
          style={{ left: 80, position: 'absolute', top: 110, transform: 'scale(0.9)', transformOrigin: 'top left' }}
        >
          <NativeDarkCloudSceneArt />
          <NativeDarkCloudHeading accountUsername={null} onAccount={() => undefined} />
          <NativeDarkCloudTabs onSelect={() => undefined} selectedId="mods" />
          <main className="dark-cloud-list-frame">
            <NativeDarkCloudColumns columns={NATIVE_DARK_CLOUD_COLUMNS.mods} />
            <div className="dark-cloud-rows">
              {WORKBENCH_DARK_CLOUD_ROWS.map(([name, author, version, status], index) => (
                <div className="dark-cloud-row" key={name}>
                  <button aria-pressed={index === 1} className="dark-cloud-row-main" type="button">
                    <NativeDarkCloudRowCells
                      cells={[
                        { text: name },
                        { text: author },
                        { text: version },
                        { text: status, tint: status === 'enabled' ? NATIVE_DARK_CLOUD_TEXT.colors.green : undefined },
                      ]}
                      columns={NATIVE_DARK_CLOUD_COLUMNS.mods}
                      tint={index === 1 ? NATIVE_DARK_CLOUD_TEXT.colors.green : undefined}
                    />
                  </button>
                </div>
              ))}
              <NativeDarkCloudStatusRow text="CONSULTING THE DARK CLOUD..." />
            </div>
          </main>
          <footer className="dark-cloud-footer">
            <div className="dark-cloud-footer-tools">
              <NativeDarkCloudToolButton icon="search" label="Search" />
              <NativeDarkCloudToolButton icon="sort" label="Sort" />
            </div>
            <NativeDarkCloudPrimaryButton type="button">VIEW MOD</NativeDarkCloudPrimaryButton>
            <NativeDarkCloudToolButton className="dark-cloud-options-button" icon={null} label="OPTIONS" nativeWidth={185} />
          </footer>
        </div>
      ) : null}
    </>
  )
}
