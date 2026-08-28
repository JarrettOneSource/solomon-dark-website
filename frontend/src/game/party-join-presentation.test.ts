import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  PARTY_INVITATION_SOUND_REQUEST,
  advancePartyInvitationAudioCursor,
  createPartyInvitationAudioCursor,
} from './party-invitation-audio.ts'

const join = await readFile(new URL('./JoinPartyScene.tsx', import.meta.url), 'utf8')
const menu = await readFile(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const darkCloud = await readFile(new URL('./DarkCloudScene.tsx', import.meta.url), 'utf8')
const hub = await readFile(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const consent = await readFile(new URL('./PartyJoinConsentDialog.tsx', import.meta.url), 'utf8')
const moddedPlay = await readFile(new URL('./ModdedPlayDialog.tsx', import.meta.url), 'utf8')
const partySettings = await readFile(new URL('./PartySettingsDialog.tsx', import.meta.url), 'utf8')
const playerCard = await readFile(new URL('./PlayerCardDialog.tsx', import.meta.url), 'utf8')
const chat = await readFile(new URL('./GameChat.tsx', import.meta.url), 'utf8')
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
  assert.match(join, /PRIVATE COLLEGE/)
  assert.match(join, /MODDED · \{party\.modCount\}/)
  assert.match(join, /className="cheats">CHEATS/)
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
  assert.match(darkCloud, /PRIVATE COLLEGE/)
  assert.match(darkCloud, /MODDED · \{party\.modCount\}/)
})

test('modded joining distinguishes persistent account sync from guest session content', () => {
  assert.match(consent, /SYNC MODS & JOIN/)
  assert.match(consent, /DOWNLOAD & JOIN ONCE/)
  assert.match(consent, /ACTIVE MODS AND CHEATS WILL BE DISABLED/)
  assert.match(consent, /DISABLE & JOIN/)
  assert.match(consent, /CHEATS ENABLED FOR THIS COLLEGE/)
  assert.match(moddedPlay, /DISABLE ALL MODS/)
  assert.match(menu, /api\.mods\.subscriptions\.sync/)
  assert.match(menu, /prefetchGameContent/)
})

test('party cog owns Party ID, visibility, guest requests, copy, rotation, leave, and kick', () => {
  assert.match(partySettings, /navigator\.clipboard\?\.writeText\(state\.party\.joinCode\)/)
  assert.match(partySettings, /INVITE ONLY/)
  assert.match(partySettings, /\{leader \? \([\s\S]*<fieldset className="party-settings-group">/)
  assert.doesNotMatch(partySettings, /sessionKind === 'global-hub'/)
  assert.match(partySettings, /state\.joinRequests/)
  assert.match(partySettings, /REGENERATE/)
  assert.match(partySettings, /LEAVE PARTY/)
  assert.match(partySettings, />KICK</)
  assert.match(partySettings, /\{leader \? \([\s\S]*<h3>PARTY ID<\/h3>[\s\S]*\) : null\}/)
  assert.match(hub, /party\.memberPlayerIds\.length > 1[\s\S]*aria-label="Party settings"/)
  assert.match(partyCss, /min-height:\s*44px/)
})

test('only the current leader receives the Player Card invite action', () => {
  assert.match(hub, /partyState\.party\.leaderPlayerId === playerId[\s\S]*!alreadyTogether/)
  assert.match(playerCard, /Invite to Party/)
  assert.match(menu, /session\.onPartyAction/)
  assert.match(hub, /className="hub-party-error" role="alert"/)
})

test('chat names resolve the current reusable Player Card and private leaders can invite remotely', () => {
  assert.match(chat, /onPlayerCardRequest\(message\.sender\.playerReference\)/)
  assert.match(chat, /messageCardTarget\(message, session\.playerId\)/)
  assert.match(menu, /session\.resolvePlayerCard\(playerReference\)/)
  assert.match(menu, /<PlayerCardDialog/)
  assert.match(menu, /session\.inviteToCollege\(resolvedPlayerCard\.playerReference\)/)
  assert.match(menu, /<CollegeInvitationDialog/)
  assert.match(menu, /await leaveGameplayForPartyTransfer\(\)/)
})

test('incoming invitation audio is edge-triggered from a session baseline without snapshot replay', () => {
  assert.deepEqual(PARTY_INVITATION_SOUND_REQUEST, {
    cue: 'click',
    playbackRate: 1,
    volume: 1,
  })

  let cursor = createPartyInvitationAudioCursor(['invite-1'])
  let delta = advancePartyInvitationAudioCursor(cursor, ['invite-1'])
  assert.equal(delta.newInvitationCount, 0)
  cursor = delta.cursor

  delta = advancePartyInvitationAudioCursor(cursor, ['invite-1', 'invite-2', 'invite-3'])
  assert.equal(delta.newInvitationCount, 2)
  cursor = delta.cursor

  delta = advancePartyInvitationAudioCursor(cursor, [])
  assert.equal(delta.newInvitationCount, 0)
  cursor = delta.cursor
  delta = advancePartyInvitationAudioCursor(cursor, ['invite-2'])
  assert.equal(delta.newInvitationCount, 0, 'an id already seen in this session does not re-arm')

  const reconnect = createPartyInvitationAudioCursor(['invite-4'])
  assert.equal(
    advancePartyInvitationAudioCursor(reconnect, ['invite-4']).newInvitationCount,
    0,
    'pending reconnect history seeds a new baseline',
  )
})

test('Main Menu consumes invitation edges beside the session party-state owner', () => {
  assert.match(
    menu,
    /partyInvitationAudioCursorRef\.current = initialPartyState\s*\? createPartyInvitationAudioCursor\(initialPartyState\.invitations\.map\(\(\{ id \}\) => id\)\)\s*: null/,
  )
  assert.match(
    menu,
    /if \(partyInvitationAudioCursorRef\.current === null\) \{[\s\S]*createPartyInvitationAudioCursor\([\s\S]*nextPartyState\.invitations\.map\(\(\{ id \}\) => id\)[\s\S]*setPartyState\(nextPartyState\)[\s\S]*return/,
  )
  assert.match(menu, /advancePartyInvitationAudioCursor\([\s\S]*nextPartyState\.invitations\.map\(\(\{ id \}\) => id\)/)
  assert.match(
    menu,
    /for \(let index = 0; index < delta\.newInvitationCount; index \+= 1\) \{\s*audio\.playSound\(PARTY_INVITATION_SOUND_REQUEST\.cue, \{/,
  )
})
