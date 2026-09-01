# 2026-08-27 — Coffin/Maggot retirement, Zombie composition, and skill-acquisition reseed reopening

## Reported smell and parity question

- Player reports: defeated Coffins appeared not to disappear; one Fire/Body
  wizard repeatedly received Enchant Staff until its cap and then the same
  Explode/Fireball/Health Up cards through roughly wave 22; Zombies showed
  visual errors.
- These are secondary reports against systems previously marked closed. The
  earlier passes skipped three required closure rules: the offer audit followed
  builder `0x0067CB70` but did not enumerate every writer of actor-private seed
  `+0x834`; the Zombie audit named atlas ranges without following both config
  selectors and all nine draw sites; and the Coffin pass shipped an explicitly
  bounded 50-tick child timer while native replenishment and landing membership
  remained extractable.
- Falsifiers were: an ordinary accepted native skill choice does not rewrite
  `+0x834`; Zombie has a native flyblown arm-side selector; BODY TYPE cannot
  select the fourth body/head banks; Coffin death retains its living body; the
  configured Maggot maximum gates births rather than grounded combat admission;
  or Maggots contribute to the native TimeLine monster count. Fresh static and
  live evidence falsified none of the corrected models below.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-27 | Same canonical image as the prior progression/enemy reports. | high |
| Offer writers/xrefs | canonical read-only Ghidra replica; `0x006594E0`, `0x00660320`, `0x00671470`, `0x0067CB70`; complete `0x00660320` xref set | Progression construction draws a seed. Every accepted `Skills_Wizard` acquisition draws `Integer(1_000_000)` and overwrites `+0x834` before rank mutation. LevelupScreen calls it once for an ordinary card and twice for Insight. ROLL AGAIN owns the remaining direct writer. The builder reads but does not mutate the seed. | high |
| Coffin/Maggot instructions | constructors `0x00479940/0x0047E0F0`; config `0x00462790`; Coffin tick/helper `0x004A2760/0x00479C30`; Maggot tick/admission/accounting `0x0048B2A0/0x004889B0/0x00487FD0`; parent-loss/death `0x0047E410/0x0049C830`; Coffin death `0x0049B310` | Closes the four Coffin states, charge-based emission, two launch segments, inactive/active child counters, 1-in-5 admission, 30-inactive ceiling, parent invalidation, and immediate body-to-independent-debris handoff. | high |
| Zombie instructions/data | constructor/config/tick/render/death `0x004740C0/0x00462790/0x004863A0/0x00493390/0x004947B0`; BadGuys arrays `2095..2202`, `2203..2274`, `2275..2292`, `2293..2364`, `2365..2508` | Constructor chooses body/head `0..2`; MonsterSetup BODY TYPE 1 writes word `0x0303` for body/head 3; FLYBLOWN is independent byte `+0x24E`. There is no flyblown-side RNG or arm-bank offset. Body rotation transforms all three authored body attachment points before arm/head placement. | high |
| Zombie selector-3 constants | fresh read-only decompile of `0x00493390`; data `0x00784ADC`, `0x00787060`, `0x007DE9B0`, `0x00787058` | Selector 3 uses scale `1.15`, composite-root translation `-8`, a body shift of `-5` along the current local direction, and two overlay shifts of `-4` from the transformed rear/front anchors. | high |
| Injected supporting runtime | task-owned Release loader, exact retail image, local process image base `0x00C30000`; exact stock-spawner Coffin/Zombie requests; actor field samples and `sd.world.trigger_enemy_death` | A live Coffin reached state 3 with configured maximum 20, active count 20, charge 10, and a separately growing inactive counter. Native Coffin and Zombie bodies left the ActorWorld immediately on the terminal request; Coffin-owned Maggot parent handles invalidated and then entered their own dead lane. Loader injection is supporting evidence only. | medium-high |
| Current Website trace | current `origin/main` `f7e0b244`; `player-progression.ts`, `boneyard-enemy-store.ts`, `project-boneyard-enemies.ts`, `native-enemy-presentation.ts`, replication/timeline/view code | Choice apply leaves `offerSeed` unchanged; Coffin emits one child every 50 ticks and caps all owned children; wave live count includes Maggots; Zombie invents `flyblownSide`, changes an arm pose, omits body/head type 3 and records `2275..2292`, and leaves body-rotated attachment points untransformed. Snapshot/view removal itself is structurally correct. | high |

The live probe used preferred-to-runtime delta `+0x00830000`; all other
addresses in this entry are preferred-image addresses. No clean-stock binary or
canonical Ghidra project was modified.

## System boundary and membership inventory

Native system A: **actor-private skill acquisition and level-up offer seed
ownership**, from construction or any permanent-rank acquisition through the
next offer's private candidate stream and shared-RNG display work.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| progression constructor seed | `0x006594E0`, `+0x834` | exact-ported in this reopening | fresh-player RNG/seed sequence |
| Create/loadout element, primary, secondary, discipline, and eight root acquisition calls | `0x005D0290 -> 0x00660320` | exact-ported in this reopening | acquisition-count and final-seed fixture |
| ordinary LevelupScreen card | `0x00671470 -> 0x00660320` once | exact-ported in this reopening | seed changes before queued offer build |
| Creativity Insight card | same call twice | exact-ported in this reopening | two seed draws; final seed is the second |
| Sorceror's Charm ROLL AGAIN | direct writer `0x006714FC` | verified-already-at-parity | one seed draw before rebuild |
| SAVE SKILL / defer, close without acquisition | no seed writer | verified-already-at-parity | unchanged seed and gameplay RNG |
| random learned-skill/item grant | `0x0056D1B0 -> 0x00660320` | exact-ported in this reopening | selection draw followed by acquisition-seed draw |
| Tutorial/direct/scripted grants | xrefs `0x005D5910`, `0x005D5CF0`, `0x0067C360`, `0x00689750` | exact-ported through shared web acquisition seam | one reseed per actually applied rank |
| Spell Welding ordinary card | row 52 through the same acquisition helper | exact-ported in this reopening | one seed draw; build identity retained |
| all ordinary rows `8..51,53..79`, Welding builds `1000..1009`, runtime rows `80/81` | existing complete catalog and builder scan | verified-already-at-parity; no eligibility/table change | all 72 public rows and prior paired differential remain members |
| Fire/Body pool and More Missiles 10 | roots/dependency row 8 | verified-already-at-parity after reseed | Fire/Body cannot receive 10 without learned Magic Missile; changed seeds vary legal cards |

Native system B: **Coffin-owned Maggot creation, admission, retirement, and
wave-count boundary**, from Coffin construction through all children and
independent terminal effects.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| hidden 180/360-tick state and initial 0..49 tick gate | `0x00479940`, state 0 | exact-ported | both constructor branches |
| rise `+0.3` through frame 3 and hold `150+Integer(150)` | state 1 | exact-ported | float32 boundary/hold range |
| opening `+0.2` through frame 12, creak edge, three initial helpers | state 2 | exact-ported | visible frame progression and exact count |
| Coffin body transform | constructor `+0x224/+0x228`, renderer `0x0049AC90` | exact-ported | retained `+/-1` X scale and signed `15` degree rotation apply to closed/open body records and launch segments |
| open charge `<1` triple emission | state 3 `0x004A2760` | exact-ported | no probability draw; three births/tick |
| open charge `>=1` emission | same | exact-ported | `Float(charge/speed) < 1`; one optional birth |
| charge recurrence | `+0x2E8 += 0.025`, cap 10 | exact-ported | float32 threshold/cap fixtures |
| launch segment A/B | `0x00479940/0x00479C30`, authored points `(5.5,8.5)->(15.5,-29.5)` and `(-9.5,-4.5)->(5.5,-41.5)` | exact-ported | retained `+/-1` X scale, signed `15` degree constructor rotation, both interpolated origins, mirrored `140..200` / `270..330` headings, and two independent `Float(8)` offsets |
| airborne Maggot | `0x0047E0F0/0x0048B2A0/0x0049C190` | exact-ported | velocity/height/gravity/landing transition plus private `Float(5)` phase, `+0.25` modulo five, and ten heading orientations |
| inactive child admission | `0x004889B0`, parent `+0x2E0` | exact-ported | first 30 failed admissions remain noncombat children |
| active child admission | same plus `0x00487FD0`, parent `+0x2E4` | exact-ported | capacity available and `Integer(5)==3` only |
| post-ceiling failed child | inactive count reaches 31 | exact-ported | terminal retirement instead of another inactive child |
| active crawl, one bite, poison/Golem exception, own death | `0x004881A0/0x0049C830` | verified-already-at-parity except admission owner corrected here | combat-active children only can bite |
| Coffin death body | `0x0049B310` plus common removal | verified-already-at-parity; browser regression added | body disappears on the terminal edge; debris is independent |
| parent-loss children | stored parent handle resolution | exact-ported | all active/inactive/emerging children retire after invalidation |
| Maggot wave-count policy | Maggot constructor cancels the shared Badguy count increment | exact-ported in this reopening | wave thresholds and spawn capacity count Coffin, never its Maggots |
| Coffin break debris/audio/reward | independent Bouncer/Unbind/audio actors | verified-already-at-parity | long-lived debris cannot retain a living Coffin view |
| Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon terminal bodies | shared Badguy terminal/removal family | verified-already-at-parity | per-family body removal and actor retirement sweep |

Native system C: **Zombie composite body and auxiliary presentation**, including
every constructor/config selector, action branch, authored record bank, and
terminal handoff.

| Member / bank | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| base/gait `2365..2508` | eight poses x 18 facings | verified-already-at-parity | complete pose/facing matrix |
| rear arm `2095..2148` and front arm `2149..2202` | rest/pose 1/pose 2 | exact-ported after removing false flyblown offset | both attack sides and 50/100 thresholds |
| body 0 `2203..2220`, body 1 `2221..2238`, body 2 `2239..2256` | constructor `Integer(3)` | verified-already-at-parity; attachment geometry corrected | all 54 rows |
| BODY TYPE 1 body 3 `2257..2274` | config apply writes `+0x24D=3`; constants `1.15`, root `-8`, body `-5` | exact-ported | all 18 facings, scale and local placement |
| body-3 overlay `2275..2292` | two draw sites guarded only by body type 3; local shift `-4` | exact-ported | one copy at each transformed arm anchor per facing; not FLYBLOWN or arm state |
| head 0 `2293..2310`, head 1 `2311..2328`, head 2 `2329..2346` | common/rare constructor selector | verified-already-at-parity; attachment geometry corrected | all 54 rows |
| BODY TYPE 1 head 3 `2347..2364` | config word `0x0303` | exact-ported | all 18 facings |
| authored body points 0/1/2 | `0x00493390` matrix path | exact-ported | body rotation transforms head/rear/front anchors before child rotations |
| FLYBLOWN byte `+0x24E` | config `+0x94`; ROTTEN flag | verified-already-at-parity after selector separation | clouds, flies, FadeSin particles and loop only |
| constructor cosmetic RNG | phases, head angle, arm angles, side, body/head selectors | exact-ported after deleting one invented draw | exact draw count/order and domains |
| beat, hit/shield, poison pool, death fragments/audio | existing action/damage/terminal owners | verified-already-at-parity | complete normal/rotten action and terminal tests |

There are no `blocked-by-platform` members. All recovered mechanisms are
representable by deterministic authoritative state plus ordinary WebGL sprites.

## Native ownership and recovered behavioral contract

- `Skills_Wizard::Acquire 0x00660320` is the seed writer the prior builder-only
  audit missed. It draws before it increments/clamps the row. An Insight card
  calls the helper twice, so the next private offer uses the second draw and the
  shared gameplay stream has advanced twice before any queued offer's Welding
  and final-shuffle work.
- Repeated Fire/Body cards on current main are therefore explained by a stale
  actor-private seed, not stock preference for Enchant Staff or Fireball. Native
  may repeat a legal card by chance/weight, but every actual acquisition changes
  the seed. More Missiles remains a separate dependency question and cannot
  enter a Fire-only book merely because reseeding was corrected.
- Coffin state 3 does not wait 50 ticks and does not stop birthing at the active
  cap. It builds `ratio=charge/(baseSpeed*timeScale)`. Below one it emits three
  children with no probability draw; otherwise it draws `Float(ratio)` and emits
  one exactly when the result is below one. Charge advances by float32 `0.025`
  to ten. The configured maximum gates only the active grounded lane.
- A landing Maggot increments the Coffin's inactive count. With active capacity
  and `Integer(5)==3`, it is promoted: inactive is decremented and active is
  incremented. Otherwise the first 30 inactive children remain parent-owned but
  noncombat; the 31st and later failed admissions retire. Maggots deliberately
  cancel the common Badguy population count and never hold a wave threshold.
- Maggot ballistic duration is height-dependent, not 24 ticks. Constructor
  phase starts at `Float(5)`, advances float32 `+0.25` with wrap at five, and
  renderer `0x0049C190` selects `orientation + 10*trunc(phase)`; orientation is
  `trunc((heading+18)/36) mod 10`.
- Coffin construction transforms both authored launch segments with retained
  horizontal scale `+/-1` and signed `Float(15)` rotation. The helper
  interpolates that result, mirrors its absolute heading only for negative
  scale, uses independent `Float(8)` draws for vertical offset and world Y,
  and retains constructor bounce velocity `-Float(0.5)`; the landing tick
  halves horizontal/bounce velocity before admission.
- Coffin death immediately hands the body to independent break effects. Any
  visible Bouncer fragments may outlive the parent, but retaining the intact
  body or its wave-count contribution is wrong. Parent identity invalidation is
  the teardown signal for every child lane.
- Zombie's body type and flyblown state are orthogonal. Config BODY TYPE 1
  overrides both byte selectors to 3; FLYBLOWN controls poison auxiliaries only.
  The renderer rotates the three authored body points with the body before
  placing head/arms. Treating those raw points as root-space offsets visibly
  disconnects parts during idle sway and the beat lean.

## Nearby-system findings

- The current compact protocol carries the invented Zombie `flyblownSide` as
  authority. Removing the refuted field changes the enemy sample schema and
  therefore requires a clean protocol version bump; no compatibility shim is
  permitted.
- Runtime atlas selection stopped at body `2256` and head `2346` even though
  the manifests and RE catalog contained selector-3 records. The complete
  preload owner must include body/overlay `2203..2292` and head `2293..2364`;
  a raw-manifest unit resolver alone cannot prove browser residency.
- The current wave director passes `actors + maggots` to both live-count and
  spawn-capacity logic. Native's Maggot constructor explicitly cancels its
  inherited Badguy count. Both consumers must use the same corrected actor-only
  population owner.
- The complete `0x00660320` xref set also makes direct/scripted grants part of
  offer-RNG ownership. Fixing only LevelupScreen would leave developer, item,
  tutorial, and Boneyard-script acquisitions with the same stale-seed defect.
- Durable native reports/catalogs updated in this pass:
  `native-progression-and-skills.md`, `native-enemies.md`,
  `native-animation-state.md`, `native-web-combat-lifecycle.md`, and
  `native-enemy-catalog.json`.

## Confidence and open questions

- Confirmed: all seed writers and `0x00660320` callers; ordinary/Insight draw
  count and order; Coffin state/emission constants; Maggot active/inactive/count
  policy and parent teardown; Zombie config bytes, all indirect record banks,
  constructor/draw order, and body-point transform ownership.
- Inferred only for deterministic multiplayer: cosmetic samples use the host's
  existing authoritative gameplay RNG stream rather than reproducing a
  process-global retail cursor from an unrelated startup history. Membership,
  branch order, and word consumption are exact.
- Unknown: none material to these three systems. No browser approximation is
  required.

## Web implementation consequence and validation contract

- Make one shared skill-acquisition seam consume and store a new offer seed per
  applied native rank. Use it for initial loadout, picker/Insight, item/random,
  direct/scripted, and Weld paths before rebuilding any pending offer.
- Replace Coffin's 50-tick/cap-at-birth approximation with native charge
  emission and active/inactive Maggot admission. Exclude every Maggot lane from
  wave live count and director capacity; retain explicit parent teardown.
- Delete Zombie `flyblownSide` end to end, add body/head type 3 plus its overlay,
  transform all three attachment points by body rotation, and bump the protocol.
- Focused tests must cover every inventory row above, including per-acquisition
  RNG state, a Fire/Body multi-level sequence, all Coffin charge/admission/count
  branches, parent death, every Zombie bank/facing/type/attack side, and strict
  protocol rejection of the old sample shape.
- Mac browser acceptance must show a varied legal Fire/Body choice sequence,
  Coffin body removal with actor-only wave count and child teardown, normal and
  rotten Zombies through idle/beat/body type 0..3, empty page/console/network
  errors, and the full canonical `./scripts/validate.sh` receipt.

## Implementation validation receipt

- Exact pre-receipt Website candidate
  `9b737df1e27fcde9c149af9fef35b89bcc458225` and byte-identical detached Mac
  tree passed `/opt/homebrew/bin/bash ./scripts/validate.sh`. The gate log
  SHA-256 is `de4b17d39fba33d6b61b2ed7797b08ea6e88b914f32178b6490320a41c121ecd`.
  Production entry `Game-BHs0dGg8.js` is 476,976 raw / 133,364 gzip bytes
  against 524,288 / 134,144 limits; production media/CSP policy passed.
- Exact rebased Mod Loader candidate
  `a7f439a12e6871ba268f3b4c032e485457ff16e6` passed all 512/512 portable
  static RE contracts on Homebrew Python. Log SHA-256 is
  `f401a5c3f2c6fe9fea047f6e4a35771ff18c0cca77b4246638b16dc8867e2dcf`.
- Mac Chrome 151 used Pixi WebGL2 to render the complete enemy/VFX frame. Its
  browser receipt observed 22/22 unique Fire/Body offer seeds and legal card
  signatures through levels 2..23, no More Missiles without Magic Missile,
  Coffin body/children fully absent after retirement with actor live count
  zero, and selector-3 Zombie body/overlay/head plus retained Coffin transform.
  Page, console, and failed-response arrays were empty. Receipt SHA-256 is
  `c4be6a343b2d8d7a688493cefaba64b23a7bdb13f0be7a7206dd402d77de4986`;
  retained evidence is under Mac
  `/Users/jarrett/codex-acceptance/coffin-zombie-offers-20260827/browser-release-3/`.
- Visual inspection accepted the articulated Zombie and rotated Coffin frame;
  screenshot SHA-256 is
  `819fa0cbe482a513e7c1d03126c5775d0bc8351a6e5cc219fca908aeaa72cf98`.
  The task left no listener on port 5418. This receipt is the sole
  post-validation documentation write; no runtime, test, build, or browser
  source byte changed afterward. No production deployment was performed.

## 2026-08-30 — Coffin spatial and hostile-membership lifecycle correction

### Reported smell and parity question

- Player report: visible Coffins survive repeated Frost Jet, Fireball, Steam,
  Lightning, and Ether contact, may persist across waves, and accumulate enough
  actors/effects to cause severe frame-time spikes. The supplied 15.246-second
  1854-by-1072 capture, `SDB - Coffins unable to be destroyed.mp4` (SHA-256
  `afea07719e40df29bd85d2f04b2ed8c1ffd9241a75f44c92b865474465dab0b7`),
  retains the same visible Coffin bodies through overlapping Fire/Steam/Frost
  effects; the on-screen frame-time counter reaches 138 ms.
- This is a secondary report against entries 168, 220, 254, and 268. Those
  passes inspected Coffin constructor `0x00479940`, observed `+0x14 = 0`, and
  encoded that constructor value as a lifetime invariant. They did not follow
  state-zero's call to helper `0x0049A670`, so the causal trace stopped before
  the native grid-attachment and hostile-flag writes. That violated the state-
  writer, lifecycle, and shared-consumer membership rules.
- Stock behavior to recover: a Coffin is spatially detached and untargetable
  while hidden, then becomes an ordinary mask-`0x2` hostile on the exact
  hidden-to-rising edge and stays targetable through rising, holding, opening,
  and open states until shared death teardown.
- Falsifiers: `0x0049A670` does not write `+0x14`; it writes a flag other than
  `0x2`; the helper is not the hidden-to-rising owner; a later living Coffin
  branch clears the bit; or any web combat consumer intentionally bypasses the
  native actor flag instead of inheriting it.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Player capture | supplied MP4 and frames at 0.5, 3.5, 6.5, 9.5, 12.5, and 14.5 seconds | Multiple visible Coffins remain intact while primary contact presentation overlaps their roots; the report spans five pure/welded spell families. | high for web symptom |
| Retail identity | unmodified Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, re-hashed 2026-08-30 | Exact executable behind every address below. | high |
| Constructor instructions | read-only canonical Ghidra replica; Coffin constructor `0x00479940` | Calls Badguy construction, writes type `0x3F5`, clears actor flags `+0x14`, clears active byte `+0x36`, and seeds hidden state zero. Constructor zero is confirmed but is not lifetime state. | high |
| Activation instructions | `Coffin` helper `0x0049A670`; raw `0x0049A6D3..0x0049A81D`; caller `Coffin_Tick 0x004A2760` | The hidden deadline calls the helper. It writes state one at `+0x210`, sets `+0x36 = 1` at `0x0049A807`, calls `SceneGrid_AttachActorIfActive 0x005212F0`, then writes `+0x14 = 0x2` at `0x0049A816`. | high |
| Query/teardown instructions | grid query `0x005235F0`; point/cone/polygon/priority family `0x00641220/0x00641500/0x00641B10/0x006427E0`; shared flag clear/detach `0x0063E7C0/0x005223D0` | Every mask-2 consumer inherits the transition; special projectile/scenery bits remain independent. Death removes the living membership. | high |
| Tool provenance | read-only Mod Loader revision `08bfba9ef367f7b863848030d0a289dc31e33192`; wrapper SHA-256 `b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`; `decompile_targets.py` SHA-256 `899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465` | Canonical source project and four-slot replica wrapper were used without modifying Mod Loader or the analyzed project. | high |
| Current Website trace | `origin/main a554ea73`; `boneyard-spell-combat.ts`, `boneyard-world.ts`, `player-staff-combat-system.ts`, `native-secondary-world.ts` | Four separate projections hard-code every Coffin as flags-zero/nonhostile for life. Physical bodies also include hidden Coffins, reversing both sides of the native transition. | high |

All addresses are preferred-image addresses. No loader-injected runtime sample
is required for the material conclusion; the state and flag writes are direct
instructions, and no stock or Mod Loader file was changed.

### System boundary and membership inventory

Native system: **Coffin spatial and hostile actor membership**, from hidden
construction through grid attachment, every mask-2 consumer, death detachment,
world replacement, and authoritative multiplayer projection.

| Member / branch | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| hidden constructor and 180/360 plus 0..49 tick wait | `0x00479940`, `+0x14=0`, `+0x36=0`, state zero | `exact-ported` | no grid body, primary/secondary/Staff target, collision, or hidden damage |
| hidden-to-rising edge | `0x0049A670`, raw `0x0049A6D3..0x0049A81D` | `exact-ported` | same authoritative tick changes phase, attaches once, and exposes bit `0x2` |
| rising / holding / opening / open | no later living clear; `0x004A2760` | `exact-ported` | continuous spatial and hostile membership through every visible state |
| dying / terminal / world replacement | `0x0063E7C0`, `0x005223D0`, common ActorWorld teardown | `verified-already-at-parity` through shared derived flag | no new contact after lethal edge; body, children, and queries retire under existing owners |
| Skeleton / Archer / Mage / Imp / Zombie / Wraith / Demon | common living Badguy bit `0x2` | `verified-already-at-parity` | unchanged per-family positive matrix |
| active Coffin-owned Maggot | existing active bit-2 lane | `verified-already-at-parity` | active grounded child remains targetable; emerging/inactive child remains noncombat |
| Fireball direct/explosion/burn | point/area mask `0x2/0x6` | `exact-ported` through shared flag | risen Coffin takes direct and owned follow-up damage; hidden Coffin is skipped |
| Ether Magic Missile and builds `1000..1002` | point mask `0x2/0x6` | `exact-ported` through shared flag | pure and inherited weld projectiles contact the risen root |
| Earth Boulder and retained Boulder weld `1006` | root gather mask `0x6` | `exact-ported` through shared flag | damage-pool traversal includes risen Coffin exactly once |
| Lightning and Flame Lash `1003` direct/chain | priority and chain mask `0x2` | `exact-ported` through shared flag | acquisition, retention, direct hit, and chain membership |
| Frost Jet and Steam Jet `1005` | cone/root mask `0x1082` / `0x2` | `exact-ported` through shared flag | cold/steam damage, modifiers, and push use the risen root |
| Blizzard `1004` direct/chain/push | polygon mask `0x1086`, hostile branch `0x2` | `exact-ported` through shared flag | direct, chain, cold/stun/damage, and push latch include risen Coffin |
| Staff movement admission and marker-time shapes | `0x0054AFF1..0x0054B336`, `0x0053B9F0` | `exact-ported` through shared flag without changing geometry | hidden Coffin produces no contact; risen Coffin admits radius contact, while normal/Critical/Whirl root shapes keep their independent exact outcomes |
| player secondary/response target projection | existing mask-2 area/retained-target family | `exact-ported` through shared flag | risen Coffin enters Flash, secondary actors, Mindblast, and retained modifier targets |
| player/enemy dynamic collision, spawn clearance, and teleport body census | grid attachment `0x005212F0` | `exact-ported` through shared spatial predicate | hidden Coffin occupies no body slot; risen Coffin does |
| generated Boneyard, custom/mod Boneyard, save/rejoin, late join | same host-owned actor phase | `exact-ported` | targetability derives from restored authoritative phase with no client guess |
| protocol/render/audio | existing Coffin phase, HP, events, and removal projection | `verified-already-at-parity` | no new wire field or presentation-only authority |
| direct Web Lua/mod damage by explicit actor id | Website extension, no stock spatial query | `out-of-system` — retain explicit API semantics | collision membership does not silently redefine direct mod commands |
| ML policy observation | Website training-only full-state contract | `out-of-system` — no policy/training change in parity task | combat outcomes still use corrected host targetability |

There are no `blocked-by-platform` members. The browser can represent this as
derived authoritative state; no approximation or compatibility layer is needed.

### Native ownership thread and recovered behavioral contract

- Coffin construction owns the hidden deadline but deliberately withholds both
  active/grid byte `+0x36` and actor-query bit `+0x14`. Hidden presentation,
  collision, and target queries therefore agree on absence.
- `Coffin_Tick 0x004A2760` owns the exact deadline. Its sole transition helper
  changes state, attaches the existing actor to the Region grid, and publishes
  hostile bit `0x2` in one fixed-tick transition. The bit is not a render flag
  and is not inferred from Coffin sprite visibility.
- Point, cone, polygon, chain, Staff, and secondary consumers read the shared
  actor membership. A per-spell Coffin exception would reproduce the original
  process failure; one host-side derived flag must feed every consumer.
- Shared death first makes the actor ineligible, clears/detaches membership,
  then existing independent break effects and parent-loss Maggot teardown may
  finish. Wave live count continues to count the Coffin actor while hidden and
  living; spatial membership does not redefine wave accounting.
- Multiplayer clients already receive Coffin phase, health, semantic effects,
  and terminal removal. The host derives collision/targetability from the same
  phase and remains the only damage authority; no protocol bump is required.

### Nearby-system findings

- The `0x1000` written at Coffin `+0x3C` is not the hostile actor bit. Frost and
  Blizzard's special `0x1000` virtual branch remains a separate target class;
  risen Coffin enters their ordinary bit-`0x2` damage branch.
- Risen Coffin's 45-unit body creates legal Staff contact at player radius 25
  plus the native `0.1` separation. Its root is consequently outside the
  normal Staff polygon's strict 70-unit endpoint but remains inside physical
  contact; Critical and Whirl keep their larger shapes. Actor membership does
  not authorize widening Staff damage geometry.
- Hidden Coffins currently participate in the web's all-body solver even while
  every damage projection excludes them. The native transition proves both
  halves wrong: hidden means neither; risen means both.
- The existing phase replication is sufficient for save/rejoin and browser
  presentation, but collision authority must consume the host brain rather than
  the presentation snapshot's visible layers.

### Confidence and open questions

- Confirmed: constructor zero, state-zero caller, exact activation instructions
  and order, bit value, grid attach, every maintained Coffin exclusion, shared
  query consumers, death detachment, and protocol ownership.
- Inferred: none material. Web phase names split native visible state more
  finely, but every non-hidden living phase follows the single instruction-
  proven bit-2 interval.
- Unknown: none. No browser limitation applies.

### Web implementation consequence and validation contract

- Add one cohesive enemy-store owner that returns native actor flags from life
  state and Coffin phase. Use it for primary targets, Staff admission/damage,
  secondary targets, movement contact classification, physical body census,
  spawn/transition clearance, and teleport collision.
- Remove every lifetime `enemyToken === 'COFFIN'` target exception. Keep hidden
  exclusion as derived state, not a spell-specific branch.
- Red/green contracts: actual hidden-to-rising stepping proves `0 -> 0x2` on
  the transition tick; all seven ordinary families stay `0x2`; dying and hidden
  Coffins are zero; Fire, Ether, Earth, Lightning, Frost, Steam, Blizzard,
  Staff admission/physical contact, secondary, and physical-body consumers
  each prove hidden-negative and risen-positive membership; Staff root-damage
  assertions retain the independent normal/Critical/Whirl geometry.
- Mac browser acceptance: spawn or reach a real Coffin, record hidden absence,
  then hit the risen actor with representative projectile, sustained, Staff,
  and secondary paths; HP must fall, lethal damage must remove the Coffin and
  its child ownership, later waves must not retain the body, and page, console,
  failed-response, host-error, and protocol-close arrays must be empty.
- The exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`
  on the Mac mini. Push, deployment, and production remain separate and require
  explicit authorization.

### Implementation validation receipt

- Causal result: retail Coffin construction clears `+0x14`, but that value is
  only the hidden interval. Raw helper instructions at `0x0049A807..0x0049A81D`
  activate the actor, attach it through `0x005212F0`, and write hostile bit
  `0x2` on the hidden-to-rising edge. The web had copied constructor zero into
  four lifetime Coffin exclusions while simultaneously leaving hidden Coffins
  in physical-body lists.
- Implementation: `boneyard-enemy-store.ts` now owns one derived
  `boneyardEnemyActorFlags` result. Hidden, death, and nonliving Coffins return
  zero; every other living survival actor and every visible living Coffin phase
  returns `0x2`. Primary spells, Staff, secondary effects, physical collision,
  arena-transition clearance, teleport collision, and maintained browser-smoke
  target selection consume that owner. No protocol field, compatibility path,
  spell-specific Coffin exception, damage geometry, or presentation clock was
  added.
- Red proof: the byte-identical Mac test-only tree aggregate
  `ebb50eb7aed2621e44ea48c910be908463a88704a6392aa63556fd0bc3cdab0e`
  passed backend/contracts/lint and failed the new Staff Coffin assertion with
  actual target ids `[]` versus `['enemy:1']`; log SHA-256
  `ccdf96e8bdf5387fd6eebce6bea80b79d93706ece5189f7e54be06a944318464`.
  The later root-geometry audit retained native Staff behavior: legal 70.1-unit
  Coffin separation is radius-contact positive but normal-polygon negative;
  Critical/Whirl keep their larger independent shapes.
- Mac exact-tree gate: all 21 tracked changed files were byte-identical between
  local and detached Mac base `a554ea7368a1c93c07661f9ad01e7a93b528f888`.
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passed backend build, 28 Website
  contracts/integration tests, lint, pre-Boneyard `330/330`, Boneyard
  `1782/1782`, every later frontend/desktop group, production frontend and host
  builds, bundle budget, and media/CSP policy. `Game-Bu0TvhZ-.js` measured
  266,211 raw / 80,891 gzip bytes against 524,288 / 134,144 limits. Gate log
  SHA-256: `dc0b82f64869b2d1c33d4f3df2f634779209ffb2eb3e5d6b13db694216ff7435`.
- Built-browser acceptance: Mac Chrome `151.0.7922.174`, 1600-by-900 WebGL2,
  aimed held Blizzard build `1004` from `(620,480)` at the controlled risen
  Coffin root `(620,360)`. The rendered sample fell from 20 HP to
  `19.276742187535856` with hit flash one; authority observed
  `18.34449987411496` at tick 1,050. Two channel actors and three Blizzard
  contact glows rendered, the target remained the sole `COFFIN` enemy, and the
  browser error array was empty. Receipt/screenshot SHA-256:
  `f1334f49d7318599a219a87884cd9ac90ea006c258bb5648864644c559fbf40c` /
  `2e5147346ce83279f793e0157e201fa12c5ac7b7ee7e237e41f577ad6b777018`.
  A preceding low-HP diagnostic also reached complete Coffin removal and 78
  native death/break actors; it was not the acceptance run because its
  one-frame contact glow retired between 20 Hz browser samples.
- Unknowns / platform differences: none. Push and deployment were not requested
  or performed. This receipt is the only tracked post-gate write; the exact
  final documented tree must pass the canonical gate before completion.

## 2026-09-01 — Six-Coffin native population and retained Maggot-view reopening

### Reported smell and parity question

- Player report: a very large lag spike coincided with five or more Coffins
  appearing and behaving strangely. The supplied stock-export archive was
  downloaded at the point the player left the run, but exact template-patch
  equality proves it carries progression only and cannot replay live Coffins.
- The closest retained server-side checkpoint for the same three-player
  lineage contains six living open Coffins, 269 living Coffin-owned Maggots,
  30 ordinary enemy actors, 118 death effects, and nine loot actors at tick
  110,360. Each Coffin owns 30..53 children.
- Native behavior to preserve: Coffin state-3 charge emission, up to 30
  inactive plus the configured active grounded population per owner, all
  ballistic/crawl/bite/death frames, lighting, painter registration, fixed-
  tick movement, replication, save/rejoin, and parent teardown.
- Parity question: retain the complete native population and every live sample
  while preventing fully off-camera Maggots from constructing/updating Pixi
  sprites, entering frame-local light queries, or entering frame-local painter
  traversal until their complete transformed art can touch the guarded view.
- Falsifiers: the private authoritative host itself missed its 100-Hz budget;
  the 269 count exceeds native admission; off-camera Maggots own audible,
  collision, light-provider, or proxy output that requires a Pixi submission;
  transformed emergence/death art can enter before its root; or re-entry uses
  a stale sample/depth/tint.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retained production continuation | schema-22 post-incident backup, tick 110,360, document SHA-256 `50dc785dfb889c15ee610803690dcf07a2a5552f553354090db9d6ae6793f18a` | Six open Coffins own 52, 51, 32, 51, 30, and 53 Maggots. Population is 269 Maggots: 260 crawling, nine emerging, 80 combat-active, 189 inactive. | high-live for retained lineage |
| Native system evidence | this entry's `0x004A2760/0x00479C30/0x0048B2A0/0x004889B0/0x00487FD0` trace | Open Coffins intentionally continue emission; each owner may retain 30 inactive children plus its configured active capacity. A count cap or early retirement would violate stock. | high instruction-derived |
| Exact browser diagnostics | protocol-115 submission captured `2026-09-01T01:29:09.061Z`; production journal | The client recorded `pingMs=1212`, later `pingMs=2845`, and the host recorded a missing replication baseline. The private session recorded no `simulation.tick_lag`; two nearby 45/49-ms lag warnings belonged to the empty shared Hub and are not this run. | high-live causal separation |
| Current Mac exact-state host replay | detached `origin/main` `46ec87a7`, M2 Mac mini, Node 22.17.0; sanitized capability-free continuation | Restore 28.08 ms; 1,000 live ticks mean 1.097 ms, p95 1.568, p99 2.945, one 36.543-ms maximum; population grew from 269 to 298 Maggots. The 100-Hz authority is inside its 10-ms steady-state budget. | high diagnostic |
| Current projection replay | same exact state | Snapshot projection is 0.961 ms; keyframe decode 7.169 ms; keyframe wire JSON 96,467 bytes, same-state compact frame 70,909 bytes, and materialized snapshot JSON 277,800 bytes. Projection plus browser work is the pressure lane, not Coffin scheduling. | high diagnostic |
| Current renderer trace | `native-maggot-view.ts`, `boneyard-world-renderer.ts` at `46ec87a7` | Every replicated Maggot updates a retained view each rendered frame. All Maggots then receive a radial light query, a dynamic painter row, and a depth lookup even when their complete art is far outside the camera. Unlike death effects, Maggots have no guarded transformed-art visibility owner. | high static causal trace |
| Existing visibility contract | entry 039 plus entry 273 death-effect reopening; `boneyardVisibleWorldBounds`, `boneyardResidentIsVisible`, `boneyardTransformedArtBounds` | A resident can skip only frame-local drawing/traversal when its full transformed authored rectangle plus the 32-unit interpolation guard misses the view. Identity, state, registration, and teardown remain live. | high existing product contract |

The raw save and capability-bearing party state remain external evidence. The
Mac diagnostic used a task-owned copy with the party-rejoin capability removed;
that file is temporary and must not be retained after the result is recorded.

### System boundary and membership inventory

Native/web system: **retained browser presentation of Coffin-owned Maggots**,
from compact descriptor/sample reconstruction through interpolation, complete
art bounds, Pixi child ownership, Region lighting, painter submission, re-
entry, retirement, run replacement, and renderer teardown.

| Member / branch | Disposition | Required proof |
| --- | --- | --- |
| Coffin hidden/rising/holding/open body and charge emission | `verified-already-at-parity` | no schedule, emission, count, RNG, or body change |
| 30 inactive and configured active Maggots per owner | `verified-already-at-parity` | production-shaped six-owner population remains 269+ and no child is dropped |
| Emerging `edge` and `lid` trajectories | `exact-ported` guarded view over all BadGuys `2013..2062` rows | transformed offset/scale bounds cover all five phases and ten orientations before culling |
| Crawl 18 facings and bite 18 facings | `exact-ported` guarded view over BadGuys `202..237` | exact record/anchor/scale bounds and re-entry sample |
| Maggot death DeadHawg 28 | `exact-ported` guarded view | death alpha/scale/position remain current |
| Red hit redraw | `exact-ported` as same-geometry child union | visible actor owns both layers; offscreen actor owns no submitted sprite children until entry |
| Retained view map and semantic IDs | `exact-ported` | every live descriptor retains one view row; no offscreen retirement or ID coalescing |
| Complete protocol samples and presentation interpolation | `verified-already-at-parity`; retained | all 269 samples continue to decode/interpolate; no lower cadence or client simulation |
| World-light tint query | `exact-ported` visible-only evaluation | current sample receives tint before its first entering frame; invisible pixels require no query |
| World-sorted painter registration/depth | `exact-ported` visible-only traversal | native registration stays in state; visible rows alone enter the frame-local queue and receive current depth |
| Offscreen-to-visible transition | `exact-ported` | current plan, texture, transform, tint, and depth apply in the same frame `renderable` becomes true |
| Visible-to-offscreen transition | `exact-ported` | retained view becomes non-renderable without stale painter/light submission |
| Pause/SkillPicker/global actor-root hide | `verified-already-at-parity` | parent actor root remains the global visibility owner |
| Parent death, Maggot death, Game Over, save/rejoin, new run, renderer destroy | `exact-ported` lifecycle | all retained containers/sprites destroy once; no prior-run view survives |
| Enemy bodies, ordinary enemy auxiliaries, hostile projectiles, loot, and death effects | `out-of-system` for this Maggot-view change | their separate visibility/lifecycle owners remain unchanged |
| Host simulation, native population, collision, damage, audio, wave counts | `out-of-system` for representation optimization | exact production replay hashes/counts remain the authority |

No member is browser-blocked. There is no intended visible difference: a
Maggot whose complete authored art cannot touch the guarded camera contributes
no pixels; it is fully current on the first frame where it can.

### Native ownership thread and recovered behavioral contract

- Authority continues to create, move, admit, damage, and retire every Maggot
  at native fixed ticks. The protocol and interpolation timeline retain every
  semantic member; population reduction is forbidden.
- The browser retained-view map is distinct from the frame-local Pixi/painter
  submission. Each live ID keeps a lightweight container row. Sprite children
  and per-frame transforms are required only when complete transformed art
  overlaps `boneyardVisibleWorldBounds`, which already includes the 32-unit
  interpolation guard.
- Visibility uses authored record width, height, anchor, current vertical
  offset, current scale, and rotation for every reachable record. Root-only or
  radius-only culling is invalid for airborne emergence.
- An invisible Maggot skips its sprite mutation, light lookup, painter-row
  insertion, and depth lookup. Its current snapshot remains available. On
  entry the renderer applies the complete current plan before tint/depth and
  before Pixi submission; on retirement the retained container and any lazily
  created sprites are destroyed exactly once.

### Confidence and open questions

- Confirmed: native 50-per-owner membership shape; retained six-Coffin/269-
  Maggot state; private-host versus client/projection causal separation;
  current snapshot sizes/timings; missing Maggot visibility owner; every
  reachable Maggot atlas family and lifecycle branch.
- Inferred: the retained three-player checkpoint is the same reported lineage,
  not the exact export millisecond. The matching wizard/class, six-Coffin
  population, and diagnostic chronology support that inference. The visibility
  implementation depends only on the exact native population contract.
- Unknown before browser validation: the exact share of the 2.845-second
  latency sample attributable to browser work versus network transport. The
  candidate must therefore report frame/task improvement without claiming
  that every latency source is local rendering.

### Web implementation and validation contract

- Add one pure complete-art bounds function for every Maggot state/record.
  Deepen `NativeMaggotViews` with retained visible membership and lazy sprite
  mutation. Reuse the existing guarded world bounds; do not add a count,
  quality, device, or distance threshold.
- Make lighting, painter-row construction, and depth assignment consume the
  same visible-ID predicate. Add visible/culled diagnostics while retaining
  total `maggotCount`.
- Red/green coverage must enumerate all 50 emergence rows, 36 crawl/bite rows,
  death, hit redraw, exact camera-edge contact, offscreen retention, re-entry,
  retirement, and destroy.
- Re-run the sanitized six-Coffin state on the Mac. Host state/counts and
  snapshot bytes must remain unchanged. A production Chrome A/B/A profile at
  matching camera/population and CPU throttle must show identical visible
  Maggot plans/painter order with materially lower browser task/frame tails.
- Built Chrome must resume the production-shaped state, report total and
  visible/culled Maggots, pan or move across an entering child, and retain
  empty page/console/response/wire/host-error arrays. The exact candidate must
  pass `/opt/homebrew/bin/bash ./scripts/validate.sh`.

### Implementation validation receipt

- Implementation preserves the complete authoritative and replicated Maggot
  population. `nativeMaggotVisualBounds` derives the current authored record,
  anchor, vertical offset, and scale for crawl, bite, death, and every
  emergence phase/orientation. `NativeMaggotViews` retains one row per live ID
  but creates/mutates sprite children only for guarded visible art. One retained
  visible-snapshot list drives tint, painter insertion, and depth, removing
  three repeated all-population traversals. Static sprite metadata is cached;
  retirement and renderer destruction remain exact.
- Automated coverage enumerates all 50 BadGuys `2013..2062` emergence rows,
  all 36 BadGuys `202..237` crawl/bite rows, DeadHawg 28 death, hit redraw,
  exact camera-edge inclusion, and fully outside rejection. The combined
  focused enemy-store/Maggot suite passes `96/96`; test TypeScript passes.
- Deterministic Mac Chrome camera acceptance retained two Maggot IDs while
  moving from camera `(592.593,500)` to `(2407.407,1500)`. Both frames reported
  total two, visible one, culled one; the initially visible west actor cannot
  intersect the later guarded view, so the later visible row proves the east
  actor materialized its current state on entry. Page, console, and failed-
  response arrays were empty.
- The capability-free production-shaped save resumed in built Mac Chrome with
  the six native Coffins and a growing 300-plus child population. At the first
  observed camera it retained 300 total / 209 visible / 91 culled. A later
  active frame retained 312 total / 15 visible / 297 culled with all 30
  ordinary enemies inside combat bounds and empty page, console, response,
  wire, and host-error arrays. Visual inspection found the active Arena frame
  coherent; SHA-256 is
  `abfee4a6f0a2c046c871cbce9ccf93ab3b57f9ebad6a46f076ffde24aecb2447`.
- Production-build 4x-CPU A/B/A/A used the same sanitized continuation and
  viewport. Baseline samples delivered 576 and 588 frames over ten seconds;
  candidate samples delivered 588 and 589. Steady p95 remained `16.8 ms` in
  all samples; one baseline sample had `33.4 ms` p99 while the other baseline
  and both candidates had `16.8 ms`. Candidate sampled CPU time averaged
  10,816.9 ms versus baseline 10,946.5 ms, a bounded 1.18% reduction. This is
  recorded as removal of proven redundant work, not as proof that a remote
  2.845-second latency incident was entirely renderer-caused.
- The unchanged compact wire remains 70,909 raw / 16,062 deflate-level-3
  bytes for the retained checkpoint; 269 Maggot rows account for 17,117 raw
  bytes. No protocol weakening, view-distance replication, count cap, or
  client-side simulation was introduced.
- The first exact-tree Mac canonical gate exited zero: 19 backend/integration
  contracts, all `1,753/1,753` broad Boneyard/runtime tests, every later
  frontend/desktop suite, production frontend and GameHost builds, bundle
  budget, media policy, and CSP. `Game-BBQPglmZ.js` measured 263,678 raw /
  80,232 gzip bytes. Pre-receipt combined log SHA-256 is
  `f0b8992806fbbbb21ebc97274fb320596a753219724ec16fd9ac54a8c2b08f16`.
- No visible Maggot behavior or browser-platform exception remains. The exact
  network-versus-client share of the historical high-latency samples is not
  recoverable from the bounded submitted log; current code closes the proven
  renderer/painter waste without inventing a network fix. At this validation
  receipt cutoff, publication and deployment remained separate and had not
  occurred.
