import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const css = await readFile(new URL('./dark-cloud.css', import.meta.url), 'utf8')
const source = await readFile(new URL('./DarkCloudScene.tsx', import.meta.url), 'utf8')
const detail = await readFile(new URL('./DarkCloudModDetail.tsx', import.meta.url), 'utf8')
const media = await readFile(new URL('./DarkCloudMedia.tsx', import.meta.url), 'utf8')
const menu = await readFile(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const menuCss = await readFile(new URL('./main-menu.css', import.meta.url), 'utf8')

test('Dark Cloud uses the requested three-lane catalog model with Mods selected first', () => {
  assert.match(source, /useState<DarkCloudTab>\('mods'\)/)
  assert.match(source, /\['mods', 'MODS'\]/)
  assert.match(source, /\['subscribed', 'SUBSCRIBED MODS'\]/)
  assert.match(source, /\['parties', 'PARTIES'\]/)
  assert.match(source, /api\.mods\.list\(\{ sort: 'newest', pageSize: 50 \}\)/)
  assert.match(source, /api\.gameParties\.list\(\)/)
  assert.doesNotMatch(source, /'recent'|'boneyards'|'multiplayer'/)
  assert.doesNotMatch(source, />RECENT<|>BONEYARDS<|>MULTIPLAYER</)
})

test('Dark Cloud removes invented heading copy and keeps account identity actionable', () => {
  assert.match(source, /<h1>THE DARK CLOUD<\/h1>/)
  assert.match(source, /accountUsername\.toUpperCase\(\)/)
  assert.match(source, /YOU ARE SIGNED IN AS A GUEST\./)
  assert.doesNotMatch(source, /HOW DARK ARE YOU TODAY\?|<small>WEB<\/small>/)
})

test('mod rows own media fallback, explicit view, double-click detail, and direct subscription controls', () => {
  assert.match(source, /<DarkCloudMedia/)
  assert.match(media, /NO IMAGE/)
  assert.match(media, /onError=/)
  assert.match(source, /onDoubleClick=\{onOpen\}/)
  assert.match(source, /aria-label=\{`View \$\{mod\.name\}`\}/)
  assert.match(source, /aria-label=\{`\$\{subscription\.enabled \? 'Disable' : 'Enable'\} \$\{mod\.name\}`\}/)
  assert.match(source, /aria-label=\{`Unsubscribe from \$\{mod\.name\}`\}/)
  assert.doesNotMatch(source, /onDoubleClick=\{primaryAction\}/)
})

test('the in-game mod viewer closes the complete website detail and comment membership', () => {
  for (const member of [
    'MOD DETAILS',
    'SCREENSHOTS',
    'DESCRIPTION',
    'VERSION HISTORY',
    'COMMENTS',
    'PREVIOUS IMAGE',
    'NEXT IMAGE',
    'POST COMMENT',
  ]) assert.match(detail, new RegExp(member))
  assert.match(detail, /api\.mods\.get\(mod\.slug\)/)
  assert.match(detail, /api\.mods\.comments\.list\(mod\.slug\)/)
  assert.match(detail, /api\.mods\.comments\.add\(mod\.slug/)
  assert.match(detail, /api\.mods\.comments\.remove\(mod\.slug/)
  assert.match(detail, /<DarkCloudMedia/)
  assert.match(detail, /aria-modal="true"/)
})

test('Dark Cloud fills the real viewport and has explicit compact/mobile reflow', () => {
  assert.match(menu, /<div className="main-menu-native-stage dark-cloud-stage">/)
  assert.doesNotMatch(menu, /className="main-menu-native-stage dark-cloud-stage" style=/)
  assert.match(css, /\.main-menu-native-stage\.dark-cloud-stage \{[\s\S]*?inset: 0;[\s\S]*?width: 100%;[\s\S]*?height: 100%;/)
  assert.match(css, /env\(safe-area-inset-top\)/)
  assert.match(css, /@media \(max-width: 700px\)/)
  assert.match(css, /@media \(max-height: 620px\)/)
  assert.match(css, /min-height: 44px/)
  assert.doesNotMatch(css, /left: 55px;[\s\S]*?width: 1490px;[\s\S]*?height: 620px;/)
  assert.match(menuCss, /:has\(\.dark-cloud-detail-backdrop\)[\s\S]*?display: none;/)
})

test('retail corner crops are mounted on the side matching their outer vertical leg', () => {
  assert.match(source, /borderTopLeft from '.+border-corner-tr\.png'/)
  assert.match(source, /borderTopRight from '.+border-corner-tl\.png'/)
  assert.match(source, /borderBottomLeft from '.+border-corner-bl\.png'/)
  assert.match(source, /borderBottomRight from '.+border-corner-br\.png'/)
})
