# 2026-09-05 — Lantern collision and secondary cursor placement reopening

## Reported behavior and evidence boundary

Players still cannot push the Lantern, and cursor-positioned secondary casts
(particularly keyboard-bound Magic Trap) sometimes use an old location. These
reopen the actor integration and input-to-placement boundaries of entries 013,
051, 083, 084, and 230; the existing spell damage/lifetime contracts remain intact.

The source binary is stock SolomonDark 0.72.5, 4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Preserved Windows Ghidra evidence is
`Decompiled Game/ghidra_outputs/actor_1391_1392_cluster_20260415.txt`
(`FUN_005e1120`) and the Mod Loader native class, object, secondary ability, and
input catalogs. This investigation corroborated the relevant instructions and
PE constants using offline LLVM disassembly on the Mac. It did not run a fresh
Windows Ghidra session or claim a new live-native comparison. The canonical
Ghidra project and original executable were not modified.

## Native owner and closed membership

Lantern is actor type `0x1392` (5010), allocation `0x13C`, constructor
`0x005E1120`, vtable `0x0079C854`, base constructor `0x006287D0`.
The constructor loads float32 **8.0** at `0x007849DC` into actor `+0x30`
(radius), then stores **1.0** into `+0x28` (push resistance). The base leaves
`+0x2C` push strength zero, `+0x34` immovable false, `+0x36` collision enabled,
and its final write at `0x0062895B` sets `+0x44` push enabled. Do not mistake
its earlier zero initialization for the final value. Tick `0x005FF010` renews
Region light membership; it does not drive movement. Movement and push response
belong to the shared `0x00525800` / `0x00526520` collision controller, including
float32 positions, weighted separation, epoch recursion, and terrain checks.
Inherited serialization at vtable +0x14 (`0x00622DC0`) includes actor position.
Draw `0x005E61D0` and light provider `0x005E6220` read that same actor center.

The complete Lantern integration boundary is: authored spawn; passive shared
collision body; player push, enemy separation and knockback; authoritative
position; saved position; welcome and delta snapshot replication; interpolated
sprite, painter depth, and light position; and independence from Solomon's
own exit. It is not an enemy, damage target, or independently driven actor.

Secondary placement belongs to dispatcher `0x0054CC50`, native cursor setting
`0x00B3BCF4`, and Region screen-to-world virtual +0xF8. The accepted cursor
point is view origin + logical cursor / view scale, without the primary/stick
aim torso offset. Native mouse and keyboard belt bindings feed this same
secondary action family. The preserved category-2 catalog has exactly 23 members:

| Placement family | Skill IDs and members | Change boundary |
| --- | --- | --- |
| Aimed point/area | 11 Leviathan, 27 Magic Storm, 49 Magic Circle, 50 Magic Trap, 72 Acid Rain, 74 Ether Drain, 76 Comet, 77 Turn Undead | Fresh pointer sampling for desktop belt inputs; retain each spell's geometry and limits. |
| Aim-derived | 15 Phasing, 73 Fire Wall | Same input producer; retain heading probes / perpendicular line. |
| Self/caster | 12 Planewalker, 21 Ring of Fire, 23 Firewalker, 30 Prismatic Shock, 35 Ring of Ice, 41 Earthquake, 46 Stoneskin, 51 Dampen, 54 Magic Shield, 78 Mindstar, 79 Regenerate | Preserve self/caster behavior; do not relocate to cursor. |
| Native special placement | 45 Raise Golem, 48 Teleport | Preserve facing-relative collision-adjusted spawn / shuffled safety lattice; neither becomes cursor-placed. |

## Verified causes and implementation

- Lantern position exists in server state but no Lantern body enters the shared
  motion solver. Snapshots omit its position, while art, painter depth, and light
  retain the authored coordinate. Adding a hitbox alone would leave an invisible
  moved collider and stationary light. The shared actor solver now includes the
  passive Lantern, and its resulting center travels through saves, snapshots,
  interpolation, painter depth, sprite position, and the existing light provider.
- Browser mousemove discards idle cursor movement. Keyboard quickbar presses
  publish the previous aim, and frame sampling only reprojects held mouse belt
  inputs. A keyboard cast can therefore use a stale point, including after camera
  motion or resize. The input owner now retains idle screen coordinates without
  issuing gameplay input and samples desktop mouse/keyboard casts consistently.
- Controller and touch ownership, blocked/blur release, secondary-at-mouse-off,
  primary aim, and non-cursor spell branches must not regress. No spell-local
  Magic Trap offset, random placement correction, or alternate collision solver.

## Integration with current main

The draft based on `530b7d2a` was transferred into an isolated worktree at
`01f07fde`, preserving the intervening Harden, status, save, and rendering work.
Protocol **122** requires the nullable authoritative `lanternPosition` in both
welcome snapshots and delta frames. The saved world already contains the field,
so this change does not introduce a new save schema or migration.

Lantern collision and knockback membership remain in
`boneyard-world-placement.ts`; simulation state and tick ordering remain in
`boneyard-world.ts`. Authored scenery-target construction moved together with its
native radius selector into the placement module to keep the world file under
1,000 lines. The geometry and target flags are unchanged. Renderer coordinates
use the Sprite's existing native pivot offset, avoiding repeated offset arithmetic.
Duplicate DOM diagnostics from the draft were removed; browser acceptance reads
the renderer's existing frame diagnostics.

| Integration member | Disposition | Verification |
| --- | --- | --- |
| Player movement and terrain-constrained Lantern pushing | exact-ported | straight/diagonal movement and authored-wall regressions |
| Player knockback and non-pushing enemy separation | exact-ported | both shared collision entrypoints |
| Lantern lifetime independent of Solomon | exact-ported | painter and null/position timeline transitions |
| Save, welcome snapshot, delta frame, and interpolation | exact-ported | moved-position round trips and immutable previous snapshots |
| Sprite, painter depth, and Region light center | exact-ported | production-browser keyboard push and rendered-position checks |
| Desktop cursor placement and mouse-position setting | exact-ported | keyboard/mouse, idle cursor, camera movement, viewport changes, blur/block |
| Touch/controller and the 23 secondary placement families | verified-already-at-parity | existing input and secondary-ability suites; unchanged spell-specific geometry |

The stock executable was re-hashed during this verification and matches the
identity above. The preserved constructor extract still shows `+0x30` loaded
from `0x007849DC` and `+0x28 = 0x3F800000`. This pass makes no additional
live-native claim.

## Verification

Nine targeted regressions failed against the deployed `01f07fde` before the
patch: three Lantern movement/wall cases and six keyboard-cursor cases. The
initial integrated candidate passed 149 focused input, world, presentation,
replication, painter, and save tests.

### Final Mac receipt

The candidate was rebased onto `84e32576` after the website-copy change reached
main. All 24 changed-file hashes matched between the local and Mac worktrees.
The full `/opt/homebrew/bin/bash ./scripts/validate.sh` passed on that base:
backend build/integration contracts, formatting, frontend lint/types and test
suites, desktop tests, production build, bundle budget, and media policy. The
game entry was 252,770 raw bytes / 76,591 gzip bytes. The final focused run
passed **153 tests** including the added knockback and lifetime transitions.

The production-build browser command was:

```sh
SDR_SECONDARY_ABILITY_SCENE=boneyard \
SDR_SECONDARY_ABILITY_ID=49,50 \
SDR_SECONDARY_ABILITY_PRODUCTION=1 \
SDR_LANTERN_CURSOR_ACCEPTANCE=1 \
node --experimental-strip-types tools/smoke-secondary-abilities.mjs
```

It entered through the normal menus, opened native Boneyard combat, and used
keyboard movement to push the authored Lantern. The selected spawn has ten
clear units before terrain blocks further travel; the browser exercises one
native radius (eight units), while the world regressions cover displacement
greater than 40 units and stopping at an authored wall.

The Lantern moved from `(866.104980, 2239.613037)` to
`(876.479891, 2239.271023)`. Its rendered sprite and Region light reported the
same final center, with positive light intensity `0.578472`. Before/after
captures were inspected. Magic Trap keyboard placement at 1600x900 and 800x450,
stationary-pointer camera movement, Magic Circle at 1200x700, and right-mouse
Trap placement all passed. Maximum measured error was `0.985346` world units
under the two-unit sampling bound; integer pointer positions matched exactly.
The normal Magic Circle and Magic Trap lifecycle/audio/presentation checks
also passed. Page, console, and failed-response arrays were empty.

An additional all-spell journey missed the brief Firewalker flash. Firewalker
passed when run independently with the same production build and no page,
console, or response errors. This receipt certifies the targeted browser
journey; it does not claim that the full all-spell sequence passed.

### Quality measurements and limits

Oxlint with maximum cyclomatic complexity **21** passed `gameplay-input.ts`,
`boneyard-world-placement.ts`, and `boneyard-solomon-render.ts`, with no warnings
or errors. Aim projection has its own private routine within the input owner;
the previous combined sampler measured 33. Those files contain no explicit
`any` or `unknown`. Their lengths are 419, 599, and 175 lines; the world-tick
file is 956 lines. No dependency, compatibility alias, or runtime feature flag
was added. The new Lantern settings remain private to their collision owner.

V8 coverage from the 153 focused tests:

| File | Lines | Branches | Functions |
| --- | ---: | ---: | ---: |
| `boneyard-world-placement.ts` | 96.99% | 93.91% | 96.00% |
| `gameplay-input.ts` | 97.61% | 85.33% | 95.12% |
| `boneyard-solomon-render.ts` | 100.00% | 95.00% | 100.00% |

These measurements do not meet a blanket 100% coverage claim. Statement
coverage, cognitive complexity, Halstead Difficulty, CRAP, mutation, general
dead-code, and duplication analysis remain unmeasured: their analyzers are not
configured/available. Existing presentation-timeline, renderer, and protocol
integration files remain above 1,000 lines (1,257 / 4,703 / 12,669); this change
does not certify those larger files against the file-size gate. No exclusions,
analyzer dependencies, or suppression comments were introduced to hide limits.
