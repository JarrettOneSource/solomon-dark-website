import { useEffect, useState } from 'react'

const SHELL_URL = '/game-app/index.html'

export default function Game() {
  const [shellDocument, setShellDocument] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const previousContent = existing?.getAttribute('content') ?? null
    const robots = existing ?? document.createElement('meta')
    if (existing === null) {
      robots.name = 'robots'
      document.head.append(robots)
    }
    robots.content = 'noindex,nofollow'

    return () => {
      if (existing === null) {
        robots.remove()
      } else if (previousContent === null) {
        robots.removeAttribute('content')
      } else {
        robots.content = previousContent
      }
    }
  }, [])

  useEffect(() => {
    const request = new AbortController()
    void fetch(SHELL_URL, { signal: request.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Shell request failed with ${response.status}`)
        return response.text()
      })
      .then(setShellDocument)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setLoadFailed(true)
      })
    return () => request.abort()
  }, [])

  return (
    <main className="fixed inset-0 bg-black">
      {loadFailed ? (
        <p className="grid h-full place-items-center text-bone">The game shell could not load.</p>
      ) : (
        <iframe
          title="Solomon's Dark"
          srcDoc={shellDocument ?? ''}
          className="block h-full w-full border-0 bg-black"
          allow="gamepad; fullscreen"
          allowFullScreen
        />
      )}
    </main>
  )
}
