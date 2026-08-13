import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'

const frontendRoot = resolve(import.meta.dirname, '..')
const gameRoot = join(frontendRoot, 'src/game')
const layers = [
  {
    directory: join(gameRoot, 'core-kernels'),
    name: 'core-kernels',
    forbidden: [
      /\b(document|window|navigator|HTMLElement|WebSocket|process)\b/,
      /from\s+['"](?:node:|react|react-dom)/,
      /from\s+['"]\.\.\/(?:core-server|client|protocol|host)/,
    ],
  },
  {
    directory: join(gameRoot, 'core-server'),
    name: 'core-server',
    forbidden: [
      /\b(document|window|navigator|HTMLElement|WebSocket)\b/,
      /from\s+['"](?:node:|react|react-dom)/,
      /from\s+['"]\.\.\/(?:client|protocol|host)/,
    ],
  },
  {
    directory: join(gameRoot, 'protocol'),
    name: 'protocol',
    forbidden: [
      /\b(document|window|navigator|HTMLElement|WebSocket|process)\b/,
      /from\s+['"](?:node:|react|react-dom)/,
      /from\s+['"]\.\.\/(?:core-server|client|host)/,
    ],
  },
]

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return ['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.test.ts')
      ? [path]
      : []
  }))
  return nested.flat()
}

const failures = []
for (const layer of layers) {
  let files
  try {
    files = await sourceFiles(layer.directory)
  } catch (error) {
    if (error?.code === 'ENOENT') continue
    throw error
  }
  for (const path of files) {
    const source = await readFile(path, 'utf8')
    for (const pattern of layer.forbidden) {
      if (pattern.test(source)) {
        failures.push(
          `${layer.name}/${relative(layer.directory, path)} violates ${pattern}`,
        )
      }
    }
  }
}

const hubScenePath = join(gameRoot, 'HubScene.tsx')
const hubScene = await readFile(hubScenePath, 'utf8')
if (/from\s+['"].*core-server\//.test(hubScene)) {
  failures.push('HubScene.tsx must present protocol snapshots and may not import authoritative server code')
}

const playerCharacterPath = join(gameRoot, 'PlayerCharacter.tsx')
const playerCharacter = await readFile(playerCharacterPath, 'utf8')
if (/from\s+['"].*(?:core-server|HubScene|hub-)\b/.test(playerCharacter)) {
  failures.push('PlayerCharacter.tsx must remain reusable across gameplay worlds')
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Game architecture import boundaries are clean.')
}
