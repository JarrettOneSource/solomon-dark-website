# 2026-08-14 — Random Boneyard run ownership and Gate tip-rule length

## Reported mismatch

- Entering a random Boneyard, refreshing the page, and starting again through
  the standalone `/game` launcher repeatedly restores the exact same run.
- Each moving fence Gate has a long black piece extending below the leaf that
  is not present at that length in stock.

## Evidence ledger

| Evidence class | Exact source | Finding | Confidence |
| --- | --- | --- | --- |
| Native generator entry | Retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `0x006388FE..0x0063893D` | Every `BoneyardGenerator` invocation samples an integer in `0..999999` from the game's global RNG, initializes a generator-local stream, then logs `Random Boneyard Seed: %d` before constructing layout. | high |
| Native Arena lifecycle | Loader `0x0046DC60`, create/save owner `0x0046D7B0`, explicit editor regeneration at `0x004C84B0` | Procedural generation occurs once at a new Arena/regeneration boundary. The materialized Arena remains stable for its run; explicit regeneration reinitializes and invokes the generator again. | high |
| Web selector | `host/boneyard-catalog.ts` and `host/boneyard-catalog.test.ts` | Each materialization receives 128 bits from `crypto.randomBytes`, uses one unsigned word to select among 12 distinct, content-hashed stock generator outputs, and emits a separate random run id. The bank is distinct and the selector itself does not retain prior choice. | high |
| Web run lifecycle | `host/game-host.ts`, `host/run-game-host.ts`, and `tools/dev-game.mjs` | The standalone launcher keeps one host process alive. On final disconnect, the host removes only the player; `state` and `loadedBoneyard` survive. The next client receives that latched Boneyard immediately and a second start request is ignored because a Boneyard is already loaded. | high |
| Native Gate painter | `Gate::Render` `0x005ECE40`; focused instructions `0x005ECF12..0x005ECFC3`; constants at `0x00784CC8` and `0x007DE8E0` | The first width-3 black rule joins `(p1.x,p1.y+32)` to `p3`. The add modifies the stored upper endpoint before the line arguments are copied. | high |
| Web Gate consumers | `renderer/boneyard-world-renderer.ts` and `editor/render.ts` | Both duplicated the same reversed offset, drawing bare `p1` to `(p3.x,p3.y+32)`. On a vertical closed leaf this is 64 world units longer than stock. | high |
| Clean-stock visual oracle | `/tmp/solomon-dark-native-fence-gate-closed-20260814.png` and `/tmp/solomon-dark-native-fence-gate-open-20260814.png`, captured from an uninjected retail process | Closed and pushed leaves retain the short internal tip rule; no matching extension continues below the lower tip. | high |

The authoritative native detail is retained in sibling reports
`docs/reverse-engineering/boneyard-system.md` and
`docs/reverse-engineering/native-gate-art-and-lifecycle.md` in the Mod Loader
repository.

## Causal chain and implementation contract

The randomizer is not returning the same seed. The lifecycle owner is stale:

```text
last standalone client disconnects
  -> player removed, host process survives
  -> loadedBoneyard and Boneyard simulation survive
  -> refreshed client authenticates to the same run
  -> host replays server-boneyard-loaded
  -> client-start-match is ignored because a run is already loaded
```

The standalone host must reset its run when its authenticated client count
reaches zero. Reset means a fresh empty Hub simulation, no loaded Boneyard, no
host claim, and fresh per-run player/snapshot sequencing. Its fixed clock must
remain parked at tick zero while that reset host is empty; otherwise the next
welcome depends on transport timing instead of the reset boundary. The
persistent browser session supervisor must keep its existing behavior:
temporary peer absence does not reroll a multiplayer Arena, and the supervisor
remains the owner of session expiry. Within any active run, one Boneyard
materialization continues to be immutable and identical for every peer.

The Gate correction belongs in shared native fence geometry. That seam must
return the two recovered rule segments so the Pixi runtime and Canvas editor
cannot independently reinterpret the native stack layout again. Mesh art,
hinge art, authoritative hinge/tip motion, collision, painter depth, and rule
width remain unchanged.

## Adjacent-system audit and explicit boundary

- The 12 bank members remain exact, distinct stock-generator outputs and the
  cryptographic selection is unbiased enough for this finite bank. This change
  restores stock generation cadence; it does not claim the browser implements
  all 6,165 native generator instructions or expands the current output space.
- Mod-authored Boneyards use the same per-run materialization edge and set-piece
  selection. They must also reset between standalone runs without changing
  their authored geometry.
- A disconnect while another authenticated client remains is not a new run;
  host authority transfer and the loaded scene must remain intact.
- Pending handshakes may attach only to either the old nonempty run or the new
  empty run. Resetting after the last authenticated release keeps that boundary
  single-threaded in the Node event loop.
- The short Gate rule is presentation-only. No protocol, snapshot, simulation,
  collision, or gate-motion field changes.

## Validation contract

- A focused host regression must reproduce final-client disconnect followed by
  an intentionally delayed new client and prove that opt-in standalone reset
  remains at Hub tick zero with no loaded Boneyard, while the default
  persistent-session behavior continues its clock and retains one exact run for
  reconnecting peers.
- Deterministic catalog coverage must continue to prove all 12 stock templates
  are reachable and distinct; fresh run ids/seeds must remain separate from
  immutable per-run peer state.
- Shared geometry coverage must pin the first Gate rule to
  `(p1.x,p1.y+32) -> p3` and the second to the two edge midpoints. Runtime and
  editor consumers must use that contract.
- A real Chromium refresh journey through the standalone host must produce a
  different run id after the last client leaves, retain WebGL readiness, and
  show no page, console, or failed-response errors. Closed/open Gate captures
  must show the corrected short rule.
- The canonical `./scripts/validate.sh` gate must pass on the exact rebased tree
  pushed to `main`.

## Implementation validation receipt

- `GameHostOptions.resetWhenEmpty` is opt-in. The standalone entry point enables
  it; supervisor-provisioned session hosts retain the default persistent-run
  policy. Final-client release now reconstructs the empty Hub and resets loaded
  Boneyard, host claim, player ids, snapshot sequence, and tick deadline before
  the next standalone client authenticates. The fixed loop parks that reset Hub
  at tick zero while it remains empty and slides its next deadline forward; the
  default persistent policy continues advancing its retained run.
- `nativeGateRules` is the single geometry owner for both visible line
  primitives. Pixi and Canvas now consume `(p1.x,p1.y+32) -> p3` and the two
  edge midpoints from that shared contract.
- The focused red phase failed because the shared Gate rule did not exist and
  the standalone host retained `loadedBoneyard` past final disconnect. The
  green phase passed all 36 focused editor/catalog/host tests. Added coverage
  also reaches every one of the 12 distinct stock-template selector buckets
  and proves the persistent-session policy still preserves an active run.
- Chrome `150.0.7871.124` completed two fresh `1600 x 900` Play -> New Game ->
  Hub -> Boneyard journeys against one long-lived local standalone host, with a
  page refresh between them. Run ids changed from
  `325ffdb11dd89d8d3955d0449730d1db` to
  `e93d83309f425a44cdb54b357e8d031b`; geometry changed from
  `eeb233d561cbbac93f87ce8a70253656f7f28347b5fa533e1bc8cdd475db23e5`
  to `dddbc28c5fb2fa1764404190e3b8ffc77f450735517cbd8f0009e0562cb2cb57`.
  Page errors, console errors, and failed responses were empty.
- Browser captures are `/tmp/solomon-boneyard-refresh-1-20260814.png`
  (SHA-256 `6f48063f193824cd13aadfcebca4ff446d07ac3b944a034803bdbb0cac834a96`)
  and `/tmp/solomon-boneyard-refresh-2-20260814.png`
  (SHA-256 `f5dca7b40fcfede301300dceeb7742db559aab6033dbf050e2528f435f752344`).
  Both show the corrected Gate rule terminating at the lower tip without the
  prior below-leaf extension.
- `./scripts/validate.sh` passed the whole tree: Release backend build with zero
  warnings/errors, all 23 Website/backend contracts, frontend lint and import
  boundaries, the complete frontend and desktop test suites, production
  frontend/game-host builds, and deployment media policy. Diagnostics were
  limited to the repository's existing Fast Refresh and chunk-size warnings.
