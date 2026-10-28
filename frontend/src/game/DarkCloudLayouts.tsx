import { useState, type FormEvent } from 'react'

import type { SharedMobileUiLayout } from '../lib/api.ts'
import { readMobileUiLayoutState } from './mobile-ui-layout.ts'
import { loadSharedMobileUiLayout, publishCurrentMobileUiLayout } from './mobile-ui-sharing.ts'
import { NativeDarkCloudText, NativeUiButton, NativeUiControlPanel, NativeUiControlPanelAction, NativeUiControlPanelField } from './native-ui/react.ts'

type LayoutAction = 'load' | 'publish'

export default function DarkCloudLayouts({ accountUsername }: { accountUsername: string | null }) {
  const customized = readMobileUiLayoutState().customized
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<LayoutAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ action: LayoutAction; layout: SharedMobileUiLayout } | null>(null)
  const [copied, setCopied] = useState(false)

  const run = async (action: LayoutAction) => {
    if (busy) return
    if (action === 'load' && code.length !== 9) return
    if (action === 'publish' && (accountUsername === null || !customized)) return
    setBusy(action)
    setError(null)
    setReceipt(null)
    setCopied(false)
    try {
      const layout = action === 'load' ? await loadSharedMobileUiLayout(code) : await publishCurrentMobileUiLayout()
      setCode(layout.code)
      setReceipt({ action, layout })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The layout could not be shared.')
    } finally {
      setBusy(null)
    }
  }

  const load = (event: FormEvent) => {
    event.preventDefault()
    void run('load')
  }

  const copy = async () => {
    if (!receipt) return
    try {
      await navigator.clipboard.writeText(receipt.layout.code)
      setCopied(true)
      setError(null)
    } catch {
      setError('The code could not be copied.')
    }
  }

  return (
    <section className="dark-cloud-layouts" aria-label="Shared mobile UI layouts">
      <header><h2><NativeDarkCloudText scale={1} text="MOBILE UI LAYOUTS" /></h2></header>
      <div className="dark-cloud-layout-sections">
        <section className="dark-cloud-layout-section">
          <h3><NativeDarkCloudText font="medium" scale={1} text="LOAD A LAYOUT" /></h3>
          <NativeUiControlPanel>
            <form onSubmit={load}>
              <NativeUiControlPanelField
                autoComplete="off"
                id="dark-cloud-layout-code"
                inputMode="text"
                label="SHARE CODE"
                maxLength={9}
                onChange={event => setCode(formatCodeInput(event.currentTarget.value))}
                placeholder="ABCD-EFGH"
                spellCheck={false}
                value={code}
              />
              <NativeUiControlPanelAction disabled={busy !== null || code.length !== 9} type="submit">
                {busy === 'load' ? 'LOADING...' : 'LOAD LAYOUT'}
              </NativeUiControlPanelAction>
            </form>
          </NativeUiControlPanel>
          <p>Replaces the layout saved on this device.</p>
        </section>

        <section className="dark-cloud-layout-section">
          <h3><NativeDarkCloudText font="medium" scale={1} text="SUBMIT YOUR LAYOUT" /></h3>
          <NativeUiControlPanel>
            <NativeUiControlPanelAction disabled={busy !== null || accountUsername === null || !customized} onClick={() => { void run('publish') }}>
              {busy === 'publish' ? 'SUBMITTING...' : 'SUBMIT CURRENT LAYOUT'}
            </NativeUiControlPanelAction>
          </NativeUiControlPanel>
          {accountUsername === null ? <p>Sign in to submit.</p>
            : !customized ? <p>Save a layout in Game Settings first.</p>
              : <p>Each submission creates a new share code.</p>}
        </section>
      </div>

      {receipt ? (
        <div className="dark-cloud-layout-receipt" role="status">
          <span><NativeDarkCloudText font="medium" scale={1} text={receipt.action === 'load' ? 'LAYOUT LOADED' : 'LAYOUT PUBLISHED'} tint={0xbfffbf} /></span>
          <output><NativeDarkCloudText scale={1} text={receipt.layout.code} /></output>
          <small><NativeDarkCloudText content font="medium" scale={1} text={`BY ${receipt.layout.author.username}`} /></small>
          <NativeUiButton height={44} onClick={() => { void copy() }} scale={0.55} width="fill">{copied ? 'COPIED' : 'COPY CODE'}</NativeUiButton>
        </div>
      ) : null}
      {error ? <p className="dark-cloud-layout-error" role="alert">{error}</p> : null}
    </section>
  )
}

function formatCodeInput(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 8)
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact
}
