# Shared Lua client journeys

Run the same Lua scenario against PixiJS and Rust while exercising their real
browser controls. Lua chooses actions and checks accepted gameplay state. The
adapter translates control names, mouse coordinates and read-only protocol
observations; the running client sends commands and acknowledgments.

This is an external browser driver. Installable gameplay mods run inside the
authority and cannot drive the login screen, GPU menus or browser keyboard.

## Run

Use the Website's installed frontend dependencies, a local checkout of
[`solomon-darker-rust`](https://github.com/JarrettOneSource/solomon-darker-rust),
and Chrome. Build the Rust navigation helper once:

```sh
cargo build -p solomon-assets --example browser_navigation
```

From `frontend/`, supply an unused output directory for each client:

```sh
SOLOMON_NAVIGATION_BINARY='/path/to/rust/target/debug/examples/browser_navigation' \
npm run smoke:client-comparison -- \
  --client pixi --url 'https://your-test-host/game/' \
  --rust-tools '/path/to/rust/tools/browser-smoke' \
  --scenario tools/client-comparison/scenarios/basic-gameplay.lua \
  --out '/path/to/evidence/pixi-basic'

SOLOMON_NAVIGATION_BINARY='/path/to/rust/target/debug/examples/browser_navigation' \
npm run smoke:client-comparison -- \
  --client rust --url 'https://your-test-host/game-rust/' \
  --rust-tools '/path/to/rust/tools/browser-smoke' \
  --scenario tools/client-comparison/scenarios/basic-gameplay.lua \
  --out '/path/to/evidence/rust-basic'
```

Use a disposable test server and fresh QA accounts. Scenarios create games and
save through Leave; the shop scenario spends gold and changes persistent College
purchases. `--account /private/qa-account.json` supplies an existing account's
`token`; omit it for guest play. Never commit account files or private saves.
`hagatha-tonics.lua` needs a fresh developer account to fund purchases through the
visible cheat menu. It then buys and removes perks using ordinary shop controls.

`--resolve-host hostname` maps only the owned browser's hostname to loopback and
allows its local TLS certificate. Use it only for a local fixture. `--chrome path`
overrides Chrome's executable; `SDR_CHROME_PATH` is also supported. M2 runs use
Chrome's Metal backend. Each run owns and closes its browser and navigation child.

## Scenarios and evidence

- `basic-gameplay.lua`: inventory, movement, Boneyard admission, Solomon's opening,
  real combat, kills, XP, loot, acknowledged pause, saved exit and continuation
  after a fresh document. Combat decisions have a bounded step budget.
- `hagatha-tonics.lua`: two tonic purchases, distinct owned-perk rows, Life Charm
  purchase and removal, and saved exit. This reproduces the duplicate Rust widget
  identifier crash in the released client.
- `hub-statue.lua`: keyboard movement around the central statue with seven
  captured viewpoints for atlas-edge and foreground comparison.
- `wave-60.lua`: the shared authority Lua pilot clears wave 60, repeatedly casts
  primary and learned secondary abilities, then saves and continues in a fresh
  document. It requires earned kills, loot and XP, active protection and available
  mana. Fifteen consecutive unchanged two-second observations fail the combat
  journey, so a lost authority cannot leave it reading the last snapshot for hours.
  The six-hour observation limit is a failure deadline, not a passing result.

## Protected wave-60 runs

Package the existing gameplay controller from `frontend/`:

```sh
node --experimental-strip-types tools/client-comparison/pack-endurance.mjs /private/pilot.zip
```

Upload the package privately to a disposable test server and subscribe the QA
account to it. Use a developer account so the scenario can set its seed through
the visible Console. Run each command above with that account,
`--scenario tools/client-comparison/scenarios/wave-60.lua`, and the same
`--seed 20261028`. Use fresh independent save slots and identical game settings.
The pilot sets incoming damage and mana spending to zero, replenishes mana,
selects earned skill offers and rotates learned secondary abilities using their
ordinary cooldowns. It does not grant waves, kills or rewards.

`sd.rng.set_seed` sets the next Boneyard seed in the Hub. Equal seeds select the
same map and initialize the wave compiler and runtime streams alike. They do
not guarantee identical complete combat: placement depends on player positions,
and event order, collision, skill choices and shared random draws affect later
spawns and loot. This Console command does not reset the session's skill-offer RNG.
Exact replay across implementations would also require matching those inputs
and state transitions.

`run-observations.json` records each run's seed and map hashes, wave transitions,
resource minima, accepted cast sequences and first-observed enemies and loot.
Repeated observations are deduplicated by actor ID and spawn tick, including
reused pickup IDs. Positions are first-observed positions; snapshots can miss
short-lived actors. Recorded event gaps and skipped secondary sequence numbers
remain explicit, so this file is not a complete authority replay. Screenshots are
captured at entry, each ten-wave milestone, pause, saved exit and continuation.

`receipt.json` retains the scenario SHA256, input timings, normalized state,
failures and browser cleanup. Every checkpoint has a numbered PNG and JSON state
file, including repeated checkpoint names. Failed runs return a nonzero status
and retain a failure screenshot when a page exists. A browser launch failure
still produces a receipt. `actions.jsonl` appends each completed action; long-run
receipts are refreshed every 30 seconds, at checkpoints and on completion/failure.

Compare invariants and screenshots, not identical frame counts or random combat
outcomes. Position, time, camera and rendering can differ between clients. These
journeys do not establish complete game parity, audible sound, native desktop
input or performance. Review images and the raw browser reports before accepting
a result. Loaded PixiJS audio requests are classified as document retirement only
when their exact request and document replacement were observed; incomplete or
unrelated cancellations remain errors.

Run `npm run test:client-comparison` for the evidence-classification regressions.
These also run in the normal frontend test command.
