import { useState, type FormEvent } from 'react'

import type { SharedMobileUiLayout } from '../lib/api.ts'
import { readMobileUiLayoutState } from './mobile-ui-layout.ts'
import {
  loadSharedMobileUiLayout,
  publishCurrentMobileUiLayout,
} from './mobile-ui-sharing.ts'

export default function DarkCloudLayouts({
  accountUsername,
}: {
  accountUsername: string | null
}) {
  const customized = readMobileUiLayoutState().customized
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'load' | 'publish' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<SharedMobileUiLayout | null>(null)
  const [receiptAction, setReceiptAction] = useState<'loaded' | 'published' | null>(null)
  const [copied, setCopied] = useState(false)

  const load = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || code.length === 0) return
    setBusy('load')
    setError(null)
    setReceipt(null)
    setCopied(false)
    try {
      const shared = await loadSharedMobileUiLayout(code)
      setCode(shared.code)
      setReceipt(shared)
      setReceiptAction('loaded')
    } catch (reason) {
      setError(message(reason, 'That layout could not be loaded.'))
    } finally {
      setBusy(null)
    }
  }

  const publish = async () => {
    if (busy || accountUsername === null || !customized) return
    setBusy('publish')
    setError(null)
    setReceipt(null)
    setCopied(false)
    try {
      const shared = await publishCurrentMobileUiLayout()
      setCode(shared.code)
      setReceipt(shared)
      setReceiptAction('published')
    } catch (reason) {
      setError(message(reason, 'The layout could not be submitted.'))
    } finally {
      setBusy(null)
    }
  }

  const copy = async () => {
    if (!receipt) return
    try {
      await navigator.clipboard.writeText(receipt.code)
      setCopied(true)
      setError(null)
    } catch {
      setError('The code could not be copied.')
    }
  }

  return (
    <section className="dark-cloud-layouts" aria-label="Shared mobile UI layouts">
      <header>
        <h2>MOBILE UI LAYOUTS</h2>
        <p>Load a shared mobile layout on any device. A Website account is required only to submit one.</p>
      </header>
      <div className="dark-cloud-layout-cards">
        <form className="dark-cloud-layout-card" onSubmit={(event) => { void load(event) }}>
          <h3>LOAD A LAYOUT</h3>
          <label htmlFor="dark-cloud-layout-code">SHARE CODE</label>
          <input
            autoComplete="off"
            id="dark-cloud-layout-code"
            inputMode="text"
            maxLength={9}
            onChange={(event) => setCode(formatCodeInput(event.currentTarget.value))}
            placeholder="ABCD-EFGH"
            spellCheck={false}
            value={code}
          />
          <button disabled={busy !== null || code.length !== 9} type="submit">
            {busy === 'load' ? 'LOADING…' : 'LOAD LAYOUT'}
          </button>
          <small>Loading replaces the mobile layout saved in this browser. No account is needed.</small>
        </form>

        <div className="dark-cloud-layout-card">
          <h3>SUBMIT YOUR LAYOUT</h3>
          <p>Publish the mobile layout currently saved in Settings and receive an immutable share code.</p>
          <button
            disabled={busy !== null || accountUsername === null || !customized}
            onClick={() => { void publish() }}
            type="button"
          >
            {busy === 'publish' ? 'SUBMITTING…' : 'SUBMIT CURRENT LAYOUT'}
          </button>
          {accountUsername === null ? (
            <small>Sign in to submit. You can still load any shared code.</small>
          ) : !customized ? (
            <small>Customize and save a mobile layout in Game Settings first.</small>
          ) : (
            <small>Submitting creates a new code and does not change older shared layouts.</small>
          )}
        </div>
      </div>

      {receipt ? (
        <div className="dark-cloud-layout-receipt" role="status">
          <span>{receiptAction === 'loaded' ? 'LAYOUT LOADED' : 'LAYOUT PUBLISHED'}</span>
          <output>{receipt.code}</output>
          <small>BY {receipt.author.username.toUpperCase()}</small>
          <button onClick={() => { void copy() }} type="button">{copied ? 'COPIED' : 'COPY CODE'}</button>
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

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
