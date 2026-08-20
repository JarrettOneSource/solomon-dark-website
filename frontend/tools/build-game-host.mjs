import { build } from 'esbuild'
import { copyFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

await rm('dist-game-host', { force: true, recursive: true })

await build({
  banner: {
    js: "import { createRequire } from 'node:module'; import { fileURLToPath as __fileURLToPath } from 'node:url'; import { dirname as __pathDirname } from 'node:path'; const require = createRequire(import.meta.url); const __filename = __fileURLToPath(import.meta.url); const __dirname = __pathDirname(__filename);",
  },
  bundle: true,
  entryPoints: {
    'game-host': 'src/game/host/run-game-host.ts',
    'game-session-supervisor': 'src/game/host/run-game-session-supervisor.ts',
  },
  format: 'esm',
  legalComments: 'none',
  outdir: 'dist-game-host',
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  target: 'node22.17',
})

await copyFile(require.resolve('wasmoon/dist/glue.wasm'), 'dist-game-host/lua54.wasm')
