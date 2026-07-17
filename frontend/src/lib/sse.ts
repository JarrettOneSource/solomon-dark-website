/**
 * Minimal fetch-based Server-Sent Events reader. The browser's EventSource
 * cannot attach an Authorization header, so authenticated streams (which the
 * lobby list needs for friend visibility) go through this instead.
 *
 * Resolves when the server ends the stream, rejects on network/HTTP failure,
 * and returns silently when `signal` aborts. Callers own the retry loop.
 */
export async function readEventStream(
  url: string,
  headers: HeadersInit,
  signal: AbortSignal,
  onEvent: (event: string, data: string) => void,
): Promise<void> {
  const res = await fetch(url, {
    headers: { ...Object.fromEntries(new Headers(headers)), Accept: 'text/event-stream' },
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`Event stream failed (${res.status})`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })

      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        let event = 'message'
        const data: string[] = []
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
          // lines starting with ':' are keepalive comments — ignored
        }
        if (data.length > 0) onEvent(event, data.join('\n'))
      }
    }
  } catch (err) {
    if (signal.aborted) return
    throw err
  } finally {
    reader.cancel().catch(() => {})
  }
}
