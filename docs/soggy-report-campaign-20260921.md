# Soggy report campaign: September 21, 2026

The fifteen archived reports are closed with fourteen implemented/verified
outcomes and one explicit exclusion: report 12's authored stock decoration.
The initial campaign shipped in `59bf21d5722843a792545f7ee9d65a2d198f3599`.
The remaining checkpoint-induced lag/whiteout repair shipped in
`e7da07f8d5a72814a2f9b5a4060973e92f9d7d92`, followed by the recovery-fixture fix
in `ee91f4b8b37addbe6f2229d95205aa932cebaa7d`. The final code candidate passed
Mac validation and was published by normal fast-forward, with local HEAD,
origin/main and the remote main ref equal.

This follow-up added and verified completion reactions on original reports 09,
10 and 11. All fifteen original messages now show the account's checkmark on a
fresh Discord read. Report 12's reaction was already present at that read and
was left untouched; its scenery remains unchanged at the user's request.
No manual production restart or deployment was performed. Live rollout was not
verified by this campaign.

| Report | Subject | Disposition |
| --- | --- | --- |
| 01 | Visual artifact in the college character-selection menu | Fixed; checkmarked |
| 02 | Burning enemies emit a persistent red glow | Fixed; checkmarked |
| 03 | Dropped items briefly flash in their previous menu position | Fixed; checkmarked |
| 04 | Invitation-already-sent text is cut off | Fixed; checkmarked |
| 05 | Multiplayer run: freezes, late crash, and improved performance | Fixed; checkmarked |
| 06 | Dire bosses should drop pieces of their associated item sets | Fixed; checkmarked |
| 07 | Investigate whether complete item-set bonuses work | Fixed; checkmarked |
| 08 | Deep Portals can be pushed out of position | Fixed; checkmarked |
| 09 | Coffin spawning and immediate destruction cause a large lag spike | Fixed: reproduced checkpoint delivery stall; checkmarked |
| 10 | Large late-run lag spike shortly before a crash | Fixed: crash, registration leak and checkpoint delivery stall; checkmarked |
| 11 | Solomonest: white playfield and dynamically imported module error | Fixed: module recovery and reproduced checkpoint-induced whiteout; checkmarked |
| 12 | Spider puddles persist between games and account changes | Excluded native scenery; existing reaction left untouched |
| 13 | Frost Missiles do not slow enemies when combined with base Frost Jet | Fixed; checkmarked |
| 14 | Ether Blast's elemental effect is missing from the wand tip | Fixed; checkmarked |
| 15 | Skorcha sometimes loses his head | Fixed; checkmarked |

## September 23 follow-up acceptance

The exact final code tree `ee91f4b8b` passed Mac
`/opt/homebrew/bin/bash ./scripts/validate.sh`, including backend integration,
frontend tests, lint/type checks, production builds, media policy and renderer
quality/mutation gates. All 7,171 tracked files matched between machines. The
152 focused tests cover bounded transfers, Unicode, malformed fragments,
interleaved gameplay, supersession, teardown and final-save ordering, including
the existing 23 MB Faculty recovery fixture.

Large background saves now travel in small acknowledged fragments so they do
not monopolize the gameplay WebSocket. Only complete saves reach storage.
An active transfer finishes before the latest queued save starts; admission,
explicit leave, Game Over and coordinated updates retain atomic delivery.
Protocol 134 enables this directly, with native populations, feedback timing,
intentional pauses and collision behavior unchanged.

Matched 45-second trials restored the original Coffin continuation through the
actual session supervisor/proxy, in a separate process from the receiver:

| Downstream limit | Previous maximum gameplay-update gap | Fixed maximum gap |
| --- | ---: | ---: |
| 10 MiB/s | 110.8 ms | 120.1 ms |
| 256 KiB/s | 620.6 ms | 120.3 ms |
| 64 KiB/s | 2472.6 ms | 306.7 ms |

All trials decoded without errors. At the slowest rate, Game Over superseded an
unfinished background save with a valid complete terminal profile. Initial-load
ping still reached 2.59 seconds under that bandwidth limit; the fix targets
active gameplay delivery, not initial transfer cost or total network loss.

A two-browser control started a save after both browsers displayed a native
Comet flash. Whole-save delivery left both renderers at alpha 0.86 after 2.2
seconds while server time advanced. With fragments at 64 KiB/s, opacity dropped
to 0.265 at that point and reached zero after 2552/2555 ms, with maximum update
gaps of 305.4/309.3 ms. At 256 KiB/s with complex lighting, flashes retired in
2119/2102 ms and both large background saves completed. Error arrays were empty;
WebGL remained healthy. This proves a repaired whiteout mechanism. The original
still image's exact trigger and duration remain unknown.

The remaining real Chrome journeys passed: normal/frozen flashes and context
restoration, party leave/rejoin and catch-up, anonymous/authenticated update
saves and reconnect, profile-only/retired wizards, the original local-only Coffin
save, original/four-style Coffin behavior, and a 15-second withheld-ACK recovery.
The latter held its backlog at eight snapshots and recovered in 32.6 ms; the
other peer kept receiving updates throughout. The updated recovery helper now
routes current-schema local-only saves to a private College.

A fresh Fire/Water two-browser run entered wave 4 in about 129 seconds. Both
pilots remained enabled, each wrote six complete diagnostic checkpoints, and
client errors and checkpoint failures were zero. Mean FPS was 59.94/59.94;
maximum active update gaps were 143.6/143.7 ms. This short run checks the changed
checkpoint consumers; the earlier Air/Ether wave-47 evidence below remains the
longer runtime receipt.

## Initial campaign acceptance

The exact runtime tree passed the complete Mac mini `scripts/validate.sh` gate
and real Chrome 153 journeys. Both machines matched all 7,168 tracked files.
Coverage includes all 24 boss cases, the three-Faculty burst, both Game Over
exits, the original Coffin continuation, the four-style Coffin burst, and a
15-second withheld-acknowledgment recovery scenario. One boss screenshot was
missed although the host observed the attack; an unchanged-tree targeted rerun
captured the projectile, green fire, real audio and three Imps with no errors.
The completed cases were retained when the remaining browser checks resumed.

The two-browser Air/Ether run completed wave 46 and entered wave 47 in about
42 minutes. It uses the maintained private stress pilot: invulnerability, no
mana spending and automatic learned abilities, with native damage, cooldowns,
levels, movement and wave timing. This is Mac loopback stress acceptance, not
normal-balance or historical-network replay evidence.

| Measurement | Air | Ether |
| --- | ---: | ---: |
| Mean rendered FPS | 59.37 | 59.35 |
| Worst five-second FPS window | 21.90 | 21.47 |
| Maximum frame duration | 264.0 ms | 268.8 ms |
| Maximum active snapshot gap | 540.1 ms | 690.4 ms |
| Browser/protocol errors | 0 | 0 |
| Final wave | 47 | 47 |

Both pilots remained enabled. Three private pilot callbacks exceeded their
execution deadline and subsequently recovered. The host recorded no simulation
failure or checkpoint failure; its longest flow-control interval was 3,564 ms,
while both clients continued receiving snapshots within the declared 1,000 ms
gap limit. Brief frame-rate dips and host backpressure remain observable under
dense effects; this acceptance does not claim that every frame stays at 60 FPS.

The final three-Faculty test starts with 26,050 native effects, retains 25,477
when both peers are present, and retires all effects. Delivery gaps are
349.6/379.8 ms with no client errors. The renderer's independent real-Pixi
comparison reduces full-population retirement from a 468.26 ms median to
23.20 ms while preserving all effects and surviving painter order.

## Initial repairs and historical evidence limits

The final pass restores native float32 scale/fade lifetimes, migrates older
saved effects without weakening wire validation, bounds synchronous host
catch-up work, reduces compression callback overhead, batches dense renderer
retirement, and lets a pause owner resume when a joining peer starts readiness.
The earlier campaign fixes include the confirmed terminal Mage crash and
registration leak, module-load recovery, authored spell/FX defects, UI defects,
item-set bonuses, stationary native owners, and the explicitly requested
boss-specific loot feature.

The production database, diagnostic uploads, durable run archives and service
journal were inspected read-only. The recorded Mage pulse-age crash and
registration leak were reproduced and repaired. The follow-up establishes a
checkpoint-transfer cause for long update gaps and persistent white feedback;
it does not retroactively identify every historical video hold or the exact
trigger of the original white screenshot. Report 12 remains authored native
scenery, explicitly excluded from changes.

Native recovery and per-member contracts remain in ledgers 017, 086, 097 and
301. Original report text and media remain in the requested report archive.
Task worktrees, private test captures and execution scaffolding are removed
after verified publication; unrelated shared checkouts are preserved.

Receipt SHA-256 values (the temporary raw captures are disposable):

- Complete canonical gate receipt: `0b6806e2d93cd0ff38aa3bcf6a8a3873742dbd9fd46b6d1b9308bd7b1d788dd3`
- Completed browser/endurance receipt: `40a820c474b88c6795a78d2841e77c469823c55a97ef3bc9459239f893280800`
- Endurance result: `7d059b1d1d4aea231edbee675659603450a006e1dfac88f35d68446833244a01`

Follow-up receipt SHA-256 values:

- Final full Mac gate (`ee91f4b8b`): `db7183a2dccbd1f12c1b6141f2bd966784c5f1b62a9419f0374c8be9fc5ca59e`
- Completed lifecycle stages: `c617d61147110493556303ceb0a60ee0c09936acf38acf5b76fde3db84151607`
- Update/reconnect and original Coffin save: `290e37a32fab34453eb4c04f0785b9992414e8e4b8df0c7607a186b514ac69d9`
- Short Fire/Water run: `05733a4490bb76df1c34008ee43298fdeff1c77607d51ff8a7608e46764d5ad1`
- Slow-link white-flash receipts and transport trial hashes are in ledgers 017/097.
