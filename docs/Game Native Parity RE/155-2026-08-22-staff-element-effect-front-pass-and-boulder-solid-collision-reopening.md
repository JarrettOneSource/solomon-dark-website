# 2026-08-22 — Staff element-effect front pass and Boulder solid collision reopening

> **Staff portion superseded later the same day by the equipped-Staff
> submission-count correction below.** The Boulder evidence remains valid.
> The claimed Staff back-base copy, three-copy heading-90 program, pose-9
> ordinary-base membership, and Wand/empty silence were false because the pass
> dropped the equipment-present and mutually exclusive pose gates.

## Reported smell and parity question

- Reported web behavior: the Staff orb can be covered by wizard clothes, and
  the Earth Boulder does not have trustworthy contact geometry against
  Gravestones and other authored map blockers.
- Stock behavior to recover: drain the complete PlayerWizard element-effect
  painter program and the complete released-Boulder solid-world query,
  including sibling items/actions, Boulder subclasses, geometry membership,
  timing, masks, transforms, terminal behavior, and teardown.
- Reproduction boundary: every heading and Staff action pose in Hub/Boneyard;
  all five equipped elements; ordinary/low-mana/Hasten/Bind/Surge/Gargantuan
  Boulder; EBoulder; Gravestone root and promoted polygon; Tree, Monument,
  Building, Goodie, Fence/post/gate/rail/wall, Terrain, and world edge.
- Falsifiers: one orb node whose z-order follows only the Staff hand/shaft
  table; a Boulder point test at the old or advanced center; a `45*charge`
  release collision; a nonzero exclusion mask; a silent EBoulder solid-world
  retirement; or any authored blocker missing from coverage.

This reopens two older closures. The Player rendering entry above followed the
Staff attachment compositor but did not drain every adjacent `0x0053B1D0`
caller, so it incorrectly collapsed several element-effect submissions into
one Staff-depth node. The Earth entry recovered `45*C`/`75*C` radii but did not
decompile the movement-walker arguments and consequently treated the former as
an immediate release probe and the latter as endpoint occupancy. Both skipped
extractable downstream instructions.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | unmodified Beta `0.72.5` `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`, re-hashed 2026-08-22 | Exact executable supplying all addresses and constants below. | high |
| Staff instructions | Ghidra 12.0.3 read-only replica; `PlayerWizard::Render 0x0054BA80`, element helper `0x0053B1D0`, overlay helper `0x0053B680`, constructor `0x0052B4C0`; caller windows `0x0054BDCF..0x0054BDE9`, `0x0054C076..0x0054C0AF`, `0x0054C7E6..0x0054C8BF` | Proves separate back/base, front/base, and front preservation/pulse submissions, inclusive heading gates, `+0x248` separation, and the `+0x268` threshold. | high |
| Boulder instructions | shared contact `0x00620B60`, movement walker `0x00524180`, release `0x005E5450`, no-op `0x00462010`, EBoulder caller `0x00621450`; raw call windows `0x00620E28..0x00620E9E`, `0x005E54DB..0x005E5522` | Proves move-first advanced-to-next capsule, radius `75*C`, zero mode bytes/mask, no release query, shared subclass ownership, and terminal-at-advanced-root order. | high |
| Authored geometry | existing exact Boneyard collision inventory and Hub segment tables; Website `boneyard-collision.ts`, `hub-collision.ts` | Every movement primitive is already represented, but Earth asks only endpoint placement and EBoulder asks old-to-advanced traversal. | high |
| Current web | Website `origin/main` `c79600e24165733837b5c734842621a822e82339`; `player-character-presentation.ts`, `hub-actors.ts`, `primary-spells.ts`, `game-simulation.ts`, `native-weld-primary-runtime.ts` | Orb position/z uses `staffFront`; release probes `45*C`; ordinary Earth probes one advanced point; EBoulder silently drops on its shorter path test. | high |

No injected-loader fact is needed for either conclusion. The executable
instructions, constructor zeroes, constants, xrefs, and authored geometry
fully determine both systems.

## System boundary and membership inventory

Native system A: **equipped Staff element-effect compositor**, from
PlayerWizard render state and equipped Staff socket through every base/front/
pulse submission, element painter, transform, action/death branch, and view
teardown.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Staff shaft and two hand banks, poses `0..9` | `0x00538B80 -> 0x00578D20` | `verified-already-at-parity` | Existing per-pose back/front sheets and transform tests remain unchanged. |
| Back-angle base element copy | `0x0054BDE4`, integer heading `<=90` or `>270` | `exact-ported` | Dedicated back node/visibility and boundary tests. |
| Front-angle base element copy | `0x0054C842`, inclusive heading `90..270`, `+0x248==0` | `exact-ported` | Dedicated front node and 90/270 boundary tests. |
| Front preservation copy at back headings | `0x0054C09E`, `+0x268<=0.1` | `exact-ported` | Every back-heading draw plan retains a front copy over clothes. |
| Front pulse copy | `0x0054C8AE`, `+0x268>0.1` | `exact-ported` | Pulse threshold/copy-count tests, including a front-heading second copy. |
| Exact 90-degree overlap | inclusive back/front comparisons | `exact-ported` | Heading-six regression retains both base-side dispositions plus the front copy. |
| Render phase 9 / StaffCast2 | `0x0054C799..0x0054C8BF` | `exact-ported` | Pose-nine draw plan keeps its unconditional finite-phase front copy. |
| Staff action poses `0..8` | ordinary branch and shared helper | `exact-ported` | Idle, primary cast, melee/spin, and recovery table tests. |
| Ether, Fire, Air, Water, Earth painters | `0x0053B1D0` dispatch | `exact-ported` | Shared compositor tests enumerate all five without element exceptions. |
| Staff selectors `0..5` | Staff type `0x1B5C` and runtime socket table | `verified-already-at-parity` | Selector changes textures/socket only, never depth program. |
| Wand and empty weapon | separate helper branches | `out-of-system` (no equipped Staff orb) | Existing `hasStaff` visibility gate remains false. |
| `+0x248` colored overlay | `0x0053B680` | `out-of-system` (distinct sprite program, not element painter) | No orb-depth state is inferred from this field. |
| death/alternate drive and world/view teardown | `+0x160`, PlayerWorldView lifecycle | `verified-already-at-parity` | Orb nodes are hidden/destroyed with the owning actor. |
| inventory preview | fixed UI-owned player portrait renderer | `verified-already-at-parity` | Its fixed heading nine is in the native front half-plane and already paints above clothes. |

Native system B: **released Boulder-family solid-world collision**, from
release fields through move-first capsule construction, complete authored
geometry, actor-query ordering, terminal breakup/audio, replication, and
teardown.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Ordinary Boulder `0x7D5` | `0x005E5450`, `0x00620B60` | `exact-ported` | Advanced-to-next radius-capsule regression and impact-at-advanced-root assertion. |
| Low-mana positive/zero-base release | same functions | `exact-ported` | No release probe; first flight uses actual charge and existing finite/NaN contact policy. |
| Hasten Rocks row 42 | upstream growth factor | `verified-already-at-parity` | Geometry still consumes the resulting live charge. |
| Bind Rocks row 43 | upstream toughness/pool | `verified-already-at-parity` | Does not change solid collision shape/mask. |
| Rock Surge row 44 | immediate full-charge release | `exact-ported` | Enters the same first-flight capsule without a special endpoint path. |
| Gargantuan row 47 | maximum/released charge | `exact-ported` | Radius remains exactly `75*actualReleasedCharge`. |
| EBoulder `0x7E1`, all split children | `0x00621450 -> 0x00620B60` | `exact-ported` | Each child uses advanced-to-next capsule and its own scale. |
| EBoulder solid terminal | vslot `0x0060BED0` | `exact-ported` | Ether fade, full BoulderBit family, light/audio state, and teardown replace silent deletion. |
| Hailstones `0x7E4` | reachable `0x005FBDE0` per-rock path | `out-of-system` (no whole-carrier shared collision result after release) | Negative sibling test remains on per-rock substeps. |
| Tree circles | movement controller, selectors `1/other` radii `12/8` | `exact-ported` | Primitive-specific capsule test. |
| Monument variants `0..20` | complete authored polygon table | `exact-ported` | Every table row remains in shared collision world; representative and table census assertions. |
| Gravestone root, main selector `1/other` | radius `0/1` circle | `exact-ported` | Root-contact capsule test. |
| Gravestone overlay `>=7` | authored four-point promoted polygon | `exact-ported` | Separate promoted-geometry test; no sprite-alpha hull. |
| Building variants `0..3` | complete authored polygon table | `exact-ported` | Table census plus capsule contact. |
| Goodie | radius-eight circle plus exact footprint | `exact-ported` | Both primitives participate under exclusion mask zero. |
| Fence, Fencepost, Gate, Rail, Wall | derived segments/polygons/posts and live Gate leaves | `exact-ported` | Static/dynamic primitive tests; no Fireball `0x700` exclusion. |
| Terrain and Arena/world boundary | movement walker grid/bounds | `exact-ported` | Capsule/bounds tests in Hub and Boneyard. |
| Actor mask-`6` contact after terrain | later `0x00642280` query | `verified-already-at-parity` outside simultaneous solid-contact ordering | Existing root-only enemy contact/pool suite remains authoritative. |
| owner death/disconnect/world replacement | primary/weld cleanup | `verified-already-at-parity` | Existing owner/world teardown suites. |

There is no `blocked-by-platform` member. Browser geometry can represent every
recovered circle, polygon, segment, capsule, and painter layer directly.

## Native ownership thread and recovered behavioral contract

- PlayerWizard, not the Staff item, owns element-effect copy count and layer
  placement. `0x0053B1D0` reads the equipped Staff socket but is invoked from
  several painter positions. Staff hand/shaft depth is therefore not a legal
  substitute for element-effect depth.
- For ordinary finite state, `+0x268 <= 0.1` and `>0.1` caller branches cover
  the entire phase domain. Together with the angular base call, at least one
  complete element-effect copy is after robe/fixed clothes for every heading.
  The exact double threshold is `0.10000000149011612` at `0x007849E8`.
- A released Boulder commits one float32 velocity step and orientation update
  before collision. Its solid query is the capsule
  `[advanced, advanced + velocity]` with radius `75*charge`, every tick, mask
  zero. Terminal presentation is rooted at `advanced`, never the prospective
  next point.
- The `45*charge` release field is not queried by `0x005E5450`; trailing
  `0x00462010` is exactly `RET 0x10`. The Website must not explode a held actor
  merely because that transitional circle overlaps scenery.
- Zero exclusion means Boulder intentionally differs from Fireball: promoted
  graves, fences/posts, trees, goodies, and gates all block it through their
  authored movement geometry.
- Ordinary Boulder and EBoulder share the solid query. Hail's released
  per-rock owner is a distinct system and must not inherit a carrier capsule.

## Nearby-system findings

- The earlier `+0x268` scale correction remains valid: the phase enlarges the
  element painter and analytic player light, not Staff geometry. Only its
  caller-depth attribution was incomplete.
- `+0x248` defaults to zero in `0x0052B4C0` and feeds `0x0053B680`, a distinct
  colored sprite-array overlay. Collapsing it into orb visibility would create
  a second ownership error.
- Fireball's mask-`0x700`, five-tick, point-sized lookahead is unaffected.
  Sharing that callback without carrying radius/mask semantics is unsafe.
- The complete authored map collision inventory was already correct; the bug
  is the Boulder consumer's query segment and release timing, not missing map
  data.

The reusable facts are also recorded in Mod Loader
`native-items-equipment-and-loot.md` and
`native-projectile-and-spell-mechanics.md`.

## Confidence and open questions

- Confirmed: all direct element-helper callsites in PlayerWizard render,
  heading/phase comparisons and inclusivity, constructor zeroes, all five
  element dispatches, move-first Boulder call arguments, radius/mask/cadence,
  release no-op, shared EBoulder call, and Hail bypass.
- Inferred: none material to the implementation.
- Unknown: none. No platform approximation or unextracted authored row remains
  in these two boundaries.

## Web implementation consequence

- Represent the element compositor with separate base-depth and front-owned
  copies; do not move Staff hand/shaft sheets. Use the front attachment
  transform for every front copy and keep all copies on the same authoritative
  tick/phase so reconstruction cannot desynchronize them.
- Replace Earth endpoint placement with a radius-aware advanced-to-next path
  query. Route Boneyard through its complete collision world and Hub through
  the authored region segments. Preserve strict contact and dynamic Gate data.
- Remove the false release-time `45*C` rejection. On first flight, use
  `75*C`; root terminal effects at the advanced center.
- Give EBoulder the same query and materialize its full existing terminal
  family on solid contact. Do not alter Hail.

## Validation contract

- Focused presentation: headings on both sides and exact 90/270 boundaries;
  poses `0..9`; idle, `+0x268` below/equal/above `0.1`; every element; Staff
  selector independence; no Wand/empty orb; and front copy z/transform above
  robe/fixed layers.
- Focused collision: no release callback; ordinary and low-mana first-flight
  capsule endpoints/radius; advanced impact root; all authored primitive
  families including root/promoted Gravestone and dynamic Gate; Hub segments;
  EBoulder child independence/full terminal; negative Hail assertion.
- Run the only supported full gate, `./scripts/validate.sh`.
- Browser journey: in a real Boneyard, capture a Staff heading whose base
  attachment is behind the robe while the front element copy remains visible;
  cast Earth into a Gravestone and another authored blocker and verify one
  advanced-root breakup, no pass-through, no page/console errors, and no stale
  rolling audio or actor after teardown.

## Implementation validation receipt

- Player presentation now retains three independently visible
  `NativeElementVfxView` owners: back base at z `2`, front base at z `6`, and
  front preservation/pulse at z `6`. All share the authoritative tick, socket,
  element plan, and `1+10*phase` scale. Front copies always receive the native
  front attachment offset; Staff hand/shaft sheets and hit copies remain
  unchanged at scale one.
- Earth release and later flight now call the same radius-aware traversal seam
  over `[advanced, advanced+velocity]` at `75*charge`. Boneyard uses the
  complete dynamic collision world; Hub uses exact segment-capsule distance.
  EBoulder uses the same path and materializes the shared full terminal helper
  (Ether fade plus complete BoulderBit family) instead of disappearing. Hail's
  per-rock path is unchanged.
- Focused regressions cover the orb copy program at every heading/pose and the
  exact `0.1` phase boundary; sequential float32 Earth/EBoulder capsule
  endpoints; no `45*C` query; advanced-root impact; Hub segment paths; every
  Boneyard primitive family including Gravestone root/promoted polygon and
  dynamic Gate; EBoulder terminal children; and Hail exclusion.
- Mod Loader static RE gate passed `491/491` after the two durable report
  corrections.
- Website `taskset -c 0-3 ./scripts/validate.sh` passed the exact tree:
  backend build plus `15/15` contracts, lint/import boundaries, `230/230`
  prerequisite tests, `1309/1309` Boneyard/runtime tests, weather `9/9`, party
  `30/30`, level-up `11/11`, diagnostics `7/7`, Hall `17/17`, Hub UI `21/21`,
  desktop `5/5`, production TypeScript/Vite/game-host builds, bundle budget,
  and CSP media policy. The only lint output was the repository's eight
  existing Fast Refresh warnings; the build retained its non-fatal large-chunk
  advisory.
- Real Chrome `150.0.7871.124` WebGL journey: idle heading 12 exposed one
  three-operation front-base Fire orb; exact heading 6 exposed the recovered
  inclusive back/base, front/base, and front-preservation copies for nine
  operations. The screenshot visibly keeps the Fire orb above the robe. Hub
  combat remained sealed; Boneyard Fire reached attachment pose `8`, element
  scale `2.3500001430511475`, weapon scale `1`, and four primary actors. Error
  arrays were empty. Receipt:
  `/tmp/solomon-staff-orb-front-20260822/solomon-hub-staff-orb-front.png`.
- Real Chrome `150.0.7871.124` Earth/geometry journey selected generated
  Gravestone `scenery:object-28`. The `22.5`-radius capsule from advanced
  `(633.4136352539062,500.2079772949219)` toward
  `(636.4136352539062,500.2079772949219)` was blocked with the full world and
  clear when only that Gravestone's authored primitives were removed. The
  authoritative `earth-impact` rooted exactly at the advanced point, lived
  `257` ticks, and rendered in eight painter bands; page, console, and failed
  response arrays were empty. Receipt:
  `/tmp/solomon-earth-boulder-geometry-20260822/solomon-earth-gravestone-impact.png`.
- No browser approximation or remaining native unknown exists in either
  reopened boundary. Publication is recorded separately after rebase and push.

## 2026-08-28 — User-authorized Boulder-family Gravestone traversal QoL

### Reported smell and parity decision

- Reported behavior, also present in the original release: large Boulders are
  consumed by scenery before reaching enemies, often forcing Earth players to
  remain on the widest Roads. The user requested that Boulders ignore
  Gravestones and suggested considering a game-wide projectile exemption.
- Current/stock cause remains proven: ordinary Boulder and every released
  Ethereal Boulder child sweep `[advanced, advanced+velocity]` with radius
  `75*releasedScale` and exclusion mask zero. Terrain wins before the later
  enemy root query, so a grave terminal produces breakup with no enemy damage.
- Mac Chrome reproduced a minimum-release scale `0.3` / radius
  `22.50000089406967` capsule terminating on one isolated Gravestone with an
  `earth-impact` and unchanged enemy health.

The user authorized the QoL after this stock behavior was identified. The
Website adopts the narrow shared-family rule: ordinary Boulder and Ethereal
Boulder ignore Gravestone collision primitives during solid-world traversal.
Every other authored blocker remains solid. A blanket projectile change is
rejected because Fire/Ether/MagicMissile-derived welds intentionally consume
flags-4 scenery, Air uses Gravestones as priority-1000 fallback targets, and
Hail owns a distinct per-rock/static-line system.

### System boundary and membership inventory

Native/QoL system: **released Boulder-family solid traversal filtered by
semantic Gravestone source identity**.

| Member / branch | Source | Disposition | Proof |
| --- | --- | --- | --- |
| ordinary Boulder normal/low-mana release | `0x00620B60` | `explicit user-authorized QoL` | isolated grave passes; enemy contact/pool remains |
| Hasten, Bind, Rock Surge, Gargantuan | shared ordinary owner | `explicit QoL through shared path` | every released scale uses the same grave exemption |
| EBoulder quantities 1..4 and every split child | `0x00621450 -> 0x00620B60` | `explicit QoL through shared path` | each child passes graves independently and retains terminal/pool state |
| Gravestone root and overlay `>=7` polygon | type 2029 source ids | `ignored by Boulder family only` | both primitives excluded by exact source identity |
| Trees, Monuments, Buildings, Goodies | authored collision census | `verified-already-at-parity` | still terminate Boulder/EBoulder |
| Fence, Fencepost, Gate, Rail, Wall, bounds | shared collision world | `verified-already-at-parity` | still terminate Boulder/EBoulder |
| Fireball, Ether, builds 1000..1002, Air | separate contact/target owners | `out-of-system` | existing scenery membership unchanged |
| Hailstones build 1008 | per-rock/static-line owner | `out-of-system` | no shared Boulder capsule |
| Hub combat | authoritative combat seal | `out-of-system` | no live Boulder release admitted |
| host/observer/late join and teardown | authoritative projectile state | `verified-already-at-parity` | collision decision remains host-only; no wire change |

No member is `blocked-by-platform`.

### Implementation and validation contract

- Extend the radius-aware Boneyard traversal seam with exact ignored source
  identities. Select all type-2029 source ids once for Boulder/EBoulder calls;
  do not remove collision rows, mutate the shared world, or infer from sprite
  shape.
- Red/green tests must cover grave root/promoted polygon pass-through for pure
  Earth and all four EBoulder children, plus retained termination on every
  other blocker family and normal enemy contact after the passed grave.
- Mac Chrome must carry Earth completely through an isolated grave with no
  impact and retain its renderer. A separate staged-hostile browser journey
  must prove enemy damage and the unchanged residual/terminal family; focused
  authority tests retain every non-grave blocker with no collision-world edit.

### Implemented result and browser acceptance

- The shared radius-aware traversal seam accepts exact ignored source ids.
  Game authority supplies only semantic Gravestone ids for ordinary Boulder
  and released Ethereal Boulder build 1006; no other primary family receives
  the exemption and no collision row is removed from the world.
- Focused regressions pass both Gravestone shapes, retained Tree/Building
  blocking, ordinary Earth, and all four released Ethereal Boulder children.
- Chrome `151.0.7922.174` placed a minimum-release radius-22.5 Earth carrier at
  `(630.4136352539062,500.2079772949219)` against Gravestone
  `scenery:object-28`, centered at `(657.9136352539062,500.2079772949219)`.
  It remained authoritative and rendered at `(696.4136352539062,
  500.2079772949219)` with no `earth-impact`; page, console, and failed-response
  arrays were empty. Visual receipt:
  `.tmp-earth-final/solomon-earth-gravestone-passage.png` (temporary acceptance
  capture).
- A separate real-browser staged-hostile journey then retained the downstream
  contract: enemy `enemy:1` entered `hitTargetIds`, the live residual carrier
  kept positive damage and emitted `earth-boulder-bit`, Rock Hit/Stone Break
  audio and renderer bands were present, and terminal `earth-impact` followed.
  Host authority independently recorded residual tick `1492` and terminal tick
  `2029`; browser errors were empty. Visual receipt:
  `.tmp-earth-contact-diagnostic-frames/solomon-primary-earth-boneyard-contact.png`
  (temporary acceptance capture).
- The same exact candidate passed the complete Mac gate recorded in entry 051,
  including the broad Boneyard/runtime suite, production builds, and bundle
  budget.
