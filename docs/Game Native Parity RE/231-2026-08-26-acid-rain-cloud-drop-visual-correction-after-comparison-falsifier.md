# 2026-08-26 — Acid Rain cloud/drop visual correction after comparison falsifier

> **2026-08-29 layering closure:** [entry 297](<297-2026-08-29-complete-region-world-painter-layering-audit.md>)
> leaves this file's art, transforms, alpha, and child clocks intact, but
> closes the parent cloud proxy family and direct residue/composite order.

## Reported smell and parity question

- The labeled stock/web comparison visibly contradicts the preceding
  completion claim: stock has a bright, round, filled cloud; web has a darker,
  smaller/elongated composite. Web secondary rain streaks also read upside
  down, with the bright end above the transparent tail.
- This is a secondary report in a supposedly closed system. The prior pass
  stopped after proving parent/child membership, offsets, queue ownership, and
  combat geometry. It did not map every direct atlas destination in
  `0x005EB290/0x005EB1D0/0x00459130`, did not count the blend-transition draw,
  and treated a path-directed line as if Pixi's local gradient followed path
  direction. Its passing tests encoded those false assumptions.
- This section supersedes the claims above that both cloud glyphs and residue
  use BadGuys 10, that falling Acid alpha is one, that the landed record is
  BadGuys 0, and that the comparison falsified the visual defect.
- Falsifiers: `DAT_00819978+0x3BF0` maps to BadGuys 10; the first record is
  drawn only once; `DAT_00819994+0x348` is not DeadHawg 4; `+0x3074` is not
  BadGuys 63; or native places the high-alpha rain stop above the transparent
  stop.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock/web comparison | pinned retail client capture SHA-256 `607a697578d1548181e86c8fce82218804f7e99cfcc4bb00ffa06a80bb9227f7`; exact current web comparison under `/home/user/.codex-artifacts/solomon-dark/acid-rain-comparison-20260826/` | Stock cloud is mottled, round, filled, and much brighter. Web shows small smooth circles/elongation. Stock rain grades transparent at the upper tail into a brighter lower end; web local-fill rendering reverses that visual order. | high, direct pixels |
| Raw cloud instructions | canonical read-only Ghidra replica, `0x005EB290`, especially `0x005EB2A3..0x005EB57B` | Global Y is shifted `-175`. BadGuys destination `+0x3BF0` is drawn once under source-over, renderer byte `+0x221` changes to additive and the same destination is drawn again, then destination `+0xFC` is drawn while additive remains active; source-over is restored at return. | high |
| Cloud operand ownership | `0x005EB290` direct field reads: scale `+0x140`, alpha `+0x144`, age `+0x148`, constructor phase `+0x14C` | Both rotations advance from the Acid actor's fixed-tick age. They do not read the global renderer/presentation frame. Same seed plus same actor age must therefore produce the same cloud transform regardless of browser frame cadence. | high |
| Atlas destination catalog | `native-content-inventory.json` / `native-asset-object-map.json`, BadGuys builder `0x004E1A10`, DeadHawg builder `0x004E8A90` | BadGuys `+0x3BF0` = record 78 (`136x135` mottled cloud); BadGuys `+0xFC` = record 10 (`67x68` circle); BadGuys `+0x3074` = record 63 (`17x14` ground ring); DeadHawg `+0x348` = record 4 (`93x78` residue). | high |
| Raw/decompiled Acid drop painter | `Anim_AcidRaindrop::Draw 0x00459130`; quad helper `0x0041DF10`; constants `0x00785428`, `0x007DE96C`, `0x007DE870`, `0x0078542C`, `0x007DE934`, `0x007DE8E0` | Falling quad is local `x=-1`, `y=height`, width 3, positive height `streakLength`; top RGBA `(.4,.95,.5,0)`, bottom `(.7,.95,.75,.5)`. Quarter-alpha BadGuys 0 stays at the ground root. Landed draw is BadGuys 63. | high |
| Shared secondary-drop sibling | `Anim_Raindrop::Draw 0x00458F90`; raw destination `DAT_00819978+0x3074` | Magic Storm uses width 2, top `(.4,.95,1,0)`, bottom `(.8,.95,1,.5)`, no falling ground marker, then BadGuys 63 after landing. | high |
| Residue instructions | `0x005EB1D0`; constants `0x007849F0=.05`, `0x007845E8=.1`, `0x00785E4C=4.5` | Source-over DeadHawg 4 at the field root, RGB `(.05,.1,.05)`, residual alpha, scale 4.5. | high |
| Current web causal trace | `native-secondary-presentation.ts`, `native-secondary-world-view.ts`, `native-secondary-assets.ts` at `799691a9` plus report harness | Web draws only two cloud primitives, both BadGuys 10, with normal/additive roles reversed; residue is BadGuys 10; Acid/Storm land on BadGuys 0. Its falling line is bottom-to-top, but `FillGradient(textureSpace='local')` applies stop zero to the top of the local bounds, so the high-alpha stop appears above. Acid also uses alpha 1 and blue 1 where native uses bottom alpha .5 and top blue .5. The first corrected comparison then exposed a second omission: web supplied the global presentation frame to both cloud rotations, so identical actor ages rendered different silhouettes when browser cadence changed. | high |

## System boundary and membership inventory

Native system: Acid Rain's complete visual painter and the shared secondary
raindrop primitive, from parent cloud/underlay submission through falling and
landed child rendering. Combat, lifetime, audio, light, replication, and
teardown stay in-bound as regression members even where already correct.

| Member / branch | Native source | Disposition | Required proof |
| --- | --- | --- | --- |
| record-78 source-over cloud | `0x005EB3C8`, BadGuys `+0x3BF0` | exact-ported | first draw is BadGuys 78, normal blend, exact tint/alpha/transform |
| record-78 additive duplicate | renderer `+0x221=1`, `0x005EB3E5` | exact-ported | second identical record-78 draw is additive and independently present |
| record-10 additive cloud | `0x005EB44D..0x005EB53E`, BadGuys `+0xFC` | exact-ported | third draw, additive, random-X-scale branch and `-50*s` offset |
| fixed-tick cloud rotation owner | actor fields `+0x148/+0x14C` in `0x005EB290` | exact-ported | divergent render-frame test retains transforms from `actor.ageTicks` and constructor phase |
| cloud Y shift/proxy/culling | `0x005EB2A3..0x005EB2C9`, `0x005E3600`, `0x0064E910` | verified-already-at-parity | offsets `[-175,-175,-175-50*s]`, queue key `rootY+350` |
| ground residue | `0x005EB1D0`, DeadHawg `+0x348` | exact-ported | DeadHawg 4, separate pre-world lane, exact tint/alpha/scale |
| Acid falling quad | `0x00459130 -> 0x0041DF10` | exact-ported | positive downward rectangle; exact width and top/bottom RGBA |
| Acid falling ground marker | `0x0045922C..0x00459280`, BadGuys `+0x38` | exact-ported | BadGuys 0 remains at ground root, alpha .25 |
| Acid landed ring | `0x00459287..0x004592FD`, BadGuys `+0x3074` | exact-ported | BadGuys 63, exact tint/scale/alpha recurrence |
| Magic Storm falling quad sibling | `0x00458F90 -> 0x0041DF10` | exact-ported | width two, exact blue-white stops, correct vertical order |
| Magic Storm landed ring sibling | `0x0045907C..0x004590F2` | exact-ported | BadGuys 63, no Acid-only ground marker |
| Acid splash | `0x00604E90` child factory / BadGuys 10 | verified-already-at-parity | existing one-in-four RNG/life/motion/additive contract unchanged |
| Arena weather rain | `0x00459B60`, separate particle-batch web owner | verified-already-at-parity, out of secondary-renderer implementation | existing top-transparent/bottom-half-alpha plan and batch tests remain green |
| density, lifecycle, damage, light, audio, protocol, reset | existing Acid/Storm owners | verified-already-at-parity | complete focused and browser receipts unchanged except primitive counts |
| Rain of Bones subclass | `0x005E3780/0x0061C440/0x005EBAD0` | out-of-system; replaces Acid painter/drop program | vtable/painter comparison retained |

## Native ownership thread and recovered contract

- The Acid proxy calls slot `+0x24` under the normal world queue. That painter
  itself owns three ordered sprite submissions and temporarily changes blend;
  the proxy is not one sprite and primitive count two is not native.
- Sprite transforms recovered earlier remain correct. The incorrect asset and
  blend membership, not the scale constants, caused the missing round cloud.
- Native `0x0041DF10` creates four vertices `(x,y)`, `(x+w,y)`,
  `(x,y+h)`, `(x+w,y+h)`: first color on the top pair, second on the bottom.
  Web must express this as a positive-height filled rectangle with explicit
  top/bottom stops. A reversed path plus local fill is not equivalent.
- Falling Acid has two spatial owners: the streak follows `height`, while the
  BadGuys-0 marker stays at the drop's ground root. The landed ring then
  replaces both. Magic Storm shares only the quad and landed-ring rules.

## Web implementation consequence

- Change the Acid plan to ordered `78 normal`, `78 add`, `10 add`; retain the
  recovered transforms and queue key.
- Drive both cloud rotations from replicated `actor.ageTicks`, the web mirror
  of native `+0x148`; presentation/render cadence must not reconstruct this
  authoritative fixed-tick field.
- Change residue to DeadHawg 4; add DeadHawg 4 and BadGuys 63 to the closed
  secondary asset membership.
- Replace the secondary line-gradient abstraction with the native vertical
  rectangle contract and exact stops. Keep Acid's ground marker at zero local
  offset, and use BadGuys 63 for both Acid and Storm landing branches.
- Do not tune tint, scale, blur, or opacity from the screenshot: the exact
  instruction values already explain the output once membership/order is fixed.

## Validation contract

- Focused red/green tests must assert all three cloud primitives in order,
  their assets/blends/transforms, DeadHawg-4 residue, both secondary-drop quad
  geometries/stops, Acid's stationary marker, and both BadGuys-63 landing
  branches. Asset closure must include records 63/78 and DeadHawg 4.
- The cloud test must deliberately pass a presentation frame different from
  `actor.ageTicks` and require both rotations to remain actor-age-derived.
- Re-run all Acid lifecycle/combat/protocol and Magic Storm presentation tests;
  Arena weather tests must remain unchanged.
- On the exact Mac candidate, run the complete canonical gate and real
  Tutorial/ordinary Boneyard Acid journeys. Capture a stock-matched 1600x900
  frame without a phase excuse: require a round, mottled record-78 cloud,
  three cloud primitives, downward streaks with bright lower ends, ground-root
  markers/rings, DeadHawg-4 residue, and empty page/console/network arrays.
- Publication and deployment remain separate and unrequested.
