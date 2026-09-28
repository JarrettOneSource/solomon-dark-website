import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DESKTOP_RELEASES_URL, loadDesktopRelease, type DesktopRelease } from '../desktop/desktop-releases.ts'

export default function Download() {
  const [release, setRelease] = useState<DesktopRelease | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    let alive = true
    void loadDesktopRelease(controller.signal).then(value => { if (alive) setRelease(value) })
      .catch(reason => { if (alive) setError(reason instanceof Error && reason.name !== 'AbortError'
        ? reason.message : 'The download catalog did not respond. Check the releases page below.') })
      .finally(() => { clearTimeout(timeout); if (alive) setLoading(false) })
    return () => { alive = false; clearTimeout(timeout); controller.abort() }
  }, [])
  return <main className="mx-auto max-w-4xl px-6 py-16">
    <p className="mb-3 font-mono text-xs uppercase tracking-widest text-gold">Solomon Darker</p>
    <h1 className="h-display text-4xl md:text-5xl">Download Offline</h1>
    <p className="mt-5 max-w-2xl text-xl text-bone-dim">
      Play on your own computer, with a local game server and local saves. Host a private game and share an invitation with friends.
    </p>
    {loading ? <p className="mt-8" role="status">Checking available desktop installers…</p>
      : error ? <p className="mt-8" role="status">{error}</p>
      : !release ? <div className="mt-8 rounded-lg border border-gold/30 bg-crypt p-6" role="status">
        <h2 className="h-display text-2xl">The first desktop release is not published yet</h2>
        <p className="mt-3 text-bone-dim">This page will offer installers once the release pipeline publishes them. Browser play is available now.</p>
      </div> : <section className="mt-8" aria-label="Available desktop installers">
        <p className="mb-4 font-mono text-sm text-gold">Version {release.version}</p>
        <div className="grid gap-4 md:grid-cols-3">
          {release.assets.map(asset => <a key={asset.label} href={asset.url}
            className="rounded-lg border border-gold/30 bg-crypt p-6 transition-colors hover:border-gold">
            <h2 className="h-display text-xl">{asset.label}</h2>
            <p className="mt-2 text-sm text-bone-dim">{asset.detail}</p>
            <p className="mt-5 text-gold">Download installer →</p>
          </a>)}
        </div>
      </section>}
    <section className="mt-10 space-y-4 text-bone-dim">
      <h2 className="h-display text-2xl text-bone">Your computer hosts the game</h2>
      <p>Solo play does not require the website. Friend invitations need an internet connection; the host must keep the app running. Local progress is stored separately from website cloud saves.</p>
      <p>The app checks for updates at launch and asks before downloading or restarting. Being offline or declining an update does not stop solo play. Friends must use the same game build.</p>
      <p>Restrictive home networks may require a relay. Hosting near your friends avoids sending gameplay to our US-East game server, but does not remove distance between players in different regions.</p>
    </section>
    <div className="mt-10 flex flex-wrap gap-4">
      <Link className="btn btn-gold" to="/game">Play in browser</Link>
      <a className="btn" href={DESKTOP_RELEASES_URL} target="_blank" rel="noopener noreferrer">Releases and installation notes</a>
    </div>
  </main>
}
