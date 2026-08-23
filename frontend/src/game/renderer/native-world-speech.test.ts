import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import type { GameWorldSpeech } from '../world-speech-presentation.ts'
import {
  WORLD_SPEECH_STYLE,
  deriveNativeWorldSpeechItems,
  layoutNativeWorldSpeech,
} from './native-world-speech.ts'

const mainMenu = await readFile(new URL('../MainMenuScene.tsx', import.meta.url), 'utf8')
const gameChat = await readFile(new URL('../GameChat.tsx', import.meta.url), 'utf8')
const hubScene = await readFile(new URL('../HubScene.tsx', import.meta.url), 'utf8')
const boneyardScene = await readFile(new URL('../BoneyardScene.tsx', import.meta.url), 'utf8')
const hubRenderer = await readFile(new URL('./hub-world-renderer.ts', import.meta.url), 'utf8')
const boneyardRenderer = await readFile(new URL('./boneyard-world-renderer.ts', import.meta.url), 'utf8')

function speech(
  playerId: string,
  text = 'Hello there',
  sequence = 1,
): GameWorldSpeech {
  return {
    channel: 'global',
    expiresAtMs: 6_000,
    holdUntilMs: 4_000,
    playerId,
    sequence,
    startedAtMs: 1_000,
    text,
  }
}

test('world speech derives local and remote active players while excluding missing, invalid, and off-region actors', () => {
  const players = {
    local: { position: { x: 10, y: 20 } },
    remote: { position: { x: 30, y: 40 } },
    invalid: { position: { x: Number.NaN, y: 50 } },
  }
  assert.deepEqual(
    deriveNativeWorldSpeechItems([
      speech('local'),
      speech('remote', 'Party now', 2),
      speech('missing', 'Gone', 3),
      speech('invalid', 'Invalid', 4),
    ], players, 1_500, playerId => playerId !== 'remote'),
    [{
      alpha: 1,
      channel: 'global',
      playerId: 'local',
      position: { x: 10, y: 20 },
      sequence: 1,
      text: 'Hello there',
    }],
  )
})

test('world speech wraps complete supported text and breaks a word wider than the panel', () => {
  const wrapped = layoutNativeWorldSpeech(
    'ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN ELEVEN TWELVE',
  )
  assert.ok(wrapped.lines.length > 1)
  assert.ok(wrapped.lines.every(line => line.advance <= WORLD_SPEECH_STYLE.contentMaxWidth))
  assert.equal(wrapped.lines.map(({ text }) => text).join(' '),
    'ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN ELEVEN TWELVE')

  const longWord = layoutNativeWorldSpeech('ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ')
  assert.ok(longWord.lines.length > 1)
  assert.ok(longWord.lines.every(line => line.advance <= WORLD_SPEECH_STYLE.contentMaxWidth))
  assert.equal(longWord.lines.map(({ text }) => text).join(''),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ')
})

test('world speech uses native glyphs without a system-font fallback', () => {
  assert.equal(layoutNativeWorldSpeech('😀').glyphCount, 0)
  assert.equal(deriveNativeWorldSpeechItems(
    [speech('local', '😀')],
    { local: { position: { x: 10, y: 20 } } },
    1_500,
  ).length, 0)
  assert.ok(layoutNativeWorldSpeech('Hello 😀').glyphCount > 0)
})

test('chat receipt feeds one shared Hub/Boneyard world-speech layer without moving transcript ownership', () => {
  assert.match(gameChat, /onMessage: \(message: GameChatMessage\) => void/)
  assert.match(gameChat, /session\.onChatMessage\(\(message\) => \{[\s\S]*onMessage\(message\)[\s\S]*setMessages/)
  assert.match(
    mainMenu,
    /const receivedAtMs = performance\.now\(\)[\s\S]*appendGameWorldSpeech\(current, message, receivedAtMs\)/,
  )
  assert.match(mainMenu, /worldSpeeches=\{worldSpeeches\}/)
  assert.match(hubScene, /renderer\.setWorldSpeeches\(worldSpeechesRef\.current\)/)
  assert.match(boneyardScene, /renderer\.setWorldSpeeches\(worldSpeechesRef\.current\)/)
  assert.match(hubRenderer, /new NativeWorldSpeechLayer\(textures\.fontAtlas\)/)
  assert.match(boneyardRenderer, /new NativeWorldSpeechLayer\(textures\.fontAtlas\)/)
  assert.match(hubRenderer, /includePlayer: \(playerId\) => \([\s\S]*\.region === participant\.region/)
  assert.match(
    boneyardRenderer,
    /world\.position\.set\([\s\S]*secondaryCameraDisplacement[\s\S]*const worldScreenTransform = \{[\s\S]*world\.position\.x[\s\S]*worldNameplates\.update\([\s\S]*worldScreenTransform[\s\S]*worldSpeech\.update\([\s\S]*worldScreenTransform/,
  )
  assert.match(boneyardRenderer, /worldSpeech\.update\(/)
})
