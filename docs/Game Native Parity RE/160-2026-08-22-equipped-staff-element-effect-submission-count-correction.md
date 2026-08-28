# 2026-08-22 — Equipped Staff element-effect submission count correction

## Reported smell and parity question

- Reported web behavior: the Staff orb VFX became far too large after the
  recent painter-depth change.
- Stock behavior to recover: the exact number of equipped-Staff element-painter
  submissions for every heading, Staff action pose, and `+0x268` phase branch,
  without changing the separately proven native painter scale.
- Reproduction inputs/scenes: Hub idle headings and Boneyard primary/secondary
  Staff poses; all 24 heading bins, poses `0..9`, phase below/equal/above
  `0.10000000149011612`, all five elements, and every Staff selector.
- Falsifiers: treating a null-equipment call as a Staff copy; two copies in
  pose 9; more than two equipped-Staff copies in any ordinary pose; removing
  the proven `1+10*phase` scale; or leaving any Staff copy behind robe/fixed
  clothes.

This reopens the same-day Staff depth entry above. That pass enumerated the
helper calls but did not carry the equipment-present guard at `0x0054BDCE`
through to its membership table, and it did not preserve the mutual exclusion
between the pose-9 call at `0x0054C7FE` and the ordinary front-angle call at
`0x0054C842`. The Website consequently materialized a nonexistent back copy
for every equipped Staff and an extra ordinary base copy during pose 9.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | staged byte-identical `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`, re-hashed 2026-08-22 | Exact image behind the read-only project and all addresses below. | high |
| Fresh helper xrefs | Ghidra 12.0.3 read-only replica; all eight xrefs to `0x0053B1D0` | Five xrefs are in main `PlayerWizard::Render 0x0054BA80`; the other three are mutually exclusive branches of alternate vslot `0x20` renderer `0x005468C0`. | high |
| Main-render instructions | `0x0054BDC4..0x0054BDE9`, `0x0054C071..0x0054C0A3`, `0x0054C799..0x0054C847`, `0x0054C847..0x0054C8BF` | `0x0054BDE4` requires a null equipment lookup; `0x0054C09E` is ordinary/back/low phase; `0x0054C7FE` is pose-9/low phase; `0x0054C842` is ordinary/front; `0x0054C8AE` is high phase. | high |
| Helper instructions/data | `0x0053B1D0`, Staff branch `0x0053B261..0x0053B318`, reads `0x0053B2DB..0x0053B2F0`; doubles `10` at `0x007DE810`, `1` at `0x007DE820` | Equipped Staff still passes `actorScale*(1+10*phase)` to the selected element painter; the reported excess comes from invalid submission membership, not a guessed replacement scale. | high |
| Current web before correction | Website `origin/main` through `05c5116f711b2d62b88ac561e2ea4b628f313a62`; `playerCharacterStaffOrbPasses` and `PlayerWorldView` | `backBase` is enabled from heading alone despite `hasStaff`; pose 9 can additionally retain `frontBase`; three complete VFX owners can therefore overlap. | high |
| Visual corroboration | pre-change browser receipt `/tmp/solomon-boneyard-staff-scale-final.png`, post-depth receipt `/tmp/solomon-staff-orb-front-final-20260822/solomon-hub-staff-orb-front.png`, and existing 1600x900 native Hub capture `Mod Loader/screenshots/hub_follow_20260417_194344_t00.png` | The recent web composition is more saturated and reads larger; instruction-derived call membership, not the visual alone, determines the correction. | medium |

No injected-loader state is used as native behavioral evidence.

## System boundary and membership inventory

Native system: **main-world equipped-Staff element-effect submission program**,
from PlayerWizard pose/heading/phase/equipment gates through each call to the
shared five-element painter, its depth/transform, and actor teardown.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Null-equipment back-angle call | `0x0054BDCE` null test -> `0x0054BDE4` | `out-of-system` (unarmed branch, not equipped Staff) | focused negative assertion removes the web `backBase` owner |
| Ordinary pose, back heading, phase `<=0.1` | `0x0054C076..0x0054C09E` | `exact-ported` | exactly one front-preservation copy |
| Ordinary pose, front heading `90..270` | `0x0054C82F..0x0054C842` | `exact-ported` | exactly one base copy; phase `>0.1` may add the pulse copy below |
| Exact heading 90 overlap | inclusive back/front tests | `exact-ported` | two copies at low phase, never three |
| Exact heading 270 | front range inclusive; back range uses `>270` | `exact-ported` | ordinary front disposition only |
| Pose 9 / StaffCast2, phase `<=0.1` | `0x0054C799..0x0054C7FE` | `exact-ported` | exactly one pose-owned front copy at every heading |
| Any pose, phase `>0.1` pulse | `0x0054C847..0x0054C8AE` | `exact-ported` | one pulse copy; pose 9 suppresses its low-phase call and ordinary front poses may retain one base copy |
| Staff action poses `0..8` | ordinary render branch | `exact-ported` | table-driven heading/phase copy census |
| Ether, Fire, Air, Water, Earth painters | `0x00539B80` dispatch reached by `0x0053B1D0` | `verified-already-at-parity` | unchanged shared element plans; copy census enumerates all five |
| Staff selectors `0..5` | type `0x1B5C`, virtual point-1 socket | `verified-already-at-parity` | selector changes art/socket, not submission gates or scale |
| Phase writers, float32 decay, interpolation | `+0x268`, `0x00550180`, `0x00548FFC..0x00549012` | `verified-already-at-parity` | existing writer/domain/timeline tests remain authoritative |
| Staff scale formula | `0x0053B2DB..0x0053B2F0` | `verified-already-at-parity` | retains exact `actorScale*(1+10*phase)` |
| Wand item branch | non-Staff path `0x0053B321..0x0053B412`, additional `0.6000000238418579` scalar | `out-of-system` (different weapon emitter/scale, not Staff orb) | recorded nearby; this correction does not infer Wand geometry from Staff |
| Empty-weapon branch | `0x0053B431..0x0053B66B` | `out-of-system` (separate hand/randomized branch) | recorded nearby; null back call remains absent from Staff membership |
| Alternate vslot-`0x20` renderer branches | `0x00546E44`, `0x0054734E`, `0x00547DE0` | `out-of-system` (mutually exclusive alternate renderer, not main-world depth program) | full xref census; each branch submits once |
| Death/alternate drive and actor/view teardown | `+0x160` helper gate and `PlayerWorldView.destroy` | `verified-already-at-parity` | no living Staff effect or stale view survives teardown |

There is no `blocked-by-platform` member. Browser scene-graph nodes can express
the exact zero/one/two-copy program.

## Native ownership thread and recovered behavioral contract

- `PlayerWizard::Render`, not the Staff item and not the element painter, owns
  submission count, painter depth, and the pose/heading/phase branch graph.
- The item lookup immediately before `0x0054BDE4` is decisive: `JNZ` skips the
  call for every equipped item. A heading test alone cannot authorize that
  node for a Staff.
- Pose 9 owns `0x0054C7FE`; the ordinary front-angle `0x0054C842` sits in its
  `else` branch. The later high-phase call replaces the pose-9 low-phase call.
- For ordinary poses, low phase yields one copy everywhere except the exact
  inclusive 90-degree overlap, which yields two. High phase yields one copy at
  back headings and two at front headings. Pose 9 always yields one.
- Every legal equipped-Staff copy uses the same authoritative tick, Staff
  point-1 socket, selected element, and `1+10*phase` scale. Actor death/view
  destruction suppresses and destroys the complete set.

## Nearby-system findings

- The helper's non-Staff equipped branch is not "no orb": it calls the same
  element dispatcher with an additional native scalar
  `0.6000000238418579`. The empty branch is different again. Both were
  inaccurately described by the previous Staff entry; neither authorizes a
  Staff back copy.
- The full helper xref set is eight, not the previously emphasized four. The
  additional main-render xref is pose-9 `0x0054C7FE`; three more belong to the
  alternate PlayerWizard renderer at `0x005468C0`.
- Durable native report corrected in
  `Mod Loader/docs/reverse-engineering/native-items-equipment-and-loot.md`.

## Confidence and open questions

- Confirmed: every helper xref, every main-render call gate, exact inclusivity,
  pose-9 mutual exclusion, Staff branch/socket/scale, five-element dispatch,
  and current web over-submission.
- Inferred: the existing captures corroborate perceived size but do not supply
  the call count; instructions do.
- Unknown: none material to the equipped-Staff main-world program.

## Web implementation consequence

- Delete the `backBase` Staff VFX owner entirely; it represents a native
  null-equipment call.
- Gate ordinary `frontBase` off during pose 9. Retain one front overlay for
  pose 9, the ordinary back/low preservation copy, and the high-phase pulse.
- Keep the recovered phase scale and all element painter geometry unchanged.
  The size correction must emerge from the exact submission program rather
  than a compensating scale constant.

## Validation contract

- Focused tests: exact copy booleans/counts at headings `0,6,7,18,19`, poses
  `0..9`, and phase below/equal/above the threshold; all five elements; no
  `backBase` renderer owner; maximum two ordinary copies and exactly one pose-9
  copy.
- Browser: idle Fire at an ordinary back heading must expose three visible
  sprite operations (one painter), exact heading 90 six (two painters), and
  pose 9 three (one painter), with weapon scale one, zero page/console/network
  errors, and no stale nodes after teardown.
- Run focused presentation/smoke coverage and the Website canonical
  `./scripts/validate.sh`; run the Mod Loader static RE gate for the corrected
  durable report.

## Implementation validation receipt

- `PlayerStaffOrbPasses` now exposes only `frontBase` and `frontOverlay`.
  `frontBase` is ordinary-pose-only; the null-equipment `backBase` view,
  update, diagnostic count, and teardown owner are deleted. The two retained
  views share the exact Staff socket, front transform, authoritative tick, and
  unchanged `1+10*phase` scale. Boneyard diagnostics now expose the same
  visible-sprite count as Hub so real pose-9 acceptance does not infer from
  scale or actor count.
- The focused presentation file passed `13/13` on the Mac mini. Its complete
  table walks all 24 headings, poses `0..9`, and phase zero/equal-threshold/
  above-threshold/high cases, rejects any `backBase`, limits ordinary poses to
  one or two copies, and requires exactly one copy for pose 9.
- Final Website acceptance used the isolated Mac tree based on
  `05c5116f711b2d62b88ac561e2ea4b628f313a62`, exact staged implementation tree
  `0482c00dfb01c356702d6c5d6c75b08b39b5c0bc`. The canonical
  `./scripts/validate.sh` gate passed `16/16` backend contracts and frontend
  groups `4/4`, `43/43`, `233/233`, `1350/1350`, `9/9`, `43/43`, `11/11`,
  `7/7`, `17/17`, and `21/21`; desktop passed `5/5`; production build, media
  policy, and bundle budget passed (`417993` raw / `117024` gzip bytes).
  The final log SHA-256 is
  `4c4e7c15363c8e7ef1c8388d738a446a194cdaa24714da4935269114d5c40b1d`.
- The corrected Mod Loader report used base
  `673a196a1c7cad8af2183c6e1691b35c50e4ded4`, exact staged tree
  `f490cc3024c4afbf609edbdd48d114b051862699`, and passed its complete
  CI-safe static RE suite `491/491` under Python 3.12.10. Log SHA-256 is
  `ab14ccea7b51323f7d469f9c738a64c53dddcdb0725e2efc227230ff9d6db567`.
- Hardware Chrome `151.0.7922.170` on the arm64 macOS `26.6.2` Mac mini
  measured idle heading 12 at three Fire operations, exact heading 6 at six,
  primary pose 8 at three with element scale `2.3500001430511475`, and secondary
  pose 9 at exactly three with 31 live Ring-of-Fire actors. Weapon scale stayed
  one throughout; page, console, and failed-response arrays were empty. The
  browser log SHA-256 is
  `509a6a9ab1f2ca9b16447cb7d5d94170d9593aff4ffeffa90c9f0e8755ad34b6`.
  Inspected Mac captures hash to
  `a2809f6c0ad72e94f096a01edf4151e7899c5f8684fa846d75be908c9e01686d`
  (Hub 90-degree overlap) and
  `ccbf2aba66a413b5d1279808cfef5fb4ec0f81963e4f12e416dc61f4185b7478`
  (Boneyard cast).
- One earlier current-main gate ran concurrently with unrelated Fireball,
  loot, and invincibility browser jobs at Mac load average above 17; only the
  existing Lua p99 budget assertion failed (`26.585 ms`). After those jobs
  exited, the exact Lua file passed `6/6`, and the unchanged complete canonical
  rerun produced the clean counts above. No product assertion was relaxed.
- All final validation was performed on the Mac mini as requested. No browser
  approximation, material unknown, or `blocked-by-platform` member remains.
  Commit, push, and deployment were not requested and have not occurred.
