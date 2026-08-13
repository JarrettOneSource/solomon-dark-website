import { build } from 'esbuild'
import { rm } from 'node:fs/promises'

await rm('dist-game-host', { force: true, recursive: true })

await build({
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  bundle: true,
  entryPoints: {
    'game-session-supervisor': 'src/game/host/run-game-session-supervisor.ts',
    'hub-host': 'src/game/host/run-hub-host.ts',
  },
  format: 'esm',
  legalComments: 'none',
  outdir: 'dist-game-host',
  outExtension: { '.js': '.mjs' },
  platform: 'node',
  target: 'node22.17',
})
