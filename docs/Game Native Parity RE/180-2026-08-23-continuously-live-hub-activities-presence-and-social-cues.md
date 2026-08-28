# 2026-08-23 — Continuously live Hub activities, presence, and social cues

## Reported smell and parity question

- Reported web behavior: opening Inventory, the full Skill Book, or the compact
  HUD selector in a Hub acquires the Website gameplay-pause barrier. One
  participant's optional surface therefore stops the shared Hub for every
  resident and stops that participant's own background presentation.
- Requested behavior: every optional Hub surface is participant-local. It may
  block only that participant's gameplay input while the authoritative Hub and
  the local WebGL presentation continue advancing. Other players see `Paused`
  for the Pause Menu or `Occupied` for another local activity on the player's
  card and through a small indicator over the wizard.
- Requested social audio: one small cue follows each authoritative chat
  delivery, each newly observed College participant, and each observed College
  departure, including a participant leaving for a Boneyard to find Solomon.
- Reproduction membership: all five Hub regions; Pause, Settings, Inventory,
  SkillScreen, the primary/A/B HUD selector, all trader dialogue/service
  variants, chat, player profile, party settings, and Boneyard selection;
  join, disconnect, Hub-to-Boneyard departure, return, reconnect baseline,
  same-region/off-region presentation, and active-Boneyard counterparts.
- Falsifiers: any Hub `client-gameplay-pause` source holds a tick; a local Hub
  modal stops its presentation loop; one participant's activity blocks a peer;
  activity survives a world exit or save; a card/indicator names the wrong
  player; an optimistic/rejected/duplicate chat produces audio; reconnect plays
  historical join cues; or Boneyard optional books cease to hold their party.

This reopens two earlier Website adaptations. The 2026-08-21 book entry made
optional Hub books shared barriers, and the 2026-08-22 live-Hub entry explicitly
left Inventory, SkillScreen, chat, player cards, party controls, and the
Boneyard picker outside its membership. That split optional-modal policy is the
missed system rule. This entry supersedes those Website dispositions for Hub
worlds only; their retail evidence and every active-Boneyard disposition remain
valid.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing retail modal trace | retail `SolomonDark.exe` 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Pause `0x0058EA50`, Inventory `0x00555810`/`0x005684C0`, SkillScreen `0x005CA640`, compact selector `0x005D8120`/`0x00657A70`, suspension helper `0x005CBD40` | Optional native surfaces suspend one process-local active region. Retail has no remote participant or shared-Hub authority policy. | high |
| Existing retail Hub/UI trace | `native-hub-and-economy.md`; dialogue action `0x00501800`, common lifetime `0x00505010`, service dispatcher `0x00514A20` | Dialogue/service and book owners are independent actor/UI lifetimes with their own close/replacement paths. | high |
| Existing negative social census | `native-player-chat-boundary.md`; input/class/network/audio census; audio rows 0, 131, and 150 | Retail owns no player chat, multiplayer presence, join/leave notification, or proved chat-notification sound. Message-named streams 131/150 may not be assigned by name alone. | high |
| Current Website causal trace | Website `origin/main` `1a195086`; `MainMenuScene.tsx`, `HubScene.tsx`, `game-client-session.ts`, `game-host.ts`, `shared-game-worlds.ts` | Pause is already local in Hub, but Inventory/SkillScreen/HUD selector still publish source-qualified pause requests. Dedicated and shared hosts accept those sources, and the shared host can skip its entire Hub tick. `HubScene` also stops its presentation loop whenever a gameplay pause is projected. | high |
| Current Website social seam | protocol 65 snapshots/chat, `GameChat`, `world-speech-presentation.ts`, party/player-card UI, resident Web Audio master | Authoritative sender and Hub membership edges already exist. The missing pieces are bounded ephemeral activity projection and one-shot presentation consumers; neither needs save, simulation, Lua, or transcript authority. | high |

No new retail address, table, asset, or trigger was recovered in this pass, so
the Mod Loader reports remain the durable native authority and receive no
duplicate Website-only policy edit.

## System boundary and membership inventory

Native/web system: the complete optional participant-owned Hub activity
lifetime, from local surface admission through input exclusion, ephemeral
presence projection, continuously live simulation/presentation, and balanced
teardown, plus social audio derived from already-authoritative chat and Hub
membership edges.

| Member | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Hub Pause Menu, Resume, Settings child, and Leave handoff | root local Pause owner; native rows from `0x0058EA50` | `exact-ported` to requested live-Hub policy | status `paused`; no network pause; local and peer ticks/render frames advance; close clears status |
| Hub Inventory, including SkillScreen-to-Inventory replacement | `HubInventoryUi` plus root inventory request | `exact-ported` to requested live-Hub policy | status `occupied`; inventory actions remain authoritative while both clients continue |
| full Hub SkillScreen, including Inventory replacement | root `SkillBook` | `exact-ported` to requested live-Hub policy | status `occupied`; no `skill-book` pause packet; selection/binding remains owner-only |
| compact primary, concentration A, and concentration B selector | root `HudSkillSelector`; native owner `0x005D8120` | `exact-ported` to requested live-Hub policy | status `occupied`; local sound mute remains; addressed mutation works without a Hub barrier |
| Hagatha/Fomentius/Luthacus/Shlorio dialogue and service, all intro/prices/replacement/back/range exits | scene-local `HubUiSurface` | `verified-already-at-requested-policy`; presence added | status `occupied`; existing live tick/render and transaction paths remain |
| chat composer for Global, Party, and Whisper | `GameChat` focus owner | `verified-already-at-requested-policy`; presence added | status `occupied`; only local gameplay input stops; close clears it |
| player profile card and party settings | `HubScene` local modals | `verified-already-at-requested-policy`; presence added | status `occupied`; no host barrier or peer input effect |
| multi-choice Boneyard picker | Hub leader-local picker | `verified-already-at-requested-policy`; presence added | status `occupied` until selection/cancel; departure resets status |
| party panel expansion, invitation toast, HUD buttons | nonmodal Hub controls | `out-of-system` (do not own the local gameplay-input exclusion) | no false Occupied state |
| dedicated/private/shared Hub simulation and WebGL presentation | host fixed tick plus `HubScene` presentation loop | `exact-ported` to requested policy | never conditionally held by optional activity; input is idle only for the activity owner |
| crafted Hub `pause-menu`, `inventory`, `skill-book`, or `skill-selector` request | client and host admission gates | `exact-ported` to requested policy | every source is suppressed/rejected in Hub; no pause message/state |
| active-Boneyard Pause/Inventory/SkillScreen/HUD selector | existing dedicated/party-run pause owner | `verified-already-at-parity` | source-qualified first owner still freezes that run and resumes without catch-up |
| mandatory level-up picker/barrier | `levelUpBarrier` | `out-of-system` (mandatory cohort progression, not optional Hub activity) | existing no-tick barrier and live frozen background stay unchanged |
| `paused`/`occupied`/clear activity state | authenticated client intent; host connection owner; protocol 66 Hub participant projection | `out-of-system` native extension | strict values, last state per participant, snapshot/late-view projection, no save/Lua/Hall state |
| player profile text | selected same-region player card | `out-of-system` native extension | exact `Paused` or `Occupied` label bound to the selected participant |
| overhead pause/occupied badge | Hub post-world screen-space layer | `out-of-system` native extension | local and remote same-region active players only; pause bars versus occupied dots; resize/camera/lifecycle coverage |
| activity owner input | client block plus host connection gate | `exact-ported` local-modal principle | held/queued input clears on activity; peers and ambient simulation continue |
| activity disconnect/world exit/return/reconnect/save | host connection/world lifecycle | `exact` extension boundary | removed on departure, returns clear, initial snapshot is baseline, never serialized |
| accepted authoritative chat echo for local sender | existing `server-chat` delivery | `out-of-system` native extension | one chat cue confirms delivery; draft/rejection is silent |
| accepted incoming Global/Party/Whisper chat | existing recipient routing | `out-of-system` native extension | one cue only on clients which received the event; duplicates/stale sequences are silent |
| College join observed by an existing Hub client | participant-id addition between authoritative Hub snapshots | `out-of-system` native extension | one join cue per new nonself id; initial/re-entry baseline is silent |
| disconnect or depart-for-Solomon observed by a remaining Hub client | participant-id removal between authoritative Hub snapshots | `out-of-system` native extension | one leave cue per removed nonself id, including party-run departure |
| observer leaves/re-enters the Hub | client membership-audio cursor | `exact` extension boundary | Boneyard transition clears observation; re-entry seeds without a burst of historical cues |
| social cue assets and routing | native registry-zero `sounds\\click` through resident one-shot master | exact native asset; explicit new triggers/pitches | chat rate `1.10`, join `1.25`, leave `0.85`, each gain `0.65`; music-independent sound mute applies |
| message-named streams 131/150 | native audio catalog only | `out-of-system` | no unproved semantic reuse |
| Pause/SkillPicker mute overlap | existing non-music master | `verified-already-at-requested-policy` | social edge is consumed silently at zero master and never queued/replayed |
| session teardown | root state, connection, renderer, cursors | `exact` lifecycle boundary | activity/cursors/views/listeners destroyed with no retained timer or sound |
| title, Create, loading, loadout, Game Over, Dark Cloud | outside a live Hub participant | `out-of-system` | independent owners and no Hub presence projection |

No member is blocked by the browser platform.

## Ownership thread and recovered/requested contract

- `MainMenuScene` combines every root/scene local activity into one three-state
  projection with strict precedence: Pause/Settings is `paused`; any other
  input-owning optional Hub surface is `occupied`; otherwise it is clear.
- `GameClientSession` sends only state edges. The host authenticates the
  participant, stores the transient value on that live connection, clears that
  participant's held/queued Hub input, and projects the value into only Hub
  snapshots. It never puts activity in the simulation tick, save document,
  party directory, Hall receipt, chat event, or Lua state.
- Hub activity is many-participant presence, not a renamed singleton pause.
  It cannot use `GameplayPauseState`. The Hub has no optional gameplay-pause
  owner at all; every pause source is rejected there, and the shared-world
  scheduler always steps the Hub. Party/dedicated Boneyard pause ownership is
  unchanged.
- The activity badge shares the final post-world camera transform used by
  nameplates and speech, includes the local wizard, filters to the viewer's
  active region, and owns no world sorting, collision, lighting, or input.
- Chat audio consumes the same already-deduplicated authoritative event as the
  transcript and world speech. College membership audio compares consecutive
  authoritative Hub participant-id sets. Both are presentation effects and do
  not acknowledge, delay, reorder, or widen their source events.
- The native `click` WAV is used because it is an already exact, small resident
  one-shot. Pitch distinguishes the three explicit Website meanings without
  inventing a native trigger or mislabeling the unproved message streams.

## Confidence and open questions

- Confirmed: complete native modal/suspension membership; absence of native
  player chat/presence/join cues; every current Hub modal owner; client/host
  pause writers; shared-Hub scheduler branch; snapshot and renderer seams.
- Inferred: none used as native fact. Labels, badge geometry, cue triggers,
  pitch, and gain are explicit requested Website multiplayer presentation.
- Unknown: none material. Retail cannot supply a multiplayer authority or
  social-notification policy because those systems are absent.

## Web implementation consequence

- The concurrent durable-profile change owns protocol 65. Advance the combined
  strict wire to protocol 66 with a Hub-activity message and a required activity
  field on each protocol Hub participant. Keep the core simulation participant
  and save shape unchanged.
- Remove the shared-Hub pause scalar and conditional tick branch. Suppress all
  client Hub pause sources and independently reject all raw host requests.
- Request Inventory/SkillScreen/HUD-selector gameplay pause only in Boneyard.
  Remove Hub presentation-pause plumbing rather than retaining a dead switch.
- Add one scene callback for all `HubScene` input-owning optional surfaces, one
  root activity reducer, one profile label, and one post-world badge layer.
- Add a bounded Hub-membership audio cursor and session-level chat/membership
  consumers. Do not add optimistic UI sounds, server audio events, history
  replay, stream-name guesses, or per-component sound calls.

## Validation contract

- Protocol/snapshot: strict activity values and required fields, protocol 66,
  full/delta reconstruction, discrete timeline state, and malformed rejection.
- Host/client: all four Hub pause sources are inert; activity blocks only the
  owner input while Hub tick/peer movement advance; Boneyard source
  replacement/hold/resume remains; activity clears on departure/teardown.
- UI/renderer: every listed optional Hub surface maps to the correct state;
  card text and local/remote same-region badges agree; off-region/absent/clear
  players produce no badge; camera/resize/destruction are covered.
- Audio: initial/re-entry baseline, one/many joins and departures, Boneyard
  observation reset, all chat channels including local echo, rejection,
  duplicate, mute, and teardown; exact cue/rate/gain assertions.
- Mac Chrome: two or more participants exercise Pause, Settings, Inventory,
  SkillScreen, compact selector, dialogue/service, chat, player card, party
  settings, and Boneyard picker while both authoritative tick and the local
  renderer advance. A peer observes Paused/Occupied card/badge state. Chat,
  join, disconnect, and party departure each produce exactly the expected
  little cue, with no replay and empty page/console/network error arrays.
- The exact candidate passes `./scripts/validate.sh` on the Mac mini.

## Implementation validation receipt

- Protocol 66 adds strict `client-hub-activity` edges and a required ephemeral
  activity field on protocol Hub participants while preserving protocol 65's
  durable save intent. `GameHost` stores activity on the authenticated live
  connection, clears only that participant's Hub input, and projects it into
  snapshots without changing the core Hub participant or save shapes. Every
  crafted Hub gameplay-pause source is rejected; the shared-world scheduler no
  longer has a Hub hold branch. Dedicated and party Boneyards retain their
  source-qualified first-owner pause barriers.
- `MainMenuScene` reduces the complete optional Hub UI inventory to
  `paused`/`occupied`/clear and requests book/selector pause only in Boneyard.
  `HubScene` reports every scene-local input-owning surface but no longer owns a
  presentation-pause switch. The selected Player Card shows `Paused` or
  `Occupied`, and one post-world Pixi layer draws pause bars or occupied dots
  above local and remote same-region wizards.
- Chat/world-speech audio moved to the session-level authoritative message
  subscription. The bounded Hub membership cursor seeds initial/re-entry state
  silently and produces one native `click` request per observed join or
  departure. Exact explicit product pitches are chat `1.10`, join `1.25`, and
  leave/depart-for-Solomon `0.85`, all at gain `0.65`; the existing non-music
  master consumes muted edges silently without replay.
- The focused branch ultimately rebased over Website `origin/main`
  `70849ccfdf02b6eede996caa8669fb4d6d804f4b`, preserving the concurrent
  durable-profile, native inventory interaction, complete controller, and Imp
  landing/presentation closures. The protocol-66 conflict resolution retains
  both the Imp effect/state fields and Hub activity. Earlier Mac gates exposed
  one strict test-only record cast and one stale Hub selector-pause fixture;
  both now exercise their correct strict/Boneyard owners.
- Exact functional candidate
  `4417da2534cc8ef0bcbd0d77527cadf5bee0c101` and the Mac checkout had a
  byte-identical 31-file manifest with aggregate SHA-256
  `c2792d5879d47e2c48b2945d4d77bff7e554ef06dc5fb98a24930d2a1060f10b`.
  On Apple arm64 macOS `26.6.2`, Node `22.17.0`, npm `10.9.2`, .NET
  `10.0.302`, and Chrome `151.0.7922.170`, the canonical
  `./scripts/validate.sh` gate passed: backend build and `17/17` contracts,
  lint with zero errors and the eight existing warnings, import boundaries,
  all `1975/1975` frontend/desktop tests, production build, media policy, and
  game bundle budget (`445958` raw / `125546` gzip). Gate-log SHA-256 is
  `34b1a5592becde2bfb2b2cb66787c56529b69e512fbc2f914dcfe0ca62715880`.
- Mac Chrome Pause/Inventory/SkillScreen/compact-selector/dialogue/Settings
  acceptance kept the authoritative Hub and local frame advancing. The local
  Hub Pause advanced tick `2076 -> 2132`; Boneyard owner/peer barriers held at
  `3127`/`3129` and resumed at `3132`. The exact pause-smoke log SHA-256 is
  `c4b6b50bfbec81110d2a179ff1f8f675890ffc0f2ea82bd3738323adbcb8d6f9`.
- Production-bundle desktop and mobile shared-Hub journeys each observed
  exactly `7` chat cues, `4` College join cues, `1` disconnect cue, and `3`
  simultaneous party-departure cues when the group went to find Solomon.
  Both retained two live Hub observers while the party run advanced, finished
  at zero sessions/players/parties/runs, and returned empty page, console,
  failed-response, and unexpected-request arrays. Log SHA-256 values are
  `624cc6573ffe3d9c28a468935b11e738061b477afd02f1afa8bfd140ed223713`
  (desktop) and
  `9a9e4d3f8baf8aef36d5c7093420258ef3639073aa156a915e8945327a46ec98`
  (mobile).
- Reviewed same-region pause-badge captures are visibly clear at both
  viewports: desktop SHA-256
  `7e7fd2143e3c5f278b1cd80083a18f40e649a0d180a27729721be7d6aaad397a`
  and mobile SHA-256
  `11915f7c17742a1f7e5db32f67fcdb88eff8158b6406366fafa58099416f046e`.
  Reviewed desktop/mobile fading world-speech captures are
  `cb6cacaeab93859376e4d3a7dd52ee020a542c5ae6522d92b2f27b2061b6d38c`
  and
  `c56b83551d0bc0fc615c741a587f5e6b759802c30d1faf0004424db122342152`.
  The Player Card label was asserted in the same real-browser journeys. No
  member is browser-blocked. Nothing was pushed, deployed, or restarted in
  production.
