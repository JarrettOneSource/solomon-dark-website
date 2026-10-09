# 2026-08-22 — Enemy status-scalar reset and temporary-control lifecycle reopening

## 2026-10-09 — Report 09: target destruction retires the whole status aggregate

The earlier closure recovered expiry and scalar restoration but skipped the
owning target's destruction boundary. The new coffin-rush continuation from
message `1557818479359426620` contains 1,041 target-effect records; 1,016 refer
to absent owners, with 824 FrostBurn records and a maximum remaining clock of
953,551 ticks. The original schema-50 save SHA-256 is
`ce91c6ea7db665c779c6b9bcced2df025e38042ecc47a67a90976410c5897602`.
Full-quality idle and held-Frost-Jet browser probes did not reproduce the
reported lag. Retained absent-target work is independently demonstrated; this
entry does not claim the reporter's exact lag cause is reproduced.

### Fresh native evidence

Bounded read-only LLVM disassembly ran on M5 `/Volumes/Drive` using retail
0.72.5, preferred image base `00400000`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
There is no new native runtime recording and no native behavior change.

- Shared modifier application `00625680` iterates the target/Puppet manager
  at `+104`, its count at `+10C`, and calls modifier slot `+1C`.
- Badguy deleting destructor `00478DA0` calls shared Puppet destructor
  `006289F0` at `00478DE5`. Maggot deleting destructor `004804B0` calls
  `0047E330`, which reaches the same Puppet destructor at `0047E3F0`.
- `00628A34..00628A78` destroys the manager's reference array at `+118`.
  The array destructor invokes element release `0045ADA0` for every element;
  `0045ADA9..0045ADC2` decrements the reference count and calls the object's
  virtual deleting destructor on final release. No modifier clock, actor
  combat flag, or target health gates this destruction.
- FrostBurn constructor `00623AE0` installs vtable `0079E5B8` and native type
  `1B78`. Its deletion slot is the common `00448DD0`; its callbacks remain
  `006278B0` (tick), `00623950` (apply), and `00627690` (merge). Long FrostBurn
  clocks are legitimate while their owner exists and do not justify a cap.

Instruction evidence establishes target-owned lifetime with high confidence.
The Web equivalent is actual canonical actor membership, not combat-query
eligibility: `boneyardNativeSecondaryTarget` excludes retained dying actors,
inactive/emerging Maggots and non-hostile actor phases.

### System boundary and complete membership

The repair owns the detached `NativeSecondarySimulationState.targetEffects`
aggregate's attachment lifetime. It does not change status clocks, scalar
composition, effect strength, target admission, particles, or actor retirement.

| Member | Disposition / focused proof | Lifetime proof / intended regression |
| --- | --- | --- |
| ColdSlow, CircleSlow, Stun, Dazzle, Frozen | exact-ported | Each aggregate member retained for its real owner, removed with absent owner |
| FrostBurn, ElectricBurn, Steamed, Prismatic | exact-ported | Same membership; no orphan damage, RNG or presentation callbacks; last live tick unchanged |
| Dampen disruption, Turn Undead flee, permanent weaken | exact-ported | Shared aggregate ownership; permanent weaken retained indefinitely for an existing owner |
| Skeleton, SkeletonArcher, SkeletonMage, Imp, Zombie, Wraith, Demon, Coffin | exact-ported | Every ordinary family is a canonical `enemies.actors` row |
| Spider, Cocoon, Portal, Heartmonger, DireFaculty, DemonSkull | exact-ported | All six later families use that same canonical owner inventory, including boss variants |
| Maggot, both launch trajectories and active/emerging/dying phases | exact-ported | Canonical `enemies.maggots`; combat eligibility never determines ownership |
| Current world, removed world, coincident numeric IDs in different worlds | exact-ported | Both world key and target ID identify the owner |
| Saved continuation, party detach/rejoin, same-tick retirement/capture, world teardown | exact-ported | Reconcile actual authoritative owners without shortening retained statuses |
| Burn and EtherBurn | verified-already-at-parity for absence cleanup | Separate actor owners explicitly retire when their target lookup is absent; existing lifetimes unchanged |
| Poisoned, Webbed, native knockback/pushback | out-of-system | Stored on canonical actor/player/force owners rather than this detached aggregate |
| StoneSkin, Planewalker and player control | out-of-system | Player-owned status state has its own lifetime boundary |
| Scenery, projectile/silk IDs, boss appendage/tail/wisp presentation | out-of-system | Producer census creates no detached target-effect identity for these; effects use their canonical enemy owner |
| Staff Disabling Hit | out-of-system | Permanent actor-owned fields, not this detached aggregate |

The 18-class historical modifier catalog is a read-only census lead, not a
new maintained Mod Loader output. Primary status producers resolve
`primaryTargetRows` / `boneyardSpellTargetById` from actors and Maggots;
secondary producers use `boneyardNativeSecondaryTargets`; Staff parses only
`enemy:` IDs. Other primary scenery, projectile and silk rows remain separate.
No authored timing or visual tables change and no browser constraint applies.

### Implementation and acceptance contract

The implementation uses complete world/target membership, independent of alive/combat flags, before
status stepping. Preserve source-order callbacks and the last timed tick.
Reconcile again after combat before publishing the authoritative state because
player death removes its Cocoon after the secondary step. Ether Drain capture
retains its dying target until the next world retirement and must retain that
target's statuses in between. Direct party-player removal also destroys owned
Cocoons and reconciles their status records before returning. Keep permanent
weakening for a retained owner, and let existing world teardown clear status
state. Save/rejoin must retain valid records and heal absent-owner legacy data
before the first restored snapshot, with no clock or RNG advance.

Focused tests cover every aggregate member, every enemy family and Maggot,
retained noncombat/dying/emerging owners, expired versus absent owners, cross-
world identity, save continuation, party rejoin and same-tick destruction.
The parent coordinates the unchanged canonical gate and built original-save
browser comparison. Those combined acceptance stages remain pending.

### Focused implementation receipt

- The two new kernel lifetime regressions failed on unchanged runtime source
  (M5 job `job_20261009T015546Z_a759bdc1d9`). After implementation the complete
  secondary-kernel, world-adapter, game-simulation and save-document suites
  passed **439/439**, with no failed, skipped or cancelled tests, in
  `job_20261009T020754Z_981f33524a` at `2026-10-09T02:08:02Z`.
  Full test typechecking (`tsc -p tsconfig.test.json --noEmit`) passed in
  `job_20261009T021035Z_786aa13ffb` at `2026-10-09T02:10:48Z`.
- Per-member tests cover all 12 modifier/status members in the detached aggregate and
  every one of the 14 ordinary actor family tokens. Real host tests cover
  inactive/emerging/dying Maggots, retained Demon death, immediate Skeleton
  retirement, parent-Coffin loss, permanent weakening, cross-world identity,
  save restore before snapshot, party detach/rejoin, Hub teardown and both
  direct-leave and active-party death-burst Cocoon cleanup. Existing Ether
  Drain tests now prove statuses persist during capture's retained dying tick
  and disappear on actual retirement, including saved continuation.
- The original save restores to **25** valid records before a tick, preserving
  all 75 ordinary actors and 120 Maggots. Four fixed-source 1,000-tick traces
  finish with 21 valid records, 70 ordinary actors, 120 Maggots and HP386.
  Every full-state SHA-256 after masking absent-target records equals the
  pre-repair baseline:
  `124791aadcb3efa1ef53d0d61360dd071e25f4f78344321b7cbfc67c298b0de4`.
  This compares all remaining gameplay state, not selected counters.
- The actual candidate's four elapsed samples were 746.917, 955.414, 971.337
  and 939.139 ms; the preserved unmodified-source samples were 1266.54 and
  1517.10 ms. These are bounded M5 workload measurements, not proof of the
  reporter's exact lag or a general FPS guarantee. Final status JSON shrank
  from the baseline's 597,940 bytes to **11,874 bytes**. Network compression
  means JSON size is not a claim about wire bandwidth.
- Native raw evidence is task-owned under M5
  `report09-lag-sh9aksle/evidence/status-lifetime`; focused test logs and
  `status-lifetime-fixed-diagnostic.json` are outside Git. The original save,
  baseline profiling and task-only probes remain unchanged and untracked.
  No schema bump, duration cap, particle suppression or native binary change
  is required. Publication, combined canonical gate and built-browser proof
  are coordinated separately; this receipt alone does not claim deployment.

## Reported smell and parity question

- Reported web behavior: Frost Jet can leave enemies frozen permanently.
  Lightning Stun may exhibit the same behavior.
- Stock behavior to recover: temporary enemy control must affect only the
  modifier's live ticks and must restore the target's authored movement,
  action, and damage values on expiry.
- Reproduction: spawn one ordinary Boneyard enemy, apply one tick of Frozen,
  then step with no effect. Before correction its stored `baseSpeed` and
  `attackSpeed` change from nonzero values to zero and remain zero. The same
  isolated trace leaves ColdSlow/Stun at half speed, Dazzle at its first ramp
  fraction, and Turn Undead damage at its already-scaled value after the
  effect input is removed.
- Membership rescan: the same aggregate currently aliases Magic Circle's
  `Mod_CircleSlow` to `Mod_ColdSlow`, omits ColdSlow material on base Frost Jet
  and Cold Aura, and selects the minimum of simultaneous ColdSlow/Frozen/Stun/
  Dazzle factors. Native keeps separate modifier instances and multiplies
  their current factors from a fresh scalar.
- Falsifiers: an effect record surviving the trace, a continued primary
  channel, a client-only stale snapshot, or stock rewriting its authored base
  speed would disprove the leading cause. The isolated host trace and native
reset instructions disprove all four.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | pinned retail `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `0x00625680` | Each live tick resets actor `+0x120` to `1.0f`, clears transient modifier state, then invokes every target-owned modifier's apply slot `+0x1C`. | high |
| Instructions | ColdSlow `0x00623080/0x00628000`; CircleSlow/Stun `0x006231B0`, Stun merge `0x00625850`; Frozen `0x006236E0/0x00623730/0x00626620`; Dazzle `0x00623490/0x006263D0` | Slow/freeze/stun/dazzle multiply the fresh current-tick scalar and own bounded clocks/merges; none mutates an authored enemy speed table. | high |
| Instructions | Badguy tick `0x004835F0`; movement `0x004763E0/0x00476B90`; Turn Undead `0x00647EF0` | Zero scalar suspends the current hostile tick; nonzero movement consumes the scalar. Turn Undead weakens once at its untouched flee sentinel, not once per update. | high |
| Web host repro | `boneyard-enemy-store.ts` on pre-correction base `d2ed2c31`; Node 22.17.0 isolated store trace | The old tick-effect helper multiplied immutable `config` fields and the returned actor persisted that clone. Frozen produced permanent zero; ColdSlow/Stun/Dazzle and Weaken permanently compounded or retained scaled authored values. | high |
| Web source census | target-effect producers in `boneyard-spell-combat.ts`, `native-secondary-abilities.ts`, `player-staff-combat-system.ts`; consumer `boneyard-enemy-store.ts` | One shared consumer defect reaches all ordinary Boneyard families and every listed control producer. Maggots already compose the scalar directly into the current movement/damage operation without rewriting stored state. | high |

## System boundary and membership inventory

Native system: the target-owned temporary modifier manager and the Website
enemy-store consumer that composes current-tick movement/action/damage scalars
without changing immutable authored enemy configuration.

| Member | Native/Web source | Disposition | Proof |
| --- | --- | --- | --- |
| Frozen — Ring of Ice `35`, Call Comet `76` FreezeWave | `0x005FFDC0`, `0x006236E0/0x00623730`; `freeze-wave` | exact-ported | full stop, thaw ramp, expiry restoration tests plus live Ring-of-Ice receipt |
| ColdSlow — Frost Jet `32`, Cold Aura `37`, Frost Missile `1001`, Blizzard Beam `1004`, Hailstones `1008` | `0x00543860`, `Mod_ColdSlow 0x1B69`; primary/weld contact producers | exact-ported | bounded/material-owning slow, composition tests, and live Frost Jet expiry |
| CircleSlow — Magic Circle `49` | `0x005FB020`, `Mod_CircleSlow 0x1B70`; `magic-circle` | exact-ported | separate refreshed 20-tick scalar and cold-material expiry regression |
| Stun — Lightning `24`, Flame Lash `1003`, Blizzard Beam `1004` | `0x0053F9C0`, `Mod_Stun 0x1B6A`; Air/weld channel producers | exact-ported | fixed/merged clock, multiplicative composition, and live Lightning expiry |
| ElectricBurn-delivered Stun — Magic Trap Air `50`, Ball Lightning `1002`, Ground Spark `1009` | `Mod_ElectricBurn 0x1B6B`; burn tick to `Mod_Stun` | exact-ported | repeated 25-tick refresh without exponential decay |
| Dazzle — Ring of Fire `21`, Magic Shield `54`, Mindblast, staff Knockback, Flash response | `Shockwave 0x005FF8C0`, `Mod_Dazzle 0x1B6E`; shared dazzle state | exact-ported | recovery ramp, multiplicative composition, and immutable-config sweep |
| Turn Undead weaken/flee `77` | `0x00647EF0`; persistent `weakenFactor`, bounded `fleeTicks` | weaken verified; flee reopened by Report 82 in entry 273 | preserve one fixed weaken factor; replace flee timer on recast and recover cast-to-vector handoff |
| Skeleton, Archer, Mage, Imp, Zombie, Wraith, Demon, Coffin | common Badguy modifier/reset path; Website ordinary actor loop | exact-ported | five scalar classes across every family without config drift |
| Coffin-owned Maggot | common native actor modifier path; Website `stepMaggots` | verified-already-at-parity | direct current-step scalar/damage composition; no stored rewrite |
| Burn, EtherBurn, FrostBurn, Poisoned, Prismatic, Steamed | non-scalar modifier callbacks and Website target effects | verified-already-at-parity | source census shows no authored-config mutation |
| Knockback, Pushback, Dampen disruption | position/action branches, not base-stat multipliers | verified-already-at-parity | separate position/action ownership remains unchanged |
| Flee steering | `0x004763E0/0x00476B90`; Turn Undead producer `0x00647EF0` | recovered-pending-port in entry 273 | earlier closure skipped cast heading and unrouted native vectors; Report 82 reopens the full owning branch |
| Staff Disabling Hit | stock one-time permanent target mutation | out-of-system — permanence is authored behavior | existing permanent-composition tests |
| Webbed/Spider/Cocoon | `Mod_Webbed 0x1B79`; native survival Spider family | exact-ported in the [2026-09-05 reopening](091-complete-enemy-animation-and-enemy-projectile-vfx-closure-2026-08-15.md) | All severities, movement/turn restraint, Cocoon damage, and owner cleanup; the story-only exclusion was false. |
| Player ColdSlow/Dazzle | player modifier/progression lane | out-of-system — separate `player-combat.ts` owner | existing countdown and restoration tests |

## Native ownership thread and recovered behavioral contract

- Common actor construction seeds the scalar, but `0x00625680` owns its
  repeated reset. It walks the target's modifier manager in stable list order;
  each active modifier contributes to the fresh scalar for that tick.
- `Badguy::Tick` and its movement/action consumers read the composed scalar.
  Expiry removes the modifier contribution; no inverse multiplication or base
  stat repair exists or is needed.
- ColdSlow/CircleSlow/Stun merge maximum remaining duration and minimum factor.
  Those merge rules are same-class only. Distinct live modifier classes remain
  separate target-owned list members and multiply their factors; Dazzle's ramp
  multiplies the already-composed scalar. Every ColdSlow applies cyan material,
  while CircleSlow shares Stun's scalar-only callback and owns no material.
  Frozen owns its final-200-tick `+0.005` thaw ramp. Dazzle advances from
  `1/duration` to one. Turn Undead applies its weaken factor once and only
  refreshes flee on later casts.
- Website effect clocks and merge rules already expire correctly. The defect
  is downstream: the ordinary actor consumer materializes a scaled `config`
  clone and stores it as the next authoritative actor. Maggots use the correct
  transient pattern.

## Nearby-system findings

- Enemy spawn `config` is also the immutable replicated descriptor source.
  Persisting a status-scaled clone violates both gameplay restoration and the
  descriptor/dynamic-sample boundary.
- Staff Disabling Hit is intentionally cumulative and permanent in stock; it
  remains in the explicit `staffActionFactor`/`staffMovementFactor` lane and
  must not be swept into temporary modifier restoration.
- Durable native report updated:
  `Mod Loader/docs/reverse-engineering/native-movement-and-tick.md`.

## Confidence and open questions

- Confirmed: native reset/apply order, all scalar-writing modifier subclasses,
  every current Website producer, all nine survival enemy families, timer
  expiry, and the host-side persistence repro.
- Inferred: none material.
- Unknown: none. The browser host can represent the fixed-tick reset exactly;
  no member is blocked by platform constraints.

## Web implementation consequence

- Keep authored `BoneyardEnemyActor.config` immutable. A temporary effect may
  provide a current-tick actor view to movement/action/contact logic, but the
  returned store must retain the unmodified source config.
- Preserve the existing merge clocks, Frost thaw material/timing, Dazzle ramp,
  effect replication, Maggot path, and intentionally permanent staff-disable
  factors. Do not add inverse repairs, expiry callbacks, fallback base speeds,
  or spell-specific release patches.
- Split CircleSlow from ColdSlow state and clocks, mark every actual ColdSlow
  producer as material-owning, and derive the current scalar by multiplying
  active class factors. Replicate the newly authoritative CircleSlow state;
  do not infer it from a nearby Magic Circle on clients.

## Validation contract

- Add the original deterministic Frozen expiry repro and a Stun active/expiry
  trace at the real enemy-store seam.
- Sweep ColdSlow, Frozen, Stun, Dazzle, and Weaken across all eight ordinary
  families, proving that active ticks never rewrite `config` and expiry needs
  no repair. Retain Maggot transient-scalar coverage.
- Retain producer contracts for every primary, weld, secondary, equipment,
  staff, and target-effect member above; run the canonical Website gate.
- Browser: cast Frost Jet and Lightning Stun against live Boneyard enemies,
  release each channel, wait beyond its modifier clock, and prove movement
  resumes with no page, console, protocol, asset, or WebGL errors.

## Implementation validation receipt

- The host now treats scaled enemy config as a current-tick view and restores
  the same authored config object at the store boundary. There is no inverse
  repair, fallback speed, or spell-specific expiry callback.
- `NativeSecondaryTargetEffectState` now keeps CircleSlow separate from
  ColdSlow, derives the complete scalar by float32 multiplication across live
  ColdSlow/CircleSlow/Frozen/Stun/Dazzle factors in retained attachment order,
  and makes every real ColdSlow producer own its cyan material. Strict protocol
  56 carries the two CircleSlow fields, bounded order, and composed scalar.
- Focused status, primary/weld producer, enemy-family, secondary, and protocol
  coverage passed `202/202`. The eight-family matrix exercises ColdSlow,
  CircleSlow, Frozen, Stun, Dazzle, and Weaken on first, refreshed, and expired
  ticks; dedicated assertions prove Frozen stop/recovery, half-speed Stun then
  full progress, fixed Turn Undead damage, modifier multiplication, and
  ColdSlow material clearing while CircleSlow remains.
- The exact integrated Mac tree based on `db3c1f4f` passed the canonical
  Website gate with `16/16` backend contracts, `4/4` library, `43/43` loot,
  `233/233` prerequisites, `1337/1337` broad runtime, `9/9` weather, `42/42`
  party, `11/11` level-up, `7/7` diagnostics, `17/17` Hall, `21/21` Hub UI,
  and `5/5` desktop tests, plus backend build/formatting, lint/import
  boundaries, production frontend/game-host builds, media policy, and bundle
  budget (`416581` raw / `116674` gzip bytes).
- The same Mac ran the Loader's complete static RE suite under Homebrew Python
  3.12 with Pillow: `504/504`. Apple system Python was rejected as evidence
  because it lacks the required language/library features.
- Hardware Chrome `151.0.7922.170` used WebGL2 and real browser input against
  one live Skeleton. Frost Jet published `coldSlowTicks=25`, factor `.5`, and
  cyan material with modifier order `[cold-slow]`; max-rank Lightning published
  `stunTicks=25`, factor zero, and order `[stun]`. After release, both effects
  disappeared and the same actor moved `1.1366355419158936` units with authored
  config unchanged. The sibling
  maximum Ring-of-Ice journey also retained Frozen `1210`, FrostBurn `121000`,
  204 ring primitives, and exact target ownership. Page, console, HTTP,
  protocol, asset, and WebGL error arrays were empty.
- Mac evidence under
  `/Users/jarrett/Projects/Solomon Dark/.codex-evidence/status-effects-20260822-root/`:
  Frost active `3fce801c1ad2ebe5da84d50ab903868257cc3fc7c2235e7b64db998c966cf0c0`,
  Frost recovered `0aaacb4f86e6824157b0912aa6a1cda1bda5e831e625eee38fed9df5554c7348`,
  Lightning active `a90ccbdc3a841282f4de170b9a4965087da141a96ef3cc04ec85462df4daa195`,
  Lightning recovered `4c47bbd2f0481e56be2ece8190fb2322b0f7e8486e1ea93673aa154a5b5eac4b`,
  and Ring of Ice `81f3a201b876a2063d2a08266fcebdff2e1581248f4afbd0ae9907b93ba490ba`.
- No member is blocked by the browser platform and no material unknown remains.
  The WSL SwiftShader renderer-start timeout was non-decisive; Mac hardware
  proof is decisive. This change is approved for publication to `main`;
  deployment remains a separate operation and is not part of this receipt.

### Report 82 flee-lifecycle acceptance

The reopening in entry 273 is now ported-and-verified. The cast writes both body and existing flee/wander heading once; newly cast flee duration replaces the remaining timer directly. Ordinary effect ticks never replay the cast bearing. Full movement refreshes from the current target, while degraded and targetless movement retain body heading. Collision, hit/disruption/frozen restraints and timer decrement remain with their existing owners. Public regressions cover shorter/longer recast, expiry, near-zero and half-speed status, party target loss/reacquisition and saved continuation. Exact runtime/test candidate `6ecd9247` passed the unchanged M5 all-mode `scripts/validate.sh` at 2026-10-07T00:20:16Z: 42 Python tests, 4,226 Node executions across 22 batches, no failed/cancelled/skipped tests, production builds and configured renderer quality gates with final failures empty. The real built four-family cast, expiry and continuing snapshots passed; publication/live details remain in the report archive.
