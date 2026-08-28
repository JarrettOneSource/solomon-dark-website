# 2026-08-23 — First-player tutorial offer and complete stock Tutorial session

## Reported smell and parity question

- Reported web behavior: `/game` always opens the ordinary title flow. It has
  no save-absence offer, no first-play control picker, no Tutorial level, no
  compiled 0-through-19 lesson owner, and no Tutorial-specific scenario or
  dialogue lifecycle.
- Requested behavior: when the selected browser slot is confirmed absent,
  offer the tutorial. An authenticated player checks the account cloud row; an
  anonymous player checks the device-local row. `YES` enters the complete
  stock tutorial and `NO` leaves the ordinary title available.
- Stock behavior to recover: a missing native profile sets profile `+0x104`,
  automatically enters the two-visible-choice control picker, shows the
  `...MIDNIGHT / SIX MONTHS AGO...` prelude, loads exact
  `data/levels/tutorial.boneyard`, and composes its authored scripts with the
  Tutorial controller and Tutorial-specific Solomon branch. Retail has no
  tutorial yes/no dialog; the offer is a named browser-only gate in front of
  that sequence.
- Falsifiers: the model is wrong if a present/corrupt/unavailable row is
  treated as absent; if a visible retail picker member, authored row, stage,
  cue, HUD gate, placement mode, or teardown branch is omitted; if the normal
  Boneyard survival director runs in the Tutorial level; or if a partial
  tutorial cannot resume from the same cloud/local record.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable | `SolomonDark.exe` 0.72.5, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Exact first-play, controller, scenario, and persistence owner. | high |
| Existing complete static packet | `Mod Loader/docs/re/tutorial-mechanics.md`; `/mnt/d/codex-evidence/tutre-20260801`; 35 indexed raw artifacts | Complete controller stages, authored level/trigger/script graph, UI gates, pointer path, drops, and teardown. | high |
| Exact level data | `tutorial.boneyard`, 33,220 bytes, SHA-256 `97802f2ca45d9bc6f90a497e7c12a55926298161e191fa70eee5e666b90106ed` | Bounds/spawn, 92 objects, 53 roads, 28 fences, 90 DeadHawg placements, four terrain records, seven recipes, six groups, 13 triggers, 12 scripts, one item recipe, no TimeLine. | high |
| Fresh clean stock | direct task-owned retail copy, empty copied `sandbox`, no loader/mod; `1600 x 900`; Loader durable captures `control-picker.png`, `midnight-prelude.png`, `stage-0.png` | Retail has no tutorial-choice dialog; picker -> baked prelude -> rain/spotlight stage 0, with normal HUD absent. | high |
| Fresh canonical Ghidra replica | `search_terms_refs.py` for `TUTORIAL`, picker heading, and tutorial-offer strings; `decompile_targets.py` for `0x00465E40`, `0x00466200`, `0x00681BA0`, `0x0068BBC0`, `0x00681930`, `0x006819C0`, `0x0047D0F0`, `0x0047D570` | No tutorial yes/no string family; forced modes 1/2 are light/off-screen placement; interval clocks/predicates are exact; Tutorial Solomon adds eight cues. | high |
| Stock assets | `Controls.bundle/png` hashes `42f875...` / `28a64a...`; `UI.bundle/png` hashes `1db00e...` / `37d5e8...`; `music.mo3` hash `32bf92...`; retail `voices/*.wav` | Exact visible picker sprites 0/2, hidden sprite 1, UI prelude record 43, arrow record 28, prelude/combat score, and 24 narration WAVs are extractable. | high |
| Current browser persistence | schema-6 profile/current-wizard continuation entry above; `Game.tsx`, `GameSaveCoordinator`, cloud and IndexedDB stores | One selected record already has the required authenticated/anonymous distinction; absence must be kept distinct from invalid/unavailable. Fresh construction also carries the proven `tutorialPending` profile fact. | high |
| Current web gameplay | Boneyard world/renderer, exact enemy families, loot actors, inventory, skill book/picker, secondary abilities, save projection, protocol 69 | The shared mechanics, observer wire, and fresh-profile pending fact exist, but the authored Tutorial composition and resumable tutorial state do not. | high |

## System boundary and membership inventory

Native system: first-play Tutorial orchestration from selected-save detection
through the browser-only offer, native control/prelude sequence, exact level and
controller composition, authoritative solo simulation, save/resume, Game Over,
and teardown. The dispositions below are the required result; this entry
remains open until the implementation receipt proves each `exact-ported` row.

### Entry, picker, and presentation membership

| Member | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| authenticated cloud row confirmed absent | account slot 0 / `GameSaveCoordinator.load` | exact-ported | offer once the read returns `null` |
| anonymous local row confirmed absent | IndexedDB slot 0 | exact-ported | same offer from device-local `null` |
| present profile-only row | schema-6 durable profile, continuation null | verified-already-at-parity; offer suppression exact-ported | no tutorial offer; New Game retains profile |
| present resumable row | schema-6 continuation | verified-already-at-parity; offer suppression exact-ported | no offer; Last Game remains available |
| invalid but physically present row | strict parse failure | exact-ported | warn/fail closed; never reinterpret as new player |
| selected-store read unavailable | HTTP/IndexedDB failure | exact-ported | warn/fail closed; never reinterpret as absent |
| requested `YES/NO` offer | no retail counterpart; fresh Ghidra string sweep | out-of-system (requested browser product gate, explicitly before native flow) | accessible/gamepad-capable dialog; `NO` returns title, `YES` alone advances |
| picker heading | `0x005B9A30`, `SELECT A CONTROL SCHEME`; Fonts group 4 at `+0x1351CC` | exact-ported | heading wrapper `40/10/28`, common gold `0xD9BA70`, center X 800, baseline Y 50 at logical 1600x900 |
| visible arrow-key panel | `Controls.0`, rect `(477.5,290)-(722.5,610)`, callback mode 1 | exact-ported | exact pixels; Arrow movement; Escape/I/T; right mouse; Delete, End, Backspace, Page Up, Page Down, Insert, Home belt bindings |
| visible WASD panel | `Controls.2`, rect `(850.5,324)-(1149.5,576)`, callback mode 2 | exact-ported | exact pixels; WASD movement; Escape/I/T; right mouse; numeric 1-through-7 belt bindings |
| dormant mouse-only panel | constructed `Controls.1`, parked off-screen in this retail build, callback mode 4 | out-of-system (native-inaccessible branch; preserve hidden state) | it is not made visible in the browser |
| picker fade/selection handoff | `0x005A8790 -> 0x005B9990 -> 0x005B6B00` | exact-ported | one committed choice; selected flash `-0.1/tick`; visible alpha `-0.02/tick`; bootstrap scalar `+0.01/tick` reaches one at 100 ticks |
| prelude music | `0x005B6C90`, music key `prelude`, module subsong 0 | exact-ported | exact extracted track starts for first-play flow |
| midnight prelude card | `0x005D08C0`, UI record 43, frame `(266,62,340,66)`, logical `443x171`, trim `(50,50)` | exact-ported | centered `(800,450)`, common-gold `0xD9BA70`, exact alpha/lifecycle |
| midnight skull backdrop | `0x005D08C0`, UI record 68, frame/logical `(753,335,93,99)` / `93x99` | exact-ported | scale 4, alpha `blend^2`, center `(800, 350-100*blend)` |
| 475-tick intro / forced north movement | Tutorial blend/fade/active/delay/movement timer `+0x8C/+0x90/+0x94/+0x98/+0x9C`; PlayerActor accumulator `+0x158/+0x15C`; `PlayerActorTick 0x00548B00` | exact-ported | 25-tick hold; float32 `+0.0025` blend then `-0.02` fade; blend `>0.8` forces north; the 250-tick post-intro lane decays that motion through the stock speed envelope |
| normal title after `NO` | browser-only branch | exact-ported | no save is fabricated and normal title remains usable |
| repeat page load while still save-absent | requested eligibility rule | exact-ported | offer appears again; session-only dismissal is not a fake save |
| ordinary MapPicker | no Tutorial-controller caller; normal Game control only | out-of-system (ordinary in-run map system, not Tutorial orchestration) | no invented Tutorial picker stage |

### Exact authored level membership

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| full Tutorial static scene | exact `tutorial.boneyard` layout: bounds `2043x2053`, spawn `(1025,2070.0703125)`, environment 1 | exact-ported | generated scene hash and every object/road/fence/sprite/terrain count |
| Tree rows | 26 serialized objects | exact-ported | all 26 projected through existing authored Tree rendering/collision |
| Monument row | one serialized object | exact-ported | exact object row |
| Gravestone rows | 64 serialized objects | exact-ported | all 64 rows and variants |
| Building row | one serialized object | exact-ported | exact building surface/occlusion row |
| Road rows | 53 serialized roads | exact-ported | all points/styles/widths |
| Fence rows | 28 serialized fences | exact-ported | all points/styles/post variants and gate geometry |
| DeadHawg placements | 90 serialized sprites | exact-ported | all atlas rows/transforms |
| Terrain rows | four serialized terrain records | exact-ported | all four meshes/styles |
| Tutorial rain/dark environment | header environment mode 1 | verified-already-at-parity for shared weather/light mechanism; exact-ported for this scene | rain audio/particles and light composition active in Tutorial |
| Solomon placement and two fires | START GAME script 10000; command 1061 -> `Fire 0x7E3` | exact-ported | two distinct `(1,100,1000)` actors at `(1766.1005859375,147.63815307617188)` and `(1852.1005859375,199.63815307617188)`; exact 1,000-tick lifetime and shared DeadHawg 46..77 animation/audio ownership |
| lock-camera trigger region | trigger 642218 | exact-ported | one-shot entry, three-second camera lock, scoped off-camera cleanup |
| recipe 10004 `Starter SKELETON` | HP 2, damage 1, chase `1.100000023841858`, path mode 2, all drop policies 4 | exact-ported | actor config and no random reward |
| recipe 10051 `Item Skeleton` | HP 2; linked byte 2 -> 10049; same disabled random-drop family | exact-ported | actor config plus one-shot amulet link |
| recipe 10059 `SKELETAL ARCHER` | HP 3, damage 2, accuracy mode 1, path mode 2, drop policies 4 | exact-ported | actor/arrow config and no random reward |
| recipe 10065 `Potion SKELETON` | HP 4, damage 1, path mode 1; linked byte 1 -> 10072 | exact-ported | actor config plus health-potion link |
| recipe 10076 survival `SKELETON` | HP 3, damage 1, path mode 1; orb/item/gold policy 0, powerup/potion 4 | exact-ported | exact random-loot policy row |
| recipe 10077 survival `SKELETAL ARCHER` | HP 4, damage 3, path mode 1; potion policy 1, powerup 4 | exact-ported | exact actor and random-loot row |
| recipe 10085 `DEADLY SKELETAL ARCHER` | HP 4, damage 3, accuracy mode 1, path mode 1, potion policy 0 | exact-ported | exact late-survival actor row |
| group 10010 `FIVE SKELETAL WARRIORS` | five ordered 10004 members | exact-ported | exact multiplicity/order |
| group 10052 `FIVE ITEM SKELETONS` | five ordered 10051 members | exact-ported | exact multiplicity/order |
| group 10060 `Archer + Melee Group` | 10059,10059,10004,10004,10004 | exact-ported | exact membership/order |
| group 10061 `Three Archers` | three 10059 members | exact-ported | exact multiplicity/order |
| group 10078 `Survive Group` | 10076,10077,10076 | exact-ported | seeded random member selection |
| group 10086 `deadly survive group` | 10085,10076 | exact-ported | seeded random member selection |
| embedded item 3010 | `Sorceror's Amulet`, type 7003, exact description/white colors/opaque float-10 child | exact-ported | ground Sack and retained inventory identity/fields |
| health potion payload | subtype 0, type 7001 | exact-ported | ground Sack, pickup, belt count, consumption, healing |
| trigger 10001 START GAME | script 10000 | exact-ported | controller/scene setup occurs once |
| trigger 10003 START WAVE 1 | script 10002 | exact-ported | wave-1 group script |
| trigger 10047 START WAVE 2 | script 10048 | exact-ported | wave-2 timed group script |
| trigger 10049 manual item drop | script 10050, death-link byte-2 eligibility, delete self | exact-ported | only first eligible Item Skeleton death drops the amulet |
| trigger 10054 START WAVE 3 | script 10055 | exact-ported | wave-3 timed groups and offer rows |
| trigger 10057 START WAVE 4 | script 10058 | exact-ported | wave-4 mixed groups |
| trigger 10063 START WAVE 5 | script 10064 | exact-ported | one Potion Skeleton |
| trigger 10072 manual potion drop | script 10073, death-link byte 1 | exact-ported | potion at death context |
| trigger 10074 survival interval | 100 ticks, enemy count `<100`, script 10075 | exact-ported | independent round-robin clock |
| trigger 10079 START WAVE 6 | script 10080 | exact-ported | offer rows plus three trigger enables |
| trigger 10081 survival interval 2 | 100 ticks, enemy `>10 && <150`, level `<4`, script 10075 | exact-ported | independent shared-script clock |
| trigger 10083 survival interval 3 | 150 ticks, level `>3`, script 10084 | exact-ported | late/deadly branch |
| trigger 642218 player-steps-on | script 642219 | exact-ported | serialized region enter only |
| script 10000 START GAME | next-wave condition, `TUTORIAL`, Solomon, two fires | exact-ported | exact action order |
| script 10002 WAVE 1 | loop twice: group 10010; arm next condition | exact-ported | ten starters in native interpreter order |
| script 10048 WAVE 2 | three off-screen groups at two-second spacing; seven-second gap; one light group | exact-ported | exact 100-Hz countdowns/placement modes |
| script 10050 Drop Item | item 3010 at death context; delete 10049 | exact-ported | one-shot exact target identity |
| script 10055 WAVE 3 | three from 10010; off-screen; offers 65/67/60; four five-member groups at four-second spacing | exact-ported | exact schedule and forced offer order |
| script 10058 WAVE 4 | 10010 + 10060; five seconds; 10061 | exact-ported | exact mixed schedule |
| script 10064 WAVE 5 | light placement; recipe 10065 | exact-ported | exact single actor |
| script 10073 Drop Health Potion | subtype 0 at death context | exact-ported | exact loot actor |
| script 10075 Survival | light placement; one random 10078 member | exact-ported | exact seeded selection per trip |
| script 10080 WAVE 6 | offers 8/72/57; enable 10074/10081/10083 | exact-ported | exact order and interval activation tick |
| script 10084 Survival 3 | one random 10086 member | exact-ported | exact late seeded selection |
| script 642219 Lock Camera | lock serialized region; sleep 300 ticks; destroy off-camera | exact-ported | scoped lifecycle and teardown |

The script command membership is closed by the rows above: IDs 1002, 1004,
1005, 1006, 1007, 1008, 1010, 1013, 1020, 1032, 1033, 1048, 1051, 1058,
1059, 1061, 1065, and 1066. No Tutorial TimeLine, ItemSet, NPCRecipe, generic
objective actor, second pointer family, or hidden scenario table exists.

### Controller stage membership

| Stage | Exact native transition/output | Disposition | Proof contract |
| ---: | --- | --- | --- |
| intro | countdown 25, effect at 20, forced movement lane 250, overlay/panel fade | exact-ported | fixed-tick card/skull/fade, authoritative northward walk, and clean handoff |
| 0 | movement anchor; squared distance `>40000`; delayed `SAY_SOLOMONDARKSHOWYOURSELF`; movement heading/subheading | exact-ported | strict boundary and one-shot narration |
| 1 | blank; wait for Solomon combat release / Arena `+0x8F14` | exact-ported | no teaching copy; stage changes only at release |
| 2 | Magic Missile heading/subheading; queue Sirmin/Solomon pair once enemies exist; advance on cast count or enemies `>5` | exact-ported | both native completion branches |
| 3 | blank; enemy count zero; queue `SAY_EASILYVANQUISHED` | exact-ported | exact zero boundary |
| 4 | blank; wait for global narration idle; reveal spell/belt widgets and gates | exact-ported | cannot advance while any queued cue remains |
| 5 | Acid Rain heading, dynamic binding, HUD arrow; advance only after skill 72 becomes active; queue three cues; start wave 2 | exact-ported | cast activation, cue order, placement schedule |
| 6 | blank; wait for wave-2 enemy count zero | exact-ported | no early advance while script spawns remain pending |
| 7 | queue `SAY_CARELESSFOOL`; scan top-level inventory; enable inventory and skip to 9 if any non-potion already exists | exact-ported | both pre-picked and ground-item branches |
| 8 | first live ground-Sack world arrow; scan any top-level non-potion | exact-ported | live tracking, no timeout, exact first-type behavior |
| 9 | inventory heading, dynamic binding, control arrow; wait for inventory modal open and attach overlay | exact-ported | gated keyboard/touch pointer and stage 10 only on open |
| 10 | all inventory resume/quick-use/equipment/backpack callouts/arrows; wait for modal close; queue three cues; start wave 3 | exact-ported | every callout member and exact close edge |
| 11 | conditional staff-melee copy; after 100 ticks and no enemies, grant 10 XP/tick until level 2; wait for action idle and no pending picker | exact-ported | native XP floor and barrier lifecycle |
| 12 | skills heading, dynamic binding, control arrow; wait for skill modal open | exact-ported | access remains closed before stage 11 |
| 13 | all skills resume/quick-use/concentration/info callouts/arrows; close starts wave 4, reveals combat HUD, removes protection, enters 15 | exact-ported | exact modal close side effects/order |
| 15 | blank; wait for enemy count `>2`, then enter 14 | exact-ported | preserved nonnumeric route 13->15->14 |
| 14 | primary/concentration callouts; conditional wounded cue; zero starts wave 5 | exact-ported | cue one-shot and exact wave edge |
| 16 | blank; wait until any first ground Sack exists | exact-ported | potion spawn, not enemy death alone |
| 17 | first live ground-Sack world arrow; wait until no ground Sack remains | exact-ported | pickup/removal boundary, no timeout |
| 18 | potion heading, dynamic binding, potion/HP arrows; wait for recursive health-potion count zero; start wave 6 and queue two cues | exact-ported | potion must be consumed, not merely picked up |
| 19 | `SURVIVE`; remove teaching overlay only after enemy count `>5` | exact-ported | survival continues after overlay teardown |

The route is fixed as
`intro -> 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 15 -> 14 -> 16 -> 17 -> 18 -> 19 -> overlay removed`.

### UI, input, combat, and pointer membership

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| primary teaching heading | `0x005C9710`, Fonts group 4 `+0x1351CC` | exact-ported | exact uppercase copy, baselines `100`, `730`, `80`, or `200` by native case; common gold plus crisp black `(2.25,2.25)` underlay |
| secondary/subheading | `0x005C9960`, Fonts group 3 `+0x0E7D98` | exact-ported | exact case/copy; baselines `170`, `760`, or `110`; same common gold/crisp shadow pair |
| bordered callout | `0x005C9C70`, UI record 4 nine-slice | exact-ported | Fonts group-3 measured bounds plus `20x28`, filled mirrored frame, common-gold text |
| stage-14 primary/concentration copy | `0x005CA480 -> 0x005C9960` | exact-ported | two unframed secondary-helper lines; no invented callout panel |
| stock pointer sprite | UI record 28, crop `(202,656,58,61)` | exact-ported | exact atlas pixels/hash |
| pointer math/blink | `0x005C9BB0`: `atan2`, degrees, normalized, tick `%50 >19` | exact-ported | 30 visible / 20 hidden ticks and exact rotation |
| UI target arrows | spell, inventory, resume, quick slots, equipment, backpack, skills, concentrations, primary, potion, HP | exact-ported | one assertion/receipt per target family |
| world target arrows | stages 8 and 17, first registered type `0x7DD`, live projection | exact-ported | first Sack follows camera/live actor and clears with stage |
| inventory access gate | native `+0x1AC0` | exact-ported | invisible/inert until stage 7/8, then enabled |
| skills access gate | native `+0x1AC1` | exact-ported | invisible/inert until stage 11, then enabled |
| quick-use/belt gate | native `+0x1AC2` | exact-ported | revealed/enabled at stage 4 |
| secondary/spell HUD gate | native `+0x1AC3` | exact-ported | revealed at stage 4 |
| combat/status HUD gate | native `+0x1AC4` | exact-ported | health/mana/status reveal only after stage-13 close |
| early damage protection | native `+0x1CD5`; cleared at stage 13 | exact-ported | host-authoritative damage suppression only during protected stages |
| inventory modal lifecycle | stock modal open/close and overlay reparent | verified-already-at-parity for modal; exact-ported for tutorial signals/callouts | authoritative stage advances from bounded semantic UI actions |
| skill modal/picker lifecycle | stock SkillScreen/level-up paths | verified-already-at-parity for modal/picker; exact-ported for tutorial signals/callouts | save/resume cannot duplicate or skip barrier |
| Acid Rain tutorial loadout | remove Call Leviathan from visible learned order, grant/select 72, clear/normalize quick slots | exact-ported | exact visible book/order/quickbar and working cast |
| forced wave-3 offer order | IDs 65,67,60 | exact-ported | exact three offer rows if the barrier is reached |
| forced wave-6 offer order | IDs 8,72,57 | exact-ported | exact three offer rows for later progression |
| mobile/controller adaptation | browser semantic inputs feeding the same action gates | exact-ported browser input projection | no extra stage or changed authoritative predicate |

### Complete narration/audio membership

All cues use one ordered, resumable narration queue. `speaker` records the
native side/portrait lane; source WAV duration owns queue occupancy.
Clean stage-0 samples during the audible first cue show no subtitle, speaker
label, dialogue box, or portrait; the browser exposes the text only to an
assistive live region and does not add a visible caption surface.

| Cue key | Producer / speaker | Disposition | Proof contract |
| --- | --- | --- | --- |
| `SAY_SOLOMONDARKSHOWYOURSELF` | stage 0 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_OHBOYANOTHERWIZARD` | Solomon face branch / Solomon | exact-ported | exact WAV/text/order |
| `SAY_IHAVEBEENDISPATCHED` | Solomon face branch / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_ILLDOTHEDISPATCHING` | Solomon face branch / Solomon | exact-ported | exact WAV/text/order |
| `SAY_YOURPERVERSIONS` | Solomon face branch / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_TODEATHEXACTLY` | Solomon face branch / Solomon | exact-ported | exact WAV/text/order |
| `SAY_SOLOMON_LAUGH1` | Solomon retreat / Solomon | verified-already-at-parity for existing cue; exact-ported for Tutorial queue order | one start, no overlap |
| `SAY_COWARDCOMEBACK` | Solomon retreat / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_GETHIMBOYS` | Solomon retreat / Solomon | verified-already-at-parity for existing cue; exact-ported for Tutorial queue order | combat release after queued speech |
| `SAY_IAMSIRMIN` | stage 2 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_NEVERHEARDOFYOU` | stage 2 / Solomon | exact-ported | exact WAV/text/order |
| `SAY_EASILYVANQUISHED` | stage 3 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_ICAMEPREPARED` | stage 5 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_ACIDRAINHUH` | stage 5 / Solomon | exact-ported | exact WAV/text/order |
| `SAY_SURRENDER` | stage 5 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_CARELESSFOOL` | stage 7 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_UNREDEEMABLE` | stage 10 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_SOUNDLIKEMYMOTHER` | stage 10 / Solomon | exact-ported | exact WAV/text/order |
| `SAY_ACCEPTYOURFATE` | stage 10 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_MAKEMESTRONGER` | stage 11 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_LEVELLINGUP` | stage 11 / Solomon | exact-ported | exact WAV/text/order |
| `SAY_LOOKINGBEATUP` | stage 14 / Solomon | exact-ported | one-shot only when wounded/enemy threshold passes |
| `SAY_FACETHEWRATH` | stage 18 / Sirmin | exact-ported | exact WAV/text/order |
| `SAY_IMBORED` | stage 18 / Solomon | exact-ported | exact WAV/text/order |
| prelude score | module subsong 0 | exact-ported | begins with first-play flow, no unrelated title substitution |
| combat prelude/score | `combatprelude` then combat module family at Solomon release | exact-ported as browser-rendered exact module audio | release-bound start and scene teardown |
| rain ambience | environment mode 1 | verified-already-at-parity | scene-owned loop and teardown |
| fire props / ordinary combat SFX | stock fire/enemy/spell/loot systems | verified-already-at-parity where shared; exact-ported for Tutorial instantiation | cue/VFX lifecycle follows exact actors |

### Lifecycle, save, authority, and boundary membership

| Member | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| authoritative tutorial owner | native singleton Tutorial/Game; browser host party run | exact-ported | one solo participant, fixed 100-Hz stage/script clocks |
| loaded Tutorial scene identity | `Game+0x1CD4`; exact level hash | exact-ported | saved continuation cannot resume as a random Boneyard |
| tutorial controller state | stage, intro, one-shots, script clocks, trigger clocks, modal state, drop arm | exact-ported | strict save/protocol round trip at representative members |
| narration queue | global native owner, browser tutorial run | exact-ported | current/pending cue and remaining ticks resume exactly; restored PCM starts at the elapsed fixed-tick offset rather than replaying the cue head |
| exact loaded Boneyard | existing continuation scene projection | exact-ported | geometry/source hashes and run id survive reload |
| authenticated persistence | account cloud adapter | verified-already-at-parity; tutorial state exact-ported | reload/Last Game resumes the tutorial |
| anonymous persistence | IndexedDB adapter | verified-already-at-parity; tutorial state exact-ported | same on-device resume |
| checkpoint ordering | host semantic checkpoints plus 30-second periodic | verified-already-at-parity; new tutorial boundaries exact-ported | stage/wave/modal/drop boundaries publish monotonically |
| teaching overlay complete | stage 19 and enemy count `>5` | exact-ported | removes only tutorial overlay owner |
| survival run continues | three authored interval triggers | exact-ported | enemies/scripts/audio continue after overlay removal |
| ordinary player death/Game Over | shared Boneyard run lifecycle | verified-already-at-parity | exact death/Hall/Game Over presentation |
| durable profile completion | browser record existence plus schema profile/nullable continuation and native `tutorialPending` fact | exact-ported browser mapping | profile survives; continuation clears and the pending fact clears at Tutorial Game Over |
| tutorial/profile economy separation | native Tutorial Game teardown does not transfer Sirmin's scripted amulet, potion, drops, or carried run inventory into the later player profile | exact-ported browser mapping | host captures the pre-Tutorial durable economy, checkpoints it as the profile lane throughout the run, and keeps Tutorial economy only inside the resumable continuation |
| clean in-game leave mid-tutorial | save-before-leave | verified-already-at-parity; tutorial continuation exact-ported | acknowledged exact sequence before teardown |
| resume mid-control-picker | no native gameplay save exists yet | out-of-system (frontend choice precedes tutorial Game/save construction) | reload re-offers because slot remains absent |
| resume mid-tutorial gameplay | native Game serializer analogue | exact-ported | stage, scripts, actors, loot, modals, and queue restore |
| `NO` opt-out persistence | request is absence-based, not a separate opt-out profile | out-of-system (no requested durable opt-out) | dismissal lasts only the page/session while no save exists |
| multiplayer peers/bots joining Tutorial | retail Tutorial is global/solo | out-of-system (enforced singleton tutorial run) | no party/bot membership or cross-player stage authority |
| mod-authored tutorials | compiled stock controller is purpose-built | out-of-system (different mod API/system) | no generic DSL inferred from this port |
| abrupt tab death before any accepted checkpoint | browser asynchronous persistence limit | blocked-by-platform (no synchronous unload write guarantee) | initial/semantic checkpoint minimizes but cannot erase this browser constraint |

## Native ownership thread

- Missing/unreadable native profile data initializes the first-play flag at
  `0x005A8390`; post-load branch `0x005BF6A0` routes nonzero to
  `0x005B6C90`. The browser equivalent is a successful selected-store read
  returning no row. Parse/read failures remain distinct.
- The requested browser dialog owns only consent. A visible control choice
  then updates semantic movement bindings and follows the native fade/loading
  handoff. It does not manufacture gameplay state or mark completion.
- Tutorial bootstrap owns a dedicated loaded Boneyard and authority run. Its
  START GAME script creates the controller, Solomon, fires, and initial wave
  condition. The shared renderer/combat/loot systems consume exact authored
  scene and recipe rows; a Tutorial-specific director interprets only the
  closed authored graph above.
- One host-owned tutorial state stores controller, script, trigger, modal, and
  narration lifetimes. Client UI actions are bounded semantic facts; clients
  cannot choose a stage, spawn an enemy, grant XP, or create loot.
- Tutorial Solomon and controller calls feed one queue. The queue gates stage
  4 and survives save/resume. Presentation consumes unseen event ids and exact
  WAVs without replaying history.
- Stage 19 destroys only the teaching overlay. The run remains the same exact
  Tutorial Boneyard until normal death/leave/teardown. Browser completion is
  represented by the now-present durable profile; Game Over makes its
  continuation null under the existing schema lifetime split.

## Recovered behavioral contract

- Time is the authoritative 100-Hz fixed tick. Script sleeps 2/3/4/5/7 seconds
  are 200/300/400/500/700 ticks. Interval values 1.0/1.0/1.5 are
  100/100/150 ticks and are checked through the native round-robin family.
- The intro is authoritative Tutorial state, not a frontend timeout: delay 25,
  blend `0 -> 1` by float32 stores of `+0.0025`, then fade `1 -> 0` by
  `-0.02`, for 475 ticks total. UI records 43/68 render throughout and stage 0
  cannot advance or arm its narration delay until the intro-active flag clears.
- Once intro blend is strictly above `0.8`, stock overwrites the PlayerActor
  movement accumulator with `(0,-actor+0x70)`. After teardown it decrements
  the 250-tick lane and writes `(0,-actor+0x70*(remaining/250))` while positive;
  the shared PlayerActor tick clamps, moves, and damps it. The browser host must
  project that as forced north movement before ordinary player motion, not as a
  local camera animation and not as optional input.
- Forced spawn modes are exact light (1) and off-screen (2) placement predicates
  followed by the existing collision/path search. Direct guessed coordinates
  are not legal substitutes.
- The Tutorial level is environment mode 1 with exact scene geometry. Its
  camera lock is generation-bound; its two fires are scene-owned; all are
  destroyed on run replacement.
- UI text and arrows render above the world/HUD in the Tutorial overlay layer.
  World arrows project the live first Sack each presentation frame; UI arrows
  resolve semantic live controls. Blink uses the authoritative tick.
- Early protection filters authoritative incoming damage only until stage-13
  close. It does not disable movement, Magic Missile, Acid Rain, pickup, staff
  melee, or modal actions required by lessons.
- Tutorial authority is solo. No replication branch can add a second lesson
  participant, but the ordinary global host may still own unrelated Hub/party
  worlds in parallel.

## Nearby-system findings

- The existing default generated-Boneyard director must key on actual built-in
  random choices, not merely `choice.source === 'default'`; the Tutorial is a
  built-in/default asset with its own authored graph.
- Authored MonsterRecipe policies are already represented by the native loot
  selector but were not carried on spawn intents. Tutorial rows require the
  exact per-recipe policies, damage/HP/speed, path mode, and Archer accuracy.
  Carrying those facts deepens the existing definition-backed spawn seam
  without interpreting arbitrary Bonedit scripts.
- The stock prelude card is exact UI record 43, not reconstructable copy. The
  gold arrow is exact UI record 28. Both already exist inside the checked-in
  UI atlas; no new approximation is needed.
- `Mod Loader/docs/re/tutorial-mechanics.md` now records the clean-stock entry,
  absent tutorial prompt, exact forced modes, interval predicates, and eight
  Tutorial-specific Solomon cues.

## Confidence and open questions

- Confirmed: executable/level/assets identity; save-absence boundary; absence
  of a retail yes/no prompt; two visible and one hidden picker members; prelude
  record/music; every authored row; every controller stage/literal/gate; all 24
  cues; spawn policies; survival interval periods/predicates; drops; and three
  completion meanings.
- Inferred only where browser ownership differs: a singleton global-host party
  run is the cleanest browser projection of retail solo authority while still
  allowing an authenticated tutorial to produce an account cloud save.
- No extractable native table remains unknown in the system boundary. The only
  platform block is an uncheckpointed abrupt browser-process death.

## Web implementation consequence

- Keep selected-store presence as `missing`, `present`, or `unavailable`; do
  not derive first-run eligibility from `profileSave === null`.
- Add one browser-only title consent dialog and an exact visible control-picker
  prelude. `YES` connects a fixed Ether/Arcane Sirmin tutorial participant to a
  singleton vanilla authority run, then starts the exact built-in Tutorial
  Boneyard without exposing the intermediate Hub.
- Generate the exact Tutorial scene from the stock source and store its source
  and geometry hashes. Implement a cohesive tutorial kernel for its closed
  controller/script/trigger graph; enrich existing enemy/loot seams only with
  the exact recipe facts they already own.
- Replicate and save Tutorial state strictly. Increment protocol and save
  schema together; explicitly normalize historical schema-6 worlds with no
  Tutorial state, rather than changing schema 6 in place.
- Add a local Tutorial overlay/presentation owner for exact bitmap copy,
  UI records 43/68 and their authoritative intro progress, common-gold heading
  and callout families, UI/world pointers, narration, and HUD gating. Keep
  stage/spawn/XP/damage/drop authority on the host.
- Add the exact score/voice assets through the repository extraction path and
  remove no ordinary title, Hub, Boneyard, save, or mod behavior.

## Validation contract

- Focused kernels: every stage transition/boundary, seven recipes, six groups,
  13 triggers, 12 scripts, 18 commands, three survival predicates/clocks,
  loadout/XP/protection, two drop chains, 24-cue order, and overlay teardown.
- Persistence/protocol: schema-6 normalization plus schema-7 Tutorial
  checkpoints at intro, stages 0/8/10/13/17/19, active scripts, queued
  narration, and post-overlay survival; unknown/corrupt input still fails
  closed.
- UI contracts: cloud/local missing/present/unavailable matrix, `YES/NO`, two
  visible picker members/hidden third, records 43/68 and all 475 intro ticks,
  exact heading/menu font owners and gold/shadow geometry, record 4 callouts,
  record 28 blink/rotation, every HUD gate and callout target.
- Mac Chrome journey: clear authenticated cloud slot and anonymous IndexedDB
  separately; observe offer; prove `NO` leaves title/save absent; choose `YES`;
  traverse representative stock stages with real input; reload/Last Game
  mid-tutorial; reach survival/Game Over/profile-only; require empty page,
  console, failed-response, and application-error arrays.
- Run all focused tests, `/opt/homebrew/bin/bash ./scripts/validate.sh`, exact
  byte-manifest comparison, and matching stock/web 1600x900 captures on the Mac
  candidate. Publication and deployment remain separate.

## Implementation validation receipt

- The selected save adapter now exposes `loading/missing/present/unavailable`
  independently for authenticated cloud slot 0 and anonymous IndexedDB slot
  0. Only a successful `missing` read opens the requested browser `YES/NO`
  gate. `NO` creates no row; `YES` alone enters the two-member stock control
  picker and its 100-tick fade before constructing a fixed Ether/Arcane Sirmin
  Tutorial run.
- The authority owns the exact generated Tutorial scene and complete closed
  graph: stages 0..19 (including `13 -> 15 -> 14`), seven recipes, six groups,
  13 triggers, 12 scripts, 18 command IDs, two finite Fire actors, both linked
  drops, three survival intervals, loadout/XP/protection/HUD gates, Solomon's
  branch, and all 24 ordered narration cues. Tutorial economy remains inside
  the continuation and never enters the pre-Tutorial durable profile.
- Protocol 70 and save schema 7 strictly carry the resumable Tutorial owner.
  The intro persists delay/blend/fade/active/forced-movement lanes, pauses all
  lesson predicates for the exact 475 ticks, renders UI records 43/68, then
  continues the native 250-tick forced north motion through the shared player
  velocity/inertia kernel. Semantic stage, wave, narration, modal, drop, Fire,
  and intro boundaries produce ordered checkpoints.
- Presentation uses the complete shared native UI catalog: Controls records
  0/2 at the recovered rectangles, Fonts group 4/group 3 with common gold and
  crisp 2.25-pixel black underlays, UI record 4 filled callouts, UI record 28
  pointers, exact prelude/combat renders, 22 newly extracted retail voice WAVs
  plus the two existing Solomon cues, live Sack projection, and every HUD and
  modal callout branch. Retail exposes no visible caption surface; narration
  text remains assistive-only.
- On Apple arm64 macOS 26.6 with pinned Node 22.17.0, npm 10.9.2, .NET
  10.0.302, Python 3.14.7, and production Chrome, the rebased Loader CI-safe
  static suite passed `499/499`; log SHA-256 is
  `83584e89e2ad8fff70d7fef3e2bbc1235b8aafcfb1495afe06070a65f2204556`.
  The exact Website code candidate passed canonical `./scripts/validate.sh`:
  backend build/contracts, formatting/lint with zero errors and the eight
  existing warnings, architecture fences, frontend suites with counts
  `9/4/45/262/1476/6/61/9/63/12/14/7/36/33`, five desktop tests, production
  build, media policy, and game bundle budget (`458,055` raw / `128,494`
  gzip). Log SHA-256 is
  `ba5a9033da5a0c1e553e3670b76c7454245345837c30a6c570251ef7db8770ec`.
- Production Chrome acceptance used the real standalone authority host and
  built bundle at `1600 x 900`. Local `NO` left IndexedDB absent and re-offered
  after reload; local `YES` exercised WASD bindings, both prelude phases,
  authoritative stage 0, forced north movement, stage-1 checkpoint, and
  Last Game resume of the same run ID/stage. Authenticated cloud absence did
  the same through GET `404` plus monotonic PUT revisions, then suppressed the
  offer after reload. Page/application error arrays were empty; the only
  console/failed-response member was that expected cloud-absence `404`.
  Browser-log SHA-256 is
  `d3295f37ced334f787e4397ced16af970add924e39cb39372eb3f144b919b0ca`.
  Reviewed capture SHA-256 values are `572fc886...` (picker), `ba6bbfbe...`
  (prelude entry), `c58845bb...` (animated skull/card), `7b87ab06...`
  (local stage 0), and `6dfd2627...` (resumed Tutorial).
- Publication and deployment remain separate. This receipt authorizes the
  focused commits for `main`; no deployment or process restart was requested.
