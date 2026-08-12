import { build } from 'esbuild'

await build({
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  bundle: true,
  entryPoints: ['src/game/host/run-game-session-supervisor.ts'],
  format: 'esm',
  legalComments: 'none',
  outfile: 'dist-game-host/game-session-supervisor.mjs',
  platform: 'node',
  target: 'node22.17',
})
