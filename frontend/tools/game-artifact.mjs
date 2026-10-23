// The Website consumes a completed Rust release; it never builds a TS game fallback.
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { cp, lstat, open, readFile, readdir, realpath, rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}

async function clientFiles(directory, prefix = '') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name
    if (entry.isSymbolicLink()) throw new Error(`Artifact contains a symbolic link: ${name}`)
    if (entry.isDirectory()) files.push(...await clientFiles(join(directory, entry.name), name + '/'))
    else if (entry.isFile()) files.push(name)
    else throw new Error(`Artifact contains a non-file entry: ${name}`)
  }
  return files
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)]
    .map(match => [match[1].toLowerCase(), match[2]]))
}

function metadata(document, name) {
  const rows = [...document.matchAll(/<meta\b[^>]*>/gi)]
    .map(match => attributes(match[0])).filter(row => row.name === name)
  if (rows.length !== 1) throw new Error(`Game document requires one ${name} metadata value`)
  return rows[0].content
}

function artifactReference(reference, mount, files) {
  const origin = 'https://artifact.invalid'
  const url = new URL(reference, `${origin}${mount}/`)
  if (url.origin !== origin || !url.pathname.startsWith(mount + '/'))
    throw new Error(`Game module reference leaves its artifact mount: ${reference}`)
  const name = 'client/' + decodeURIComponent(url.pathname.slice(mount.length + 1))
  if (!Object.hasOwn(files, name)) throw new Error(`Game module is absent from the artifact: ${name}`)
  return name
}

function documentModule(document, mount, files) {
  const scripts = [...document.matchAll(/<script\b[^>]*>/gi)]
    .map(match => attributes(match[0])).filter(row => row.type === 'module')
  if (scripts.length !== 1 || !scripts[0].src)
    throw new Error('Game document requires its actual external bootstrap module')
  return artifactReference(scripts[0].src, mount, files)
}

async function requireWasm(path) {
  const file = await open(path)
  try {
    const header = Buffer.alloc(8)
    const { bytesRead } = await file.read(header, 0, 8, 0)
    if (bytesRead !== 8 || !header.equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])))
      throw new Error(`Artifact does not contain a WASM module: ${path}`)
  } finally { await file.close() }
}

export async function readGameArtifact({ dist, nativeHost } = {}) {
  if (!dist || !nativeHost)
    throw new Error('SDR_GAME_DIST and SDR_GAME_NATIVE_HOST must identify one completed Rust artifact')
  const client = await realpath(resolve(dist))
  const root = dirname(client)
  if (client !== join(root, 'client')) throw new Error('SDR_GAME_DIST must be the artifact client directory')
  const manifest = JSON.parse(await readFile(join(root, 'game-artifact.json'), 'utf8'))
  if (!manifest || manifest.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(manifest.revision)
    || typeof manifest.target !== 'string' || !/^[a-z0-9_-]+$/.test(manifest.target)
    || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files))
    throw new Error('Invalid Rust game-artifact.json schema, revision, target or files')
  const executable = manifest.target.includes('windows') ? 'solomon-darker.exe' : 'solomon-darker'
  const native = await realpath(resolve(nativeHost))
  if (native !== join(root, 'bin', executable))
    throw new Error('SDR_GAME_DIST and SDR_GAME_NATIVE_HOST must belong to the same artifact')
  if (!Object.hasOwn(manifest.files, `bin/${executable}`))
    throw new Error('Artifact manifest does not identify its native host')
  for (const [name, digest] of Object.entries(manifest.files)) {
    if (!name || isAbsolute(name) || name.includes('\\') || name.split('/').some(part => !part || part === '.' || part === '..')
      || [...name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))
      throw new Error(`unsafe artifact path: ${name}`)
    if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest))
      throw new Error(`Invalid artifact SHA-256: ${name}`)
    const path = join(root, name)
    const entry = await lstat(path)
    if (!entry.isFile()) throw new Error(`Artifact entry must be a regular file: ${name}`)
    if (await sha256(path) !== digest) throw new Error(`Artifact SHA-256 mismatch: ${name}`)
  }
  for (const name of await clientFiles(client)) {
    if (!Object.hasOwn(manifest.files, `client/${name}`))
      throw new Error(`Artifact contains an unlisted client file: ${name}`)
  }
  const deployment = JSON.parse(await readFile(join(client, 'deployment.json'), 'utf8'))
  if (deployment.revision !== manifest.revision) throw new Error('Game deployment revision does not match its artifact')
  const document = await readFile(join(client, 'index.html'), 'utf8')
  const mount = metadata(document, 'solomon-game-mount')
  if (!/^\/[a-z0-9/-]+$/.test(mount) || mount.endsWith('/') || mount.includes('//'))
    throw new Error('Invalid game artifact mount')
  if (metadata(document, 'solomon-build-revision') !== manifest.revision)
    throw new Error('Game document revision does not match its artifact')
  const bootstrap = await readFile(join(root, documentModule(document, mount, manifest.files)), 'utf8')
  const moduleReferences = [...bootstrap.matchAll(/["']([^"'\s]+\.m?js)["']/g)]
  const wasmReferences = [...bootstrap.matchAll(/["']([^"'\s]+\.wasm)["']/g)]
  if (!moduleReferences.length || !wasmReferences.length)
    throw new Error('Game bootstrap must reference its actual module and WASM')
  for (const [, reference] of moduleReferences) artifactReference(reference, mount, manifest.files)
  for (const [, reference] of wasmReferences)
    await requireWasm(join(root, artifactReference(reference, mount, manifest.files)))
  for (const name of ['save-tools/solomon_save_tools.js', 'save-tools/solomon_save_tools_bg.wasm', 'editor-test/index.html']) {
    if (!Object.hasOwn(manifest.files, `client/${name}`)) throw new Error(`Incomplete Rust game artifact: ${name}`)
  }
  await requireWasm(join(client, 'save-tools/solomon_save_tools_bg.wasm'))
  const editor = await readFile(join(client, 'editor-test/index.html'), 'utf8')
  documentModule(editor, mount, manifest.files)
  if (!editor.includes('data-editor-test-boot')) throw new Error('Artifact has no editor-test bootstrap')
  return { root, client, native, manifest, mount }
}

export async function stageGameArtifact(artifact, destination) {
  const target = resolve(destination)
  // Resolve existing parents too: macOS /var and /private/var name the same files.
  const missing = []
  let parent = target
  let canonical
  while (canonical === undefined) {
    try { canonical = join(await realpath(parent), ...missing) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      missing.unshift(basename(parent))
      parent = dirname(parent)
    }
  }
  const contains = (a, b) => {
    const path = relative(a, b)
    return !path || (path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path))
  }
  if (contains(artifact.root, canonical) || contains(canonical, artifact.root))
    throw new Error('Game staging destination must not overlap the source artifact')
  await rm(target, { recursive: true, force: true })
  await cp(artifact.client, target, { recursive: true })
  for (const [name, digest] of Object.entries(artifact.manifest.files)) {
    if (name.startsWith('client/') && await sha256(join(target, name.slice(7))) !== digest)
      throw new Error(`Staged game SHA-256 mismatch: ${name}`)
  }
}

async function main() {
  const command = process.argv[2]
  if (!['check', 'stage', 'inspect'].includes(command) || process.argv.length !== 3)
    throw new Error('usage: node tools/game-artifact.mjs check|stage|inspect')
  const artifact = await readGameArtifact({ dist: process.env.SDR_GAME_DIST, nativeHost: process.env.SDR_GAME_NATIVE_HOST })
  if (command === 'inspect') {
    console.log(JSON.stringify({ root: artifact.root, dist: artifact.client, nativeHost: artifact.native,
      revision: artifact.manifest.revision, target: artifact.manifest.target, mount: artifact.mount,
      manifestSha256: await sha256(join(artifact.root, 'game-artifact.json')) }))
    return
  }
  if (artifact.mount !== (process.env.VITE_GAME_ARTIFACT_BASE || '/game'))
    throw new Error('Game artifact mount does not match VITE_GAME_ARTIFACT_BASE')
  if (command === 'stage')
    await stageGameArtifact(artifact, fileURLToPath(new URL('../../backend/wwwroot/game', import.meta.url)))
  console.log(`Rust game artifact ${artifact.manifest.revision} (${artifact.manifest.target}, ${artifact.mount}) ${command === 'stage' ? 'staged' : 'verified'}.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Rust game artifact: ${error.message}`); process.exitCode = 1 })
}
