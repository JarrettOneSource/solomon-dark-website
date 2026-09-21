# Windows performance repair and main release

Continuation: Fleet session `492v95wn`, September 21, 2026. This supersedes
the interrupted integration in `6a583nbx` and `37ryhsj8`.

## Implemented repair boundary

The prior validated candidate is preserved in `bfa35bd3`. The release adds:

- Pulse-owned Mage creator light registrations through authoritative emission,
  object/compact protocol, interpolation, scene and simulation light queries,
  and save restoration. Protocol 129 and save schema 37 carry the field.
  Exact legacy owners may supply missing schema-36 registrations; missing
  legacy owners are rejected rather than guessed. Fresh unstepped worlds keep
  their legitimate enemy tick sentinel of -1 and cannot contain live pulses.
- Shared gamepad sampling and a stable mod quickbar key handler. Ordinary
  runtime updates do not detach/reinstall handlers, and empty quickbars have
  no handler. Modal/disabled-scope transitions and input edges are retained.
- A per-step live Coffin-owner index and stable-grid candidate queries for
  non-pushing crowd movement. Corrections re-query while retaining strictly
  ascending source-index contact order. Appended actors and completed moves
  update grid membership; all native collision arithmetic remains unchanged.
- Deferred offscreen death-effect sprite/graphics allocation. Empty containers
  retain their original insertion order, ages and logical identities.
- Per-client monitor error counts, native window state and focus diagnostics,
  plus termination on a sampled client error after preserving its sample.

No actor cap, lower graphics setting, reduced spell rate, relaxed cooldown,
weakened protocol validation, or reduced stress workload is used. The private
Fire-on-Mac / Water-on-Windows pilot retains invulnerability, zero mana spending,
refill to current capacity, and automatic learned/equipped ability use. Native
mana reservations/affordability and cooldowns are unchanged.

## Verification before the complete release gate

The initial integrated run passed 340 of 347 tests and identified seven fresh
save-restoration regressions caused by rejecting the existing -1 enemy tick
sentinel. That defect is corrected with an explicit regression. All 49 save
checks subsequently passed, as did TypeScript checking. The complete gate
below re-runs the integrated source rather than treating the partial run as a
pass.

52 movement/world checks pass. The native movement oracle is compared over
120 randomized crowds at three cell sizes, correction across query boundaries,
and 260 sequential moves with dynamically appended bodies. Twelve complete
archived/generated simulation workloads preserve exact output/RNG hashes.
The corrected matched full-tick benchmark is in
`performance-movement-grid-20260921.md` and its JSON receipt. It shows gains on
the two largest captured states, but a small slowdown on the other captured
state; these are local measurements, not Windows FPS promises.

Headed Mac Chrome acceptance exercises the real Mage interpolation, pulse
views, scene-light manager and WebGL draws across birth/orphan boundaries,
both contact variants, every live age and complete retirement with no browser
errors. The real React mod quickbar passes 50 empty and 100 nonempty updates,
rebinding, session replacement and unmount with balanced listener lifetimes.
Reproduction tools: `check-mage-light-browser.mjs` and
`check-mod-quickbar-browser.mjs` under `frontend/tools`.

## Release and endurance contract

Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on this exact committed
candidate before publishing. Keep its final job outcome and source/build hash
receipt outside the committed source so that the build revision matches the
published commit. Fetch immediately before publication, fast-forward push
without force, and verify remote SHA equality. A push is not a production
service deployment.

The new endurance run starts from clean main using the validated build and
fresh private evidence directory. Both real clients must naturally enter
wave 101 in the same authoritative party/run for wave-100 acceptance. An
initially healthy restart is not endurance completion. Record fresh process
identities for cleanup; preserve original failed-run evidence. Window state
is diagnostic context, not proof of the cause of every frame stall.
