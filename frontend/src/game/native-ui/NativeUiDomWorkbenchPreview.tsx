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
import NativeUiTypographyPreview from './NativeUiTypographyPreview.tsx'
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
          { bounds: nativeUiRect(60, 28, 180, 69), id: 'messages', label: 'MESSAGES' },
          { bounds: nativeUiRect(240, 28, 220, 69), id: 'menus', label: 'SIMPLE MENUS' },
          { bounds: nativeUiRect(460, 28, 190, 69), id: 'settings', label: 'SETTINGS' },
          { bounds: nativeUiRect(650, 28, 220, 69), id: 'boasts', label: 'BOAST MENU' },
          { bounds: nativeUiRect(870, 28, 160, 69), id: 'party', label: 'PARTY' },
          { bounds: nativeUiRect(1030, 28, 210, 69), id: 'chip', label: 'PARTY CHIP' },
          { bounds: nativeUiRect(1240, 28, 300, 69), id: 'typography', label: 'TYPOGRAPHY' },
        ]}
        width={1_600}
      />
      {selectedTab === 'typography' ? <NativeUiTypographyPreview /> : null}
      <div style={{ visibility: ['boasts', 'party', 'chip', 'typography'].includes(selectedTab) ? 'hidden' : undefined }}>
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
    </>
  )
}
