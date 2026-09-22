import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { deploymentRevisionFromResponse, reloadForDeploymentRevision } from '../game/deployment-revision.ts'
import { TITLE_BUILD_REVISION } from '../game/title-build-revision.ts'
import { isModuleLoadError } from '../lib/module-load-error.ts'

// Eagerly loaded: recovery must remain usable when any lazy route/child fails.
export default function RouteError() {
  const moduleFailure = isModuleLoadError(useRouteError())

  useEffect(() => {
    const currentRevision = TITLE_BUILD_REVISION.full
    if (!moduleFailure || !currentRevision) return
    const controller = new AbortController()
    async function recoverChangedRelease() {
      try {
        const response = await fetch(`/deployment.json?current=${currentRevision}`, {
          cache: 'no-store', headers: { accept: 'application/json' }, signal: controller.signal,
        })
        const liveRevision = await deploymentRevisionFromResponse(response)
        if (controller.signal.aborted || !liveRevision || liveRevision === currentRevision) return
        reloadForDeploymentRevision(liveRevision)
      } catch {
        // Offline, cancelled, or storage blocked: the explicit retry stays usable.
      }
    }
    void recoverChangedRelease()
    return () => controller.abort()
  }, [moduleFailure])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="h-display text-2xl">
        {moduleFailure ? 'Page files could not be loaded' : 'Something went wrong'}
      </h1>
      <p className="max-w-lg text-bone-dim">
        {moduleFailure
          ? 'Check your connection, then reload the page to try again.'
          : 'Reload the page to try again, or return home.'}
      </p>
      <button className="btn btn-gold" onClick={() => window.location.reload()}>Reload page</button>
      <a className="btn btn-stone" href="/">Return home</a>
    </main>
  )
}
