import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const join = await readFile(new URL('./JoinPartyScene.tsx', import.meta.url), 'utf8')
const menu = await readFile(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const darkCloud = await readFile(new URL('./DarkCloudScene.tsx', import.meta.url), 'utf8')
const hub = await readFile(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const consent = await readFile(new URL('./PartyJoinConsentDialog.tsx', import.meta.url), 'utf8')
const moddedPlay = await readFile(new URL('./ModdedPlayDialog.tsx', import.meta.url), 'utf8')
const partySettings = await readFile(new URL('./PartySettingsDialog.tsx', import.meta.url), 'utf8')
const partyCss = await readFile(new URL('./party-settings.css', import.meta.url), 'utf8')
const joinCss = await readFile(new URL('./join-party.css', import.meta.url), 'utf8')

test('Play owns a dedicated mobile Party ID and directory wrapper', () => {
  assert.match(menu, /action="join-party" accessibleLabel="Join party"/)
  assert.match(menu, /screen === 'join-party'/)
  assert.match(join, /usePartyDirectory\(true\)/)
  assert.match(join, /usePartyJoinActions\(requesterDisplayName, onResolved\)/)
  assert.match(join, /autoCapitalize="characters"/)
  assert.match(join, /autoCorrect="off"/)
  assert.match(join, /enterKeyHint="go"/)
  assert.match(join, /window\.visualViewport/)
  assert.match(join, /directoryPartyPresentation\(party\)/)
  assert.match(join, /className=\{`join-party-status/)
  assert.match(join, /className="join-party-location"/)
  assert.match(join, /className="join-party-squad"/)
  assert.match(joinCss, /\.join-party-squad/)
  assert.match(joinCss, /grid-template-areas:[\s\S]*?'list'[\s\S]*?'actions'/)
  assert.doesNotMatch(joinCss, /span:nth-child\(2\)\s*\{\s*display:\s*none/)
})

test('Dark Cloud keeps its distinct party wrapper over the same headless modules', () => {
  assert.match(darkCloud, /usePartyDirectory\(tab === 'parties'\)/)
  assert.match(darkCloud, /usePartyJoinActions\(requesterDisplayName, onPartyResolved\)/)
  assert.match(darkCloud, /directoryPartyAction\(party\)/)
  assert.match(darkCloud, /disabled=\{busy \|\| action === 'wait'\}/)
  assert.match(darkCloud, /directoryPartyPresentation\(party\)/)
  assert.match(darkCloud, /selectedPartyAction === 'wait'[\s\S]*?'IN GAME'/)
  assert.match(darkCloud, /prefetchGameContent/)
  assert.match(darkCloud, /className="dark-cloud-download"/)
  assert.match(darkCloud, /REQUEST/)
})

test('modded joining distinguishes persistent account sync from guest session content', () => {
  assert.match(consent, /SYNC MODS & JOIN/)
  assert.match(consent, /DOWNLOAD & JOIN ONCE/)
  assert.match(consent, /ACTIVE MODS AND CHEATS WILL BE DISABLED/)
  assert.match(consent, /DISABLE & JOIN/)
  assert.match(moddedPlay, /DISABLE ALL MODS/)
  assert.match(menu, /api\.mods\.subscriptions\.sync/)
  assert.match(menu, /prefetchGameContent/)
})

test('party cog owns Party ID, visibility, guest requests, copy, rotation, leave, and kick', () => {
  assert.match(partySettings, /navigator\.clipboard\?\.writeText\(state\.party\.joinCode\)/)
  assert.match(partySettings, /INVITE ONLY/)
  assert.match(partySettings, /state\.joinRequests/)
  assert.match(partySettings, /REGENERATE/)
  assert.match(partySettings, /LEAVE PARTY/)
  assert.match(partySettings, />KICK</)
  assert.match(partySettings, /\{leader \? \([\s\S]*<h3>PARTY ID<\/h3>[\s\S]*\) : null\}/)
  assert.match(hub, /party\.memberPlayerIds\.length > 1[\s\S]*aria-label="Party settings"/)
  assert.match(partyCss, /min-height:\s*44px/)
})

test('only the current leader receives the Player Card invite action', () => {
  assert.match(hub, /partyState\.party\.leaderPlayerId === playerId[\s\S]*!alreadyTogether[\s\S]*Invite to Party/)
  assert.match(menu, /session\.onPartyAction/)
  assert.match(hub, /className="hub-party-error" role="alert"/)
})
