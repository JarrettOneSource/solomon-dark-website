import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

import { createNativeSecondaryPlayerState } from './core-kernels/native-secondary-abilities.ts'
import { createGameSimulation, damageGameSimulationPlayer } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import type { GameSnapshot } from './protocol/game-state.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from './save/game-save-document.ts'

const renderer = build({
  stdin: {
    contents: `import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import GameHud from './GameHud.tsx';
      import { HotbarProvider } from './HotbarControls.tsx';
      import { DEFAULT_GAME_CONTROL_BINDINGS } from './game-settings.ts';
      export const render = snapshot => renderToStaticMarkup(createElement(HotbarProvider, null, createElement(GameHud, {
        accountUsername: null, audio: {playSound(){}}, controls: DEFAULT_GAME_CONTROL_BINDINGS,
        getPingMs: () => null, initialSnapshot: snapshot, playerId: 'owner',
        progression: snapshot.players.owner.progression, subscribePing: () => () => {},
        subscribeSnapshot: () => () => {}, uiScale: 1, viewport: {displayScale: 1, width: 1600, height: 900},
      })));`,
    loader: 'tsx', resolveDir: import.meta.dirname,
  },
  bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', write: false,
  loader: { '.png': 'empty', '.css': 'empty' },
  banner: { js: `import { createRequire } from 'node:module'; const require = createRequire(${JSON.stringify(import.meta.url)}); const window = { localStorage: { getItem: () => null } };` },
}).then(async built => import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`))

function simulation(regenerate: boolean, other: 'firewalker' | 'mindstar' = 'firewalker') {
  const base = damageGameSimulationPlayer(createGameSimulation({
    owner: { discipline: 'mind', displayName: 'Pulse', element: 'fire' },
  }), 'owner', 25, 0)
  return {
    ...base,
    secondaryAbilities: {
      ...base.secondaryAbilities,
      players: {
        owner: {
          ...createNativeSecondaryPlayerState(), regenerate,
          firewalker: other === 'firewalker', mindstar: other === 'mindstar',
          reservedMana: (other === 'firewalker' ? 50 : 40) + (regenerate ? 25 : 0),
          magicShieldAbsorb: 25, magicShieldMaximum: 50,
        },
      },
    },
  }
}

test('GameHud follows accepted Regenerate independently of Shield and other mana-reserving toggles', async () => {
  const { render }: { render: (snapshot: GameSnapshot) => string } = await renderer
  for (const [other, states] of [
    ['firewalker', [[false, 50], [true, 75], [false, 50]]],
    ['mindstar', [[false, 40], [true, 65], [false, 40]]],
  ] as const) for (const [active, reserve] of states) {
    const snapshot = createGameSnapshot(simulation(active, other), 'owner')
    const html = render(snapshot)
    assert.equal(html.includes('aria-label="Regenerate active"'), active)
    assert.equal(html.includes('hub-hud-meter-regenerate'), active)
    assert.match(html, /aria-label="Health 25 of 50"/)
    assert.match(html, /aria-label="Magic shield 25 of 50"/)
    assert.ok(html.includes(`aria-label="${reserve} mana reserved"`))
    if (active) {
      assert.match(html, /aria-label="Regenerate active"[^>]*data-native-ui-strip="UI\.52"[^>]*clip-path:inset\(0 75% 0 0\)/)
    }
  }
})

test('a restored save retains the Firewalker reserve without a stale Regenerate health pulse', async () => {
  const { render }: { render: (snapshot: GameSnapshot) => string } = await renderer
  const document = createGameSaveDocument({
    integrity: 'global-clean', loadedBoneyard: null, mods: [], modState: {},
    playerId: 'owner', state: simulation(true),
  })
  const restored = restoreGameSaveDocument(document)
  const snapshot = createGameSnapshot(restored.state, 'owner')
  assert.equal(snapshot.secondaryAbilities.players.owner?.regenerate, false)
  assert.equal(snapshot.secondaryAbilities.players.owner?.firewalker, true)
  const html = render(snapshot)
  assert.doesNotMatch(html, /hub-hud-meter-regenerate|Regenerate active/)
  assert.match(html, /aria-label="50 mana reserved"/)
})
