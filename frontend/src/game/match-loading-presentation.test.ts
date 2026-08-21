import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const component = readFileSync(new URL('./MatchLoadingScreen.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./match-loading-screen.css', import.meta.url), 'utf8')
const createScene = readFileSync(new URL('./CreateMenuScene.tsx', import.meta.url), 'utf8')
const mainScene = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const boneyardScene = readFileSync(new URL('./BoneyardScene.tsx', import.meta.url), 'utf8')
const background = readFileSync(new URL('../assets/game/match-loading-background.png', import.meta.url))

test('uses the exact Mod Loader art and recovered viewport-relative painter', () => {
  assert.equal(
    createHash('sha256').update(background).digest('hex'),
    '251365e025129972707b436d441d52ae2c5f8199bc3f80a1c4e03b2a28a1180c',
  )
  assert.match(component, /matchLoading\.background/)
  assert.match(component, /role="progressbar"/)
  assert.match(component, /aria-valuenow=\{loading\.progress \* 100\}/)
  assert.match(component, /shouldPresentMatchLoading/)
  assert.match(css, /\.match-loading-art[\s\S]*object-fit:\s*fill/)
  assert.match(css, /\.match-loading-scrim[\s\S]*height:\s*18%/)
  assert.match(css, /\.match-loading-progress[\s\S]*left:\s*calc\(20% - 0\.5px\)/)
  assert.match(css, /\.match-loading-progress[\s\S]*top:\s*calc\(92\.5% - 0\.5px\)/)
  assert.match(css, /\.match-loading-progress[\s\S]*width:\s*60%/)
  for (const color of ['#000000b3', '#69522ae6', '#14110deb', '#caa14d', '#f2e5c7']) {
    assert.match(css.toLowerCase(), new RegExp(color))
  }
})

test('owns both requested transitions through destination renderer readiness', () => {
  assert.match(createScene, /onDisciplineCommit: \(\) => void/)
  assert.match(
    createScene,
    /const selectDiscipline[\s\S]*onDisciplineCommit\(\)[\s\S]*setPendingDiscipline\(discipline\)/,
  )
  assert.match(mainScene, /beginLoading\('hub', 'connecting_transport'\)/)
  assert.equal(
    mainScene.match(/beginLoading\('hub', 'connecting_transport'\)/g)?.length,
    1,
  )
  assert.match(mainScene, /onDisciplineCommit=\{beginHubLoading\}/)
  assert.match(mainScene, /beginLoading\('boneyard', 'preparing_boneyard'\)/)
  assert.match(mainScene, /advanceLoading\('reading_boneyard'\)/)
  assert.match(mainScene, /advanceLoading\('materializing_participants'\)/)
  assert.match(mainScene, /activeBoneyardRunRef\.current !== snapshot\.world\.runId/)
  assert.match(mainScene, /loadedBoneyardRunRef\.current !== nextBoneyard\.runId/)
  assert.match(mainScene, /<MatchLoadingScreen loading=\{loading\} \/>/)
  assert.match(
    mainScene,
    /const levelUpModalActive = Boolean\(runtimeSnapshot\?\.levelUpBarrier\) \|\| levelUpPickerClosing/,
  )
  assert.equal(
    mainScene.match(
      /inputBlocked=\{loading !== null \|\| levelUpModalActive \|\| gameplayPause !== null \|\| skillBookOpen\}/g,
    )?.length,
    2,
  )
  assert.match(mainScene, /onReady=\{finishHubLoading\}/)
  assert.match(mainScene, /onReady=\{finishBoneyardLoading\}/)
  assert.doesNotMatch(mainScene, /Opening the Boneyard/)
  assert.doesNotMatch(mainScene, /transitionTo\('hub'\)/)
})

test('seals scene input until the same renderer reports its initial frame', () => {
  for (const scene of [hubScene, boneyardScene]) {
    assert.match(scene, /inputBlocked: boolean/)
    assert.match(scene, /onReady: \(\) => void/)
    assert.match(scene, /onLoadingErrorRef\.current\(\)/)
    assert.match(scene, /onReadyRef\.current\(\)/)
  }
  assert.match(boneyardScene, /input\.setBlocked\(inputBlockedRef\.current\)/)
  assert.match(boneyardScene, /inputRef\.current\?\.setBlocked\(sceneInputBlocked\)/)
  assert.match(
    hubScene,
    /input\.setBlocked\(inputBlockedRef\.current \|\| modalOpenRef\.current\)/,
  )
  assert.match(
    hubScene,
    /inputRef\.current\?\.setBlocked\(inputBlocked \|\| modalOpen\)/,
  )
})

test('keeps the Boneyard renderer resident across run-local snapshot changes', () => {
  assert.match(
    boneyardScene,
    /const \[boneyardInitialSnapshot\] = useState<BoneyardGameSnapshot>/,
  )
  assert.match(
    boneyardScene,
    /createBoneyardWorldRenderer\(\{[\s\S]*initialSnapshot: boneyardInitialSnapshot/,
  )
  assert.doesNotMatch(
    boneyardScene,
    /\[audio, digPosition, initialSnapshot, loaded, onInput, playerId, samplePresentation\]/,
  )
})
