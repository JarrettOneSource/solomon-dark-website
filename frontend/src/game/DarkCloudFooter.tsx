import type { ReactNode } from 'react'

import type { DarkCloudRow, DarkCloudTab } from './DarkCloudRows.tsx'
import type { GameContentDownloadProgress } from './game-content-cache.ts'
import { directoryPartyAction } from './party-directory.ts'
import { NativeDarkCloudPrimaryButton, NativeDarkCloudText, NativeDarkCloudToolButton, NativeUiButton, NativeUiControlPanel } from './native-ui/react.ts'

interface DarkCloudFooterProps {
  onPrimary: () => void
  onSearch: () => void
  onSort: () => void
  partyBusy: boolean
  progress: GameContentDownloadProgress | null
  selected: DarkCloudRow | null
  status: ReactNode
  tab: DarkCloudTab
}

export function DarkCloudFooter({ onPrimary, onSearch, onSort, partyBusy, progress, selected, status, tab }: DarkCloudFooterProps) {
  const partyAction = selected?.kind === 'party' ? directoryPartyAction(selected.party) : null
  const label = tab === 'parties'
    ? partyAction === null ? 'SELECT PARTY' : { join: 'JOIN PARTY', request: 'REQUEST TO JOIN', wait: 'IN GAME' }[partyAction]
    : 'VIEW MOD'
  const disabled = tab === 'parties'
    ? partyAction === null || partyAction === 'wait' || partyBusy
    : selected?.kind !== 'mod'
  return (
    <footer className="dark-cloud-footer">
      <DarkCloudDownloadProgress progress={progress} />
      {tab !== 'layouts' ? (
        <>
          <div className="dark-cloud-footer-tools">
            <NativeDarkCloudToolButton icon="search" label="Search" onClick={onSearch} />
            <NativeDarkCloudToolButton icon="sort" label="Sort" onClick={onSort} />
          </div>
          <NativeDarkCloudPrimaryButton disabled={disabled} onClick={onPrimary}>{label}</NativeDarkCloudPrimaryButton>
          <NativeDarkCloudToolButton className="dark-cloud-options-button" disabled={selected?.kind !== 'mod'} icon={null} label="OPTIONS" nativeWidth={185} onClick={onPrimary} />
          <div className="dark-cloud-footer-status">{status}</div>
        </>
      ) : null}
    </footer>
  )
}

export function DarkCloudStatus({ count, loading, onClear, onRefresh, query, tab }: {
  count: number
  loading: boolean
  onClear: () => void
  onRefresh: () => void
  query: string
  tab: DarkCloudTab
}) {
  return (
    <>
      <span className="dark-cloud-status-label"><NativeDarkCloudText content font="medium" scale={0.85} text={statusLabel(tab, count, query, loading)} /></span>
      {loading && count > 0 ? <span className="dark-cloud-status-note"><NativeDarkCloudText font="medium" scale={0.85} text="REFRESHING..." /></span> : null}
      {query ? <NativeUiButton height={44} onClick={onClear} scale={0.55} width="fill">CLEAR SEARCH</NativeUiButton> : null}
      {tab === 'parties' ? <NativeUiButton data-dark-cloud-refresh height={44} onClick={onRefresh} scale={0.55} width="fill">REFRESH</NativeUiButton> : null}
    </>
  )
}

function DarkCloudDownloadProgress({
  progress,
}: {
  progress: GameContentDownloadProgress | null
}) {
  if (!progress || progress.totalBytes === 0) return null
  const percent = Math.min(100, Math.round(progress.completedBytes / progress.totalBytes * 100))
  return (
    <NativeUiControlPanel
      className="dark-cloud-download"
      variant="field"
      role="progressbar"
      aria-label="Downloading mod content"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="dark-cloud-download-track"><span className="dark-cloud-download-fill" style={{ width: `${percent}%` }} /></div>
      <small><NativeDarkCloudText font="medium" scale={1} text={`${progress.active ? 'DOWNLOADING MOD CONTENT' : 'CONTENT READY'}, ${percent}%`} /></small>
    </NativeUiControlPanel>
  )
}

function statusLabel(tab: DarkCloudTab, count: number, query: string, loading: boolean): string {
  if (tab === 'layouts') return 'MOBILE UI LAYOUTS'
  if (loading && count === 0) return 'CONSULTING THE DARK CLOUD...'
  if (query) return `"${query.toUpperCase()}", ${count} ${count === 1 ? 'MATCH' : 'MATCHES'}`
  if (tab === 'parties') return `${count} ${count === 1 ? 'PARTY' : 'PARTIES'}`
  if (tab === 'subscribed') return `${count} SUBSCRIBED`
  return `${count} ${count === 1 ? 'MOD' : 'MODS'}`
}
