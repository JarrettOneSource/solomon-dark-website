# 2026-08-23 — Primary collision masks, cell order, and Lightning priority reopening

## Reported smell and parity question

- Reported web behavior: verify Fireball and Ether collisions plus Lightning
  targeting priority against stock. The read-only audit disproved the existing
  closed status: Fireball lacked one hostile-over-scenery precedence branch;
  Ether and its inherited weld family used the wrong terrain admission and no
  widened scenery lane; Lightning exposed only Gravestone from a five-class
  priority-1000 family.
- Stock behavior to recover: the complete birth/flight line masks, point-query
  mask transition, exact current-cell slot order, Fireball scenery suppression
  polygon, and complete Lightning candidate priority membership.
- Reproduction inputs/scenes: Boneyard births beside mask-`0x100/0x600/0x700`
  geometry; flight ages `0/199/200`; retained and missing target handles; same-
  cell scenery/hostile overlaps; actors crossing a 100-unit cell edge; Tree,
  Monument, Gravestone, Building, Goodie, hostile, and Coffin candidates; pure
  Ether plus builds `1000/1001/1002`.
- Falsifiers: a class constructor writes a different flight mask; a rebind
  swaps with the old tail; Fireball rescans after suppressing scenery; any of
  the five scenery constructors lacks priority `1000`; a chain query inherits
  scenery; or stock reads a fixed width rather than the live App surface.

This is a secondary report against a ledger that already claimed closure. The
earlier pass stopped at point-query radius/mask and left the documented
`registrationOrder` projection unresolved. The later Fireball scenery pass
then enumerated four additional flags-`4` classes without reopening Lightning's
membership. Both omissions violated the whole-system and falsified-assumption
rules; this pass reopens the shared query system rather than adding another
symptom patch.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable | unmodified 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Exact image behind every address below. | high |
| Fireball instructions | `0x005FDD90`, raw `0x005FDFA4..0x005FE1F6`; point query `0x00641220`; polygon count `0x00642940`; point-in-polygon `0x00405160` | First flags-4 candidate is suppressed when a mask-2 root is inside the forward width-40/live-viewport polygon, except strict `candidate d2 < 2`; no same-tick rescan. | high |
| Ether-family instructions | pure handler `0x0053CFE0`; weld handlers `0x0053E6A0/0x0053EDB0/0x0053F3C0`; constructors `0x005E4990/0x005E4C50/0x005E4F30/0x005E4FB0`; tick/contact probe `0x005FD270/0x005E4A80` | Birth mask `0x380`; flight mask `0x700`; radius 6 and mask 2 while age `<200` plus a handle, otherwise mask 6; all four concrete contacts retire on flags-4 scenery. | high |
| Spatial-order instructions | register/attach `0x0063F6D0/0x005212F0`; rebind `0x005217B0`; live cell vtable preferred `0x00793A00`; append `0x00402720 -> 0x004013C0/0x004013E0`; remove `0x004014B0 -> 0x00402770` | Registration and destination rebind append at tail; same-cell motion is a no-op; removal stably shifts later slots. Manager registration order and cell-binding order are distinct. | high |
| Lightning instructions/data | query `0x00641500`; base `0x006287D0`; scenery constructors `0x005E46D0/0x005E0DB0/0x005E5C30/0x005F2C30/0x005E3D60`; attachment vslot census | Lower priority then strictly nearer; enemy priority 0; all five flags-4 scenery classes priority 1000 and attachment zero; exact ties preserve cell order. | high |
| Supporting runtime | task-owned loader-injected PID, 2026-08-23; read-only `sd.debug` App/cell reads | Live 1600-by-900 surface reported `App+0x1DC/+0x1E0 = 1600/900`; live player cell used vtable rebasing to `0x00793A00` and held player at slot zero. | high-supporting |
| Current web | rebased `origin/main 70b935e`; `primary-spells.ts`, `game-simulation.ts`, `boneyard-world.ts`, `boneyard-enemy-store.ts`, `boneyard-spell-combat.ts`, `primary-spell-targeting.ts` | Fire alone received `0x700`; no Ether birth segment; scenery rows entered only Fire; Lightning list filtered type 2029; global array index stood in for cell order. | high |

## System boundary and membership inventory

Native system: primary-spell birth/flight terrain admission plus the actor
enumeration and class policy that select Fireball, MagicMissile-family, and
Lightning contacts, from actor registration through contact retirement.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Fireball initial segment and five-tick terrain | `0x0053DC60`, `0x005E0970`, `0x005FDD90` | `verified-already-at-parity` after shared mask API | both use `0x700`; wall and excluded-shape regressions |
| Fireball hostile contact | point query mask 6/radius 20 | `verified-already-at-parity` | strict cell/radius plus damage/impact test |
| Fireball flags-4 first candidate with no hostile corridor | `0x005FDFA4..0x005FE1F6` | `exact-ported` | all five scenery rows and strict contact test |
| Fireball flags-4 first candidate with hostile corridor | same branch | `exact-ported` | live-width polygon, boundary, no-rescan tests and browser passage |
| Magic Missile `8` birth | `0x0053DBC2..0x0053DC14` | `exact-ported` | caster-root-to-birth mask `0x380` obstruction matrix |
| Magic Missile `8` flight terrain | constructor `+0x38`, `0x005FD270` | `exact-ported` | age-zero and recurring mask `0x700` matrix |
| Magic Missile contact mask 2 | `0x005E4A80`, age `<200`, handle present | `exact-ported` | scenery ignored, intervening hostile accepted |
| Magic Missile contact mask 6 | `0x005E4A80`, age `>=200` or missing handle | `exact-ported` | each scenery family consumes with Ether impact |
| FireMissile `1000` | `0x0053E6A0`, `0x005E4C50/0x005E4CA0` | `exact-ported` | inherited masks/order plus class Fire impact |
| FrostMissile `1001` | `0x0053F3C0`, `0x005E4FB0/0x005F25B0` | `exact-ported` | inherited masks/order plus class Frost impact |
| BallLightning `1002` | `0x0053EDB0`, `0x005E4F30/0x005F2360` | `exact-ported` | inherited masks/order plus class Lightning impact |
| GroundSpark `1009` | distinct `0x00545FC0`/`0x7E5` owner | `out-of-system` (not MagicMissile inheritance) | negative sibling mask test |
| Tree `2001` | priority constructor `0x005E46D0` | `exact-ported` | Lightning target and Fire/Ether scenery tests |
| Monument `2009` | `0x005E0DB0` | `exact-ported` | same |
| Gravestone `2029` | `0x005E5C30` | `exact-ported` | same plus existing visual fallback |
| Building `2040` | `0x005F2C30` | `exact-ported` | same |
| Goodie `2061` | `0x005E3D60`, flags `0x2004` | `exact-ported` | closed/open actor-membership test |
| living hostile families and Maggots | base priority/flags plus registration/rebind | `exact-ported` | manager-order and cell-tail tests across a cell crossing |
| Coffin hidden state | constructor `0x00479940` clears `+0x14/+0x36` | `exact-ported` in the 2026-08-30 reopening | hidden root remains detached and outside every queried mask |
| Coffin rising/holding/opening/open states | transition helper `0x0049A670`, write `0x0049A816` | `exact-ported` in the 2026-08-30 reopening | mask-2 membership covers Fire, Ether, Earth, Lightning, Frost, Steam, Blizzard, and welded siblings |
| actor death/retirement | flags clear `0x0063E7C0`, manager/cell removal | `exact-ported` | death eligibility and stable-compaction tests |
| Lightning priority then distance | `0x00641500` | `exact-ported` | hostile-over-scenery, scenery-nearest, priority/distance/equal-tie tests |
| Lightning retention and chain | `0x0052BA80`, `0x00641340` | `verified-already-at-parity` | wider-dot retention and mask-2 nearest-unused tests |
| Water/Earth shared cell traversal | `0x00522F50/0x00523140` | `exact-ported` for traversal order only | existing class geometry plus new destination-tail ordering |
| Hub spell collision | Website noncombat product owner | `out-of-system` (no Hub cast admitted) | existing authoritative Hub combat seal |

No member is blocked by the browser platform.

## Native ownership thread

- Owner and construction: the Region actor manager registers concrete objects;
  its world grid owns cell membership independently. Spell handlers choose
  birth masks and concrete constructors store recurring line masks.
- Producers: Boneyard authored object order, wave/maggot/projectile registration
  edges, movement-driven cell rebinds, current viewport input, projectile age,
  and target-handle state.
- State: manager registration ordinal persists for actor life; cell binding
  ordinal changes only on a cell change; viewport width is current per caster;
  Ether-family mask widens at exact age 200 or absent handle.
- Consumers: point, polygon, rectangle, and circle broadphases; Fireball
  corridor policy; concrete contact callbacks; Lightning endpoint selection.
- Siblings: MagicMissile, FireMissile, FrostMissile, and BallLightning share
  constructor/tick/query ownership. Water/Earth share cell traversal only.
- Teardown: death clears flags before final actor retirement; cell removal
  stably compacts; owner/world reset discards ordinals, projectiles, and input.
- Coffin activation: its constructor-time zero is temporary. On the exact
  hidden-to-rising edge, `0x0049A670` attaches the actor to the grid and writes
  hostile bit `0x2`; no later living-state branch clears it.

## Recovered behavioral contract

- Birth masks: Fire `0x700`; pure/welded MagicMissile family `0x380`.
  Recurring five-tick flight mask: `0x700` for all five classes.
- Fire actor contact remains post-move radius 20/mask 6. A first scenery result
  is suppressed if a mask-2 root lies inside
  `[P+Q,P-Q,P+W*D-Q,P+W*D+Q]`, `Q=(D.y*20,-D.x*20)`, unless scenery `d2<2`.
- Ether-family contact remains post-move radius 6. Use mask 2 iff age `<200`
  and target handle exists; otherwise mask 6. First cell slot wins.
- Spatial cells are `trunc0(float32(position/100))`. Registration/rebind appends
  to the destination tail; removal is stable; global registration order is not
  rewritten by cell motion.
- Lightning candidates use lower signed `nativePriority`, then strictly nearer
  root; exact ties preserve cell order. All five scenery families are priority
  1000 with zero attachment; hostiles are priority zero.
- Host fixed-tick authority owns viewport, bindings, collision, contact, and
  retirement. Protocol 61 carries the caster logical viewport width; clients
  do not decide a collision outcome.

## Nearby-system findings

- Goodie's unlock/open timer does not retire the actor. Its flags `0x2004`
  remain actor membership after the tick-250 contents materialization, so it
  remains a valid scenery candidate.
- MagicMissile acquisition `0x00641160` uses manager order, not spatial cells;
  point/cone queries use cell order. One overloaded web `registrationOrder`
  cannot represent both contracts.
- The durable native details are also recorded in Mod Loader
  `native-projectile-and-spell-mechanics.md` and the one-shot/Lightning summaries
  in `native-skills-and-spells.md`.

## Confidence and open questions

- Confirmed: every mask, threshold, radius, polygon vertex, priority writer,
  attachment vslot, cell add/remove function, class sibling, scene candidate,
  and teardown edge consumed here.
- Inferred: none material.
- Unknown: none. Responsive logical width is supplied explicitly by the caster
  and remains host-validated, so no browser approximation is introduced.

## Web implementation consequence

- Add distinct manager and cell-binding ordinals to targetable Boneyard actors;
  update cell order only when the trunc0 100-unit cell changes.
- Publish one complete five-class primary scenery list with priority 1000 and
  exact radii instead of separate Grave-only and Fire-only lists.
- Route every projectile terrain query through an explicit native exclusion
  mask; add the missing Ether-family caster-to-birth segment.
- Apply Ether-family dynamic actor masks and scenery retirement in the shared
  combat owner; keep GroundSpark separate.
- Carry logical viewport width in strict client input and use it only as the
  host Fireball corridor length. Bump protocol to 61.
- Replace the Fireball root-only symptom test and the Grave-only Lightning test
  with full membership/order contracts.

## Validation contract

- Focused contracts: all five scenery constructors; Fire corridor present,
  absent, edge, behind, lateral, and no-rescan cases; manager/cell order across
  spawn, same-cell motion, cross-cell append, death, and retirement; Ether ages
  0/199/200 and present/missing handles; pure plus all three weld contacts;
  `0x380/0x700` birth/flight mask matrix; protocol width rejection/preservation.
- Mac full gate: `./scripts/validate.sh` on the exact candidate after rebase.
- Browser: built Chrome/WebGL2 Boneyard journeys cover Fire impact/explosion,
  Ether birth-terrain impact, and Air scenery fallback during a live wave.
  Exact corridor, age/handle, all-five-scenery, and tie-order branches remain
  deterministic integration contracts rather than UI-timing assertions.
- Stock comparison: structured receipt records class, target order, cell order,
  masks, age/handle branch, viewport width, contact/retirement result, and the
  matching preferred-image instruction oracle.

## 2026-08-23 implementation and Mac acceptance receipt

- Website Mac gate passed backend build/integration, lint and architecture
  boundaries, frontend groups `4/44/239/1404/60/9/43/11/7/33/21`, desktop
  `5/5`, production TypeScript/Vite/host build, the `122544 <= 131072` byte
  gzip budget, and media policy. Log SHA-256:
  `cd4f5368cf09408e320bd3f6094919846a8a67ad2d9f34aa37ab2951a9bb3bb9`.
- Mod Loader Mac static RE gate passed `494/494`. Log SHA-256:
  `05337fb0992ab7f77edc6f401e2a9828244623026a817f82446582d335e00f45`.
- Fire Chrome receipt passed with eight hit cues, live Ember life
  `0.9899940490722656`, zero runtime error panels, and empty console, page,
  and HTTP error arrays. Log/image SHA-256:
  `e654729078de9bc46f2245b0457dced5a2b5bffddc00040763725dc3d52a7ee7` /
  `92acf5ba925c6148cde16b3b2434db86989a1d82a0852438275b2220abefafc1`.
- Ether production Chrome crossed the native gate, armed Solomon combat, and
  rendered `ether-impact` from the explicit birth-terrain path with an empty
  page/console/HTTP error collection. Log/image SHA-256:
  `22923382df9257e314362acdd438c85814a071b1b6dbf490c5d1fb41a908aa52` /
  `da2d24817d24e23041efc27773f36447f2641a5c32673b3aa784cd3320472971`.
- Air production Chrome crossed the same gates, held five rendered Lightning
  actors during a nine-Skeleton wave, and selected flags-4
  `scenery:object-59`; its page/console/HTTP error collection was empty.
  Log/image SHA-256:
  `32ad104957167e0ddb528d01be48a3d86c65aa3456270cf158c98bbfaf73b4d5` /
  `3426fece9e28e4f4192f94817fb7af09379a6c0320cef3b53acdf5a3bf0808ef`.
