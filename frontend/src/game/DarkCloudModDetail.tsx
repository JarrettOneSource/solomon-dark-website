import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { api, type ModDetail, type ModSubscription, type ModSummary } from '../lib/api.ts'
import { formatBytes, formatCount, formatDate, timeAgo } from '../lib/format.ts'
import DarkCloudComments from './DarkCloudComments.tsx'
import DarkCloudGallery from './DarkCloudGallery.tsx'
import { NativeDarkCloudPanelArt, NativeDarkCloudText, NativeUiButton, NativeUiControlPanel, NativeUiControlPanelAction, NativeUiDialog, NativeUiStoneButton } from './native-ui/react.ts'

export type DarkCloudSubscriptionAction = 'disable' | 'enable' | 'subscribe' | 'unsubscribe'

interface DarkCloudModDetailProps {
  accountUsername: string | null
  mod: ModSummary
  onClose: () => void
  onSubscriptionAction: (action: DarkCloudSubscriptionAction) => Promise<void>
  subscription: ModSubscription | null
}

export default function DarkCloudModDetail({
  accountUsername,
  mod,
  onClose,
  onSubscriptionAction,
  subscription,
}: DarkCloudModDetailProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [detail, setDetail] = useState<ModDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailRevision, setDetailRevision] = useState(0)
  const [subscriptionBusy, setSubscriptionBusy] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    let current = true
    setDetail(null)
    setDetailError(null)
    void api.mods.get(mod.slug).then((value) => {
      if (current) setDetail(value)
    }).catch((error) => {
      if (current) setDetailError(error instanceof Error ? error.message : 'The mod details could not be loaded.')
    })
    return () => { current = false }
  }, [detailRevision, mod.slug])

  const runSubscriptionAction = async (action: DarkCloudSubscriptionAction) => {
    if (subscriptionBusy) return
    if (!accountUsername) {
      window.location.assign('/login')
      return
    }
    setSubscriptionBusy(true)
    setSubscriptionError(null)
    try {
      await onSubscriptionAction(action)
    } catch (error) {
      setSubscriptionError(error instanceof Error ? error.message : 'The subscription could not be changed.')
    } finally {
      setSubscriptionBusy(false)
    }
  }

  const summary = detail ?? mod
  return (
    <NativeUiDialog
      aria-labelledby="dark-cloud-detail-title"
      className="dark-cloud-detail dark-cloud-panel"
      onDismiss={onClose}
    >
      <NativeDarkCloudPanelArt />
      <header className="dark-cloud-detail-header">
        <div>
          <h2 id="dark-cloud-detail-title"><NativeDarkCloudText content scale={1.05} text={summary.name} /></h2>
          <p><NativeDarkCloudText content font="medium" scale={1} text={`BY ${summary.author.username}`} /></p>
        </div>
        <NativeUiButton height={44} scale={0.55} width={100}
          ref={closeRef}
          type="button"
          className="dark-cloud-detail-close"
          data-game-back="true"
          aria-label="Close mod details"
          onClick={onClose}
        >BACK</NativeUiButton>
      </header>

      <div className="dark-cloud-detail-scroll">
        {detailError ? (
          <div className="dark-cloud-detail-load-error" role="alert">
            <p>{detailError}</p>
            <NativeUiButton height={44} scale={0.55} width="fill" type="button" onClick={() => setDetailRevision(revision => revision + 1)}>
              RETRY
            </NativeUiButton>
          </div>
        ) : null}

        <div className="dark-cloud-detail-layout">
          <DarkCloudGallery images={detail?.screenshots ?? []} key={`${mod.slug}:${detailRevision}`} name={summary.name} />

          <aside className="dark-cloud-detail-summary" aria-labelledby="dark-cloud-summary-title">
            <div className="dark-cloud-section-heading">
              <h3 id="dark-cloud-summary-title"><NativeDarkCloudText font="medium" scale={1} text="ABOUT THIS MOD" /></h3>
            </div>
            <NativeUiControlPanel>
              <p className="dark-cloud-detail-deck">{summary.summary}</p>
              <dl>
                <div><dt><NativeDarkCloudText font="medium" scale={1} text="VERSION:" /></dt><dd><NativeDarkCloudText content font="medium" scale={1} text={summary.latestVersion} /></dd></div>
                <div><dt><NativeDarkCloudText font="medium" scale={1} text="DOWNLOADS:" /></dt><dd><NativeDarkCloudText content font="medium" scale={1} text={formatCount(summary.downloads)} /></dd></div>
                <div><dt><NativeDarkCloudText font="medium" scale={1} text="PUBLISHED:" /></dt><dd><NativeDarkCloudText content font="medium" scale={1} text={formatDate(summary.createdAtUtc)} /></dd></div>
                <div><dt><NativeDarkCloudText font="medium" scale={1} text="UPDATED:" /></dt><dd><NativeDarkCloudText content font="medium" scale={1} text={timeAgo(summary.updatedAtUtc)} /></dd></div>
              </dl>
              {summary.tags.length > 0 ? (
                <div className="dark-cloud-detail-tags" aria-label="Tags">
                  <span><NativeDarkCloudText font="medium" scale={1} text="TAGS:" /></span>
                  <span className="dark-cloud-detail-tag-list">
                    {summary.tags.map(tag => <span key={tag}><NativeDarkCloudText content font="medium" scale={1} text={tag} /></span>)}
                  </span>
                </div>
              ) : null}
            </NativeUiControlPanel>
            <SubscriptionControls
              authenticated={accountUsername !== null}
              busy={subscriptionBusy}
              error={subscriptionError}
              onAction={runSubscriptionAction}
              subscription={subscription}
            />
          </aside>
        </div>

        <section className="dark-cloud-detail-copy" aria-labelledby="dark-cloud-description-title">
          <div className="dark-cloud-section-heading">
            <h3 id="dark-cloud-description-title"><NativeDarkCloudText font="medium" scale={1} text="DESCRIPTION" /></h3>
          </div>
          <NativeUiControlPanel>
            <p>{detail?.description || summary.summary}</p>
          </NativeUiControlPanel>
        </section>

        <section className="dark-cloud-versions" aria-labelledby="dark-cloud-versions-title">
          <div className="dark-cloud-section-heading">
            <h3 id="dark-cloud-versions-title"><NativeDarkCloudText font="medium" scale={1} text="VERSION HISTORY" /></h3>
            <span><NativeDarkCloudText font="medium" scale={0.85} text={detail ? `${detail.versions.length} RELEASE${detail.versions.length === 1 ? '' : 'S'}` : 'LOADING'} /></span>
          </div>
          <NativeUiControlPanel>
            {detail === null ? <p className="dark-cloud-detail-empty"><NativeDarkCloudText font="medium" scale={1} text="CONSULTING THE DARK CLOUD..." /></p> : null}
            {detail?.versions.length === 0 ? <p className="dark-cloud-detail-empty"><NativeDarkCloudText font="medium" scale={1} text="NO RELEASES LISTED." /></p> : null}
            {detail?.versions.map(version => (
              <article key={version.id}>
                <div>
                  <strong><NativeDarkCloudText content font="medium" scale={1} text={`v${version.version}`} /></strong>
                  <span><NativeDarkCloudText font="medium" scale={0.85} text={formatDate(version.createdAtUtc)} /></span>
                  <span><NativeDarkCloudText font="medium" scale={0.85} text={formatBytes(version.fileSize)} /></span>
                  <span><NativeDarkCloudText font="medium" scale={0.85} text={`${formatCount(version.downloads)} DOWNLOADS`} /></span>
                </div>
                {version.changelog ? <p>{version.changelog}</p> : null}
              </article>
            ))}
          </NativeUiControlPanel>
        </section>

        <DarkCloudComments accountUsername={accountUsername} mod={summary} />
      </div>

      <footer className="dark-cloud-panel-footer">
        <NativeUiStoneButton className="dark-cloud-detail-done" height={44} onClick={onClose} width="fill">
          DONE
        </NativeUiStoneButton>
      </footer>
    </NativeUiDialog>
  )
}

function SubscriptionControls({
  authenticated,
  busy,
  error,
  onAction,
  subscription,
}: {
  authenticated: boolean
  busy: boolean
  error: string | null
  onAction: (action: DarkCloudSubscriptionAction) => void
  subscription: ModSubscription | null
}) {
  const state = !authenticated
    ? 'GUEST'
    : subscription
      ? subscription.enabled ? 'ENABLED' : 'DISABLED'
      : 'NOT SUBSCRIBED'
  return (
    <div className="dark-cloud-detail-subscription">
      <div className="dark-cloud-section-heading">
        <h3><NativeDarkCloudText font="medium" scale={1} text="SUBSCRIPTION" /></h3>
        <span><NativeDarkCloudText font="medium" scale={0.85} text={state} /></span>
      </div>
      <NativeUiControlPanel>
        {!authenticated ? (
          <NativeUiControlPanelAction
            type="button"
            disabled={busy}
            onClick={() => onAction('subscribe')}
          >
            SIGN IN TO SUBSCRIBE
          </NativeUiControlPanelAction>
        ) : !subscription ? (
          <NativeUiControlPanelAction type="button" disabled={busy} onClick={() => onAction('subscribe')}>
            {busy ? 'WORKING...' : 'SUBSCRIBE'}
          </NativeUiControlPanelAction>
        ) : (
          <>
            <NativeUiControlPanelAction
              type="button"
              disabled={busy}
              onClick={() => onAction(subscription.enabled ? 'disable' : 'enable')}
            >
              {busy ? 'WORKING...' : subscription.enabled ? 'DISABLE MOD' : 'ENABLE MOD'}
            </NativeUiControlPanelAction>
            <NativeUiControlPanelAction type="button" disabled={busy} onClick={() => onAction('unsubscribe')}>
              UNSUBSCRIBE
            </NativeUiControlPanelAction>
          </>
        )}
      </NativeUiControlPanel>
      {error ? <p className="dark-cloud-inline-error" role="alert">{error}</p> : null}
    </div>
  )
}
