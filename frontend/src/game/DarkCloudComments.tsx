import { useEffect, useState, type FormEvent } from 'react'

import { api, type ModComment, type ModSummary } from '../lib/api.ts'
import { timeAgo } from '../lib/format.ts'
import { NativeDarkCloudText, NativeUiButton, NativeUiControlPanel, NativeUiControlPanelAction } from './native-ui/react.ts'

export default function DarkCloudComments({ accountUsername, mod }: { accountUsername: string | null; mod: ModSummary }) {
  const [comments, setComments] = useState<{ items: ModComment[]; total: number } | null>(null)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentRevision, setCommentRevision] = useState(0)
  const [commentBody, setCommentBody] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)

  useEffect(() => {
    let current = true
    setComments(null)
    setCommentError(null)
    void api.mods.comments.list(mod.slug).then((value) => {
      if (current) setComments(value)
    }).catch((error) => {
      if (current) setCommentError(error instanceof Error ? error.message : 'The comments could not be loaded.')
    })
    return () => { current = false }
  }, [commentRevision, mod.slug])

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
      setCommentError(error instanceof Error ? error.message : 'The comment could not be posted.')
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
      setCommentError(error instanceof Error ? error.message : 'The comment could not be removed.')
    } finally {
      setCommentBusy(false)
    }
  }

  return (
    <section className="dark-cloud-comments" aria-labelledby="dark-cloud-comments-title">
      <div className="dark-cloud-section-heading">
        <h3 id="dark-cloud-comments-title"><NativeDarkCloudText font="medium" scale={1} text="COMMENTS" /></h3>
        <span><NativeDarkCloudText font="medium" scale={0.85} text={comments === null ? 'LOADING' : `${comments.total} TOTAL`} /></span>
      </div>

      {accountUsername ? (
        <NativeUiControlPanel>
          <form onSubmit={submitComment}>
            <label htmlFor="dark-cloud-comment"><NativeDarkCloudText font="medium" scale={1} text="LEAVE A COMMENT" /></label>
            <NativeUiControlPanel variant="field">
              <textarea
                id="dark-cloud-comment"
                maxLength={1000}
                placeholder="Write a comment..."
                value={commentBody}
                onChange={event => setCommentBody(event.target.value)}
              />
            </NativeUiControlPanel>
            <div>
              <span><NativeDarkCloudText font="medium" scale={0.85} text={`${commentBody.length} / 1000`} /></span>
              <NativeUiControlPanelAction
                type="submit"
                disabled={commentBusy || commentBody.trim().length === 0}
              >
                {commentBusy ? 'POSTING...' : 'POST COMMENT'}
              </NativeUiControlPanelAction>
            </div>
          </form>
        </NativeUiControlPanel>
      ) : (
        <NativeUiControlPanel>
          <NativeUiControlPanelAction
            type="button"
            onClick={() => window.location.assign('/login')}
          >
            SIGN IN TO COMMENT
          </NativeUiControlPanelAction>
        </NativeUiControlPanel>
      )}

      {commentError ? <p className="dark-cloud-inline-error" role="alert">{commentError}</p> : null}
      {comments ? (
        <NativeUiControlPanel className="dark-cloud-comment-list">
          {comments.items.length === 0 ? <p className="dark-cloud-detail-empty"><NativeDarkCloudText font="medium" scale={1} text="NO COMMENTS YET." /></p> : null}
          {comments.items.map(comment => (
            <article key={comment.id}>
              <header>
                <strong><NativeDarkCloudText content font="medium" scale={1} text={comment.author.username} /></strong>
                <span><NativeDarkCloudText font="medium" scale={0.85} text={timeAgo(comment.createdAtUtc)} /></span>
                {canDeleteComment(accountUsername, mod, comment) ? (
                  <NativeUiButton height={44} scale={0.55} width="fill"
                    type="button"
                    disabled={commentBusy}
                    aria-label={`Delete comment by ${comment.author.username}`}
                    onClick={() => { void deleteComment(comment.id) }}
                  >
                    DELETE
                  </NativeUiButton>
                ) : null}
              </header>
              <p>{comment.body}</p>
            </article>
          ))}
        </NativeUiControlPanel>
      ) : null}
    </section>
  )
}

function canDeleteComment(
  accountUsername: string | null,
  mod: ModSummary,
  comment: ModComment,
): boolean {
  return accountUsername !== null && (
    accountUsername === mod.author.username || accountUsername === comment.author.username
  )
}
