import { useState } from 'react'

import type { SharedMobileUiLayout } from '../lib/api.ts'
import { readMobileUiLayoutState } from './mobile-ui-layout.ts'
import { publishCurrentMobileUiLayout } from './mobile-ui-sharing.ts'
import { NativeUiSettingsAction } from './native-ui/react.ts'

export default function MobileUiLayoutSettingsAction({
  accountUsername,
}: {
  accountUsername: string | null
}) {
  const customized = readMobileUiLayoutState().customized
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState<SharedMobileUiLayout | null>(null)
  const [copied, setCopied] = useState(false)
  const disabled = busy || accountUsername === null || !customized

  const publish = async () => {
    if (disabled) return
    setBusy(true)
    setError(null)
    setShared(null)
    setCopied(false)
    try {
      setShared(await publishCurrentMobileUiLayout())
    } catch (reason) {
      setError(message(reason, 'The layout could not be submitted.'))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!shared) return
    try {
      await navigator.clipboard.writeText(shared.code)
      setCopied(true)
      setError(null)
    } catch {
      setError('The code could not be copied.')
    }
  }

  return (
    <div className="game-settings-mobile-ui-share">
      <NativeUiSettingsAction
        disabled={disabled}
        label={busy ? 'SUBMITTING MOBILE UI...' : 'SUBMIT TO DARK CLOUD'}
        onClick={() => { void publish() }}
      />
      {accountUsername === null ? (
        <small>SIGN IN TO SUBMIT A MOBILE UI LAYOUT.</small>
      ) : !customized ? (
        <small>CUSTOMIZE AND SAVE A MOBILE UI LAYOUT FIRST.</small>
      ) : null}
      {shared ? (
        <div className="game-settings-layout-code" role="status">
          <span>SHARE CODE</span>
          <output>{shared.code}</output>
          <button onClick={() => { void copy() }} type="button">
            {copied ? 'COPIED' : 'COPY'}
          </button>
        </div>
      ) : null}
      {error ? <small className="game-settings-mobile-ui-share-error" role="alert">{error}</small> : null}
    </div>
  )
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
