# 2026-08-26 — Post-Game-Over player-generation and carried-state reset correction

## Reported smell and parity question

- Reported web behavior: after Game Over and Hub return, a wizard can retain items
  or learned skills; the issue was observed after the stock Tutorial.
- Deterministic authority repro on macOS: Tutorial Acid Rain remained rank 1
  with quickbar `[72,null,...]` after the terminal transition. The ordinary
  completed Game Over profile also packed Hat, Robe, Staff, Health Potion, and Mana Potion
  into retained storage.
- Parity question: which state belongs to the dead player generation, which
  profile state survives, and which Tutorial/normal/multiplayer branches share
  the reset owner?

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions | 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; read-only Ghidra replica; `0x005D0290` | Both callers (`Create::Tick 0x0058A820` and startup owner `0x005D07D0`) finalize a new selection by granting only the chosen element/root/starting pair, all roots `0..7`, then starter construction `0x005CFA80`. | high |
| Durable native class evidence | `native-class-loadouts.md`; constructors `0x006594E0/0x00674EE0` | Every one of the 15 choices begins level 1, XP 0, only its starting non-root pair learned, fresh selected skills/quickbar, three starter wearables, and two potions. | high |
| Retail archival instructions | `0x005C9670 -> 0x005BE320`; raw `SETZ` at `0x005C9696..0x005C96A2` | Retail moves ordinary carried inventory/equipment into a Luthacus Sack when the consumed-corpse byte is clear; Last Word independently sweeps eligible ground Sacks/Gold. This is profile archival, not active inventory inheritance. | high |
| Web authority repro | exact `ec9c16c0` macOS simulation | `enterPostRunLoadout` restored only the Tutorial economy baseline, while `replacePlayerLoadout` called `reselectPlayerLoadout` on the old book and progression. Completed Game Over always requested carried-item transfer. | high |
| Tutorial item falsifier | same macOS seam with a real Tutorial amulet pickup/equip | The amulet already resets to no equipped amulet, fresh potions, and empty storage. The item defect is not the Tutorial economy snapshot itself; monotonic reset revision remains required for reliable replication. | high |

## System boundary and membership inventory

Native/web system: terminal run archival, post-Game-Over Create confirmation, and
construction of the next participant generation.

| Member/branch | Native source | Disposition | Required result |
| --- | --- | --- | --- |
| Tutorial-only amulet, potion, Gold, and active equipment/backpack | disposable Tutorial actor plus new-player starter `0x005CFA80` | `verified-already-at-parity`, with replication hardening | restore the pre-Tutorial durable economy, mark Tutorial complete, and publish a strictly newer economy revision |
| Tutorial Acid Rain, granted choices, level/XP, pending offers, and quickbar | fresh `Skills`/`Skills_Wizard` constructors and `0x005D0290` | `exact-ported` | none cross College/Create confirmation into the new wizard |
| normal Boneyard learned ranks/order, level/XP, pending/deferred offers, selected primary/concentrations, advanced unlocks, and quickbar | same new generation | `exact-ported` | rebuild from the newly confirmed element/discipline at native fresh defaults |
| active equipment/backpack after Game Over | `0x005CFA80` | `verified-already-at-parity` | fresh Hat/Robe/Staff and two starter potions only |
| ordinary carried-item Luthacus Sack | `0x005C9670 -> 0x005BE320` ordinary-transfer branch | `out-of-system` by explicit Website product direction | do not retain the completed run's carried equipment/backpack in web storage |
| Last Word ground Sack/Gold sweep | progression `+0x7D8`, Arena actor scan | `verified-already-at-parity` | retain this explicit purchased recovery perk; it does not preserve carried inventory |
| pre-existing Luthacus storage, Gold, Hagatha perks/runtime, Unforge bonuses, tutorial/College flags | durable profile owner | `verified-already-at-parity` | survive the generation reset without becoming active run loadout |
| retained element/discipline focus and wizard display name | Create owner fields and participant config | `exact-ported` | preselect the prior pair/name; confirmation may choose a different pair |
| solo, multiplayer all-ready barrier, disconnect during loadout | participant-owned host lifecycle | `exact-ported` | reset each confirmed participant once; final confirmation alone merges the party into Hub |
| Game Over profile checkpoint and later restore | profile-only save owner | `exact-ported` | no completed-run carried items or skill continuation can reappear after reload |
| voluntary run retirement, explicit Kill Wizard, active-run rejoin | separate lifecycle owners | `out-of-system` | unchanged; this correction is terminal Game Over only |

There are no browser-platform blocks. The one deliberate stock difference is
the user-directed removal of retail's ordinary carried-item Luthacus archive.

## Corrected ownership and implementation consequence

The previous pass reset combat/runtime components but reused the same player
skill book and progression, then called `reselectPlayerLoadout`. That treated a
new Create generation as a run respawn. The correct owner is post-Game-Over Create
confirmation: after validating that participant's one-shot selection, authority
draws a fresh offer seed and replaces level/XP, skill book, stat book, runtime,
offers, selections, and quickbar from the selected native starting tuple while
preserving only durable Hagatha runtime/profile state. The replacement revision
must be greater than the completed Game Over generation's revision. Individual
death is not this boundary: a dying or spectating multiplayer participant keeps
the same progression, skills, active inventory, and equipment while another
eligible participant keeps the run alive.

Completed-run economy archival must set ordinary carried transfer false. It
still creates the fresh active starter inventory, preserves existing durable
storage/profile fields, and includes only Last Word's independently eligible
ground items/Gold. Tutorial baseline restoration likewise advances from the
live Tutorial economy revision so entity replication cannot reuse an older
inventory baseline.

No protocol or save-schema shape changes: the current protocol and save schema
15 already carry the required components. Regression coverage must exercise
Tutorial, ordinary solo, multiplayer distinct selections, Last Word, profile
checkpoint/restore, and a second Boneyard. Browser proof must finish Tutorial,
complete College/Create, open Inventory and Skill Book in Hub, and show no
Tutorial amulet/Acid Rain or learned run rank while retaining only fresh
starter inventory and the selected starting skills.

## Implementation validation receipt

- `player-entity-store.ts` now replaces the accepted post-Game-Over participant
  with a fresh selected skill/stat/progression/runtime generation and a new
  host RNG offer seed while preserving durable Hagatha runtime. The previous
  progression revision is advanced, not reset or reconstructed by a client.
- `game-simulation.ts` disables ordinary carried-item transfer only for
  terminal Game Over, retains Last Word ground recovery and pre-existing
  storage/profile state, and gives completed Tutorial economy restoration a
  revision strictly newer than both the baseline and disposable live economy.
  Explicit Kill Wizard retirement keeps its separate archival policy.
- Focused macOS type and authority coverage passed `149/149` across the player
  store, Tutorial integration, complete simulation, save checkpoint, and host
  lifecycle. It covers an equipped Tutorial amulet, Tutorial level/Acid Rain,
  distinct multiplayer learned ranks, new offer seeds, Hagatha runtime,
  Last Word ground recovery, pre-existing storage, profile-only Game Over save,
  all-ready loadout, and second-run reset.
- The exact rebased Website code candidate `37f63f1b` passed the complete
  macOS `./scripts/validate.sh` gate. Its production entry remained inside the
  bundle budget at `477699` raw / `133914` gzip bytes, and the deployment media
  policy passed. The complete log SHA-256 is
  `d8b161ea0cd3b1c295fbe91a3dfaafdb4eb8491cbb69573deb58da1787eea03c`.
- Mac Chrome `151.0.7922.174` completed the real Tutorial on stock and mobile
  College branches plus both responsive siblings. After Office/Create, the
  rendered Inventory and Skill Book showed level 1, Air primary 24/secondary
  27, Acid Rain rank 0, no amulet, only Health/Mana starter potions, and zero
  storage; page, console, and failed-response arrays were empty. The browser
  log SHA-256 is
  `b1079a2e30b0b39f1020315fdf7dfe70fdcf578442f5205b6c736b4c051001bd`.
- The separate real two-client death/Game Over journey returned both players
  through independent Create choices. Water/Mind and Earth/Body each arrived
  level 1 / XP 0 with only their starting pair, two starter potions, and zero
  retained storage; both console/page-error arrays were empty. Its log SHA-256
  is `e3f33dc847822e0ffa863af94f2013f8f0cacae9caaad3067aaeed2c2db35b4d`.
- Mod Loader candidate `a0dab00f` passed `509/509` static RE contracts; log
  SHA-256 `e2240059e30ea4c05ce64281119c43c4359d5fbbfde59c91890ffaeb7d9b1a19`.
  Protocol 82 and save schema 15 retain their existing shapes. No material
  unknown or browser-platform block remains; ordinary carried-item archival is
  the single explicit user-directed difference from retail.
