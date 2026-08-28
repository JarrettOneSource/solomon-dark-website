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
