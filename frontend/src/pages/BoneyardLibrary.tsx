import { useEffect, useState } from 'react'

import BoneyardLibrary from '../editor/BoneyardLibrary.tsx'
import { NativeDarkCloudText } from '../editor/library-ui/NativeDarkCloudText.tsx'
import { storeWorkshopRequest } from '../editor/workshop-navigation.ts'
import type { WorkshopRequest } from '../editor/store.ts'
import { useAuth } from '../lib/auth.tsx'
import '../editor/boneyard-library.css'

/** Website-owned authoring shelf, embedded inside the Rust Dark Cloud frame. */
export default function BoneyardLibraryPage() {
  const { user, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const parent = window.top ?? window
  const [viewport, setViewport] = useState(() => ({ width: parent.innerWidth, height: parent.innerHeight }))

  useEffect(() => {
    const resize = () => setViewport({ width: parent.innerWidth, height: parent.innerHeight })
    parent.addEventListener('resize', resize)
    return () => parent.removeEventListener('resize', resize)
  }, [parent])

  useEffect(() => {
    const initialMenuKey = new URL(window.location.href).searchParams.get('menu-key') || 'Escape'
    const openMenu = (event: KeyboardEvent) => {
      const menuKey = parent.document.querySelector<HTMLElement>('.game-menus')?.dataset.cloudMenuBinding || initialMenuKey
      if (event.code !== menuKey || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      event.stopPropagation()
      window.parent.postMessage({ type: 'sdr-boneyard-library-menu' }, window.location.origin)
    }
    window.addEventListener('keydown', openMenu)
    return () => window.removeEventListener('keydown', openMenu)
  }, [parent])

  const open = async (request: WorkshopRequest) => {
    setError(null)
    setOpening(true)
    try {
      parent.location.assign(await storeWorkshopRequest(request))
    } catch {
      setOpening(false)
      setError('The workshop could not be opened on this device. Check browser storage, then try again.')
    }
  }

  return (
    <main
      className="boneyard-library-document"
      data-parent-narrow={viewport.width <= 700}
      data-parent-short={viewport.height <= 620 && viewport.width >= 701}
      inert={opening || undefined}
    >
      {error ? <p className="boneyard-library-open-error" role="alert">{error}</p> : null}
      {loading ? (
        <p role="status"><NativeDarkCloudText text="OPENING BONEYARDS..." /></p>
      ) : (
        <BoneyardLibrary accountUsername={user?.username ?? null} onOpen={request => { void open(request) }} />
      )}
    </main>
  )
}
