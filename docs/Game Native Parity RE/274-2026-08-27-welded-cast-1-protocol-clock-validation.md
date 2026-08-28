# 2026-08-27 — Welded Cast 1 protocol clock validation

## Reported smell and parity question

- Reported web behavior: inspect production server logs for crashes/errors and
  fix the web port. The current protocol-95 browser repeatedly entered the
  active Boneyard, then disconnected with code `4008` because
  `primaryCast.actionTick` was "outside the Staff Cast 1 program."
- Stock behavior already recovered by the 2026-08-23 Staff clock entry: every
  welded one-shot uses the ordinary Fire-rate Cast 1 clock, independent of the
  wizard's authored base element. The web question is whether the strict wire
  validator accepts that same complete action lifetime for every welded
  one-shot and every wizard configuration.
- Reproduction inputs/scenes: an Ether-configured wizard selects welded skill
  `52`, casts each one-shot build `1000`, `1001`, `1002`, or `1009` in an
  active Boneyard, and crosses action tick 55. Exercise both an ordinary player
  and a developer observer because both decode the shared projected frame.
- Falsifiers: the host uses an Ether-rate clock for welded one-shots; the wire
  projection carries a different selected build; a non-Ether configuration
  also rejects the legal action; or the current decoder accepts tick 72 and
  rejects only 73 for every welded one-shot.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production host journal | NFO `chicago-quad36-h-10-m7b`, deployed Website `c2c248d37ffdfb706c2c0f48d6f50ffb3991cb03`, protocol 95, 2026-08-28 `02:54:26Z` and `02:54:55Z` | Player and observer transports both closed with code `4008`; the exact reason names `frame.players.<id>.primaryCast.actionTick` outside Staff Cast 1. | high |
| Bounded client diagnostics | private archives `7a57d931-6097-4941-8ecc-b2f2bf83958c` and `a4876c69-1132-4cfc-80ed-dc5baeb851b7` | Both browsers authenticated successfully, then `decodeServerGameMessage` failed on the same frame field and sent the reason back through the transport. | high |
| Live read-only observer | same deployed host/run, raw protocol-95 frames, Ether skill `8` baseline | Ordinary Ether Cast 1 remained valid through observed action tick 53. The profile retained welded build `1001`, isolating the failure to the welded-selection branch rather than transport, pause, or generic Ether timing. | high supporting evidence |
| Existing native evidence | retail Cast 1 `0x0044B170/0x0044B370`, progress `0x004486E0`, marker callback `0x00550180`; 2026-08-23 Staff clock ledger | Cast 1 owns float32 progress, marker `1`, strict end `4`; welded one-shots `1000/1001/1002/1009` share that owner and the Fire-rate web clock. | high |
| Web causal trace | `primary-spells.ts`, `game-snapshot.ts`, `game-protocol.ts` at `c2c248d3` | Authority sets `castClockElement = primaryElement ?? 'fire'`, so every weld uses the 73-tick Fire domain. The decoder derives skill `52` from the wizard's base element, so an Ether wizard is incorrectly limited to 55. | high |

The older `SDR_GAME_MEMORIAL_PATH must be configured` journal crashes are a
separate, already-corrected deployment-unit incident. The current live and
release unit hashes match and contain the fixed StateDirectory-owned memorial
path; they are not a causal candidate for the protocol-95 disconnect.

## System boundary and membership inventory

System boundary: **authoritative primary Cast 1 clock projection and strict
wire validation**, from selected primary/build identity through fixed-tick
action progress, snapshot projection, player/observer decoding, invalid-frame
closure, selection reset, and teardown.

| Member / branch | Native/web owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Ether `8` one-shot | native Cast 1 Ether rate | `verified-already-at-parity` | legal `0..54`, reject 55; live raw frames remain accepted |
| Fire `16` one-shot | native Cast 1 Fire rate | `verified-already-at-parity` | legal `0..72`, reject 73 |
| Air `24`, Water `32`, Earth `40` Constant | Staff Constant | `verified-already-at-parity` | channel domain remains `0..1`; release is `-1` |
| Burning Bolt `1000` welded one-shot | welded Cast 1 | `exact-ported` validator correction | every base-element configuration accepts 72 and rejects 73 |
| Frost Missile `1001` welded one-shot | welded Cast 1 | `exact-ported` validator correction | production reproduction plus every-base-element matrix |
| Ball Lightning `1002` welded one-shot | welded Cast 1 | `exact-ported` validator correction | every base-element configuration accepts 72 and rejects 73 |
| Crawling Shock `1009` welded one-shot | welded Cast 1 | `exact-ported` validator correction | every base-element configuration accepts 72 and rejects 73 |
| Sustained/persistent welds `1003..1008` | Staff Constant / persistent owners | `verified-already-at-parity` | channel domain remains `0..1`; idle/release remains `-1` |
| Primary/build selection and reset | player entity store | `verified-already-at-parity` | selection atomically resets action, held/channel, randomized sound, target, and selected age |
| Player and observer snapshots | shared host projection | `exact-ported` | both recipients decode the same legal welded frame without a `4008` close |
| Hub idle, Boneyard active, pause/resume, disconnect, run retirement | host lifecycle | `verified-already-at-parity` | no clock remapping by scene/lifecycle; invalid-frame close remains fail-closed for genuinely invalid data |

There is no `blocked-by-platform` member. The browser can represent the exact
finite Cast 1 clock.

## Native ownership thread and recovered behavioral contract

- Fixed-tick primary authority owns `actionTick`; snapshots only project it and
  the decoder must validate the same domain without retiming it.
- Pure Ether uses the 55-tick Cast 1 family and pure Fire uses the 73-tick
  family. Web weld authority deliberately selects the Fire family for every
  welded build because a weld has no single pure `primaryElement`.
- Protocol progression already supplies both `selectedPrimarySkillId` and
  `weldBuildId` before primary-cast validation. Skill `52` with an active build
  therefore has an exact, local discriminator and must never fall back to
  `PlayerCharacterConfig.element`.
- Legal welded one-shot action ticks are `-1` or `0..72`. Tick 73 and above
  remain invalid. Channel-active primary actions remain limited to `0..1`.
- A decoder error remains a fail-closed transport error. The fix changes the
  legal shared clock domain, not close-code ownership, simulation timing,
  presentation, input, audio, or save state.

## Nearby-system findings

- The production log search also found one protocol-94 diagnostic for
  `boneyard.scene.roads[0].linkMask must be finite` immediately before protocol
  95 deployed. No protocol-95 recurrence exists; keep it classified as closed
  by the intervening Boneyard/protocol release unless a current archive
  falsifies that disposition.
- The deployment-unit memorial crashes ended after the release-owned systemd
  unit was installed and reconciled. Current services are active with zero
  restarts and byte-identical live/release unit hashes.
- No new reusable retail fact was recovered, so the existing Mod Loader Cast 1
  reports remain authoritative and require no duplicate edit.

## Confidence and open questions

- Confirmed: production symptom, player/observer scope, exact host/client close
  path, authority/validator disagreement, complete one-shot weld membership,
  unaffected pure/channel families, and lifecycle boundaries.
- Inferred: the user's skill-book interaction selected Frost Missile immediately
  before both failures. The selected build is supported by the retained live
  profile, but the fix does not depend on reconstructing UI clicks.
- Unknown: the rejected frame's exact action value was not retained in the
  bounded client report. Any value `55..72` proves the same deterministic
  domain mismatch; the regression uses both legal edge 72 and illegal edge 73.

## Web implementation consequence

- Make the protocol's cast-clock selector treat active welded skill `52` as
  Fire-clock ownership, matching `stepPrimarySpells`.
- Keep pure element selection and the strict Constant branch unchanged. Do not
  widen all action clocks or suppress decoder failures.
- Add the four-build by five-base-element matrix at the protocol seam, plus
  explicit 72/73 boundary assertions and unaffected pure Ether coverage.

## Validation contract

- Focused red/green: the current protocol round-trips action tick 72 for each welded
  one-shot on Ether/Air/Earth/Fire/Water configurations, rejects 73, retains
  pure Ether's 55 rejection, and retains channel `>1` rejection.
- Host/browser: select Frost Missile on an Ether wizard, hold through at least
  one complete 73-tick action, and observe continuing snapshots with no page,
  console, failed-response, host-error, or code-`4008` arrays. Repeat through a
  developer observer or the shared decoder contract.
- Exact candidate: run the Website canonical Mac gate and a real Mac Chrome
  Boneyard journey against the byte-identical candidate tree.

## Implementation validation receipt

- `game-protocol.ts` now names the owning selector
  `primaryCastClockElement` and maps selected Spell Welding row `52` to the
  same Fire clock used by `stepPrimarySpells`. Pure element clocks, Constant
  validation, fail-closed decoding, host projection, simulation, presentation,
  audio, input, and saves are unchanged.
- The protocol regression drains all four one-shot builds
  `1000/1001/1002/1009` across Ether/Air/Earth/Fire/Water configurations. Each
  accepts legal action tick 72 and rejects 73; pure Ether still rejects 55 and
  the existing Constant test still rejects channel tick 2.
- The exact red Mac candidate over Website `4c608b42` failed only the new
  welded-clock test at `game-protocol.ts:3651` with the production error while
  the other `1691/1692` Boneyard/host tests passed. Red gate-log SHA-256 is
  `67a2e86b7feeed14d5aff316a61f25f7a4c3354ea4337592ae1d158a98bddf24`.
- The byte-identical corrected candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: 27 backend/contracts, strict
  formatting/lint/import/generated checks, every registered frontend and
  desktop suite, the corrected `1692/1692` Boneyard/host group, `77/77` ML
  tests, production builds, media policy, and the Game bundle budget
  (`251319` raw / `76428` gzip). Green gate-log SHA-256 is
  `1b681da7a2c0cedf758017a5fe2f2ba2bc5a8e076566fef74d56b8b849e6345d`.
- Mac Chrome `151.0.7922.174` created an Ether/Arcane wizard, granted and
  selected Frost Missile `1001`, entered a real generated Boneyard, crossed
  the authored Gate/Solomon combat admission, and held through three complete
  emissions. The browser decoded 504 welded frame samples, observed legal
  action tick 71 beyond the old 55 boundary, stayed in the ready Boneyard, and
  reported empty page, console, failed-request, and host-error arrays. Browser
  log SHA-256 is
  `ad79b410d5d4e843d122dfce83c58f7323b4911371f4af685ff2b971d5b75c61`;
  the reviewed frame SHA-256 is
  `160ef6f82b71e2b9b92d68aced6398b092280a7988c5bdf19e02fbde21bb4f7f`.
- Publication rebase preserved concurrent enemy-targeting/navigation commit
  `c59c27af2b526722c77f135f7f63526cd543fefd`. Exact pre-receipt candidate
  `1de3051d903d59d51fb75af05ac0653ce9d02aa9`, tree
  `a46428ffbce96a3b00bf456d9741a99193b3c533`, and its detached Mac worktree
  had byte-identical protocol/test bytes (SHA-256
  `63d3a50462ebab8b1e2d3a47baa3e291c368816c832a7fd34372f30f1af5f34b`
  and
  `50d4248b57ec4c918e82297f0ad1a070f6932d9ef9bed9ac454a5fd130a4875e`).
- The complete rebased Mac gate passed 27 backend/contracts, strict checks,
  the expanded `1712/1712` Boneyard/host group, `77/77` ML tests, every other
  registered suite, production builds/media policy, and the Game budget
  (`251319` raw / `76432` gzip). Final gate-log SHA-256 is
  `73b37911bf7ab0289d986e1a1899ac1e17409a5e10c8cee54432c1659c7f68ea`.
- Final Mac Chrome `151.0.7922.174` repeated the real Gate/Solomon/Frost
  Missile journey on protocol 96. It decoded 375 welded samples, reached legal
  action tick 71 across three emissions, remained ready, and again produced
  empty page, console, request-failure, and host-error arrays. Final browser
  log SHA-256 is
  `1f78f1deaab1ed278e9fa370456212a254b844749c905065a22d7cc763b1c4df`;
  final reviewed frame SHA-256 is
  `20ba73c618d8dced1b04ed2da32478e06059b81fc1e8d4974bcfd00b331921ec`.
- Temporary browser instrumentation was removed after both journeys. This
  receipt is the sole post-validation documentation write; no runtime, test,
  build, asset, or protocol byte changed afterward. Push verification and
  production deployment remain separate receipts.
