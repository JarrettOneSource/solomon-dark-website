import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const css = await readFile(new URL('./dark-cloud.css', import.meta.url), 'utf8')
const source = await readFile(new URL('./DarkCloudScene.tsx', import.meta.url), 'utf8')
const detail = await readFile(new URL('./DarkCloudModDetail.tsx', import.meta.url), 'utf8')
const media = await readFile(new URL('./DarkCloudMedia.tsx', import.meta.url), 'utf8')
const menu = await readFile(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const menuCss = await readFile(new URL('./main-menu.css', import.meta.url), 'utf8')
const game = await readFile(new URL('../pages/Game.tsx', import.meta.url), 'utf8')

test('Dark Cloud uses the requested three-lane catalog model with Mods selected first', () => {
  assert.match(source, /useState<DarkCloudTab>\('mods'\)/)
  assert.match(source, /\['mods', 'MODS'\]/)
  assert.match(source, /\['subscribed', 'SUBSCRIBED MODS'\]/)
  assert.match(source, /\['parties', 'PARTIES'\]/)
  assert.match(source, /api\.mods\.list\(\{ sort: 'newest', pageSize: 50 \}\)/)
  assert.match(source, /usePartyDirectory\(tab === 'parties'\)/)
  assert.match(source, /usePartyJoinActions\(requesterDisplayName, onPartyResolved\)/)
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
  assert.match(menu, /<div className="main-menu-native-stage dark-cloud-stage" inert=\{darkCloudMenuOpen \|\| undefined\}>/)
  assert.doesNotMatch(menu, /className="main-menu-native-stage dark-cloud-stage" style=/)
  assert.match(css, /\.main-menu-native-stage\.dark-cloud-stage \{[\s\S]*?inset: 0;[\s\S]*?width: 100%;[\s\S]*?height: 100%;/)
  // The stage origin is already safe-area inset by .main-menu-page (main-menu.css); the
  // scene must not inset again or the phone geometry loses the inset twice.
  assert.doesNotMatch(css, /env\(safe-area-inset/)
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

test('Dark Cloud Esc menu is the native gameplay pause menu', () => {
  // The scene only raises the request; MainMenuScene owns the menu and mounts GameplayPauseMenu.
  assert.match(source, /menuKeyCode: string/)
  assert.match(source, /event\.code !== menuKeyCode/)
  assert.match(source, /if \(menuOpen \|\| searchOpen \|\| sortOpen \|\| detailMod\) return/)
  // The skull is the stage-level GameMenuSkull MainMenuScene mounts over the scene; the
  // scene paints none of its own.
  assert.doesNotMatch(source, /className="dark-cloud-menu"|dark-cloud\/skull\.png/)
  assert.doesNotMatch(css, /\.dark-cloud-menu\s*[{,]/)
  assert.match(menu, /<GameMenuSkull\n\s+availability=\{!darkCloudMenuOpen && settingsContext === null \? 'available' : 'inert'\}\n\s+frameScale=\{1\}\n\s+onOpenMenu=\{openDarkCloudMenu\}\n\s+scene="dark-cloud"/)
  assert.doesNotMatch(source, /dark-cloud-menu-plates|dark-cloud-menu-panel|crest|>RESUME<|>MAIN MENU</)
  assert.doesNotMatch(css, /dark-cloud-menu-plates|dark-cloud-menu-panel|dark-cloud-panel-crest/)
  assert.match(menu, /<GameplayPauseMenu\n\s+audio=\{audio\}\n\s+backAction="resume"\n\s+className="dark-cloud-pause-stage"/)
  // Escape stays consumed (native 0x005A8950 swallows the second OPEN MENU); the skull and
  // controller B still back out through RESUME.
  assert.match(menu, /escapeAction=\{null\}/)
  assert.match(menu, /menuKeyCode=\{gameSettings\.controls\.openMenu\}/)
  assert.match(menu, /menuOpen=\{darkCloudMenuOpen \|\| settingsContext !== null\}/)
  assert.match(menu, /className="main-menu-native-stage dark-cloud-stage" inert=\{darkCloudMenuOpen \|\| undefined\}/)
  assert.match(menu, /playerId=\{DARK_CLOUD_PAUSE_OWNER_ID\}/)
  assert.match(menu, /ownerPlayerId: DARK_CLOUD_PAUSE_OWNER_ID,\n\s+source: 'pause-menu'/)
  assert.match(menu, /style=\{darkCloudPauseStageStyle\}/)
  // Rows are the Dark Cloud's own (0x005A5530): RESUME / GAME SETTINGS / SIGN OUT / MAIN MENU; guests drop SIGN OUT.
  assert.match(menu, /const darkCloudMenuRows = accountUsername \? NATIVE_DARK_CLOUD_MENU_ROWS : NATIVE_DARK_CLOUD_GUEST_MENU_ROWS/)
  assert.match(menu, /nativePauseMenuStagePlacement\(fixedViewport, darkCloudMenuRows\)/)
  assert.match(menu, /rows=\{darkCloudMenuRows\}/)
  assert.match(menu, /onSelect=\{\(action\) => \{\n\s+setDarkCloudMenuOpen\(false\)\n\s+if \(action === 'settings'\) setSettingsContext\('dark-cloud'\)\n\s+else if \(action === 'sign-out'\) onSignOut\(\)\n\s+else if \(action === 'leave'\) transitionTo\('root'\)/)
  assert.match(menu, /onSignOut: \(\) => void/)
  // SIGN OUT ends the site session itself, the same logout the account pages use.
  assert.match(game, /const \{ user, loading: authLoading, logout \} = useAuth\(\)/)
  assert.match(game, /onSignOut=\{logout\}/)
})
