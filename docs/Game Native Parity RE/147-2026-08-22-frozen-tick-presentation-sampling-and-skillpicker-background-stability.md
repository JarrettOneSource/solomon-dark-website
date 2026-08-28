# 2026-08-22 — Frozen-tick presentation sampling and SkillPicker background stability

## Reported smell and parity question

- Reported web behavior: when the mandatory SkillPicker appears, the world
  underneath looks as if it advances one frame and then undoes that frame.
- The 2026-08-21 live-background pass correctly restored every world member,
  but its membership sweep stopped at renderer visibility. It did not include
  the Hub/Boneyard presentation timelines or the Hub local-prediction override
  that feed those renderers. This reopens that entry under the rule that the
  whole producer-to-consumer clock path is the system boundary.
- Stock behavior to preserve: the already-drawn world remains behind
  `LevelupScreen`; non-player actor clocks hold, while the separately owned
  PlayerActor level-up sparkle/light lane and SkillPicker UI clocks continue.
- Reproduction: two authoritative Hub samples at ticks `100` and `105` place a
  remote actor at X `20` and `30`. With the tick-105 sample first received at
  `50 ms`, duplicate tick-105 deliveries at `100 ms` and `150 ms` currently
  produce the display sequence `20 -> 25 -> 29.8 -> 20 -> 25 -> 29.8 -> 20`.
  That is the reported replay-and-undo motion, independent of CSS or WebGL.
- Falsifiers: preserving a same-tick sample's first receipt clock does not stop
  the rewind; a same-tick state replacement becomes stale; a strictly newer
  tick loses normal interpolation; the Hub local player still predicts while
  a level-up barrier owns the world; or any SkillPicker world member becomes
  hidden again.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Stock executable identity | retail Beta `0.72.5` `SolomonDark.exe`, size `4,723,200`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-22; preferred image base `0x00400000` | Same binary as the sealed picker/ActorWorld investigation. | high |
| Existing native instructions and trace | `LevelupScreen_Render` `0x0067DF80`; `ActorWorld::Tick` `0x004022A0`, virtual return `0x00402348`; Skeleton tick `0x00484B90`; PlayerActor tick `0x00548B00`; `Mod Loader/docs/skill-picker-re.md` | The screen curtains the already-rendered world. The barrier holds non-player actor ticks while the PlayerActor-owned level-up lane continues; the screen renderer has no selective world-family hide branch. | high |
| Current Website causal trace | Website `0574fa68`; `game-client-session.ts`; `hub-presentation-timeline.ts`; `boneyard-presentation-timeline.ts`; Hub/Boneyard scene loops | A duplicate authoritative tick replaces both the payload and `receivedAtMs`. Sampling therefore restarts the last interpolation interval. Hub local prediction is also reconciled and restarted despite `levelUpBarrier`. | high |
| Deterministic web repro | Node 22.17.0 source harness against Website `0574fa68` | Tick/position samples are `[[50,20],[75,25],[99,29.8],[100,20],[125,25],[149,29.8],[150,20],[175,25],[199,29.8]]`. | high |
| Settled stock visual fixture | `Mod Loader/tests/fixtures/webgame/menu-reference-captures/skill-picker.png`, SHA-256 `96fa5827e56de2a274b44eb9e6ccc10ad6da27fe973c946d76febbb9f7612556` | Retained reference for the picker-over-world composition; it does not encode browser transport timing. | high |

## System boundary and membership inventory

Native/web system: delivery-time interpretation of a frozen authoritative
world, from host tick/barrier through both presentation timelines and the Hub
local-prediction override into every world renderer below SkillPicker. Option
roll/apply, card rendering, and authored render-time cosmetic randomness remain
owned by their existing systems.

| Member (class/variant/scene/branch) | Owner/source | Disposition | Proof |
| --- | --- | --- | --- |
| Strictly advancing Hub ticks | `HubPresentationTimeline.push/sample` | verified-already-at-parity | existing interpolation and lifecycle suite remains unchanged |
| Stale Hub ticks | `HubPresentationTimeline.push` | verified-already-at-parity | stale-snapshot regression |
| Same-tick Hub payload replacement | `HubPresentationTimeline.push` | exact-ported | latest payload replaces atomically without restarting the tick's first receipt clock |
| Hub remote players | Hub player interpolation | exact-ported | duplicate-tick no-rewind position/gait coverage |
| Hub participants and room transitions | Hub participant interpolation | exact-ported | shared same-tick clock owner; transition alpha cannot replay |
| Hub Students and ambient/fountain state | Hub Student/ambient interpolation | exact-ported | shared same-tick clock owner; complete timeline fixture coverage |
| Hub primary spells and native secondary actors | shared presentation interpolators | exact-ported | same-tick clock is retained for both state families |
| Hub local predicted player | `GameClientSession` local presentation | exact-ported | level-up and gameplay-pause holds bypass prediction and reset to authoritative state |
| Hub courtyard renderer membership | `HubWorldScene` | verified-already-at-parity | no `modalActive` suppression; all residents remain renderable |
| Every Hub private room | `HubPrivateRoomScene` | verified-already-at-parity | no `modalActive` suppression; player/NPC/flame/effect membership retained |
| Strictly advancing and stale Boneyard ticks | `BoneyardPresentationTimeline.push/sample` | verified-already-at-parity | existing actor/lifecycle interpolation suite |
| Same-tick Boneyard payload replacement | `BoneyardPresentationTimeline.push` | exact-ported | latest payload replaces atomically without restarting the tick's first receipt clock |
| Boneyard local/remote players, enemies, and Solomon | Boneyard player/enemy/encounter interpolation | exact-ported | duplicate-tick no-rewind player/enemy/encounter coverage |
| Boneyard projectiles, projectile/death effects, Maggots, and mage lightning | Boneyard effect interpolators | exact-ported | shared retained clock; existing per-family interpolation coverage |
| Boneyard gates, loot, Goodies, waves, run, and Arena transition | Boneyard world interpolators | exact-ported | shared retained clock; payload replacement remains live |
| Boneyard primary spells and native secondary actors | shared presentation interpolators | exact-ported | same-tick clock retained for both state families |
| Boneyard renderer membership, weather, lights, nameplates, and painter traversal | `BoneyardWorldRenderer` | verified-already-at-parity | no suppression branch; complete frozen snapshot remains submitted |
| Player-owned level-up beam/sparkles/light | `level-up-presentation.ts` wall-clock owner | verified-already-at-parity | existing exact 180-tick/2,390-ms presentation tests |
| SkillPicker reveal, ambient, panels, actions, and close | `SkillPicker`/renderer | out-of-system (separate native UI clock, intentionally live) | existing reveal/close/render contract tests |
| Per-render cosmetic sampling that does not mutate actor state | existing renderer presentation frame | out-of-system (render lane, not authoritative interpolation or actor progression) | actor/world coordinates and authoritative ages remain frozen |

No member is blocked by the browser platform.

## Native ownership thread and recovered behavioral contract

- The host simulation tick is the world clock. `levelUpBarrier` prevents world
  advancement; network snapshot sequence and packet arrival time are transport
  clocks and cannot manufacture another native tick.
- Each presentation timeline owns one first-receipt timestamp per distinct
  authoritative tick. A later packet with the same tick may replace state
  atomically (for example a pending participant resolving), but it is not a new
  interpolation epoch. A strictly greater tick is the only operation that
  appends history and starts a new interval.
- Hub local prediction is downstream of the same authoritative clock. It may
  run only while the world admits simulation ticks. While `levelUpBarrier` or
  the existing authoritative gameplay pause owns the world, the local player
  is sampled directly from the newest authoritative state and the predictor is
  reset at incoming snapshots so stale velocity/correction state cannot leak
  across resume.
- Boneyard has no separate local-prediction override; correcting its timeline
  clock closes local and remote players plus every world interpolator together.
- Render loops remain alive during SkillPicker so the native picker reveal and
  the separately reconstructed player level-up beam/sparkle/light can advance.
  They repeatedly render one stable world sample; they do not hide world
  membership or infer world progress from packet delivery.
- Entry is the barrier edge, same-tick updates retain the first clock, choice
  resolution removes the hold, and the first strictly newer tick resumes normal
  interpolation without wall-clock catch-up.

## Nearby-system findings

- The defect predates the live-background change: both timeline implementations
  have replaced `receivedAtMs` on duplicate ticks since their initial commits.
  The 2026-08-21 change exposed it by correctly keeping the world renderer live
  beneath SkillPicker.
- Dedicated hosts normally broadcast only lifecycle/state edges while a level
  barrier holds. Shared hosts can broadcast repeated same-tick snapshots to a
  paused party because another world instance continues advancing, so this is
  both a solo edge artifact and a sustained multiplayer artifact.
- The same clock rule protects ESC/book pause resume and any future coherent
  world hold; it is not a SkillPicker-specific delay or renderer patch.
- The reusable native consequence is recorded in
  `Mod Loader/docs/skill-picker-re.md`; no new address, asset, or authored table
  was recovered.

## Confidence and open questions

- Confirmed: causal replay, both duplicate-tick writers, Hub prediction leak,
  complete timeline membership, stock render/ActorWorld split, and browser
  representability.
- Inferred: the user's exact visible subject may be a player, enemy, NPC, spell,
  or camera-dependent family; all share one of the proven clock paths, so the
  correction does not depend on identifying that subject.
- Unknown: none material. Render-time cosmetic flicker is intentionally not
  reclassified as actor simulation; browser acceptance separately checks that
  world coordinates/ages hold while the native level-up lane advances.

## Web implementation consequence

- Preserve the original `receivedAtMs` when replacing the newest same-tick
  payload in both presentation timelines. Do not add a SkillPicker timer,
  debounce, canvas freeze, or scene-specific branch.
- Make the existing session-owned local Hub predictor obey the authoritative
  hold predicate (`levelUpBarrier` or gameplay pause), sampling the latest local
  player directly and resetting prediction state on held snapshots.
- Keep every restored world renderer family visible and keep the existing
  level-up presentation and picker clocks live.

## Validation contract

- Focused timeline tests: after interpolation reaches a tick, multiple
  same-tick replacements must never move any Hub/Boneyard actor back toward the
  prior tick; replacement payload fields must still become current; strictly
  newer and stale behavior must remain unchanged.
- Focused session test: a moving Hub player that enters `levelUpBarrier` must
  remain at its authoritative position across render samples and duplicate
  held snapshots, then resume prediction only after the barrier clears.
- Browser journey: trigger the picker while movement exists, sample the
  presented world through repeated frozen snapshots, require stable
  coordinates/tick after the single normal settling interval, retain all Hub
  and Boneyard membership, observe the independent level-up particle lane, and
  require empty page/console errors.
- Run the exact Website tree through `./scripts/validate.sh`, then repeat the
  browser journey on the Mac mini acceptance environment.

## Implementation validation receipt

- `HubPresentationTimeline` and `BoneyardPresentationTimeline` now replace a
  same-tick payload while retaining that tick's first `receivedAtMs`. A greater
  tick still appends a normal interpolation interval, and stale ticks retain
  their prior rejection path. No renderer, picker, CSS, protocol, or host-tick
  branch was added.
- `GameClientSession` resets Hub local presentation on authoritative hold
  edges/snapshots and returns the timeline's newest authoritative local player
  while either `levelUpBarrier` or gameplay pause is active. Prediction resumes
  from the reset state after release, without replaying held velocity or
  correction time.
- The pre-fix deterministic Hub harness reproduced
  `20,25,29.8,20,25,29.8,20`. The added Boneyard regression failed with local X
  `10` instead of `20`, and the session regression exposed predicted X
  `104.09510004520416` instead of authoritative X `110`. After the shared fix,
  the focused Hub timeline, Boneyard timeline, and session selection passed
  `57/57`.
- Local exact-tree `./scripts/validate.sh` exited zero: `15/15` backend and
  Website contracts; frontend groups `4/4`, `43/43`, `227/227`, `1291/1291`,
  `8/8`, `29/29`, `11/11`, `7/7`, `17/17`, and `21/21`; desktop `5/5`;
  production build, media policy, and bundle budget. The Game entry is
  `393907` raw / `110586` gzip bytes. The validation log SHA-256 is
  `74fd798abfceca0efd432f0597db78cd5e3255cb5e80467da1576bd64f774ed5`.
- The Mod Loader CI-safe native suite passed `491/491` locally and again on the
  Mac evidence tree. The Mac log SHA-256 is
  `46901b16623008157eff762d8c353fc7ef332106524191994c0a8ee8bf9d8579`.
- A byte-for-byte copy of every changed Website file was applied over detached
  current-main base `05c73e43adeae4ac641e4e15ab576ecfbfe12988` at
  `/Users/jarrett/codex-acceptance/skill-picker-freeze-rebased-20260822.78IjhF/website`.
  Jarrett's Mac mini was arm64 macOS `26.6.2`, Node `22.17.0`, npm `10.9.2`,
  .NET SDK `10.0.302`, and Chrome `151.0.7922.170`. Its clean canonical run
  passed the same counts, production build, budget, and media policy; log
  SHA-256 is
  `6e621e1b148621e7f23363b9e6e0fe28afa9424c716bc3c99e3a4ac8fe163418`.
- Two consecutive full Mac Chrome/WebGL SkillPicker journeys moved the
  authoritative Hub player before level-up and crossed a same-tick reroll
  broadcast. The first took 30 animation-frame samples spanning 29 distinct
  world renders at tick `1272`; the second took 30 samples spanning 30 renders
  at tick `1205`. Every sample in both runs held player X exactly at
  `950.7400000014901` (zero spread), while the independent native level-up lane
  reached 49 and 48 particles respectively. Hub `dynamicSuppressed=false`; both
  Boneyard continuations retained one live Skeleton with
  `dynamicSuppressed=false`; world and picker canvases used WebGL2; page and
  console error arrays were empty.
- Inspected Mac captures are
  `/tmp/solomon-dark-skill-picker-rebased2-mac.png` SHA-256
  `682550deae0ce3cbb0a527e62a63485d06b9b0aa5f7e4690fb0a4be1acba5c99`,
  `/tmp/solomon-dark-skill-picker-rebased2-mac-reveal.png` SHA-256
  `352b9c556f533e44baf6e4eb7b6471c4ce0f410f57bbeac7f90ef272dc1c6171`,
  and `/tmp/solomon-dark-skill-picker-rebased2-mac-boneyard.png` SHA-256
  `1d11bfd46af7a7f9399a44d5627d9036e6c12c7e7c18f595b77a73a0e54080db`.
  All three show the complete world beneath the retained curtain/panel; the
  Boneyard frame preserves its enemy/world membership.
- Final publication rebase receipt: Website current-main base
  `956cefce6b55a6bee9e732ee92fd909d57597ab5` adds the independently recovered
  live-Hub optional-modal policy. Its client admission guard and this pass's
  frozen-tick prediction/interpolation owner merged without a code conflict;
  the combined focused timeline/session selection passed `57/57`. The
  byte-identical Mac tree at
  `/Users/jarrett/codex-acceptance/skill-picker-push-rebase-20260822.1wSq8I/website`
  passed the complete canonical gate: `15/15` backend/contracts and frontend
  groups `4/4`, `43/43`, `227/227`, `1293/1293`, `8/8`, `29/29`, `11/11`,
  `7/7`, `17/17`, `21/21`, and desktop `5/5`, plus production build, bundle
  budget (`394308` raw / `110684` gzip), and media policy. Its log SHA-256 is
  `08ea52c0035d3a55d59d57b23c18840de974d7addf1ceff8cfeaf78330d0c4dc`.
- The combined Mac Chrome/WebGL journey again held 30 distinct world renders at
  tick `1386` and player X `950.7400000014901` with zero spread, while 49
  level-up particles advanced; Hub and Boneyard retained
  `dynamicSuppressed=false`, Boneyard retained one live Skeleton, both canvases
  used WebGL2, and page/console error arrays were empty. The local parallel gate
  starved two pre-existing socket-message deadlines; those exact host and
  supervisor files passed `50/50` in isolation. No product assertion was
  changed or loosened.
- No member is blocked by the browser platform. One focused local commit exists
  in each repository and publication is pending at this receipt point. No
  deployment or production process change was performed.
