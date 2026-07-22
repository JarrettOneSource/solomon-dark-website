// The plan chest: local drafts in the browser, plus whatever the Annals hold
// for signed-in wizards. Open one, start fresh, or let one go.

import { useEffect, useState } from 'react'
import { importDocValue } from '../../editor/io'
import type { EditorDoc } from '../../editor/model'
import type { DraftMeta } from '../../editor/store'
import { deleteDraft, listDrafts } from '../../editor/store'
import { api } from '../../lib/api'
import type { BoneyardDraftSummary } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Spinner } from '../ui'

interface Props {
  currentId: string
  onOpen: (id: string) => void
  onOpenCloud: (doc: EditorDoc, cloudId: number, name: string) => void
  onNew: () => void
  onClose: () => void
}

export default function DraftsDrawer({ currentId, onOpen, onOpenCloud, onNew, onClose }: Props) {
  const { user } = useAuth()
  const [drafts, setDrafts] = useState<DraftMeta[]>(() => listDrafts())
  const [condemned, setCondemned] = useState<string | null>(null)
  const [cloud, setCloud] = useState<BoneyardDraftSummary[] | null>(null)
  const [cloudNote, setCloudNote] = useState<string | null>(null)
  const [cloudCondemned, setCloudCondemned] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!user) return
    let stale = false
    api.boneyards
      .list()
      .then((items) => {
        if (!stale) setCloud(items)
      })
      .catch((err) => {
        if (!stale) setCloudNote(err instanceof Error ? err.message : 'The Annals are not answering.')
      })
    return () => {
      stale = true
    }
  }, [user])

  const openCloud = async (item: BoneyardDraftSummary) => {
    setCloudNote(null)
    try {
      const full = await api.boneyards.get(item.id)
      const doc = importDocValue(full.document)
      onOpenCloud(doc, item.id, full.name)
    } catch (err) {
      setCloudNote(
        err instanceof Error
          ? `${item.name}: ${err.message}`
          : `${item.name} would not open.`,
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel panel-ornate flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden"
        role="dialog"
        aria-label="Drafts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
          <div>
            <div className="kicker">The plan chest</div>
            <h2 className="h-display mt-0.5 text-lg">Drafts</h2>
          </div>
          <button
            type="button"
            className="text-bone-dim hover:text-blood"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {drafts.length === 0 ? (
            <p className="text-fell py-4 text-center text-sm text-bone-dim">
              The chest is empty. How refreshingly tidy.
            </p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="slab flex items-center gap-3 rounded-sm px-3 py-2.5">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onOpen(d.id)}
                    title="Open this draft"
                  >
                    <span className="block truncate text-sm text-bone">
                      {d.name || 'Untitled acre'}
                      {d.id === currentId && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-gold/70">on the table</span>
                      )}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-bone-dim/70">
                      {d.residents} placed · {new Date(d.updatedAt).toLocaleString()}
                    </span>
                  </button>
                  {condemned === d.id ? (
                    <button
                      type="button"
                      className="btn btn-blood !px-2.5 !py-1.5 !text-[10px]"
                      onClick={() => {
                        deleteDraft(d.id)
                        setDrafts(listDrafts())
                        setCondemned(null)
                      }}
                    >
                      Certain?
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-bone-dim/60 hover:text-blood"
                      title="Burn this draft"
                      onClick={() => setCondemned(d.id)}
                    >
                      burn
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {user && (
            <section className="mt-5 border-t border-gold/10 pt-4">
              <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                The Annals hold
              </h3>
              {cloudNote && <p className="text-fell mt-2 text-xs text-blood/90">{cloudNote}</p>}
              {cloud === null && !cloudNote ? (
                <Spinner size={30} />
              ) : cloud && cloud.length === 0 ? (
                <p className="text-fell mt-2 text-xs text-bone-dim/70">
                  Nothing lodged yet. Send a draft up and the chronicler will make room.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {(cloud ?? []).map((c) => (
                    <li key={c.id} className="slab flex items-center gap-3 rounded-sm px-3 py-2.5">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openCloud(c)}
                        title="Open a copy from the Annals"
                      >
                        <span className="block truncate text-sm text-bone">{c.name}</span>
                        <span className="mt-0.5 block font-mono text-[10px] text-bone-dim/70">
                          {new Date(c.updatedAt).toLocaleString()}
                          {c.compiledSize !== null && ' · compiled'}
                        </span>
                      </button>
                      {cloudCondemned === c.id ? (
                        <button
                          type="button"
                          className="btn btn-blood !px-2.5 !py-1.5 !text-[10px]"
                          onClick={async () => {
                            try {
                              await api.boneyards.remove(c.id)
                              setCloud((prev) => (prev ?? []).filter((x) => x.id !== c.id))
                            } catch (err) {
                              setCloudNote(err instanceof Error ? err.message : 'The Annals refused.')
                            }
                            setCloudCondemned(null)
                          }}
                        >
                          Certain?
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-bone-dim/60 hover:text-blood"
                          title="Strike this draft from the Annals"
                          onClick={() => setCloudCondemned(c.id)}
                        >
                          strike
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="border-t border-gold/15 px-5 py-4">
          <button type="button" className="btn btn-gold w-full" onClick={onNew}>
            Break new ground
          </button>
        </div>
      </div>
    </div>
  )
}
