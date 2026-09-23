# Soggy report campaign: September 21, 2026

The fifteen archived reports were reviewed and all confirmed, reproducible fixes
were published to `main`. The final runtime commit is
`59bf21d5722843a792545f7ee9d65a2d198f3599`; its normal fast-forward publication was
verified with `HEAD == origin/main == git ls-remote`. No manual production
restart or deployment was performed. A push is not a live-production receipt.

Eleven original report messages have a verified checkmark. Reports 09, 10 and 11
retain unconfirmed historical symptoms; report 12 depicts authored stock
background decoration. Those four messages remain unchecked.

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
| 09 | Coffin spawning and immediate destruction cause a large lag spike | Partly addressed; historical symptom unconfirmed |
| 10 | Large late-run lag spike shortly before a crash | Partly addressed; historical symptom unconfirmed |
| 11 | Solomonest: white playfield and dynamically imported module error | Partly addressed; historical symptom unconfirmed |
| 12 | Spider puddles persist between games and account changes | Native behavior; no checkmark |
| 13 | Frost Missiles do not slow enemies when combined with base Frost Jet | Fixed; checkmarked |
| 14 | Ether Blast's elemental effect is missing from the wand tip | Fixed; checkmarked |
| 15 | Skorcha sometimes loses his head | Fixed; checkmarked |

## Final acceptance

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

## Repairs and remaining evidence limits

The final pass restores native float32 scale/fade lifetimes, migrates older
saved effects without weakening wire validation, bounds synchronous host
catch-up work, reduces compression callback overhead, batches dense renderer
retirement, and lets a pause owner resume when a joining peer starts readiness.
The earlier campaign fixes include the confirmed terminal Mage crash and
registration leak, module-load recovery, authored spell/FX defects, UI defects,
item-set bonuses, stationary native owners, and the explicitly requested
boss-specific loot feature.

The production database, diagnostic uploads, durable run archives and service
journal were inspected read-only. The recorded Mage pulse-age crash was
reproduced and repaired. Historical frames alone do not establish the cause of
every preceding stall or white image:

- **09:** Coffin and Hurricane ownership, the supplied continuation and native
  burst behavior pass. The cause of the historical long acknowledgment stall
  remains unproven.
- **10:** The recorded crash and cumulative Mage registration leak are fixed.
  Attribution of the particular pre-crash lag video remains unproven.
- **11:** Dynamic-module recovery and reload-loop protection are fixed. The
  separate white-playfield screenshot still lacks a proven trigger or duration.
- **12:** The persistent patch is authored stock decoration. Actual temporary
  effects clear across the tested scene/account lifecycle.

Native recovery and per-member contracts remain in ledgers 086, 097 and 301.
The decisive code/browser acceptance is attached to runtime commit `59bf21d5`;
this campaign record changes documentation only. Original report text and media
remain in the requested report archive. Temporary worktrees, comparison trees,
private test captures and execution scaffolding are removed after publication.

Receipt SHA-256 values (the temporary raw captures are disposable):

- Complete canonical gate receipt: `0b6806e2d93cd0ff38aa3bcf6a8a3873742dbd9fd46b6d1b9308bd7b1d788dd3`
- Completed browser/endurance receipt: `40a820c474b88c6795a78d2841e77c469823c55a97ef3bc9459239f893280800`
- Endurance result: `7d059b1d1d4aea231edbee675659603450a006e1dfac88f35d68446833244a01`
