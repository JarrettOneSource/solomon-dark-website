# 2026-08-22 — Party social presentation, player cards, and host-routed whispers

## Reported smell and parity question

- Publication request: recover the completed Claude party/social rework, carry
  it over the newer authoritative-host and Earth Boulder changes on `main`,
  publish it with the Dark Cloud mobile rework, and remove its temporary
  branches/worktrees afterward.
- The behavioral question is whether the rework preserves the existing
  shared-Hub party authority while adding only presentation and an explicit
  host-routed private-text lane. Retail Solomon Dark has no player-card,
  Website party, or player-chat owner, so these members remain deliberate web
  product extensions rather than claims of native behavior.
- Falsifiers: client-authored sender identity, delivery outside the selected
  pair, a self/missing/disconnected target being accepted, social metadata
  changing gameplay authority, a nonparty player leaking into the Ally HUD,
  touch controls shrinking with the logical stage, or either stale source
  branch's incompatible protocol number surviving integration.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing native boundary | 2026-08-20 shared-Hub party entry and 2026-08-21 player-chat entry in this ledger; `native-player-chat-boundary.md` | Retail owns neither Website parties/player cards nor player text chat. Native participation, world transition, HUD input priority, and fixed ally-row facts remain the protected boundary. | high |
| Recovered Website change | clean branch `claude/party-social-20260821`, original commit `7e7dba58fa11e831b6afebaa9083d0a7ae2d386b`; `GameChat.tsx`, `HubScene.tsx`, `AllyHud.tsx`, `game-host.ts`, `party-system.ts`, protocol and tests | The change adds one active Whisper target, host pair routing, richer informational Hub profiles, party/ally presentation, local playtime accumulation, and device-independent social sizing. | high |
| Integration conflict | Website `origin/main` `450ba958746c0ad33b0516a7c2b8becfc3b62a36`; protocol 51 Earth-Boulder contract plus the party branch's independent protocol-50 claim | Both wire changes must coexist under a new incompatible generation. The integrated tree uses protocol 52 and retains both validation bodies. | high |

No new reusable native address, asset table, or authored row was recovered, so
the existing Mod Loader native reports remain authoritative and unchanged.

## System boundary and membership inventory

Native boundary: the existing shared-Hub party topology, fixed ally state, and
UI input priority. Web extension boundary: connected-player social
presentation and ephemeral one-to-one text carried by the authoritative host.

| Member (scene/state/branch) | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Party roster panel, count, leader and local-player badges | `HubScene`, authoritative `LocalPartyState` | `out-of-system` (intentional Website social presentation) | UI derives membership and leadership only from host state. |
| Player Card identity, class, live gold and profile actions | `HubScene`, current snapshot and party projection | `out-of-system` (intentional Website social presentation) | Live economy remains snapshot-authored; profile closes before message/invite actions. |
| Account badge, highest wave and total playtime | client hello -> host profile map -> party projection | `out-of-system` (informational Website metadata) | Strict nullable/bounded wire fields; never consumed by authentication, simulation, saves, leaderboard authority, or party admission. |
| Local playtime accumulation | `playtime-store.ts`, browser local storage | `out-of-system` (device-local informational statistic) | Corrupt/negative/fractional/unsafe values read as zero; interval and final flush accumulate monotonically. |
| Whisper request and strict wire shape | Player Card -> `GameChat` -> `GameClientSession` -> protocol 52 | `out-of-system` (Website text extension) | `targetPlayerId` exists exactly for client Whisper; resolved recipient exists exactly for server Whisper. |
| Whisper routing and rejection | `game-host` authenticated connection map | `out-of-system` (Website text extension) | Host-authored sender; exactly sender plus connected nonself target receive; outsider sees nothing; self/missing/disconnected target gets `target-unavailable`. |
| Whisper presentation lifecycle | session-scoped `GameChat` | `out-of-system` (Website text extension) | Player Card opens/focuses Whisper; incoming events retarget an idle thread; an in-progress draft keeps its target; unread and departed-target states remain bounded and local. |
| Global and Party chat | protocol-49 owner retained under protocol 52 | `verified-already-at-parity` with the prior designed web contract | Hub/party/run routing, rate limit, normalization, input exclusion, local history, and teardown remain unchanged. |
| Party-scoped remote-player Ally HUD rows | `AllyHud` and party member ids | `out-of-system` (explicit social-presentation override) | Only living nonlocal party players render, ordered by stable id with live health and element identity. |
| Golem Ally HUD row | native Golem state producer plus shared presentation row | `verified-already-at-parity` mechanically; presentation intentionally restyled | Actor/world membership and live health remain native-derived; no player profile data enters it. |
| Coarse-pointer HUD scaling | scene `--hud-display-scale` and social counter-scale | `out-of-system` (browser responsive composition) | Party, player-card, chat and ally controls retain physical touch size while the logical stage scales. |
| `SDR_GAME_SHARED_HUB` runner flag | local `run-game-host` harness seam | `out-of-system` (development-only topology switch) | Default remains the private shared-credential host; only explicit `1` selects multi-client ticket-mode shared Hub for smoke acceptance. |

There are no `blocked-by-platform` members and no undispositioned sibling rows.

## Ownership and behavioral contract

- Party membership, leader, invitations, world placement, run membership and
  snapshot routing remain host-authoritative. Social rendering consumes those
  projections and cannot mutate them except through existing validated invite
  and accept commands.
- The Whisper packet supplies text and a target id only. The host derives the
  authenticated sender, resolves the currently open nonself target on the same
  host, allocates the global chat sequence, and sends one encoded event to the
  target and sender. The existing five-per-five-second rate gate is shared by
  Global, Party and Whisper.
- The client keeps one active Whisper target over the bounded session chat log.
  A Player Card request opens and focuses that target. An incoming Whisper may
  retarget an idle thread for reply; it cannot replace a different target while
  the user is composing. Departure is rejected at send time and surfaced as a
  local status rather than a disconnect.
- Account username, highest wave and total playtime are explicitly
  self-reported display metadata. Authentication tickets, leaderboard user id,
  authoritative gold, party membership and gameplay state retain their
  existing owners.
- The player Ally HUD is an explicit Website social-presentation override. Its
  membership and health remain authoritative; the new portrait chips, element
  accents and responsive placement are not represented as retail pixels.

## Web implementation consequence

- Protocol 52 is the sole integrated wire identity: it includes protocol-50
  movement scale, protocol-51 Earth Boulder residuals, and the new social/
  Whisper fields. No compatibility shim preserves either stale protocol claim.
- `game-runtime-architecture.md` supersedes its old no-Whisper statement and
  records the pair-routing and informational-profile boundaries.
- No native Mod Loader code or documentation changes because the work adds no
  native fact and does not change the stock-to-web ownership boundary.

## Validation contract

- Canonical `./scripts/validate.sh` on the exact integrated tree.
- Party/chat contracts must cover strict wire membership, host-authored sender,
  exact pair delivery, outsider isolation, unavailable/self targets, profile
  projection, playtime corruption/flush, chat targeting and party-scoped ally
  rows.
- Real Chrome shared-Hub journey must exercise the Player Card, invite/party
  roster, Whisper send/reply/unread path, desktop and coarse-pointer social
  composition, Hub-to-Boneyard party scope, and empty page/console errors.
- Repeat the canonical gate and real-browser party journey on the Mac mini
  against the exact final Git tree before publication.

## Implementation validation receipt

- Integration state: the two stale branches were replayed over Website
  `origin/main` `450ba958746c0ad33b0516a7c2b8becfc3b62a36`. The append-only Dark Cloud
  ledger conflict preserves both histories, and the independently claimed
  protocol versions are replaced by strict protocol 52.
- Integration review found one lifecycle defect that the original focused
  tests did not exercise: the parent retained an already-handled Player Card
  Whisper request, so disabling chat during loading and enabling it in the
  Boneyard selected Whisper again. `GameChat` now acknowledges the handled
  request and `MainMenuScene` clears it; the active session thread remains
  available without replaying the one-shot open intent. The real party smoke
  now pins Player Card -> Whisper, exact pair delivery, outsider isolation,
  reply targeting, Hub/Boneyard channel membership, and this transition.
- Exact-tree identity: local and Mac mini started at Website `origin/main`
  `450ba958746c0ad33b0516a7c2b8becfc3b62a36`; their complete binary diff hashes
  matched at
  `befb6f7e8b55e55f64eba2e0732b2fea04b5b5a812bcf9f8aa3e84d987577481`
  before validation.
- Local canonical `./scripts/validate.sh` passed: `15/15` backend/contracts,
  `4/4` library, `43/43` loot, `226/226` prerequisite, `1270/1270` broad game,
  `29/29` party/chat/playtime, `11/11` level-up/HUD, `7/7` diagnostics,
  `17/17` Hall, `16/16` Hub UI, `5/5` desktop, production build, media policy,
  and bundle budget. `Game-5-cB1Qjm.js` was `393063` raw / `109978` gzip bytes.
  Only the eight existing Fast Refresh advisories remained.
- Local Chrome acceptance passed on the production bundle. Dark Cloud matched
  `1600x900`, `390x844`, and `844x390` viewports with zero horizontal overflow,
  `44 px` minimum touch targets, and empty page/console/failed-response arrays.
  Mobile and desktop shared-Hub journeys each returned `status: ok` on protocol
  52, delivered Aurelia's Whisper to Daria and the echo to exactly that pair,
  retained Party/Global isolation, entered one three-member Boneyard while the
  outsider stayed movable in Hub, and ended at zero sessions/players/parties/
  runs with empty page and console errors. The visually inspected Whisper
  captures hash to
  `736e2153053470f7336daeee79dab235bfb3d659f804795da738cec13d870f87`
  (mobile) and
  `a43e04999c1f18b8c6a48028a38fc7b19c3f3d76218f87485e83f0f01fa15e6f`
  (desktop).
- Apple arm64/macOS exact-tree canonical validation passed the same counts and
  budget; `Game-CbRvnqIi.js` was `393063` raw / `109978` gzip bytes. Mac Chrome
  repeated Dark Cloud desktop/portrait/landscape and both party pointer modes
  with the same semantic results, empty error arrays, and final zero occupancy.
  Mac Dark Cloud mobile/landscape captures hash to
  `ce54b941fe39dd249cc0d8c423aac5b1ba87d57b164e535fe5a276bc25e042cb`
  and `4fd3002adad6232d7e81c6c84eaa25c63a6b3ceea0d410a6e7426ce0324e1912`;
  Mac Whisper mobile/desktop captures hash to
  `3c78192bfc9908366a585622fce8ee028930cdc02955d0849f30fc1d106585b7`
  and `9135d8cae740422b5b1e17fa481ad6706c0fd8cece4aa8fdbea38f6543678d75`.
- Publication and deployment remain separate. These receipts precede the
  requested commit/push; no production process was restarted or bypassed.
