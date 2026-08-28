# 2026-08-20 — Golem articulated-draw correction, second reopen

## Reported smell and parity question

- Reported web behavior: after the broader secondary-ability correction, the
  Golem still looks visually goofy.
- Stock behavior to recover: one compact upright articulated stone body whose
  twelve records retain separate visible positions and internal painter keys.
- Reproduction: a single non-Fete Golem in the Hub at assembly ages
  `2/50/100/200/400`. The age-400 capture SHA-256 is
  `b8fdc0ac98695580b75fbc6e69584f573f8539e3483b731dabb292df443e955d`.
  It reproduces the detached plates and empty green center without a second
  summon or enemy interaction.
- Falsifier: if Fete overlap were the cause, the single-Golem capture would be
  compact. It is not. If atlas crops were wrong, their registrations would
  disagree with the untouched Golem bundle. They do not.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions | `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `Golem::Draw 0x00617820` | Each body record stores draw `(x,y)` and a separate sort Y. Records 4..8/10/11 sort at `drawY-50`; record 9 sorts at `drawY-70`. | high |
| Retail constants | draw operands at `0x007DE9B0`, `0x0079E220`, `0x00785670`, `0x00794080`, `0x007DE9D8`, `0x00791F58`, `0x00786CB8`, `0x007847A8`, `0x007847C8`, `0x00787C40` | Exact forward/lateral/vertical and sort offsets are `-5,-38,+38,-20,+12,-12,-15,+8,+50,+70`. | high |
| Stock asset | untouched `images/Golem.png`, SHA-256 `586bb06b4fc69f0d90c90da99871e1cd97d5f250a1e83edbba82a4b7504294ac`; extracted entries `1..208` | Crops and registrations are correct; the web defect is composition geometry. | high |
| Native runtime diagnostic | loader-injected native-renderer capture `/mnt/d/codex-evidence/minion-sync-20260726/live18-post-final-rebase/host_owned/host.png`, SHA-256 `7c5ce25e89f649535632b9610447a33beff023a8882503d44a5cb19a20f48545` | The native renderer produces a compact, connected upright silhouette through gait and attack. This supports the static result but is not clean-stock authority by itself. | medium |
| Current web | `nativeGolemPresentationPlan` and the single-Golem phase journey | The web passes native sort offsets as visible vertical offsets for core, limbs, and five body pieces; it also puts `+0x220/+0x224` rotations on connector endpoints instead of limb records. | high |

## System boundary and membership inventory

Native system: `Golem::Draw` from authoritative articulated state through its
connector prepass, twelve-record list construction, internal sort, Golem atlas
draws, Iron overlays, core glows, and shared Hub/Boneyard world submission.

| Member | Native source | Required disposition | Proof / consequence |
| --- | --- | --- | --- |
| assembly beam and elevation `0/-20/-40` | age branch before `0x00618377` | `verified-already-at-parity` | phase captures and existing contract |
| records 0..3, chassis `113/129/145/161 + facing` | list entries 0..3 | `verified-already-at-parity` | visible Y equals sort Y for these rows |
| record 4, two BadGuys-15 core glows | list entry 4 and null-sprite draw branch | `exact-ported` by this correction | draw at `C+(0,E+10)`; sort at `drawY-50` |
| records 5..6, left/right limb banks | list entries 5..6 | `exact-ported` by this correction | visible feet-side positions, independent sort Y, and authoritative rotations |
| records 7..8, forward bank-65 pieces | list entries 7..8 | `exact-ported` by this correction | visible `E+5/E+8`; sort `-50`; record 8 rotation `10` |
| record 9, center bank-65 piece | list entry 9 | `exact-ported` by this correction | visible `E+15`; sort `-70`; scale `.8` |
| records 10..11, rear bank-65 pieces | list entries 10..11 | `exact-ported` by this correction | opposite facing, visible `E+15/E+12`, sort `-50` |
| endpoint/glow/cap connector prepass | age `>=200` branch | `exact-ported` by this correction | offset endpoints, weighted joints, stable endpoint orientation, pre-body order |
| 16 headings and opposite bank | `0x00410500` plus `(round+9)/22` | `verified-already-at-parity` | heading contract test |
| idle/gait rotations | fields `+0x220/+0x224` | `exact-ported` by this correction | limbs use signed completed-step angles; connector endpoints do not rotate |
| left/right attack and provoke modes | `+0x1DC/+0x1E8/+0x1EC/+0x220/+0x224` | `exact-ported` by this correction | both pose variants and all mode branches covered |
| Iron overlays `177/193 + facing` | record flags 2/3 | `verified-already-at-parity` | same visible transform as side chassis |
| one- versus two-summon Fete ownership | cast dispatcher bit `0x8` | `verified-already-at-parity` | independent actor roots; no renderer merge |
| Hub and Boneyard consumption | shared secondary world view | `verified-already-at-parity` | one plan and effective world Y in both scenes |
| Golem death fragments | separate `Golem::Death 0x00619730` | `out-of-system` | separate finite presenter, unaffected by articulated list geometry |

## Recovered transform and order contract

Let `D=(sin(h),-cos(h))`, `P=(D.y,-D.x)`, `C=(L+R)/2`, and assembly
elevation `E` be `0`, `-20`, or `-40`. `f` is the 16-way facing and `o` is
the opposite facing. Visible positions and sort keys are distinct:

| Row | Draw | Visible offset from `C` | Sort key | Rotation / scale |
| ---: | --- | --- | --- | --- |
| 0 | `113+f` | `D*15+(0,E)`, or `D*10+(0,E-5)` in mode 3 | draw Y | `0 / 1` |
| 1 | `129+f` | `D*-5+(0,E)` | draw Y | `0 / 1` |
| 2 | `145+f` | `D*-5+P*-30+(0,E+5)` | draw Y | `0 / 1` |
| 3 | `161+f` | `D*-5+P*30+(0,E+5)` | draw Y | `0 / 1` |
| 4 | two `BadGuys[15]` glows | `(0,E+10)`, second glow `+5Y` | first draw Y `-50` | scales `[2,2.25)` and `[1.5,1.75)` |
| 5 | `(mode>1 ? 17 : 1)+f` | `D*-5+P*-38+(0,E+5)` | draw Y `-50` | field `+0x220`, forced `45` in mode 1 |
| 6 | `(mode>1 ? 49 : 33)+f` | `D*-5+P*38+(0,E+5)` | draw Y `-50` | field `+0x224`, forced `-45` in mode 1 |
| 7 | `65+f` | `D*-20+P*12+(0,E+5)` | draw Y `-50` | `0 / 1` |
| 8 | `65+f` | `D*-20+P*-12+(0,E+8)` | draw Y `-50` | `10 / 1` |
| 9 | `65+f` | `D*-15+(0,E+15)` | draw Y `-70` | `0 / .8` |
| 10 | `65+o` | `D*1+P*12+(0,E+15)` | draw Y `-50` | `0 / 1` |
| 11 | `65+o` | `D*1+P*-12+(0,E+12)` | draw Y `-50` | `0 / 1` |

All atlas draws multiply scale by `1.1109999418258667`; connector caps use
half scale `0.5554999709129333`. For age `>=200`, endpoint sprites are at
`L+leftOffset` and `R+rightOffset` with no rotation. The left joint is
`leftOffset + .5*(L+C+P*-10) + (0,-15)`; the right is
`rightOffset + .5*(R+C+P*10) + (0,-15)`. Each glow is
`(endpoint+3*joint)/4`; caps are at the joints. Endpoints, glows, and caps draw
before the sorted twelve-record body.

## Web implementation and validation consequence

- `nativeGolemPresentationPlan` must retain visible offset and local sort Y as
  separate fields. A sort key may never be passed to Pixi as sprite position.
- The existing record selections, atlas registrations, elevation, Fete cap,
  combat, replication, light, and death paths remain unchanged.
- Limb rotations consume the authoritative per-foot values except for native
  mode-1 overrides; connector endpoints stay aligned to their facing record.
- Connector offsets must affect endpoints and the exact weighted joints.
- The deterministic browser hash may replace presentation-local stock RNG for
  the two core glows, but it must preserve the recovered color and scale
  domains; this creates no predicted structural difference.
- Focused tests must pin all twelve visible offsets and sort keys at multiple
  headings, both limb modes, provoke offsets, and Iron overlays. The phase
  browser journey must capture a single Golem at `2/50/100/200/400`, then an
  attacking Boneyard Golem, with empty page/console errors and a compact
  connected silhouette comparable to the retained native frames.

## Implementation validation receipt

`nativeGolemPresentationPlan` now keeps each record's visible transform and
internal sort Y separate. Records 4..11 retain the same native painter order
while their sprites return to the recovered visible positions. Per-foot
rotations now drive limb records 5/6, with mode-one `45/-45` overrides;
connector endpoints remain unrotated. The connector prepass now applies
per-side offsets to endpoints, constructs the weighted joints, and places each
glow between its endpoint and joint exactly once.

The new render-contract regression failed on the old core offset (`y=-61`
instead of native `-11`) before the implementation and passes afterward. It
also pins every visible record formula through all sixteen headings, stable
connector orientation, offset endpoints/joints/glows, and authoritative limb
rotations. After integration with the native-loot system, the focused
secondary/prerequisite suite passes 140/140, the loot suite passes 40/40, and
the broad game suite passes 972/972. The complete canonical gate also passed backend
contracts/build/formatting, lint/boundaries, level-up, diagnostics, Hub UI,
desktop, production build, bundle budget, and media policy.

The single-Golem Hub phase journey passed in WebGL2 with empty page/console
errors and captures at ages `2/50/100/200/400`. Its corrected age-100 and
age-400 frames show the core enclosed by a compact stone shell rather than
floating 50 units above it. The Boneyard journey retained real Golem damage
and showed the connected windup/contact body.

The same implementation then passed the complete canonical gate on the arm64
Apple-M2 Mac mini. Hardware Chrome/WebGL2 repeated the single-Golem Hub phase
journey and live Boneyard attack with no page or console errors. The Hub receipt
SHA-256 is
`dece65a04a315930a9dd0c647ca79dc983b3cfef5b5572e346b640ec12a3e19f`;
the Boneyard receipt SHA-256 is
`3b84688d33001c2d4da42a51cb1400514b5cbc8648f4ba93eaf1874342d36858`.
The Boneyard target fell from 2.5 HP to below zero while the Golem retained one
20-primitive connected body.

The runtime-bearing Website commit
`96fa2121c4f40acd5ae29cd9ace00dc1c691ef1a` and the Mod Loader evidence commit
`167a9ad1eb1d5e959a391bde228413d68bfe553e` then reached their respective
`main` branches by fast-forward. Website Validate run `32381239264` and Mod
Loader Lua/static-contract run `32381239108` both passed. While the guarded
deploy worker was validating `96fa212`, Website `main` advanced to its
documentation-only descendant
`b874445126f05334b9bd85d612788257c6b6d193`. The worker correctly rejected the
stale candidate, independently validated the descendant, and deployed that
exact revision.

Production reported both services active with zero restarts, protocol 30,
zero sessions and lobbies, `ok` live and backup database integrity, and no
warning-level cutover journal. The public `/game` response and deployed
`wwwroot/index.html` shared SHA-256
`5652c8608f09ca457bee74f4466df36705f626864e56efdd4a775fc312bd8d2d`.

The final Apple-M2 Chrome/WebGL2 production journey used the exact behavioral
tree from `96fa212`; the deployed descendant differs only in this RE ledger.
Three real clients completed Create, shared Hub, generated mode-2 Boneyard,
and gate crossing over public HTTPS/WSS with empty page and console error
arrays. The retained receipt is
`/Users/jarrett/.codex-test-artifacts/golem-pass2-production-b874445/receipt.json`,
SHA-256
`527b886977866cb0b08251089ffa3ad1df118f4c37087af13eb98ba3b192b899`.
Its visually inspected Boneyard and open-gate frames retained the expected
world lighting, WebGL painter order, and approximately 60 FPS. Browser teardown
returned production to zero sessions and lobbies with no warning-level service
journal. This closes publication, deployment, and production acceptance for
the second Golem reopen.
