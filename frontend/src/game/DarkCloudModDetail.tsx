import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'

import { api, type ModComment, type ModDetail, type ModSubscription, type ModSummary } from '../lib/api.ts'
import { formatBytes, formatCount, formatDate, timeAgo } from '../lib/format.ts'
import DarkCloudMedia from './DarkCloudMedia.tsx'

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
  const [comments, setComments] = useState<{ items: ModComment[]; total: number } | null>(null)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentRevision, setCommentRevision] = useState(0)
  const [commentBody, setCommentBody] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [subscriptionBusy, setSubscriptionBusy] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [imageIndex, setImageIndex] = useState(0)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    let current = true
    setDetail(null)
    setDetailError(null)
    setImageIndex(0)
    void api.mods.get(mod.slug).then((value) => {
      if (current) setDetail(value)
    }).catch((error: unknown) => {
      if (current) setDetailError(message(error, 'The mod details could not be loaded.'))
    })
    return () => { current = false }
  }, [detailRevision, mod.slug])

  useEffect(() => {
    let current = true
    setComments(null)
    setCommentError(null)
    void api.mods.comments.list(mod.slug).then((value) => {
      if (current) setComments(value)
    }).catch((error: unknown) => {
      if (current) setCommentError(message(error, 'The comments could not be loaded.'))
    })
    return () => { current = false }
  }, [commentRevision, mod.slug])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (isTextEntry(event.target)) return
      if (event.key === 'ArrowLeft') showPreviousImage()
      if (event.key === 'ArrowRight') showNextImage()
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  })

  const images = detail?.screenshots ?? []
  const selectedImage = images[imageIndex] ?? null

  const showPreviousImage = () => {
    if (images.length < 2) return
    setImageIndex(index => (index + images.length - 1) % images.length)
  }
  const showNextImage = () => {
    if (images.length < 2) return
    setImageIndex(index => (index + 1) % images.length)
  }

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
      setSubscriptionError(message(error, 'The subscription could not be changed.'))
    } finally {
      setSubscriptionBusy(false)
    }
  }

  const submitComment = async (event: FormEvent) => {
    event.preventDefault()
    const body = commentBody.trim()
    if (!body || commentBusy) return
    setCommentBusy(true)
    setCommentError(null)
    try {
      await api.mods.comments.add(mod.slug, body)
      setCommentBody('')
      setCommentRevision(revision => revision + 1)
    } catch (error) {
      setCommentError(message(error, 'The comment could not be posted.'))
    } finally {
      setCommentBusy(false)
    }
  }

  const deleteComment = async (commentId: number) => {
    if (commentBusy) return
    setCommentBusy(true)
    setCommentError(null)
    try {
      await api.mods.comments.remove(mod.slug, commentId)
      setCommentRevision(revision => revision + 1)
    } catch (error) {
      setCommentError(message(error, 'The comment could not be removed.'))
    } finally {
      setCommentBusy(false)
    }
  }

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div className="dark-cloud-detail-backdrop" role="presentation" onMouseDown={closeFromBackdrop}>
      <section
        className="dark-cloud-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dark-cloud-detail-title"
      >
        <header className="dark-cloud-detail-header">
          <div>
            <span>MOD DETAILS</span>
            <h2 id="dark-cloud-detail-title">{detail?.name ?? mod.name}</h2>
            <p>BY {(detail?.author.username ?? mod.author.username).toUpperCase()}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="dark-cloud-detail-close"
            aria-label="Close mod details"
            onClick={onClose}
          >
            <span aria-hidden>×</span>
          </button>
        </header>

        <div className="dark-cloud-detail-scroll">
          {detailError ? (
            <div className="dark-cloud-detail-load-error" role="alert">
              <p>{detailError}</p>
              <button type="button" onClick={() => setDetailRevision(revision => revision + 1)}>
                RETRY
              </button>
            </div>
          ) : null}

          <div className="dark-cloud-detail-layout">
            <section className="dark-cloud-gallery" aria-labelledby="dark-cloud-gallery-title">
              <div className="dark-cloud-section-heading">
                <h3 id="dark-cloud-gallery-title">SCREENSHOTS</h3>
                <span>{images.length === 0 ? 'NO IMAGES' : `${imageIndex + 1} / ${images.length}`}</span>
              </div>
              <div className="dark-cloud-gallery-stage">
                <DarkCloudMedia
                  alt={selectedImage ? `${mod.name} screenshot ${imageIndex + 1}` : mod.name}
                  className="dark-cloud-gallery-image"
                  eager
                  src={selectedImage?.url ?? null}
                />
                <button
                  type="button"
                  className="dark-cloud-gallery-previous"
                  aria-label="PREVIOUS IMAGE"
                  disabled={images.length < 2}
                  onClick={showPreviousImage}
                >
                  <span aria-hidden>‹</span>
                </button>
                <button
                  type="button"
                  className="dark-cloud-gallery-next"
                  aria-label="NEXT IMAGE"
                  disabled={images.length < 2}
                  onClick={showNextImage}
                >
                  <span aria-hidden>›</span>
                </button>
              </div>
              {images.length > 1 ? (
                <div className="dark-cloud-gallery-thumbnails" aria-label="Choose screenshot">
                  {images.map((image, index) => (
                    <button
                      type="button"
                      key={image.id}
                      className={imageIndex === index ? 'selected' : ''}
                      aria-label={`Show screenshot ${index + 1}`}
                      aria-pressed={imageIndex === index}
                      onClick={() => setImageIndex(index)}
                    >
                      <DarkCloudMedia alt={`${mod.name} screenshot ${index + 1}`} src={image.url} />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <aside className="dark-cloud-detail-summary">
              <p className="dark-cloud-detail-deck">{detail?.summary ?? mod.summary}</p>
              <dl>
                <div><dt>VERSION</dt><dd>{detail?.latestVersion ?? mod.latestVersion}</dd></div>
                <div><dt>DOWNLOADS</dt><dd>{formatCount(detail?.downloads ?? mod.downloads)}</dd></div>
                <div><dt>PUBLISHED</dt><dd>{formatDate(detail?.createdAtUtc ?? mod.createdAtUtc)}</dd></div>
                <div><dt>UPDATED</dt><dd>{timeAgo(detail?.updatedAtUtc ?? mod.updatedAtUtc)}</dd></div>
              </dl>
              {(detail?.tags ?? mod.tags).length > 0 ? (
                <div className="dark-cloud-detail-tags" aria-label="Tags">
                  {(detail?.tags ?? mod.tags).map(tag => <span key={tag}>{tag}</span>)}
                </div>
              ) : null}
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
              <h3 id="dark-cloud-description-title">DESCRIPTION</h3>
            </div>
            <p>{detail?.description || detail?.summary || mod.summary}</p>
          </section>

          <section className="dark-cloud-versions" aria-labelledby="dark-cloud-versions-title">
            <div className="dark-cloud-section-heading">
              <h3 id="dark-cloud-versions-title">VERSION HISTORY</h3>
              <span>{detail ? `${detail.versions.length} RELEASE${detail.versions.length === 1 ? '' : 'S'}` : 'LOADING'}</span>
            </div>
            {detail?.versions.length === 0 ? <p className="dark-cloud-detail-empty">NO RELEASES LISTED.</p> : null}
            {detail?.versions.map(version => (
              <article key={version.id}>
                <div>
                  <strong>v{version.version}</strong>
                  <span>{formatDate(version.createdAtUtc)}</span>
                  <span>{formatBytes(version.fileSize)}</span>
                  <span>{formatCount(version.downloads)} DOWNLOADS</span>
                </div>
                <p>{version.changelog || 'No changelog supplied.'}</p>
              </article>
            ))}
          </section>

          <section className="dark-cloud-comments" aria-labelledby="dark-cloud-comments-title">
            <div className="dark-cloud-section-heading">
              <h3 id="dark-cloud-comments-title">COMMENTS</h3>
              <span>{comments === null ? 'LOADING' : `${comments.total} TOTAL`}</span>
            </div>

            {accountUsername ? (
              <form onSubmit={submitComment}>
                <label htmlFor="dark-cloud-comment">LEAVE A COMMENT</label>
                <textarea
                  id="dark-cloud-comment"
                  maxLength={1000}
                  placeholder="Share a useful note about this mod…"
                  value={commentBody}
                  onChange={event => setCommentBody(event.target.value)}
                />
                <div>
                  <span>{commentBody.length} / 1000</span>
                  <button type="submit" disabled={commentBusy || commentBody.trim().length === 0}>
                    {commentBusy ? 'POSTING…' : 'POST COMMENT'}
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="dark-cloud-comment-sign-in" onClick={() => window.location.assign('/login')}>
                SIGN IN TO COMMENT
              </button>
            )}

            {commentError ? <p className="dark-cloud-inline-error" role="alert">{commentError}</p> : null}
            {comments?.items.length === 0 ? <p className="dark-cloud-detail-empty">NO COMMENTS YET.</p> : null}
            <div className="dark-cloud-comment-list">
              {comments?.items.map(comment => (
                <article key={comment.id}>
                  <header>
                    <strong>{comment.author.username}</strong>
                    <span>{timeAgo(comment.createdAtUtc)}</span>
                    {canDeleteComment(accountUsername, detail ?? mod, comment) ? (
                      <button
                        type="button"
                        disabled={commentBusy}
                        aria-label={`Delete comment by ${comment.author.username}`}
                        onClick={() => { void deleteComment(comment.id) }}
                      >
                        DELETE
                      </button>
                    ) : null}
                  </header>
                  <p>{comment.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
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
  return (
    <div className="dark-cloud-detail-subscription">
      {!authenticated ? (
        <button type="button" disabled={busy} onClick={() => onAction('subscribe')}>SIGN IN TO SUBSCRIBE</button>
      ) : !subscription ? (
        <button type="button" disabled={busy} onClick={() => onAction('subscribe')}>{busy ? 'WORKING…' : 'SUBSCRIBE'}</button>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction(subscription.enabled ? 'disable' : 'enable')}
          >
            {busy ? 'WORKING…' : subscription.enabled ? 'DISABLE MOD' : 'ENABLE MOD'}
          </button>
          <button type="button" disabled={busy} onClick={() => onAction('unsubscribe')}>UNSUBSCRIBE</button>
        </>
      )}
      {error ? <p className="dark-cloud-inline-error" role="alert">{error}</p> : null}
    </div>
  )
}

function canDeleteComment(
  accountUsername: string | null,
  mod: ModSummary | ModDetail,
  comment: ModComment,
): boolean {
  return accountUsername !== null && (
    accountUsername === mod.author.username || accountUsername === comment.author.username
  )
}

function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
