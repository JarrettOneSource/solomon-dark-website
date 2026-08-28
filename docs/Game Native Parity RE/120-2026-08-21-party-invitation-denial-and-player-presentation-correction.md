# 2026-08-21 — Party invitation denial and player presentation correction

## Reported smell and parity question

- Reported web behavior: a received party invitation can only be accepted;
  environment-mode Boneyards place a conspicuous white oval over every player;
  and the remote-player name and health bar look like disconnected elements.
- Stock behavior to retain: player eligibility, camera-following projection,
  authoritative HP, remote-only lifecycle, Region light ownership, and every
  environment-mode branch remain governed by the recovered native systems.
- Requested Website policy: add recipient-owned invitation denial, materially
  tone down the late white direct-player aperture, and make the remote name and
  attached health bar one cohesive visual unit. The last two presentation
  choices are explicit user-authored web overrides, not claims of newly
  recovered stock constants.
- Reproduction inputs/scenes: receive and deny an invitation in the shared Hub;
  inspect one and multiple players in environment modes `0`, `1`, and `2`;
  inspect short, long, full-health, partial-health, and zero-health remote
  names in Courtyard, each private Hub room, and Boneyard.
- Falsifiable questions: whether denial merely hides local DOM state or removes
  the authoritative invitation; whether the white oval comes from Region
  analytic tint or the late direct pass; whether the name is centered on its
  own glyph run or on the unrelated 64-pixel bar minimum; and whether the
  redesign accidentally adds labels for self, summons, or invalid actors.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native instructions | retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; image base `0x00400000`; `Arena::Render 0x0046EC80`; environment pass `0x00470EE0`; direct draw `0x004713FF` | Modes `1/2` draw DeadHawg record 18 after the world with `SRCALPHA,ONE` and native alpha `.2375..25`; mode `0` has no direct pass. This native fact is unchanged. | high |
| Native durable reports | Mod Loader `docs/reverse-engineering/native-lighting-and-shadow-system.md`, `docs/ally-healthbar-investigation.md`, and `docs/design/world-render-seam.md` | Region raster/analytic lighting and the post-world remote participant indicator are independent consumers; fixed ally rows are a sibling rather than the world bar. | high |
| Existing Website causal trace | `boneyard-environment-light.ts`, `boneyard.css`, `BoneyardScene.tsx` at `1e1cb3b` | The visible white oval is a post-WebGL Canvas2D layer containing the white record-18 crop, composited with `lighter` in the canvas and `plus-lighter` over the completed scene. It does not come from actor tint or the Region multiply. | high |
| Existing Website name layout | `native-world-nameplate.ts`, `ally-hud.ts` at `1e1cb3b` | Short-name glyph positions are shifted by `-minimumBarWidth/2` even though the glyph layout exposes its own `advance`; the name is therefore centered against the 64-pixel bar estimate rather than its measured run. | high |
| Existing Website party path | `party-system.ts`, `shared-game-worlds.ts`, `game-host.ts`, `game-protocol.ts`, `game-client-session.ts`, `HubScene.tsx` at protocol `37` | Invitations are authoritative host records. Accept, disconnect, party launch, and capacity cleanup remove them; there is no recipient decline transition or wire message. | high |
| Visual supporting capture | Mod Loader `runtime/flat_multiplayer_boneyard_client.png` and `runtime/flat_multiplayer_boneyard_host.png` | The preserved native multiplayer frame shows a compact actor-following name/health treatment and dark field; it does not justify a new exact Website style constant, but it falsifies treating a dominant white web oval as visually harmless. | medium |

## System boundary and membership inventory

Native systems: the Website party-invitation lifecycle; the Boneyard Region and
late environment-player light consumers; and the remote-wizard post-world
indicator lane. Invitation denial and the requested visual styling are explicit
Website product policy around those native gameplay boundaries.

| Member (class/variant/scene/branch) | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Recipient denies a live invitation | Website party coordinator | exact-ported | recipient-only transition removes exactly one invitation and increments revision |
| Nonrecipient denial | Website authority boundary | exact-ported | rejected as `not-recipient` with identical state |
| Missing/stale denial | Website authority boundary | exact-ported | rejected as `invitation-missing` with identical state |
| Denial protocol/client/host broadcast | Website transport | exact-ported | strict protocol-38 round trip, client send, host state broadcast |
| Received-invite UI | semantic Hub party panel | exact-ported | adjacent Accept and Deny actions; Deny removes the invitation without changing membership |
| Accept, capacity, disconnect, run-start cleanup | existing Website party lifecycle | verified-already-at-parity | existing party/system/smoke coverage remains green |
| Environment mode `0` | `0x00470EE0` gate | verified-already-at-parity | no direct aperture canvas |
| Environment modes `1/2`, one or many players | `0x0047128F..0x004713FF` | out-of-system (explicit user-requested Website brightness override; native `.2375..25` remains documented) | bounded record-18 pass retained at 14 percent alpha; exact far-field transparency and three-player overlap ceiling |
| Region player/Lantern/enemy/projectile/spell sources | `0x0057FE40`, `0x0057D670` | verified-already-at-parity | no Region, analytic tint, source enrollment, or shadow change |
| Optional environment local target grids | `0x004714C8..0x00472828` | out-of-system (current web actor model has no target-mask members) | no invented record-9 fallback |
| Remote wizard in Courtyard | post-world participant indicator | exact-ported semantics; out-of-system visual style (requested redesign) | centered measured glyph run and cohesive attached bar |
| Remote wizard in Mortuary/Library/Storeroom/Office | same active-Region lane | exact-ported semantics; out-of-system visual style (requested redesign) | shared renderer layer, no room-specific path |
| Remote wizard in Boneyard | same post-world lane | exact-ported semantics; out-of-system visual style (requested redesign) | same component and HP contract under Boneyard camera |
| Short/long/space-containing supported name | group-6 glyph/kerning table | exact-ported text metrics; out-of-system plate geometry | width derives from measured layout plus fixed padding, with one compact minimum |
| Full/partial/zero health | authoritative participant snapshot | exact-ported lifecycle; out-of-system bar style | clamped fill and retained zero-health empty bar |
| Local player, summons, invalid name/max HP, offscreen actor | native remote-wizard predicate | verified-already-at-parity | remains absent |
| Disconnect/scene switch teardown | frame-local indicator list | verified-already-at-parity | stale keyed views removed and textures destroyed |
| Fixed ally HUD player/Golem rows | `0x005CF480 -> 0x005D2520` sibling | out-of-system (separate fixed-HUD owner, not requested) | no CSS or geometry change |

There are no `blocked-by-platform` members. The two visual differences are
intentional user-requested Website policy and are surfaced here instead of
being mislabeled as native parity.

## Native ownership thread

- Party owner: the host-side party coordinator owns invitations and revision;
  the UI can only request a transition. Denial therefore belongs beside accept,
  not in component-local filtering.
- Lighting owner: Region raster multiplication and analytic actor tint finish
  independently. The reported white oval is owned by the later mode-`1/2`
  record-18 surface, whose canvas is transparent outside each player draw.
- Indicator owner: participant identity/HP and presented world position derive
  a per-frame remote-wizard item; the screen-space renderer owns the glyph,
  plate, and bar and tears them down when the binding disappears.
- Entry/reset/teardown: invite creation/denial/acceptance/disconnect/run start
  mutate host state; lighting surfaces exist only for modes `1/2`; nameplate
  views follow active scene players and never persist across missing bindings.

## Recovered behavioral contract

- Denial removes only the named live invitation. It does not move either player,
  alter either party, close mod runtimes, or invalidate unrelated invitations.
- The authoritative host validates invitation id and recipient; protocol input
  remains strictly shaped. A successful denial publishes new party state.
- The direct record-18 player aperture remains bounded and additive, preserves
  slot order and flicker phase, and remains absent in mode `0`. Only its web
  opacity is deliberately scaled to `0.14` of native (`.03325..035`). This
  keeps three exactly overlapping players at or below alpha `28/255`.
- The nameplate keeps the remote-only predicate, `(actor_x, actor_y - 45)`
  anchor, screen-space scale, bitmap atlas/kerning, authoritative unsmoothed HP,
  zero-health retention, and noninteractive post-world ordering.
- The redesigned visual uses one measured glyph-run width, compact horizontal
  padding, a dark bronze-edged plate, warm bitmap text, and a directly attached
  thin health track of the same width. It adds no DOM, input, audio, RNG, or
  simulation ownership.

## Nearby-system findings

- The former name renderer passed the health-bar width into glyph placement.
  This violated its own ledger statement that both name and bar are centered;
  the redesign removes that refuted coupling for every supported name.
- Canvas `lighter` is still required internally for multiple overlapping player
  apertures; CSS `plus-lighter` owns composition over the WebGL world. Removing
  either would change overlap semantics rather than just brightness.
- Denial is not equivalent to hiding the invitation. A local-only button would
  allow the stale invite to be accepted later and would leave host revision and
  other clients inconsistent.
- No reusable retail fact changed, so the Mod Loader native reports remain the
  authority and require no edit for these explicit Website policy choices.

## Confidence and open questions

- Confirmed: all current owners, native lighting branch membership, exact
  source of the white oval, the glyph-width coupling defect, party lifecycle,
  and every scene/eligibility sibling in scope.
- Inferred policy: `Deny` is a terminal recipient action for one invitation and
  does not send a rejection notification to the inviter because no party event
  surface exists.
- Unknown: none requiring an unextracted native table or browser approximation.
  Visual opacity and plate styling are explicit requested product values.

## Web implementation consequence

- Add one recipient-authoritative party denial transition through coordinator,
  shared worlds, host, protocol 38, client session, Hub UI, and acceptance smoke.
- Preserve all native nameplate semantics but replace the disconnected width
  estimate with a shared measured plate/bar layout and centered glyph run.
- Scale only the late direct-player aperture alpha; do not touch Region sources,
  analytic tint, object shadows, spell/Lantern light, darkness, or player art.
- Remove the obsolete bar-width-based glyph centering and the native-exact web
  brightness claim for the intentionally overridden branch.

## Validation contract

- Focused tests: denial success/nonrecipient/missing/unrelated-invite behavior;
  shared-world denial; strict protocol round trip/rejection; client send;
  measured nameplate layout for short/long/space names; HP clamping and
  self/invalid/offscreen/zero-health membership; direct-light alpha bounds.
- Browser journey: in a real shared Hub, deny one invitation and prove it does
  not reappear or change party size, then accept a later invitation; capture
  centered cohesive nameplates in Hub and Boneyard with no page/console errors.
- Lighting journey: environment mode `0` has no direct surface; modes `1/2`
  retain bounded single-player center alpha `7..11/255`, with a three-overlap
  center maximum at most `28/255`, far alpha/RGB zero, and unchanged Region
  source diagnostics.
- Canonical gate: Windows-native `./scripts/validate.sh` on the exact final tree.

## Implementation validation receipt

- Party denial now owns one complete authority path: `party-system.ts` removes
  exactly one recipient invitation and advances revision; `shared-game-worlds.ts`
  preserves Hub/party membership; protocol `38`, `game-host.ts`, and
  `game-client-session.ts` carry and broadcast the transition; `HubScene.tsx`
  renders adjacent Accept/Deny actions with a distinct low-emphasis denial
  style. Denial does not close mod runtimes or publish a world snapshot.
- `native-world-nameplate.ts` preserves the native remote-wizard item/lifecycle
  but now measures the actual group-6 glyph run, centers its bounds, and draws a
  shared-width dark bronze plate plus attached five-pixel health track. The
  former bar-width-based glyph offset and 64-pixel disconnected bar are gone;
  fixed ally HUD rows remain untouched.
- The late environment-player record-18 surface retains its native mode gate,
  bounded crop, flicker, multi-player additive composition, transparent far
  field, and post-WebGL order. Only the explicit Website brightness multiplier
  changed to `0.14`. `smoke-game-runtime.mjs`,
  `measure-boneyard-performance.mjs`, and the shared-party journey now enforce
  the new single- and multi-player pixel bounds rather than stale native-alpha
  expectations.
- Red/green evidence: the new party tests initially failed on missing
  `denyPartyInvitation`/`denySharedPartyInvitation`; the client test failed on
  the absent method; the nameplate and light tests failed on absent measured
  layout/style and old alpha. After implementation, local focused runs passed
  party `16/16`, world-nameplate/ally `13/13`, Boneyard render `24/24`, and the
  combined protocol/client/render matrix `63/63`; the eight supervisor tests
  and lint/import boundaries also passed.
- Mac focused matrix on Apple M2, Node `22.17.0`, and .NET `10.0.302` passed
  party `16/16`, world-nameplate/ally `13/13`, combined protocol/client/render/
  supervisor `71/71`, and lint/import boundaries. The full Mac canonical gate
  first reached broad frontend `1047/1048`; its sole failure was the unrelated
  load-sensitive Lua p99 check (`29.049 ms` against `20 ms`). The isolated Lua
  suite immediately passed `6/6`, including the timing member, and the complete
  canonical rerun then exited zero with backend build/contracts, formatting,
  lint/boundaries, all frontend matrices, desktop tests, production builds,
  bundle budget, and media policy.
- Mac Chrome desktop and mobile shared-Hub journeys exercised a real protocol-38
  supervisor and production build. Both denied Basil's first invite, proved the
  invitation disappeared while membership stayed singleton, accepted a second
  invite, formed a three-member party, entered one Boneyard, kept an unrelated
  fourth player moving in Hub, and returned health to zero sessions/players/
  parties/runs. Both had empty page- and console-error lists. The mobile frame
  at `844 x 390` visibly exposes the 48-pixel Accept and Deny targets.
- The final Mac mode-2 journey separated the raw peers before capture, visibly
  retaining centered `BASIL`/`CASSIA` plates and their attached bars. The late
  light canvas reported maximum alpha `17/255`, exact far transparency, and no
  page/console errors. The mobile mode-2 run independently reported maximum
  alpha `18/255`. Matched visible/hidden direct-light frames show that the
  remaining colored staff-orb cores are independent stock element VFX rather
  than the removed white player aura.
- Mac performance on real Chrome/ANGLE Metal (`Apple M2`) with a mode-2 Arena,
  567 drops, and 299 splashes passed: idle `59.93 FPS`, p95/p99/max
  `20.6/21.1/21.2 ms`; moving `60.08 FPS`, `20.5/21.1/21.6 ms`; zero long
  tasks. Single-player direct-light center alpha was `8` at startup and `9`
  during the sample, with RGB `765` and far alpha/RGB zero.
- Windows Chrome `150.0.7871.124` independently ran the desktop production-build
  matrix against the isolated local protocol-38 backend/supervisor. Deny removed
  the first invite, a second invite was accepted, three members entered run
  `ad265b2422cff4bce3d35f5cd806bf75`, the unrelated Hub player moved
  `950.64 -> 968.2215`, all health counts returned to zero, and page/console
  errors were empty. Its screenshots are under
  `.codex-windows-validation/invite-lighting-nameplates-20260821-root/windows/`.
- Evidence paths on the Mac are under
  `/Users/jarrett/Projects/Solomon Dark/.codex-evidence/invite-lighting-nameplates-20260821-root/`:
  `party-invitation-deny.png`, `hub-nameplates.png`,
  `boneyard-nameplates.png`, `boneyard-without-direct-player-light.png`, and
  `boneyard-performance.png`; the `mobile/` sibling contains the touch matrix.
- Membership rescan found denial in protocol/interface/client/host/shared/
  coordinator/UI/test/smoke ownership, no remaining bar-width glyph path, and
  no stale `55..70` direct-light acceptance range. No member is
  `blocked-by-platform`; the explicit visual overrides remain the only predicted
  stock differences. No Mod Loader report changed because no native fact was
  revised.
- Publication state: implementation exists only in the isolated Website
  worktree/branch. There is no commit, push, deployment, or production change.
