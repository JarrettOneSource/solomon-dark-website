import { useState, type ReactNode } from 'react'

import {
  NativeDarkCloudPanelArt,
  NativeDarkCloudText,
  NativeUiControlPanel,
  NativeUiControlPanelAction,
  NativeUiControlPanelField,
  NativeUiDialog,
} from './native-ui/react.ts'

export type DarkCloudSort = 'downloads' | 'members' | 'name' | 'newest' | 'updated'

export function DarkCloudSearchDialog({ initialQuery, onClose, onSearch, parties }: {
  initialQuery: string
  onClose: () => void
  onSearch: (query: string) => void
  parties: boolean
}) {
  const [query, setQuery] = useState(initialQuery)
  return (
    <DarkCloudDialog kind="search" onClose={onClose} title="SEARCH THE DARK CLOUD">
      <form onSubmit={event => { event.preventDefault(); onSearch(query) }}>
        <NativeUiControlPanel>
          <NativeUiControlPanelField
            autoFocus
            clearLabel="Clear search text"
            id="dark-cloud-search-input"
            label={parties ? 'LEADER, MEMBER, OR BONEYARD:' : 'MOD, AUTHOR, OR TAG:'}
            onChange={event => setQuery(event.target.value)}
            onClear={() => setQuery('')}
            value={query}
          />
        </NativeUiControlPanel>
        <NativeUiControlPanel>
          <NativeUiControlPanelAction type="submit">SEARCH NOW</NativeUiControlPanelAction>
        </NativeUiControlPanel>
      </form>
    </DarkCloudDialog>
  )
}

export function DarkCloudSortDialog({ onClose, onSort, parties, sort }: {
  onClose: () => void
  onSort: (sort: DarkCloudSort) => void
  parties: boolean
  sort: DarkCloudSort
}) {
  const choices: readonly (readonly [DarkCloudSort, string])[] = parties
    ? [['members', 'MOST WIZARDS'], ['name', 'LEADER NAME']]
    : [['newest', 'NEWEST'], ['updated', 'UPDATED RECENTLY'], ['downloads', 'MOST DOWNLOADED'], ['name', 'NAME']]
  return (
    <DarkCloudDialog kind="sort" onClose={onClose} title={parties ? 'SORT PARTIES BY...' : 'SORT MODS BY...'}>
      <NativeUiControlPanel aria-label="Sort order" role="group">
        {choices.map(([value, label]) => (
          <NativeUiControlPanelAction
            aria-pressed={sort === value}
            autoFocus={sort === value}
            key={value}
            onClick={() => onSort(value)}
            selected={sort === value}
          >
            {label}
          </NativeUiControlPanelAction>
        ))}
      </NativeUiControlPanel>
    </DarkCloudDialog>
  )
}

function DarkCloudDialog({ children, kind, onClose, title }: {
  children: ReactNode
  kind: 'search' | 'sort'
  onClose: () => void
  title: string
}) {
  return (
    <NativeUiDialog aria-label={title} className={`dark-cloud-modal dark-cloud-modal-${kind} dark-cloud-panel`} onDismiss={onClose}>
      <NativeDarkCloudPanelArt />
      <div className="dark-cloud-panel-body">
        <h2 className="dark-cloud-panel-caption"><NativeDarkCloudText font="medium" scale={1} text={title} /></h2>
        {children}
      </div>
    </NativeUiDialog>
  )
}
