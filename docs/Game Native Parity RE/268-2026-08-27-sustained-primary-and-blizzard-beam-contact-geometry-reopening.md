# 2026-08-27 — Sustained primary and Blizzard Beam contact geometry reopening

## Reported smell and parity question

- Reported web behavior: Frost + Lightning weld contact feels spatially wrong;
  either its collision shape or enemy collision boxes appear incorrect.
- Stock behavior to recover: the entire player sustained-primary target-query
  family that owns Lightning, Frost Jet, Flame Lash, Blizzard Beam, and Steam
  Jet, including view/terrain clipping, root geometry, broadphase order, target
  flags, chains, weak branches, push collision, contact children, and teardown.
- Reproduction inputs/scenes: Boneyard at canonical and resized logical
  viewports; targets on strict range/angle/polygon/chain boundaries; every
  survival enemy family, Maggot, Coffin, the five flags-4 scenery classes,
  Arrow, terrain obstruction, low mana, Widen, Chaining, Stun, and push.
- Falsifiers: any directional query reading body radius; Blizzard calling
  `0x00641B10`; a per-target Blizzard LOS check; chain equality admitted at
  100; weak Blizzard chaining/stunning/pushing; a chain beam factory call; or
  the target-owned push fields failing to gate/ramp before world collision.

This is a secondary report against the 2026-08-20 welded-primary closure. That
pass recovered Blizzard's draw factory but stopped before the handler's
contact polygon, inherited Frost Jet's cone for combat, and called the two
source glows the complete child set. The 2026-08-23 primary-collision reopening
then enumerated point/cone helpers without sweeping `0x006427E0` or the
Blizzard call at `0x00541F37`. Both passes violated whole-system membership;
this entry supersedes their Blizzard collision and child-membership wording.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable | unmodified 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Exact image behind every instruction, field, constant, and xref below. | high |
| Blizzard causal trace | read-only Ghidra 12.0.3 replica; handler `0x00541870`; raw `0x00541A26..0x00542C92` | One view/terrain-clipped primary beam, strict four-point root polygon, direct contacts, 100-unit chains, target push state, and independent children. | high |
| Shared query helpers | `0x006427E0 -> 0x005235F0`; `0x00641500`; `0x00641B10`; `0x00641340`; point/polygon helpers `0x00641220/0x00405160` | Polygon and directional queries are root-only; Lightning/Frost angles use a 30-unit back-projected apex; chain radii differ by caller. | high |
| Complete xref sweep | direct-reference census for `0x006427E0/0x00641500/0x00641B10/0x00641340` | Closes every player-primary caller and dispositions every enemy/secondary/melee/modifier sibling. | high |
| Constants/raw operands | `0x007848A0=200`, `0x007DE908=100`, `0x007847C8=50`, `0x007DE920=20`, `0x00784D80=15`, `0x00784D50=30`, `0x007852D8=200`, Blizzard stack radius `100`, `0x00785428=.4` | Pins view padding, corridor geometry, angular apex, caller-specific chain radii, and chain-fade loss. | high |
| Current web trace | `primary-spell-targeting.ts`, `native-primary-skill-profile.ts`, `primary-spells.ts`, `boneyard-spell-combat.ts`, `boneyard-enemy-store.ts`, protocol 90 input, and Blizzard renderer at `58ded923` | Web substitutes Frost cone reach/aperture/LOS for Blizzard, uses 200-unit chains, applies normal branches while weak, has no target push latch, and creates chain beams instead of native contact children. | high |

Raw task logs are in
`/home/user/.codex-tmp/frost-lightning-weld-collision-20260827/` and remain
transient: `decompile-primary.log`, `decompile-siblings.log`,
`decompile-polygon-system.log`, `blizzard-polygon-insns.log`,
`blizzard-contact-insns.log`, `blizzard-chain-vfx-insns.log`, query/call xref
logs, and constant dumps. Reusable conclusions are owned by this ledger plus
Mod Loader `spell-welding.md` and `native-projectile-and-spell-mechanics.md`.

## System boundary and membership inventory

Native system: player sustained-primary contact acquisition from
caster/view/terrain inputs through Region root enumeration, direct/chain
contact, target push and world collision, registered contact presentation, and
release/owner/world teardown.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Lightning `24` acquisition | `0x00529AD0 -> 0x00641500` | `exact-ported` | 30-back angular apex, strict range, LOS, priority, view endpoint, retention |
| Lightning `24` chain | `0x0053F9C0 -> 0x00641340`, radius 200 | `verified-already-at-parity` after shared radius assertion | strict root radius/order and used-target exclusion |
| Frost Jet `32` normal | `0x00543860 -> 0x00641B10`, mask `0x1082` | `exact-ported` | 30-back apex, half-angle `15+widen/2`, reach `205+4*widen`, root-only LOS |
| Frost Jet `32` weak | same handler, mask `2` | `exact-ported` | aperture 30/reach 205, `.75` ColdSlow, no learned push/projectile branches |
| Frost Jet Arrow/`0x80` branch | `0x00543860`, vslot `+0x64` | `verified-already-at-parity` with corrected special-list order | Arrow remains after grid roots and tumbles only when native scalar crosses one |
| Flame Lash `1003` acquisition | shared `0x00529AD0/0x00641500` | `exact-ported` | same corrected apex/view/priority contract as Lightning |
| Flame Lash `1003` chain | `0x005408F0 -> 0x00641340`, radius 200 | `verified-already-at-parity` | separate Fire payload and existing fade/ribbon ownership retained |
| Blizzard `1004` primary line | `0x00541A26..0x00541C4E`, `0x00410FF0/0x00524D70` | `exact-ported` | caster viewport plus 100 padding, mask-`0x380` terrain endpoint, beam/contact share endpoint |
| Blizzard `1004` root polygon | `0x00541C4E..0x00541F37`, `0x006427E0` | `exact-ported` | exact four vertices, mask `0x1086`, strict root-only point test, cell order, no target LOS |
| Blizzard direct hostile contact | bit `0x2` branch `0x00542181..0x00542395` | `exact-ported` | Cold before Stun before damage; each root once in query order |
| Blizzard weak branch | `0x00541973..0x005419B5` plus contact gates | `exact-ported` | half damage, `.75` Cold, no Stun/push/chain, half beam width |
| Blizzard chain selection | `0x005425BF..0x00542C01`, radius 100 | `exact-ported` | strict equality exclusion, shared used set, `.600000024` damage recurrence |
| Blizzard target push latch | target `+0x1C8/+0x1CC`, `0x005423BE..0x00542598` | `exact-ported` | 30-forward radius-`25/3` blocker, three-tick gap reset, ramp/caps, world MoveStep |
| Blizzard flags-`0x40` push branch | `0x005424F2..0x00542513` | `verified-already-at-parity` negative for current survival families | `.05` scalar retained in shared helper; no current Website family advertises the flag |
| Blizzard Tree `2001` | flags `0x4`, primary scenery row | `exact-ported` | polygon/root admission and variant-3 glow; no damage/chain/push |
| Blizzard Monument `2009` | same | `exact-ported` | per-class root assertion |
| Blizzard Gravestone `2029` | same | `exact-ported` | per-class root assertion |
| Blizzard Building `2040` | same | `exact-ported` | per-class root assertion |
| Blizzard Goodie `2061` | flags `0x2004` | `exact-ported` | closed/open lifecycle plus root/glow admission |
| Blizzard Arrow `0x80` | query mask and vslot `+0x64` | `exact-ported` | special-list order and fixed-scalar tumble event |
| Blizzard `0x1000` virtual branch | same mask/vslot branch | `out-of-system` — no Website survival actor owns flag `0x1000` | complete negative target census |
| Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon | base bit `0x2` plus family store | `exact-ported` | every family has a root-boundary direct/chain test; child Imps/Demons retain state |
| Coffin-owned Maggot | active bit `0x2` path | `exact-ported` | root, chain, push-latch, and teardown tests |
| Coffin `1013`, hidden | constructor `0x00479940` clears `+0x14/+0x36` | `exact-ported` in the 2026-08-30 reopening | detached and excluded before emergence |
| Coffin `1013`, rising/holding/opening/open | activation helper `0x0049A670`, write `0x0049A816` | `exact-ported` in the 2026-08-30 reopening | hostile bit `0x2` admits direct/chain Frost, Lightning, Steam, Flame, and Blizzard contacts |
| enemy body radii and visible sprite boxes | actor `+0x30` and renderer families | `out-of-system` — directional/polygon narrow phase reads roots only | oversized-radius and sprite-overlap negative tests |
| terrain-contact variant-3 SpellGlow | `0x00541F98..0x00542062`, `0x00454AD0` | `exact-ported` | one-frame owner at endpoint minus 20 Y, two RNG words, terrain-only birth |
| per-root variant-3 SpellGlow | `0x00542086..0x00542181` | `exact-ported` | one per flags-2/4 root, stable order, independent one-frame expiry |
| two source variant-24 SpellGlows | `0x005328D0` primary factory | `verified-already-at-parity` | exact four-word pair and one-frame teardown retained |
| chain `Anim_FadeFrost` | `0x005426C3..0x0054284C` | `exact-ported` | current-source radial offset, Water compositor, `1/.6/.2` alpha, independent sort/lifetime |
| optional `Anim_FrostJetEffect_Chaining` | `0x00542851..0x005429F8`, base ctor `0x00453550` | `exact-ported` | one-in-two selector at the current source, four constructor RNG words, speed/core/update wrapper, independent expiry |
| invented Blizzard chain beam | no `0x005328D0` chain-loop call | `out-of-system` — remove | only one primary beam remains per held tick |
| Steam Jet `1005` cone/push | `0x00542D20 -> 0x00641B10` | `exact-ported` | corrected 30-back apex and half-angle; Steam actor/contact lifecycle unchanged |
| polygon-query Mouth Beam xref | `0x0044FFE0` | `out-of-system` — enemy ability owner | native enemy presentation/combat contract retained |
| polygon-query Staff xref | `0x0053B9F0` | `out-of-system` — melee footprint owner | existing three-shape Staff contract retained |
| cone helper xrefs `0x005F3B50/0x005F6410` | secondary/enemy area consumers | `out-of-system` — not player primary handlers | exact direct-xref census |
| cone query Leviathan xref | `0x006145D0` | `out-of-system` — secondary summon | existing Leviathan contract retained |
| chain ElectricBurn xref | `0x00628F10` | `verified-already-at-parity` | existing radius-200 modifier tests retained |
| chain Goodie xref | `0x00646D00` | `out-of-system` — unlock interaction | existing nearest unopened Goodie contract retained |
| Hub cast path | Website Hub noncombat admission | `out-of-system` — no primary contact is admitted | existing Hub combat seal |
| Boneyard release/death/world replacement | held dispatcher and world-owned transient cleanup | `exact-ported` | no new queries after release; every child expires or owner/world teardown removes it |

No member is blocked by the browser platform.

## Native ownership thread and recovered behavioral contract

- The authenticated caster input supplies aim plus current logical viewport;
  the active Region owns camera clamp/view dimensions and static collision.
  The primary handler owns one fixed-tick view endpoint, optional terrain
  replacement, query geometry, ordered target walk, modifier/damage order, and
  child births. The target actor owns Blizzard push accumulator/timestamp; the
  active world owns final movement collision and cell rebind.
- Lightning and Flame use the priority cone; Frost and Steam use the ordered
  cone. Both angle helpers measure from `origin-30*direction` but retain strict
  range from the real origin. Blizzard instead uses the corridor formula:
  `beamWidth=(widen==0?.75:1+3*widen)*(weak?.5:1)`,
  `halfWidth=max(20,25*beamWidth)`, roots inside the shifted/extended four-point
  polygon above, and no per-target LOS.
- Input viewport width and height are authoritative bounded surface facts.
  View origin is camera-clamped around the caster at native Hub/Boneyard scale;
  Blizzard expands it by 100 before ray clipping. This is gameplay input only
  for stock handlers that consume Region view state; render cadence never owns
  collision.
- Query traversal is cell X, cell Y, stable cell slot. Special `0x180` actors
  follow grid candidates in their collection order. Strict point-in-polygon,
  range, chain, and circle comparisons reject equality.
- Primary release, skill replacement, death, disconnect retirement, world
  replacement, and run teardown stop new emissions immediately and remove
  owner/world state. Already registered native-duration children finish unless
  their world is torn down.

## Nearby-system findings

- Durable finding: the shared cone helpers back-project only the angular apex;
  they do not move the strict range origin. This corrects pure Frost, Steam,
  Lightning, and Flame together.
- Durable finding: Region view rectangles can feed gameplay query range in
  addition to presentation. The responsive-camera entry's statement that view
  changes never affect collision remains true for world/body collision, but is
  not true for Blizzard/Lightning spell target extent.
- Durable finding: target `+0x1C8/+0x1CC` is Blizzard push state on hostile
  actors; the same numeric offsets have different subclass meanings on Wizard
  and scenery classes.
- Native reports updated: Mod Loader `spell-welding.md` owns the complete
  Blizzard model; `native-projectile-and-spell-mechanics.md` owns shared query
  helper semantics and xref membership; `native-skills-and-spells.md` carries
  the corrected sustained-handler summary.

## Confidence and open questions

- Confirmed: every formula, comparison, mask, call, direct xref, field update,
  low-mana gate, and child factory above is instruction- or static-data-backed.
- Inferred: descriptive names for target `+0x1C8/+0x1CC`; ownership and exact
  reads/writes are confirmed even though native symbols are absent.
- Unknown: none material to the web implementation. Stock process-global
  presentation RNG sequence remains represented by the already documented
  stable semantic render stream only where it cannot affect gameplay state;
  every selector/birth that changes actor membership remains authoritative.

## Web implementation consequence

- Replace Blizzard's Frost-cone branch with one shared exact contact-polygon
  kernel and use the same terrain/view endpoint for simulation and rendering.
- Correct the shared cone angular apex and Widen contribution everywhere;
  replace no enemy radii or renderer boxes.
- Carry viewport height beside width under protocol 94. Keep the host as owner
  of view clipping, target selection, damage, push state, and child identities.
- Store Blizzard push accumulator/timestamp on every live hostile row, use the
  existing native point query for the forward blocker, then pass only the
  requested displacement into the active world's collision resolver.
- Remove invented Blizzard chain beams. Add terrain/root SpellGlows, chain
  Frost fades, and the optional chaining Frost actor with their own fixed-tick
  lifetimes and painter roots.
- Retain pure Lightning/Flame priority, Frost/Steam LOS, modifier ordering,
  damage authority, audio, and all unrelated projectile/world collision paths.

## Validation contract

- Focused contracts: exact polygon vertices at neutral/Widen/weak widths;
  strict root/body-radius negatives; mask/order/scenery/Arrow membership; view
  resize and terrain endpoint; pure Air/Water/Steam apex/aperture boundaries;
  strict 100/200 chain radii; weak branch; push blocker/gap/ramp/caps/rebind;
  child RNG/membership/lifetimes; and no chain beam.
- Per-family matrix: Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon,
  Maggot, hidden-Coffin negative, risen-Coffin positive, all five scenery rows,
  and Arrow.
- Protocol contract: width and height are both finite, bounded, required, and
  preserved through client clone/equality and host input.
- Browser journey: a real 1600x900 Mac Chrome Boneyard run equips build 1004,
  places roots on both sides of the old-cone/new-polygon difference and strict
  100-unit chain boundary, holds/release normal and weak casts, verifies HP,
  modifiers, positions, actor-child census, endpoint agreement, and empty
  page/console/failed-response arrays.
- Full gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact detached
  Mac candidate after focused failures prove the superseded implementation.

## Implementation validation receipt

- Causal result: enemy body radii and rendered boxes were falsified. Retail
  Blizzard Beam handler `0x00541870` queries strict actor roots inside its own
  shifted, forward-extended polygon; the web handler had substituted Frost
  Jet's cone, LOS, and 200-unit chain model. No enemy collision box was changed.
- Website implementation now owns one viewport/terrain-clipped beam endpoint,
  the exact four-point root polygon, native cell/special-list traversal, strict
  100-unit Blizzard chains, weak-branch gates, target-owned push latch/ramp,
  Cold-before-Stun-before-damage ordering, and the complete independent glow,
  Frost-fade, and optional chaining-Frost child set. Shared Frost/Steam and
  Lightning/Flame angular queries now use the 30-unit back-projected apex while
  retaining strict range at the real origin. Protocol 94 carries both viewport
  dimensions and rejects non-native duplicate transient fields.
- The pre-fix focused run passed 90 contracts and failed the four intended
  falsifiers: cone apex, Blizzard polygon/100-unit chain, weak Blizzard, and
  viewport height. Its log SHA-256 is
  `199e2d2284b2b56f07bb49c578365ec864ee354b3ab12fce65ab9ceffcd26e0a`.
- The corrected focused runtime suite passes 30/30, including the exact
  Blizzard polygon and child birth program plus the protocol-safe Frost fade;
  log SHA-256 is
  `4f32487d1d0c58021730fdd88eab7879f87850cff5dc643853254840d30b4ac3`.
  The broader exact Mac candidate gate also passed backend build with zero
  warnings/errors, pretest 310/310, Boneyard 1679/1679, every auxiliary suite,
  production builds/media policy, and the game bundle budget at 252,266 raw /
  76,565 gzip bytes. Its pre-browser log SHA-256 is
  `333fb88b3c0da08505f0adcfb5dad233825c9b7b3b108517674a6385185cbc3a`;
  the exact final candidate is rerun after this receipt is recorded.
- The Mod Loader static RE registry passes 521/521 with the widened native
  contracts; log SHA-256 is
  `bca317fd0e65c33f126a90981c9584e84672ae51b1a1d958abf82c31d9bcd8e6`.
- Real 1600x900 Mac Chrome Boneyard acceptance equipped build 1004 and used
  three controlled host-owned Demon roots. The direct root fell from 400 to
  `399.9698999977112`, received Cold, Stun, and Blizzard push timestamp 184;
  the root 95 units away chained to `399.981939997524` with Cold and Stun; the
  outside root remained exactly 400. The captured renderer frame held two beam
  snapshots, four Blizzard glows, Frost fades, and chaining-Frost children.
  Page, console, and failed-response arrays were empty. Browser log SHA-256 is
  `dc906e5a0227ba5849f604bb3f8be1266e42e57e828f1677bd000e57ffe47ad7`;
  inspected screenshot SHA-256 is
  `d2920ba731cbe1082cf328eb30c34690fe48ffdfa7e0e16ffcf4de285333c585`.
- No push, deployment, or production cutover was requested or performed. The
  isolated Website and Mod Loader task branches and Mac receipts remain local.
