import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

export async function startStaticClientServer({ root, host = '127.0.0.1', port = 0 }) {
  if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
    throw new Error('Desktop client server must bind to loopback')
  }
  const clientRoot = resolve(root)
  const indexPath = resolve(clientRoot, 'index.html')
  await requireFile(indexPath)
  let expectedHost = ''
  const server = createServer(async (request, response) => {
    try {
      if (expectedHost && request.headers.host !== expectedHost) {
        response.writeHead(421, securityHeaders())
        response.end()
        return
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { ...securityHeaders(), allow: 'GET, HEAD' })
        response.end()
        return
      }
      if (request.url === '/__desktop/health') {
        response.writeHead(200, {
          ...securityHeaders(),
          'cache-control': 'no-store',
          'content-type': 'application/json; charset=utf-8',
        })
        if (request.method === 'HEAD') response.end()
        else response.end(JSON.stringify({ status: 'ok' }))
        return
      }
      const path = safePathname(request.url)
      if (path === null) {
        response.writeHead(400, securityHeaders())
        response.end()
        return
      }
      const requested = resolve(clientRoot, `.${path}`)
      if (requested !== clientRoot && !requested.startsWith(`${clientRoot}${sep}`)) {
        response.writeHead(404, securityHeaders())
        response.end()
        return
      }
      const requestedExists = await regularFile(requested)
      if (!requestedExists && extname(path)) {
        response.writeHead(404, securityHeaders())
        response.end()
        return
      }
      const file = requestedExists ? requested : indexPath
      const extension = extname(file).toLowerCase()
      response.writeHead(200, {
        ...securityHeaders(),
        'cache-control': file === indexPath ? 'no-store' : 'public, max-age=31536000, immutable',
        'content-type': CONTENT_TYPES.get(extension) ?? 'application/octet-stream',
      })
      if (request.method === 'HEAD') response.end()
      else createReadStream(file).pipe(response)
    } catch (error) {
      response.writeHead(500, securityHeaders())
      response.end()
      process.stderr.write(`Desktop client response failed: ${String(error)}\n`)
    }
  })
  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolveListen()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Desktop client server did not bind TCP')
  expectedHost = `${host.includes(':') ? `[${host}]` : host}:${address.port}`
  return {
    origin: `http://${expectedHost}`,
    async close() {
      await new Promise((resolveClose, reject) => {
        server.close((error) => error ? reject(error) : resolveClose())
      })
    },
  }
}

function securityHeaders() {
  return {
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self'; connect-src 'self' ws://127.0.0.1:* wss:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'cross-origin-opener-policy': 'same-origin',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  }
}

function safePathname(rawUrl = '/') {
  try {
    const rawPath = rawUrl.split('?', 1)[0]
    if (/%2f|%5c/i.test(rawPath)) return null
    const decoded = decodeURIComponent(rawPath)
    if (decoded.includes('\\') || decoded.split('/').includes('..')) return null
    return new URL(decoded, 'http://desktop.invalid').pathname
  } catch {
    return null
  }
}

async function regularFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function requireFile(path) {
  if (!await regularFile(path)) throw new Error(`Desktop client is missing ${path}`)
}
