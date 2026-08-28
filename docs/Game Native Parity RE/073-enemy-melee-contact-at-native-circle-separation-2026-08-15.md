# Enemy melee contact at native circle separation — 2026-08-15

## Captured failure and ownership finding

The deterministic two-player browser journey reached an active 15-Skeleton
opening with clean page/console error arrays, but its designated host remained
alive at 16.847 HP after the five-minute death-proof window. The final host
position was `(600.7841343645737,354.45636087803865)`, surrounded by eight
authoritative Skeletons at center distances of roughly 40..76 units. Damage
had occurred, but only intermittently while the input driver forced bodies
through one another; ordinary settled contact did not sustain an attack.

This joins two already recovered contracts that were implemented separately:

- `PlayerWizard` radius is 25 and evaluated Skeleton radius is 12..20.
- Native actor response separates an overlapping pair to
  `radiusA + radiusB + 0.1` (`0x00521E00`, `0x00521EF0`).

The enemy-store reach helper used
`max(namedCenterReach, actorRadius + playerRadius)`. For Skeletons the named
temporary center reach is 36, so the helper admits at most 37..45 units while
the collision owner deliberately settles the same pair at 37.1..45.1 units.
Imps have the same structural mismatch, and the largest Zombies can encounter
it too. Damage remains accidentally possible only during a transient overlap
from a separately driven player epoch. That makes input motion, not an enemy
action marker at legal contact, the hidden authorization for a hit.

## Parity boundary and implementation contract

The exact per-family native weapon shapes/reaches remain open. This repair does
not promote the current named center-distance bounds to recovered retail
geometry. It makes the bounded Website contact rule internally coherent with
the exact native circle-response rule:

- Export the already recovered `0.1` actor-separation epsilon from the shared
  physics kernel; do not duplicate or approximate it in enemy code.
- Marker-time eligibility uses
  `max(namedCenterReach, actorRadius + targetRadius + separationEpsilon)`.
  It still requires the staged target to be connected, eligible, living, and
  within reach on every independent marker.
- No action clock, damage value, target selection, movement, collision,
  knockback, projectile, protocol, or renderer behavior changes.
- A regression must place a real evaluated Skeleton exactly at the shared
  solver's legal separation, prove it begins its action without player input,
  and prove its recovered marker damages the staged target. A point beyond the
  epsilon remains out of reach.
- The deterministic multiplayer browser journey must then prove organic host
  death, the native dying-to-spectating transition while the guest remains
  alive, spectator camera/input lock, all-dead Game Over, host-only retained
  loadout confirmation, and both peers returning to the same Hub session.

## Implementation validation receipt

- `NATIVE_ACTOR_SEPARATION_EPSILON` is now the one shared exported `0.1`
  constant used by actor correction and melee eligibility. The enemy-store
  helper includes that epsilon after both collision radii and retains the
  existing named family reach as the other branch of the maximum.
- The focused store regression failed first with the exact settled target in
  `approach` instead of `attack`. It now proves the real evaluated Skeleton
  begins its action, reaches a damaging marker, and rejects a target only
  `0.0001` beyond the settled distance. The world regression starts the pair
  overlapped, lets authoritative two-way actor response settle it, then proves
  the same stationary Skeleton enters `attack` and damages the player.
- Independent replay of the captured zero-seed actors found IDs 10, 12, 13,
  14, and 15 between `0.0923` and `0.1170` beyond the old threshold. Before
  the repair, an exact radius-sum fixture produced nine markers and 13.5
  damage over 200 ticks while radius sum plus 0.1 produced zero markers and
  zero damage. After the repair, test-project TypeScript passes and the shared
  physics/store/world suite passes 51/51.
