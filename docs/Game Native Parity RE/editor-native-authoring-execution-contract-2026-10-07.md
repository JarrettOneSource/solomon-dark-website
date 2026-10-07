# Stock Boneyard authoring and execution contract (2026-10-07)

## Status, scope, evidence

Recovery ledger for full native editor authoring/execution, **not** a parity completion claim. All recovered members below are recovered-pending-port until implementation and acceptance are recorded. Unknown native facts remain open; none is a browser limitation.

Retail Solomon Dark 0.72.5, preferred image base 0x00400000; SHA-256 03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3, rechecked October 7. Full decompiles from canonical SolomonDark/SolomonDark.exe analyzed project, through read-only replica wrapper. Mod Loader and canonical project were not edited. Scratch extraction: home-wsl /mnt/c/Users/User/Documents/codex-runs/solomon-editor-native-ol69p7cm-20261007. Durable source is this Website file.

Tool SHA-256: Invoke-GhidraHeadless.ps1 b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49; decompile_targets.py 899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465. Prior read-only evidence: Mod Loader/docs/reverse-engineering/boneyard-authoring-format.md, native-boneyards-and-world.md, native-class-catalog.json.

## Important corrections

- 0x004DDB00 historically called TimelineExecutor_Tick is TimeLineBox drawing: class vtable 0x00787F24 slot +0x0C. It draws graph ticks, glyphs, icons and connectors. It is not gameplay scheduling
- 0x004BA1E0 builds timeline-event property UI; its handler IDs are UI kinds
- 0x004DEDA0 is code-line editor dispatcher. Real gameplay condition/action executor is 0x00689750
- ScriptThread tick: 0x0068B060, vtable 0x007A0F4C +0x08
- Runtime timeline-event dispatcher: 0x0046C9A0. Includes type 7 custom recipe/group spawning, absent from title builder's 0–6 list
- TimeLine generic update/draw vtable slots are no-ops. Its Arena/controller consumer owns scheduling
- TimeLine +0x34 selects time units in execution; the historical “enabled byte” label is unsafe

Decompiler arguments/calling conventions are imperfect. Missing pseudocode arguments do not imply missing native arguments. Offsets below are runtime field offsets, not serialized byte offsets.

## Common ABI

Little-endian; bool/u8 occupy one byte. Preserve original noncanonical true bytes unchanged. String: u32 count including NUL, bytes, terminal NUL. Preserve nested chunk framing, unknown fields, unknown tails, unused selectors and reserved opcodes.

Sync helpers: +0x00424E30 integer32; 00424DA0 byte; 00424F60 bool; 00425210 f32; 00425000 float2; 004252C0 float4; 00425130 String; 004247B0 begin chunk; 00424860 end chunk; 00425580 polymorphic manager; 004256A0 embedded list.

Factory membership: 6001 MonsterRecipe, 6002 UIDGroup, 6003 ItemRecipe, 6004 NPCRecipe, 6005 ItemSet, 6006 TimeLine, 6007 TimeLineEvent, 6008 Spawner.

0x0064BC40 relinks UIDGroup member UIDs to parallel pointers, MonsterRecipe +C4 to +C8 when +C1 enabled, NPCRecipe optional links (+7A,+7C,+80), (+84,+88,+8C), (+90,+94,+98), event-reference UIDs, and CodeLine type-5 UID operands. Native UIDGroup is separate from web selection grouping.

Events are stably inserted by increasing (float +1C, float +20); strict comparisons preserve source order when both equal. Never sort by UID. +1C is timeline time/X and +20 is graph row/tie-break, not world coordinates.

## CodeLine, conditions and ScriptThread

Constructor 006821B0: opcode +4=0, secondary +8=0, empty operand array +0C, nested list +1C=null. Runtime operand stride=8: u8 tag at +0, payload/pointer at +4. Wire encoding is tagged, not a memory dump.

00683C10 opens a chunk: u32 operandCount; each u8 tag plus payload; bool hasNestedLines; if true u32 nestedCount and recursive lines; closes chunk. Each nested line has header chunk [u32 opcode,u32 secondary] followed by wrapper chunk containing recursive CodeLine Sync. Outer script/condition/event owners similarly write headers separately.

| Tag | Wire | Getter |
| --- | --- | --- |
| 1 | i32/u32 | 006837D0 |
| 2 | f32 | 006838A0 |
| 3 | String | 00683960 |
| 4 | float2 | 00683A50 |
| 5 | u32 UID | 00683AF0 |

0068B5B0 condition list: empty succeeds; trigger +24==0 is short-circuit AND, otherwise short-circuit OR. Context is installed and restored. 00689750 condition IDs 1–14; CodeLine +8==1 inverts. Query mode returns bool. Script mode false calls 00681D40 to skip a block; returns no sleep.

0068B060 thread:
- Lazily resolves script/trigger IDs; invalid references retire
- Positive sleep +54 decrements once per tick and resumes when reaching zero
- Nonzero action return becomes sleep/yield state and ends tick immediately
- At most ten instruction iterations per native tick
- PC advances before dispatch
- End of script pops script-ID/return-PC stacks; no return frame terminates
- CALL SCRIPT nests/returns
- Negative state <=-10000 represents predicate waits; many are polled every tenth tick
- Context globals clear on yield/finish

## Trigger graph

00684360 exact framing:
1. Open root, open header
2. u32 +4 (UID), String +8 (name), u32 +2C (kind), u32 +24 (condition aggregation), u32 +68, bool +28,+65,+94
3. Open parameter child: u32 +44,+84; f32 +48,+4C,+50,+54; float2 +58; f32 +60; u8 +64; u32 +8C; close child
4. Embedded CodeLine Sync at trigger +98; close header
5. Open condition-list child: u32 count; repeated CodeLine header and payload-wrapper chunks; close child
6. Root tail bool +95,+30; f32 +34; u32 +38; bool +3C; close root

Labels not independently tied to controls stay offset-named. TriggerControl 00686400 owns triggers, named scripts, flags, counters and active ScriptThreads.

Trigger kind mapping from 004B4EC0:
1 START GAME; 2 START WAVE; 3 END WAVE; 4 END GAME (native typo END GAE); 5 WIN GAME; 6 LOSE GAME; 7 PLAYER STEPS ON; 8 MANUAL; 9 INTERVAL; 10 PLAYER PRESSURE; 11 MONSTER DIES HERE; 12 BOSS HP; 13 LEVEL UP; 14 FIND SOLOMON; 15 SOLOMON RUNS.

004B4B50 options: name, initially enabled, trigger limit, required pressure seconds, stationary-player requirement, global trigger.

## Timeline ABI and event inventory

TimeLine 00646F80 exact order in one chunk:
String +14; u32 UID +30; u8 timeUnits +34; manager events +38; f32 +84; u32 +88; u8 +8C; u32 +90; u8 +98,+99; u32 +94; manager activeSpawners +9C.
Constructor 00640E60 clears scalar/byte fields above. On loading active spawners their +14 owner pointer is assigned to this timeline.

TimeLineEvent 00652040:
- Root starts u32 UID +14, u32 type +18, f32 time/X +1C, f32 row/Y +20
- Child 1 u32 count,u32 referenceUIDs[] (runtime array +28)
- Child 2 u32 count,u8 bytes[] (+48)
- Child 3 u32 count,f32 floats[] (+58)
- Child 4 u32 count,u32 ints[] (+68)
- Child 5 u32 count,String strings[] (+78)
- Root continuation bool +24,+25,u8 +A0
- Child 6 u32 codeCount; each CodeLine header chunk and recursive payload wrapper
- Close root

Constructor 004A9E80 clears arrays,+24,+25,+A0. Runtime resolved-pointer array +38 is not serialized.

0046C9A0 event membership:
| Type | Semantics |
| --- | --- |
| 0 | Stock-monster Spawner |
| 1 | Trigger reference[0]: byte[0]==0 trip, ==1 try |
| 2 | Pause timeline, mode byte[0], params float/int arrays |
| 3 | Advance wave via 00465C00 |
| 4 | Label marker, no direct action |
| 5 | Jump among referenced labels |
| 6 | Set default spawn-location selectors int[0],int[1] |
| 7 | Custom recipe/group Spawner |

Types 0/7 create Spawner storing owner,event pointer,event UID; budget=int[0]; default-location bytes from timeline +98,+99. int[1] enables pacing, float[0] supplies duration converted by timeline units, int[2]==1 selects pacing behavior. Type7 int[3]==0 enables sequential/all-members behavior and replaces budget with sum of +50 counts of opcode3003 referenced groups. Do not omit type7 or treat it as type0.

## Recipe ABI

MonsterRecipe 0063E890 exact order:
u32 enemyType; String name; u32 uid; f32 maxHp,primaryDamage,chaseSpeed,moveSpeedScale; u32 variantMode,projectileMode,auraMode; u8 headgearMode,unknown81,unknown82,randomVariant; String archetype; bool hasLinkedUid; u32 linkedUid,behaviorCount,behaviorMin,behaviorMax; bool flanking; u8 pathfindingMode,dropOrbs,dropPowerups,dropItems,dropSpecificItems,dropGold,dropPotions,specialSpawnMode; f32 attackSpeed,xpBonus,secondaryDamage; bool shield,shieldOthers,unknown96,burning; f32 tertiaryDamage,extraDamage; u32 behaviorTimer; float4 rect98,rectA8; u8 castMode.
Modes are enemy-type-specific; codec support alone does not prove safe combinations.

UIDGroup 0064A130:
String name; u32 uid; u32 memberCount; u32 members[count]; u32 field58,field5C,field60,field34.
Runtime +3C/+40 UID data/count and +4C/+50 resolved-pointer data/count.

ItemRecipe 00570D90:
u32 +14; String +18,+34,+50; embedded list via 004256A0 at +6C; u32 +84; u8 +88; float4 +8C,+9C; u8 +89,+8A. On load zero +14 resolves via 005B9870. Embedded item payload needs its real codec.

NPCRecipe 0063EBD0:
u32 +4C; String +14,+30; u32 +50; u8 +56; bool +54; u8 +7A; u32 +7C; u8 +84; u32 +88; u8 +90; u32 +94; String +58; u8 +55,+79; bool +78; u8[4] +9C; u32[4] +A0; bool[4] +B0; float4[2] +B4; u32 +74.

ItemSet 6005 serializer 0042E260 is a no-op in this retail executable. Do not invent subclass fields.

## Required acceptance and open recovery

Full acceptance must cover every record roundtrip; unknown bytes and noncanonical bools; UID collisions/missing references/copy/delete; every trigger ingress; AND/OR/inversion; all conditions/actions; nested flow/call/return/loops/gotos; sleep/predicate yields and ten-instruction order; timeline time units/pause/jump/tie ordering; type7 spawning/failures/teardown; every tool/menu/property and input transition; imported normal games and disposable editor tests; interruption/repeat/death/return without account rewards; clean-stock observation plus exact-tree Mac/browser validation.

Recovery continues below. Native timeline owner, complete opcode schemas, trigger ingresses, recipe-property UI and editor tool/menu inventory must be completed before full-stock certification. Partial extraction is not a final disposition.

## Recovered runtime timeline scheduler (0046E390)

Arena owns active TimeLines at +9040 (count +9048, elements +9054). Each tick, visit active timelines in list order.

When pauseKind +8C == 0:
1. Snapshot current timeline time +84
2. Tick active-spawner manager (004022A0)
3. Compute step = 1 / native tick-rate global 00820230; if +34 != 0 divide by the native minutes constant at 007849A0
4. Inspect event at cursor +88
5. If no event remains and no active spawners remain, remove timeline from active list
6. If event +25 is already marked consumed, increment cursor and finish this timeline for this tick (do not skip arbitrarily many consumed events)
7. If event time +1C is greater than the time snapshot, stop processing and advance clock by step
8. Otherwise dispatch 0046C9A0. If event +24 is set, set +25=1. Increment cursor
9. Continue with next due event only if dispatch returned zero; pause events return nonzero and end processing immediately without the ordinary clock-advance path

When paused, no ordinary timeline-time advancement occurs:
- 1: decrement +90; clear pause when <1
- 2: clear when global living-monster count 0081984C <1
- 3: clear when living-monster count < +90 (strict)
- 4: no automatic clear, manual restart
- 5: clear when Game +1C2C==0 and global boss count 00819850==0
- 6: clear when (+90 < Arena +88 OR living-monster count < +94) AND boss count <1

Clearing a pause in the paused branch does not process an event until the next tick. Types 0/7 active spawners are ticked from the unpaused path, so pause freezes this scheduling lane. A list-removal mutation is native behavior and must be accounted for when translating iteration.

These observations falsify “all events with time <= new time run immediately,” “pause is wall time,” and “consumed events are free to skip in a while-loop.” Use current-time snapshot and one-consumed-event-per-tick behavior.


## Complete CodeLine authoring membership and schemas

The sibling machine-readable artifact is editor-native-opcodes-2026-10-07.json.
It contains 113 membership rows: conditions 1–14; the complete action interval
1001–1096, including reserved/no-op slots; and timeline spawner operand records
3001–3003. The native action menu builder004B6750 contains **94 rows and92 distinct
action IDs**, not the earlier informal92/90 count. FORCE SPAWNS1005 and CLEAR
REFERENCES1043 each appear under both MONSTER and NPC commands. Hidden action1014
START/STOP WAVE CONTROLLER is accepted by both editor and runtime but has no
004B6750 menu row. Reserved IDs1021,1022,1050 dispatch to the runtime no-op.
ENDIF1076 and LABEL1077 are structurally meaningful to traversal while their
individual runtime dispatch returns zero.

Each row records editor source, native labels, tagged operand index/type, first-read
default, numeric limits, exact choices and choice values, conditional geometry
schema, property writes, and runtime/condition contracts. Controls form a union
inventory, not an instruction to display or initialize every variant at once.
Use conditionalVisibility, variant selectors, and the runtime contract.

### Lazy operands, holes, defaults, and property-side mutation

006821B0 constructs an empty operand array. Getter access grows the array and
allocates only the requested slot. Defaults: i32=0, f32=0, String empty,
float2=(0,0), UID=0 plus null resolved pointer. Intervening slots remain tag-0
holes.00683C10 serializes their tag with no payload. Do not replace all holes
with i32 zero, eagerly initialize every branch, or discard operands hidden by a
different selector. Known tags are1–5; unknown source bytes/tails remain
preservation data, not permission to reinterpret them.

004BD040 integer and004BD190 float property builders immediately clamp the
referenced value when their control is constructed. Min/max are inclusive
signed integer arguments; the float helper converts those integer bounds to
floats. These ranges are native authoring behavior, not necessarily runtime
clamps. Float constructor comparisons turn NaN into the lower bound
when that control renders.

The generic number default is not a valid substitute for explicit property writes:
- RANDOM condition14 changes zero bound I2 to2
- PLAYER LEVEL condition7 writes I0=0
- EXPLOSION1060 and FIRE1061 change zero size F1 to100
- PAUSE TIMELINE1069 changes pause kind I2=0 to4 when pause mode and timeline resolution permit the panel
- CHANGE NPCs TO ALLIES1095 initializes I0=0 and I1=25 only when its operand array is empty
- REDUCE REF'D MONSTER HP1096 initializes F0=50 only when its operand array is empty
- START FIRE duration's visible numeric range [1,1000] clamps initially zero F2 to1

Dropdown construction004C3810 splits "|" in source order. A label with [n]
uses explicit integer n; otherwise its zero-based row index is the value.
Never replace explicit IDs with array position: potion, music, location,
pause-kind, and tweak catalogs have nonsequential values. Dynamic record
selectors use native UIDs, including selectors whose storage tag happens to
be i32 (condition2 named-monster UID and condition3 item UID).

### Shared location authoring

004D2370 receives caller-specific allowed-choice bitmask and relative operand
base s. Displayed order and explicit selector codes:

| UI order | Code | Mask bit | Native label |
| --- | --- | --- | --- |
| 0 | 3 | 0x8 | POSITION |
| 1 | 0 | 0x1 | ANY PLAYER |
| 2 | 1 | 0x2 | LOCAL PLAYER |
| 3 | 11 | 0x800 | AHEAD OF ANY PLAYER |
| 4 | 12 | 0x1000 | AHEAD OF LOCAL PLAYER |
| 5 | 2 | 0x4 | ANY PLACE |
| 6 | 4 | 0x10 | CIRCLE |
| 7 | 5 | 0x20 | RECTANGLE |
| 8 | 6 | 0x40 | OUT OF BOUNDS |
| 9 | 7 | 0x80 | TRIGGER FOCUS |
| 10 | 8 | 0x100 | HOT AREA |
| 11 | 9 | 0x200 | LOCAL PLAYER'S LIGHT |
| 12 | 10 | 0x400 | CLOSEST OPEN GRAVE |

I[s] is mode; s+1 is unused by shared authoring/runtime resolver. Mode3 uses
V[s+2]. Mode4 uses center V[s+3] and integer radius I[s+4]. Mode5 uses two
float2 corners V[s+5], V[s+6]. Keep every caller's base and mask from catalog.
Condition2 has base2, mask0x1B8. Standard spawn/drop/effect actions usually use
mask0x18FF. NPC actions use0x188F; nearest-reference variants use0x023C;
SLEEP UNTIL location predicates use0x0088; Solomon placement uses0x063C.
These are distinct contracts, not one unrestricted position selector.

Point-producing resolver00466600 differs from point-testing00464050,
monster queries006873C0, reference queries, and Solomon placement00467230.
Do not infer one universal runtime meaning from UI names. In particular,
resolver00466600 has fallback-center behavior for modes8/10, while
Solomon placement1048 genuinely supports closest-open-grave mode10.
Opcode/runtime supplements preserve consumer-specific behavior.

### Stock-monster CodeLines1082 and3001

004AB3F0's action selector contains ten authored rows: Skeletal Warrior1001,
Skeletal Archer1002, Skeletal Mage1003, Zombie1006, Spider2057, Imp1004,
Coffin1013, Wraith1007, Imp Portal5021, Lesser Demon1009. This is selector
membership, not the entire MonsterRecipe class factory.

I0 is monster type and I1 is the editor previous-type cache. When type
changes,004D2970 copies I0 to I1 and resizes operand array to8, removing stale
type-specific variants/tweaks. I9 has enemy-specific variants:
- Warrior: bare hands/sword/mace/flail/axe/pike
- Archer: normal/fire/poison
- Mage: fire/lightning/frost/poison
- Zombie: normal/flyblown
- Coffin: normal/rotten

I10 onward is a variable-length positive-ID tweak list, with trailing zero
choice added when required. It is not a fixed list of player skill IDs. Catalog
preserves all base and type-specific tweak labels/IDs, including nonsequential
XP-minus47 and aiming-random49. Timeline3001 reuses the same builder with
action prefix and location controls disabled;3002 has MonsterRecipe UID0
and3003 UIDGroup UID0.

### Authoring evidence quality

Raw instructions supplied most static property argument evidence; decompiles
resolve branch visibility and shared helpers. A Ghidra function-body boundary
omitted the later duration branch of004D3AF0 from original ASM slice; complete
decompile identifies F3, [0,1000000] range, and selected timeline seconds/minutes.
This is an evidence-tool boundary, not a platform limitation. Dynamic selector
label registries already maintained in frontend/src/game/core-kernels/native-skill-catalog.json
remain the source for skill names; native enumeration006591E0 covers IDs8–81 except80.

### Complete CodeLine membership ledger

All rows below are recovered-pending-port except explicit reserved native no-ops.

| ID | Native name/context | Operand union |
| --- | --- | --- |
| 1 | WAVE NUMBER IS | 0:i32, 1:i32 |
| 2 | OBJECT IS AT | 0:i32, 1:i32, 2:i32, 4:float2, 5:float2, 6:i32, 7:float2, 8:float2 |
| 3 | PLAYER HAS ITEM | 0:i32 |
| 4 | FLAG IS | 0:String, 1:String |
| 5 | COUNTER IS | 0:String, 1:i32, 2:i32, 3:i32, 4:String |
| 6 | GAME DATA IS | 0:i32, 1:i32, 2:i32 |
| 7 | PLAYER LEVEL IS | 0:i32, 1:i32, 2:i32 |
| 8 | PLAYER ELEMENT IS | 0:i32 |
| 9 | PLAYER DISCIPLINE IS | 0:i32 |
| 10 | PLAYER SKILL LEVEL IS | 0:i32, 1:i32, 2:i32 |
| 11 | PLAYER'S GOLD IS | 0:i32, 1:i32, 2:i32, 3:String |
| 12 | PLAYER'S HEALTH IS | 0:i32, 1:i32, 2:i32, 3:String, 4:f32 |
| 13 | PLAYER'S MANA IS | 0:i32, 1:i32, 2:i32, 3:String, 4:f32 |
| 14 | RANDOM ROLL | 0:i32, 1:i32, 2:i32 |
| 1001 | ECHO | 0:String |
| 1002 | SCRIPT LOGIC->SLEEP | 0:f32 |
| 1003 | WORLD COMMANDS->START NEXT WAVE | (none) |
| 1004 | WORLD COMMANDS->START NEXT WAVE WHEN... | 0:i32, 1:i32, 2:f32 |
| 1005 | MONSTER COMMANDS->FORCE SPAWNS... | 0:i32 |
| 1006 | MONSTER COMMANDS->SPAWN CUSTOM MONSTER | 0:UID, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1007 | MONSTER COMMANDS->SPAWN CUSTOM MONSTER GROUP | 0:UID, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1008 | ITEM COMMANDS->DROP ITEM | 0:UID, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1009 | TRIGGER LOGIC->DISABLE TRIGGER | 0:UID |
| 1010 | TRIGGER LOGIC->ENABLE TRIGGER | 0:UID |
| 1011 | TRIGGER LOGIC->TRIP TRIGGER | 0:UID |
| 1012 | TRIGGER LOGIC->TRY TRIGGER | 0:UID |
| 1013 | TRIGGER LOGIC->DELETE TRIGGER | 0:UID |
| 1014 | START/STOP WAVE CONTROLLER | 0:i32 |
| 1015 | ITEM COMMANDS->DROP RANDOM ITEM | 0:i32, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1016 | ITEM COMMANDS->DROP GOLD | 0:i32, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1017 | ITEM COMMANDS->DROP RANDOM GOLD | 0:i32, 1:i32, 2:i32, 4:float2, 5:float2, 6:i32, 7:float2, 8:float2 |
| 1018 | ITEM COMMANDS->LIMIT DROPS... | 0:i32, 1:i32, 2:i32, 3:i32 |
| 1019 | MONSTER COMMANDS->FORTIFY MONSTER RECIPE | 0:UID, 1:i32, 2:f32 |
| 1020 | MONSTER COMMANDS->SPAWN PARTIAL MONSTER GROUP | 0:i32, 1:UID, 2:i32, 4:float2, 5:float2, 6:i32, 7:float2, 8:float2 |
| 1021 | reservedAction | (none) |
| 1022 | reservedAction | (none) |
| 1023 | PLAYER COMMANDS->AUTO LEVELUP ON/OFF | 0:i32, 1:i32 |
| 1024 | PLAYER COMMANDS->INVENTORY BUTTON ON/OFF | 0:i32, 1:i32 |
| 1025 | PLAYER COMMANDS->SPELLBOOK BUTTON ON/OFF | 0:i32, 1:i32 |
| 1026 | PLAYER COMMANDS->BELT BUTTONS ON/OFF | 0:i32, 1:i32 |
| 1027 | PLAYER COMMANDS->PLAYER MOVING ON/OFF | 0:i32, 1:i32 |
| 1028 | PLAYER COMMANDS->PLAYER CASTING ON/OFF | 0:i32, 1:i32 |
| 1029 | PLAYER COMMANDS->INVOKE INVENTORY | 0:i32 |
| 1030 | PLAYER COMMANDS->INVOKE SPELLBOOK | 0:i32 |
| 1031 | PLAYER COMMANDS->INVOKE SKILL PICKER | 0:i32 |
| 1032 | SCRIPT LOGIC->LOOP | 0:i32 |
| 1033 | SCRIPT LOGIC->END LOOP | (none) |
| 1034 | PLAYER COMMANDS->INCREASE PLAYER SKILL | 0:i32, 1:i32 |
| 1035 | PLAYER COMMANDS->TELEPORT PLAYER | 0:i32, 1:i32, 2:i32, 4:float2, 5:float2, 6:i32, 7:float2, 8:float2 |
| 1036 | ITEM COMMANDS->PUT ITEM IN INVENTORY | 0:i32, 1:UID |
| 1037 | ITEM COMMANDS->TAKE ITEM FROM INVENTORY | 0:i32, 1:UID |
| 1038 | SCRIPT LOGIC->CALL SCRIPT | 0:UID |
| 1039 | NPC COMMANDS->SPAWN NPC | 0:UID, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1040 | SCRIPT LOGIC->SLEEP UNTIL... | 0:i32, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1041 | NPC COMMANDS->REFERENCE NPCs... | 0:i32, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1042 | NPC COMMANDS->REMOVE NPCs | 0:i32 |
| 1043 | MONSTER COMMANDS->CLEAR REFERENCES | (none) |
| 1044 | NPC COMMANDS->NPCs LOOK AT... | 0:i32, 1:f32, 2:i32, 4:float2, 5:float2, 6:i32, 7:float2, 8:float2 |
| 1045 | NPC COMMANDS->MOVE NPCs... | 0:i32, 1:i32, 2:f32, 3:i32, 5:float2, 6:float2, 7:i32, 8:float2, 9:float2 |
| 1046 | NPC COMMANDS->SET NPC IDLE BEHAVIOR | 0:i32 |
| 1047 | NPC COMMANDS->NPCs NEED HELP! | 0:i32 |
| 1048 | SOLOMON COMMANDS->PLACE SOLOMON DIGGING | 0:i32, 2:float2, 3:float2, 4:i32, 5:float2, 6:float2 |
| 1049 | NPC COMMANDS->NPCs FLEE! | (none) |
| 1050 | reservedAction | (none) |
| 1051 | SYSTEM COMMANDS->DARK CODE | 0:String |
| 1052 | MONSTER COMMANDS->MONSTER FLAIR | (none) |
| 1053 | MONSTER COMMANDS->REFERENCE MONSTERS... | 0:UID, 1:i32, 2:i32, 4:float2, 5:float2, 6:i32, 7:float2, 8:float2 |
| 1054 | FLAGS AND COUNTERS->SET FLAG | 0:String, 1:String |
| 1055 | FLAGS AND COUNTERS->SET COUNTER | 0:String, 1:i32 |
| 1056 | FLAGS AND COUNTERS->INCREMENT COUNTER | 0:String |
| 1057 | FLAGS AND COUNTERS->DECREMENT COUNTER | 0:String |
| 1058 | PLAYER COMMANDS->FORCE SKILL PICK | 0:i32 |
| 1059 | ITEM COMMANDS->DROP POTION | 0:i32, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1060 | FX COMMANDS->DO EXPLOSION AT... | 0:f32, 1:f32, 2:i32, 4:float2, 5:float2, 6:i32, 7:float2, 8:float2 |
| 1061 | FX COMMANDS->START FIRE AT... | 0:f32, 1:f32, 2:f32, 3:i32, 5:float2, 6:float2, 7:i32, 8:float2, 9:float2 |
| 1062 | WORLD COMMANDS->WIN LEVEL | (none) |
| 1063 | WORLD COMMANDS->LOSE LEVEL | (none) |
| 1064 | WORLD COMMANDS->CHANGE WEATHER | 0:i32 |
| 1065 | WORLD COMMANDS->LOCK/UNLOCK CAMERA | 0:i32, 1:float2, 2:float2 |
| 1066 | WORLD COMMANDS->DESTROY OFF-CAMERA OBJECTS | (none) |
| 1067 | TIME LINE COMMANDS->START TIME LINE... | 0:UID |
| 1068 | TIME LINE COMMANDS->STOP TIME LINE... | 0:UID |
| 1069 | TIME LINE COMMANDS->PAUSE/UNPAUSE TIME LINE... | 0:i32, 1:UID, 2:i32, 3:f32, 4:i32 |
| 1070 | TIME LINE COMMANDS->JUMP TO LABEL... | 0:UID, 1:UID |
| 1071 | TIME LINE COMMANDS->JUMP TO NEXT EVENT | 0:UID |
| 1072 | PLAYER COMMANDS->DISABLE SKILL PICK | 0:i32 |
| 1073 | PLAYER COMMANDS->ENABLE SKILL PICK | 0:i32 |
| 1074 | ITEM COMMANDS->TAKE GOLD FROM INVENTORY | 0:i32, 1:i32 |
| 1075 | PLAYER COMMANDS->REJUVENATE | 0:f32, 1:i32, 2:i32 |
| 1076 | IF/ENDIF->ENDIF | (none) |
| 1077 | SCRIPT LOGIC->LABEL... | 0:String |
| 1078 | SCRIPT LOGIC->GOTO | 0:String |
| 1079 | PLAYER COMMANDS->LEVEL UP PLAYER | 0:i32 |
| 1080 | PLAYER COMMANDS->XP ACCUMULATION ON/OFF | 0:i32, 1:i32 |
| 1081 | PLAYER COMMANDS->GRANT XP | 0:i32, 1:i32 |
| 1082 | MONSTER COMMANDS->SPAWN DEFAULT MONSTER | 0:i32, 1:i32, 2:i32, 4:float2, 5:float2, 6:i32, 7:float2, 8:float2, 9:i32,10..:i32 |
| 1083 | SOLOMON COMMANDS->SOLOMON DRIVE-BY | (none) |
| 1084 | SOLOMON COMMANDS->RUN SOLMON AWAY | (none) |
| 1085 | SOLOMON COMMANDS->SLEEP UNTIL SOLOMON IS GONE | (none) |
| 1086 | ITEM COMMANDS->DROP KEY | 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1087 | ITEM COMMANDS->ENABLE/DISABLE DROPS... | 0:i32, 1:i32 |
| 1088 | MONSTER COMMANDS->REMOVE UNSEEN MONSTERS | (none) |
| 1089 | MONSTER COMMANDS->REMOVE OFFSCREEN MONSTERS | (none) |
| 1090 | PLAYER COMMANDS->MODIFY XP ACCUMULATION | 0:i32, 1:f32 |
| 1091 | WORLD COMMANDS->PREVENT LULLS | 0:i32, 1:f32 |
| 1092 | FX COMMANDS->OFFSCREEN MAGIC... | 0:f32, 1:i32, 3:float2, 4:float2, 5:i32, 6:float2, 7:float2 |
| 1093 | NPC COMMANDS->CHANGE NPCS TO TARGETS... | (none) |
| 1094 | WORLD COMMANDS->SET MUSIC... | 0:i32 |
| 1095 | NPC COMMANDS->CHANGE NPCS TO ALLIES... | 0:i32, 1:i32, 2:i32 |
| 1096 | MONSTER COMMANDS->REDUCE REF'D MONSTER HP | 0:f32 |
| 3001 | timelineSpawnOperand | 0:i32, 1:i32, 9:i32,10..:i32 |
| 3002 | timelineSpawnOperand | 0:UID |
| 3003 | timelineSpawnOperand | 0:UID |

# Stock trigger and condition contract supplement

Recovery evidence only, 2026-10-07. All rows are recovered-pending-port. No Website/application files were changed by this worker. JSON companion: trigger-condition-supplement.json.

Retail SolomonDark.exe 0.72.5 SHA-256 03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3 was rechecked. Preferred image base 0x00400000. Canonical SolomonDark/SolomonDark.exe was read through the existing replica wrapper; raw logs and extracted functions are task scratch.

## Findings that must affect implementation

- 004736D0 is literally MOV AL,1; RET. Stock authority succeeds unconditionally. Global-trigger fallback paths are retained native code, not observed network authority semantics.
- Trigger polling is ordered after active ScriptThreads. It polls one PLAYER STEPS ON, one PLAYER PRESSURE, then one INTERVAL candidate per tick, each with its own round-robin cursor. It then processes the entire active-pressure list.
- PLAYER STEPS ON has no rising-edge latch. Unlimited triggers can fire again on each visit while the player remains in the region.
- INTERVAL lastTick is updated when due before conditions are tested. A false condition still consumes that interval.
- Pressure enters only after conditions pass. Conditions are not rechecked during the hold or exit. Holding uses eligibility, a native tick countdown and optional exact-position stationary reset.
- Pressure's primary script does not consume the use limit. Its secondary/exit script does. Leaving before the required hold time cancels silently.
- TRIP bypasses enabled and conditions, but respects killed. TRY first runs the eligibility helper, which implements only trigger kinds 7–10. TRY on other kinds returns false.
- ENABLE does not revive killed/exhausted triggers. DELETE marks killed and removes from the per-kind active list; it does not destroy the master-owned object or cancel existing threads.
- Boss thresholds are strictly crossed: newHP/maxHP < threshold < oldHP/maxHP. Landing exactly on a threshold does not fire.
- Generic batch iteration corrects the index after current-trigger removal. The boss-HP and death/level helper loops simply advance. Do not silently substitute a different list-mutation policy.
- Stock circle eligibility compares squared distance directly to trigger +60. Generic condition location mode8 squares that same +60 again. Preserve this discrepancy unless authoring evidence proves a storage conversion.
- The primary-player gold/HP/mana/element/discipline/skill conditions use their actual native owners. They do not all follow the active ScriptThread player selector.
- Native RNG roll is zero-based [0,N), not a tabletop die [1,N].

## Ownership and lifecycle

Arena embeds TriggerControl at +8528. Control+4 points to the Arena. Master triggers are +20; per-kind lists are +38+kind*18 (hex arithmetic), with count at list+8/data at list+14. Active threads are +208. Active-pressure entries are +254.

Trigger fields:
- +24 aggregation: zero AND, nonzero OR
- +28 enabled; +2C kind; +30 global
- +34 pressure seconds; +38 countdown; +3C stationary requirement
- +44 interval last tick
- +48 rectangle x,y,w,h; +58 circle center; +60 circle bound / interval seconds / boss threshold according to kind; +64 location mode
- +65 limit enabled; +68 remaining uses
- +84/+88 primary script UID/resolved pointer
- +8C/+90 secondary script UID/resolved pointer
- +94 killed; +95 pressure-active latch; +96 current player selector
- +B8/+BC mutable trigger focus

Constructor 00684040 defaults enabled/global/limit-enabled true, remaining uses1, AND, pressure seconds/countdown0, stationary false, lastTick0, killed/active false, both script UIDs-1. Loading00686400 restores serialized state, inserting only enabled and not-killed triggers into per-kind lists.

00686E70 creates an active ScriptThread, copies focus and player selector, selects primary when argument3==1 else secondary, and consumes a pending object reference through00685350. All recovered local entry paths ultimately pass player parameter0 into00686E70, which overwrites Trigger+96 and thread+60 with0. Some linked/death helpers temporarily assign a source selector before the wrapper, but it is not retained by this retail creation path. It applies a use-limit decrement only when its consume flag is true. Killed triggers refuse new threads; existing threads retain references. No physical deletion is implied by DELETE TRIGGER.

## Condition evaluation

0068B5B0: an empty list succeeds even in OR mode. AND/OR short-circuit in authored order. It saves/restores the current trigger context. 00689750 IDs1–14 return a Boolean in query mode. CodeLine+8 exactly1 inverts; other values do not. In script mode a false condition invokes00681D40 block skip and returns0.

Comparison codes: 0 ==, 1 >, 2 <, 3 >=, 4 <=, 5 !=. Integers are signed32. Invalid comparator is false. Float comparison uses00681A50 without epsilon. Raw status-word checks prove unordered/NaN is false for ==, >, <, >=, <= and true for !=; signed zeroes are equal. HP/mana integer conversion00747360 truncates toward zero; percentage computation multiplies by double100.0 then stores f32 before comparison.

| ID | Condition | Operand slots and native behavior |
|---|---|---|
|1|Wave|0 i32 RHS;1 i32 comparison; LHS Arena+8FF0|
|2|Object at|0 subject selector;1 named monster UID if selector4; shared location base2. Subjects0 focus,1 local player,2 any player,3 any monster,4 named monster. Details below|
|3|Has item|0 i32 inventory item ID; Game+13B8 lookup00552430 returns non-null|
|4|Flag|0 String name;1 String expected value. Missing=false. Stored string case flag selects ASCII case-insensitive or exact comparison|
|5|Counter|0 String name;1 comparison;2 RHS kind;3 number if kind0;4 String RHS counter otherwise. Missing named counter on either side=false|
|6|Game data|0 count kind:0 monsters,1 bosses,2 zombies;1 comparison;2 RHS. Globals0081984C/50/58; invalid kind=false|
|7|Player level|0 aggregation;1 comparison;2 RHS.0 primary,1 max,2 min existing players, starting with primary. Editor004D1D20 resets slot0 to0|
|8|Element|0 i32 ID equals primary stats+82C|
|9|Discipline|0 i32 ID equals primary stats+830|
|10|Skill level|0 skill ID1..82;1 comparison;2 RHS; sign-extended i16 skill+22. Invalid ID=false|
|11|Gold|0 comparison;1 RHS kind;2 number if0;3 String counter otherwise. Gold global0081A388. Missing RHS counter reads0|
|12|Health|0 comparison;1 RHS kind0 number,1 counter,2 percent;2 integer,3 String,4 f32 respectively. Primary stats+70/+74|
|13|Mana|Same as12, primary stats+7C/+80|
|14|Random|0 RHS;1 comparison;2 exclusive boundN. UI defaults0 to2 and bounds2..1000000. Runtime permits imported0 and negatives|

Native numeric editors normally allow -1000000..1000000, with random bound's special minimum2. The JSON includes extracted UI numeric ranges/callsites. Dynamic option text should come from the parent authoring catalog, not the preliminary string-tracking results.

### Object-at subject and geometry paths

006895E0:
- Focus: active thread+64/+68, else trigger+B8/+BC, else false
- Local player: active thread+60 player index, else0; missing avatar=false
- Any player: four existing avatars, short-circuit
- Any/named monster:006873C0 spatial query, with named filter requiring entity+1D0 recipe pointer and entity+1D4==slot1

00464050 scalar geometry and006873C0 monster queries are separate functions and do not support identical mode sets. Authorable condition2 calls location UI004D2370 with base2/mask1B8.

Scalar modes:0 near any player,1 near triggering player,2 anywhere,3 near explicit point,4 circle,5 rectangle,6 outside camera,7 near focus,8 within trigger geometry,9 nearby triggering player with anisotropic distance. Near-point bound is squared distance4. Explicit circle uses i32 radius squared; rectangle is lower-inclusive, upper-exclusive.

Condition2 explicit payload indices: location selector2, point4, circle center5/radius6, rectangle corners7/8. See parent shared-location catalog for exact labels/masks and other contexts.

RNG00401170 adds two lagged state words, masks to30bits, advances indices modulo55, masks word>>6 to next power-of-two range then modulo N. Negative N requests a second random sign draw. N0 returns0 without an RNG update. Do not use an unrelated host random generator when replay parity matters.

## Trigger ingress inventory

| Kind | Ingress and requirements |
|---|---|
|1 START GAME|0046B180→0068B6D0(1), after Arena setup; stock authority true|
|2 START WAVE|00465C00→batch2 after current wave increment/reset/music|
|3 END WAVE|00465C00→batch3 before increment, only old wave>0|
|4 END GAME|004633D0→batch4, after batch6 and before Game_OnGameOver|
|5 WIN GAME|Authored row exists, but no kind5 call in complete generic-dispatch xrefs. See terminal caveat|
|6 LOSE GAME|004633D0→batch6 before END GAME|
|7 STEPS ON|Round-robin list+E8/cursor+1D4; eligibility+conditions then trip|
|8 MANUAL|Explicit script/timeline/recipe TRIP or TRY; no tick lane|
|9 INTERVAL|Round-robin list+118/cursor+1DC; elapsed tick gate, reset timestamp before conditions|
|10 PRESSURE|Round-robin list+130/cursor+1E0 then active-list lifecycle|
|11 MONSTER DIES|004819D0→0068B920 after count decrement, recipe pointer non-null; focus=dead object|
|12 BOSS HP|0048A290→0068B7C0 in damage path with recipe+54 nonzero; strict threshold crossing|
|13 LEVEL UP|0067C250→0068BA90(13), local stats path after level loop|
|14 FIND SOLOMON|0048A8B0→batch14, state<3/pre-wave/slot0 same Arena and Game+1ABD==0, proximity ellipse|
|15 SOLOMON RUNS|0047D570→batch15 when escape hop rises above zero and state becomes4|

Generic0068B6D0 has seven direct code references and no data/vtable references: two wave calls, Arena-start, Solomon-run, Solomon-find, and two terminal loss/end calls.

FIND SOLOMON proximity is ((sx-px)/1.5)^2+((sy-10-py)/1.25)^2<10000. Other players can update Solomon's proximity state but do not emit14.

### Linked recipe callbacks

0068BB10: mode0/unsupported or null target does nothing. Mode1 direct trip. Mode2 runs eligibility then conditions. The focus is copied before testing, even when TRY fails. Non-null source entity supplies pending object reference and source player+5C.

Monster death recipe mode+C1/resolved pointer+C8, reference kind2.
NPC conversation start +7A/+80; conversation completion +84/+8C; removal +90/+98, reference kind32. NPC completion obeys per-player/all-player conversation completion state before calling the link.

### Pressure precision and exit ordering

Initial hold conversion is trunc(f32(seconds*tickRate)). A newly enrolled positive hold can decrement during that same controller tick's active-list pass. Stationary reset compares both focus coordinates exactly and resets to the full converted duration after the decrement.

A positive authored duration converting to0 ticks never queues primary: it enters the already-expired active state and can later queue secondary on exit. Do not clamp it to1tick.

Before the hold expires, ineligibility cancels with no scripts. At zero, primary is queued once, with consume-limit=false. At zero/negative countdown, ineligibility queues secondary with consume-limit=true, clears latch, removes active-list entry and compensates loop index. It does not recheck condition rows. Disable can cause this exit; killed prevents creation but still allows cleanup.

## Evidence, boundaries, and acceptance

Raw supplemental evidence files are recovery-trigger-supplement-{helpers,ingress,closure,instructions,edge-instructions,float,terminal}.txt; helper/caller decompiles are in trigger-supplement-functions. JSON records material function addresses and native offsets, and includes the parent-provided authoring extraction.

004633D0 has exactly two data xrefs, at00785A0C and0078C25C (Arena/Bonedit terminal vtable slot).00467A50 has only the two executor callsites. The WIN GAME automatic ingress remains an explicit caveat for the parent terminal/fade audit; there is no direct generic-dispatch route in the complete xref set. Win/lose opcodes1062/1063 both call00467A50; that function ignores the parameter and starts the same fade/music-stop path. Manual TRIP can still target kind5.

Required port checks: all14 condition rows plus invalid/inverted inputs and missing references; every automatic/event ingress; AND/OR short circuit/RNG consumption; 7/9/10 round-robin latency; countdown/hold exit; disabled-versus-killed; limited adjacent batch mutations; strict boss equality edges; primary versus source-player ownership; duplicate/missing references; no rewards in editor test execution; exact-tree Mac validation and real browser journey. This supplement itself is static recovery, not port or runtime acceptance.


## Complete action execution membership checkpoint

The machine catalog retains every action runtime row, helper decompile, instruction address and native floating constant. This checkpoint does not claim browser implementation parity. Full recipe/tool/timeline-property recovery remains open and will arrive as a later addendum.

### 1001 ECHO

Echo text using005CA7C0 with opaque white RGBA(1,1,1,1); action returns0

### 1002 SCRIPT LOGIC->SLEEP

Return trunc_f32(F0 * timingScale00820230); stock scale100. Positive return suspends current script, zero continues, negative values obey script tick sentinel rules

### 1003 WORLD COMMANDS->START NEXT WAVE

Start next wave00465C00: increment world+8FF0; reset wave/lull counters+88,+8FF4,+9000; copy previous wave+8FEC; set+902A. First wave unlocks casting; initial combat music may start; notify wave triggers

### 1004 WORLD COMMANDS->START NEXT WAVE WHEN...

004625F0 stores world+8FF8=I0. Mode0 stores trunc(max(F2,1)*ticksPerSecond) at+8FFC;mode1 storesI1;mode2 stores trunc(F2*ticksPerSecond);mode3 only changes mode and retains old threshold

### 1005 MONSTER COMMANDS->FORCE SPAWNS... / NPC COMMANDS->FORCE SPAWNS...

00462680 stores world+8F00=I0:0 dark,1 light,2 offscreen,3 exact,4 off-boneyard. The policy is applied after authored location resolution by00466200

### 1006 MONSTER COMMANDS->SPAWN CUSTOM MONSTER

00469580(world,line,null,locationBase1,0,0,0): resolve recipe, build monster00463B50, choose authored point, apply forced-placement00466200, insert into world, handle boss flags/visible summoning/combat music. Missing recipe or factory returns null

### 1007 MONSTER COMMANDS->SPAWN CUSTOM MONSTER GROUP

0046C710 resolves group and spawns each recipe in stored order via00469580 with locationBase1; group+58 optionally shares first final position among all members; restore shared-position global afterward

### 1008 ITEM COMMANDS->DROP ITEM

00469FE0 resolves recipe, creates item004699B0; resolves point then suitable drop position00645910; wraps item in pickup005E1460, inserts, records current wave in world+9064. Missing recipe/item means no drop

### 1009 TRIGGER LOGIC->DISABLE TRIGGER

00463020(1009,U0) calls Remote_DisableTrigger if target resolved; unresolved target is no-op

### 1010 TRIGGER LOGIC->ENABLE TRIGGER

00463020(1010,U0) calls Remote_EnableTrigger if target resolved; unresolved target is no-op

### 1011 TRIGGER LOGIC->TRIP TRIGGER

00463020(1011,U0) calls00689570 direct trip, bypassing TRY tests; unresolved target is no-op

### 1012 TRIGGER LOGIC->TRY TRIGGER

00463020(1012,U0) calls0068B8E0 trigger condition/repeat eligibility path; unresolved target is no-op

### 1013 TRIGGER LOGIC->DELETE TRIGGER

00463020(1013,U0) calls Remote_KillTrigger if resolved; unresolved target is no-op

### 1014 recovered-action

Hidden from add-action menu but implemented/editor-backed.004630C0 sets world+8FE8=(I0==0);0 START, nonzero STOP wave controller

### 1015 ITEM COMMANDS->DROP RANDOM ITEM

00466D20 resolves point and calls world virtual+140 with point,I0,0; records world+9064=current wave. Rarity0 ANY,1 COMMON,2 RARE,3 EPIC

### 1016 ITEM COMMANDS->DROP GOLD

00466D90 resolves point and calls world virtual+144(point,I0,0)

### 1017 ITEM COMMANDS->DROP RANDOM GOLD

00466DF0 resolves point; if endpoints differ amount=I0+RandInt(I1-I0+1,false), elseI0; calls world virtual+144. Upper bound inclusive; no endpoint normalization in wrapper

### 1018 ITEM COMMANDS->LIMIT DROPS...

00462690 stores world+8F08=I0; modeI1=0 sets level range[-9999,9999],1 sets both endpointsI2,2 usesI2/I3. Other modes preserve prior endpoints

### 1019 MONSTER COMMANDS->FORTIFY MONSTER RECIPE

00468060 chooses referenced recipe or all world recipes if none; factor=1+F2/100. It ALWAYS multiplies world defaults too, plus selected recipes. Attribute0 HP,1 four damage multipliers,2 chase speed,3 attack speed,4 XP bonus. Speed clamped to [0.10000000149011612,5]; XP0 becomes1 before multiply

### 1020 MONSTER COMMANDS->SPAWN PARTIAL MONSTER GROUP

0046C790 choosesI0 recipes from mutable random bag of group members, removes each drawn recipe, refills when exhausted, spawns through00469580 locationBase2. Empty group stops. Respects group shared-position flag. Count<=0 spawns none

### 1021 native-unused-noop

No switch handler; native dispatch points to common return0. No editor/menu implementation recovered

### 1022 native-unused-noop

No switch handler; native dispatch points to common return0. No editor/menu implementation recovered

### 1023 PLAYER COMMANDS->AUTO LEVELUP ON/OFF

Scope guardA. Set game+1ABF=(I0==1) for auto-levelup. Scope0 ALL;1 LOCAL. Trailing getterI1 read is unused

### 1024 PLAYER COMMANDS->INVENTORY BUTTON ON/OFF

Scope guardA. Set game+1AC0=(I0==1) for inventory button. Trailing getterI1 is unused

### 1025 PLAYER COMMANDS->SPELLBOOK BUTTON ON/OFF

Scope guardA. Set game+1AC1=(I0==1) for spellbook button. Trailing getterI1 is unused

### 1026 PLAYER COMMANDS->BELT BUTTONS ON/OFF

Scope guardA. Set game+1AC2=(I0==1) for belt buttons. Trailing getterI1 is unused

### 1027 PLAYER COMMANDS->PLAYER MOVING ON/OFF

Scope guardA.005C7300(game,I0==0,false) sets movement-disabled state and adjusts input channel; game+85 or globalB3BCA0 can force disabled. Trailing getterI1 unused

### 1028 PLAYER COMMANDS->PLAYER CASTING ON/OFF

Scope guardA.005C7390(game,I0==0,false) sets casting-disabled state and adjusts input channel; game+85 or globalB3BCA0 can force disabled. Trailing getterI1 unused

### 1029 PLAYER COMMANDS->INVOKE INVENTORY

Scope guardB(I0). If game+15A0==0 invoke inventory005C6F10; otherwise leave open UI unchanged. Trailing getterI0 unused

### 1030 PLAYER COMMANDS->INVOKE SPELLBOOK

Scope guardB(I0). If game+1664==0 invoke spellbook005CA640. Trailing getterI0 unused

### 1031 PLAYER COMMANDS->INVOKE SKILL PICKER

Scope guardB(I0).0067C320 increments player+44 skill picks and creates picker when player+83C absent; sets picker+78=10,+624=1. Trailing getterI0 unused

### 1032 SCRIPT LOGIC->LOOP

IfI0<1 return0 without skipping body. Otherwise00684960 scans following lines with nested-loop depth, writes matching END LOOP.I0=currentPC(first body index). This LOOP.I1=I0. Counter resides on shared CodeLine, not per execution instance

### 1033 SCRIPT LOGIC->END LOOP

IfI0-1<0 return0; fetchCodeLine(I0-1), decrement that LOOP.I1; if remaining>0 set scriptPC=I0 via00682490. END LOOP does not decrement its own I1

### 1034 PLAYER COMMANDS->INCREASE PLAYER SKILL

Scope guardB(I0) gates00660320(local player,I1,1);0065F9A0 skill-stat refresh executes even when guard skips increment. TrailingI0 read unused

### 1035 PLAYER COMMANDS->TELEPORT PLAYER

Scope guardB(I0).00466E80 resolves point/safe player position00645910, teleports game player0, shifts movement target by same delta; I1==0 adds departure and arrival effects00644A00, nonzero silent

### 1036 ITEM COMMANDS->PUT ITEM IN INVENTORY

Scope guardB(I0).00469F90 creates item004699B0 from recipeU1 then0055FF20(item,true,true), pickup audio00407B70. Missing recipe/item no-op

### 1037 ITEM COMMANDS->TAKE ITEM FROM INVENTORY

Scope guardB(I0).004632F0 finds inventory item matching recipe+14 through00552430; removes00568170, destroys it, plays audio, refreshes inventory. Missing target no-op

### 1038 SCRIPT LOGIC->CALL SCRIPT

If resolved, push current script index and already-incrementedPC onto script return stacks; set scriptPC0, current script pointerU0, script index=U0+4; update current-script globals. Missing script no-op

### 1039 NPC COMMANDS->SPAWN NPC

00466FA0 creates native NPC type5015, copies recipe subtype/owner fields, resolves location and forced spawn policy, inserts and initializes. If created and refs-kind is0 or32, set kind32 and append native entity ID; if refs-kind2 leave NPC unreferenced

### 1040 SCRIPT LOGIC->SLEEP UNTIL...

ForI0 in1..4 resolve location once into script+58/+5C; return -10000-I0. Kinds0 talk,1 dark,2 light,3 unseen,4 visible,98 lull,99 Solomon gone. Unsupported kinds<=-10000 remain stuck until external state change

### 1041 NPC COMMANDS->REFERENCE NPCs...

00687700 appends NPC refs(kind32), clearing prior set only if different nonzero kind. I0==1 chooses closest unreferenced type5015 to resolvedL1;I0==0 supports location modes2 all,3 point,4 circle,5 rect,9 player-light. Others do nothing. Deduplicate by native ID

### 1042 NPC COMMANDS->REMOVE NPCs

Requires refs-kind32.00684AB0 writes each surviving NPC+181=lowByte(I0):1 when dark,2 offscreen,3 unsummon,4 instant removal. It schedules NPC-owned behavior rather than directly destroying in this helper

### 1043 MONSTER COMMANDS->CLEAR REFERENCES / NPC COMMANDS->CLEAR REFERENCES

00681D80 frees current native-ID reference array, zeros count/pointer and refs-kind. Shared by NPC and monster menus

### 1044 NPC COMMANDS->NPCs LOOK AT...

Requires refs-kind32. ResolveL2 once even in direction mode. I0==0 derives atan2(-(targetY-y),targetX-x)*180/pi normalized by+360 when negative; otherwise usesF1. Set NPC+188 desired angle; if NPC+4!=0 also+6C; idle state+1C0=0

### 1045 NPC COMMANDS->MOVE NPCs...

Requires refs-kind32. ResolveL3 only whenI1==0 or2; per survivingNPC call005E9D50 with walk/run,I1,point,F2. Mode1 creates distant heading destination; helper sets moving flag and clips path to world bounds

### 1046 NPC COMMANDS->SET NPC IDLE BEHAVIOR

Requires refs-kind32.00684B70 sets NPC+1C0=low16(I0):0 stand,1 face player

### 1047 NPC COMMANDS->NPCs NEED HELP!

Requires refs-kind32. Per surviving NPC call005EA450(script owner playerIndex+60,I0). OperandI0 is consumed even though editor has no visible controls

### 1048 SOLOMON COMMANDS->PLACE SOLOMON DIGGING

00467230 only runs when world+902B==0 and no Solomon entity00467160. It gathers open graves(native type2029 and+142==8) selected by modes2/3/4/5/10; mode10 chooses nearest to local player/start position. Resets world+9029/global819911 and invokes00465920(list). This is a grave-selection consumer, not generic pointL0

### 1049 NPC COMMANDS->NPCs FLEE!

Requires refs-kind32.006852C0 calls005F6410(script owner playerIndex+60) on each surviving NPC

### 1050 native-unused-noop

No switch handler; native dispatch common return0. No editor/menu implementation recovered

### 1051 SYSTEM COMMANDS->DARK CODE

006824B0 splits code on '='; recognized commands unholytransform sets bit1/2/4/8 for value1..4 on all native type1008 actors;bossmegadeath sets bit16 on those actors;tutorial calls005D5CF0. Unknown commands do nothing

### 1052 MONSTER COMMANDS->MONSTER FLAIR

Requires refs-kind2(monsters).00685100 calls virtual+7C on each surviving referenced monster. No configurable operands

### 1053 MONSTER COMMANDS->REFERENCE MONSTERS...

00687B10 appends monster refs(kind2), clearing only a differing nonzero kind. Closest mode picks nearest unreferenced actor whose+14==2, THEN applies recipe filter(actor+1D0==U0) without trying second closest. Area mode2 all,3 point FALLS THROUGH circle,4 circle,5 rectangle,9 player-light. Others no-op. Deduplicate IDs

### 1054 FLAGS AND COUNTERS->SET FLAG

00687F90 upserts named String-to-String flag in script manager+26C; value is arbitrary string, not bool. Existing name replaces value; missing creates entry

### 1055 FLAGS AND COUNTERS->SET COUNTER

00688800 upserts named i32 counter in script manager+284 using replace=false/addFlag0; existing value setI1, missing initializesI1

### 1056 FLAGS AND COUNTERS->INCREMENT COUNTER

00688800(name,+1,addFlag1); existing increments, missing initializes1

### 1057 FLAGS AND COUNTERS->DECREMENT COUNTER

00688800(name,-1,addFlag1); existing decrements, missing initializes-1

### 1058 PLAYER COMMANDS->FORCE SKILL PICK

AppendI0 to local player's forced skill-pick list atplayer+85C via list virtual0. No per-player scope operand

### 1059 ITEM COMMANDS->DROP POTION

00466B50 resolvesL1 and safe drop point00645910, then world virtual+148(point,lowByte(I0)). ID map0 health,1 mana,5 rejuvenation,2 wizard chug,4 mind chug,3 antidote

### 1060 FX COMMANDS->DO EXPLOSION AT...

00466BC0 resolvesL2, calls00642BF0 using damageF0,sizeF1/100,script owner lowByte+60, fixed flags and invalid target-1

### 1061 FX COMMANDS->START FIRE AT...

00466C60 constructs world fire type2019, sets positionL3,flag+17C|=2,size+150=F1/100,damage+158=F0,duration+144=F2,ownership byte+154=1; inserts via0063F6D0

### 1062 WORLD COMMANDS->WIN LEVEL

Call00467A50(world,1). Native helper ignores argument, sets world+8E6E=1,+8E4C=float32(0.005), fades music to empty over200 native ticks(2 seconds). Same resulting helper behavior as1063

### 1063 WORLD COMMANDS->LOSE LEVEL

Call00467A50(world,0). Native helper ignores argument; identical state change to1062, despite LOSE label

### 1064 WORLD COMMANDS->CHANGE WEATHER

Store lowByte(I0) inworld+8F20:0 clear,1 rainy,2 stormy,3 snowy,4 foggy. Downstream weather owner consumes state

### 1065 WORLD COMMANDS->LOCK/UNLOCK CAMERA

00464B20(world,I0,V1,V2). I0==1 unlock restores original camera bounds+8BBC and transition value; otherwise normalizes/authors requested rect, intersects/clamps with world bounds, stores camera constraint+8E98 and interpolation endpoints

### 1066 WORLD COMMANDS->DESTROY OFF-CAMERA OBJECTS

004728B0 scans camera-border structures and world objects, removes those outside camera bounds, updates visible fence/gate construction and cleanly erases native objects. No CodeLine operands

### 1067 TIME LINE COMMANDS->START TIME LINE...

If resolved reset timeline time+84=0 and event cursor+88=0, append timeline to active listworld+9040 via virtual+10. It does not clear existing pause+8C. Missing emits Timeline not found diagnostic

### 1068 TIME LINE COMMANDS->STOP TIME LINE...

If resolved reset time+84=0,event cursor+88=0; remove from world active timeline list+9040 via virtual+1C. Does not clear pause state. Missing no-op

### 1069 TIME LINE COMMANDS->PAUSE/UNPAUSE TIME LINE...

If resolved andI0==1 set pause+8C=0. I0==0 storeslowByte(I2);reason1 sets+90=trunc(F3*100) when timeline unit+34=0(seconds),trunc(f32(F3*60)*100) whenunit1(minutes);reason3 storesI4. Other reasons preserve+90. OtherI0 no-op

### 1070 TIME LINE COMMANDS->JUMP TO LABEL...

If both resolved00647080(timeline,label+1C time): set timeline+84,time; set cursor to first eventtime>=target. No pause-state change. If no event matches function leaves oldcursor, an observable native edge case

### 1071 TIME LINE COMMANDS->JUMP TO NEXT EVENT

From current timeline eventcursor skip consecutive type4 label rows by incrementingcursor; if a next nonlabel exists call00647080 with its timestamp. Missing timeline/end-list no-op. No pause-state change

### 1072 PLAYER COMMANDS->DISABLE SKILL PICK

Set game disabled-random-skill byte array[+1868+I0]=1. No bounds check in executor

### 1073 PLAYER COMMANDS->ENABLE SKILL PICK

Set game disabled-random-skill byte array[+1868+I0]=0. No bounds check in executor

### 1074 ITEM COMMANDS->TAKE GOLD FROM INVENTORY

Scope guardB(I1).005A7C60(-I0,true) subtracts and floors global gold0081A388 at0. TrailingI1 unused

### 1075 PLAYER COMMANDS->REJUVENATE

Scope guardB(I2). Resource0/2 calls0052AC80(F0) to add raw health amount and cap atmaxHP;1/2 calls0052B150(F0,false) to add raw mana amount and clamp0..maxMana;3 calls00656F20 to zero secondary cooldowns. TrailingI2 unused

### 1076 IF/ENDIF->ENDIF

ENDIF marker has no action effect; default return0. Condition false-skip scanner00681D40 consumes it and tracks nested condition lines

### 1077 SCRIPT LOGIC->LABEL...

LABEL marker has no execution effect; default return0. GOTO scans these markers and compares S0

### 1078 SCRIPT LOGIC->GOTO

006847F0 scans current script from index0 for first opcode1077 whoseString0 matches, setsPC to label row itself; nexttick/default executes marker. Missing label echoes LABEL NOT FOUND with red color and continues

### 1079 PLAYER COMMANDS->LEVEL UP PLAYER

Scope guardB(I0).005C88F0 temporarily enables player+2C, grants(nextLevelXP-currentXP+1)*XPmultiplier through00680AB0, restores+2C. TrailingI2 allocates/reads unused operand

### 1080 PLAYER COMMANDS->XP ACCUMULATION ON/OFF

Scope guardB(I0).00656560(local player,I1==0) stores XPaccumulation flagplayer+2C. TrailingI2 unused

### 1081 PLAYER COMMANDS->GRANT XP

Scope guardB(I0).005C8880(game,float(I1),0) grantsI1*game+1AB8 XP through00680AB0. TrailingI2 unused

### 1082 MONSTER COMMANDS->SPAWN DEFAULT MONSTER

0046BB50 gathers positiveI10..operandCount-1, builds temporary recipe006400C0/0046B390(typeI0,variantI9,tweaks), custom-spawns atlocationBase2 and zeros monster+1D0 recipe identity; destroys temporary recipe. I1 unused

### 1083 SOLOMON COMMANDS->SOLOMON DRIVE-BY

004671F0 creates Solomon drive-by native type5020 only if world+902B==0 and00467160 returnsnone; initializes0047BBC0 and inserts. Existing Solomon prevents duplicate

### 1084 SOLOMON COMMANDS->RUN SOLMON AWAY

004671C0 clearsworld+902B, then if existingSolomon native type5009 setsentity+2A0=1 to run away

### 1085 SOLOMON COMMANDS->SLEEP UNTIL SOLOMON IS GONE

Return-10099 directly; identical wait predicate to1040 kind99, no location capture

### 1086 ITEM COMMANDS->DROP KEY

0046A0F0 resolvesL1 and safe drop twice, makes key native type7012, setsitem+1C=1, wraps pickup005E1460, inserts, calls004683E0. Operand0 is unused; location begins1

### 1087 ITEM COMMANDS->ENABLE/DISABLE DROPS...

00463520 ORsworld+8F04 withI1; ifI0==0 then XORI1, effectivelyclearbits(enable). Nonzero setsbits(disable)

### 1088 MONSTER COMMANDS->REMOVE UNSEEN MONSTERS

00468660(world,0) destroys monster-class actors(flags+14 &2) whose seen flag+ D4==0 usingvirtual+18; a previously-seen offscreen actor is retained

### 1089 MONSTER COMMANDS->REMOVE OFFSCREEN MONSTERS

00468660(world,1) destroys monster-class actors(flags+14 &2) whose translated actor-bounds do not overlap camera rect, usingvirtual+18

### 1090 PLAYER COMMANDS->MODIFY XP ACCUMULATION

Storegame+1AB8=1+F1/100 whenI0==0,otherwise1-F1/100. Replaces XPmultiplier; no clamping, no player-scope guard

### 1091 WORLD COMMANDS->PREVENT LULLS

IfI0==0 setworld+8E29=1 and+8E2C=trunc(F1*100); otherwise+8E29=0 and retainoldthreshold

### 1092 FX COMMANDS->OFFSCREEN MAGIC...

004687E0 resolvesL1, constructs005E4150 effectobject, sets+144=trunc(F0*100),+13C/+140=target minus screen/camera center(world+8BDC..8BE8); inserts into world

### 1093 NPC COMMANDS->CHANGE NPCS TO TARGETS...

Requires refs-kind32.00684F60 calls005E3050 for each survivingNPC; allocates enemy target native type2, copiesNPC state0052A320, inserts. Downstream conversion ownership preserved byhelper

### 1094 WORLD COMMANDS->SET MUSIC...

0 play prelude;1 dynamic pair combat/combat;2 heavycombat/boss_aggressive;3 heavycombat/boss_squirmy;4 academy;5 academyold;6 solomondarktheme. Single cues use00409CD0, pairs00409FA0; unsupportedI0 no-op

### 1095 NPC COMMANDS->CHANGE NPCS TO ALLIES...

Requires refs-kind32.00684FE0 attempts0061AA00 conversion only forNPC subtype+174==3; returnedally+21C->+24=(I2==0). I0==1 sets maxHPplayerStat+74=-9999(infinite sentinel), otherwise set current+70 andmax+74=float(I1). Conversion removes oldNPC; stale refs subsequently resolve as native IDs

### 1096 MONSTER COMMANDS->REDUCE REF'D MONSTER HP

Requires refs-kind2.00685180 multiplies each surviving referencedmonster+174(currentHP) byfloat32(1-F0/100); no clamp, no damage callback, no direct death/removal. Logs before/afterHP

