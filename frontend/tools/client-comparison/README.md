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

`receipt.json` retains the scenario SHA256, input timings, normalized state,
failures and browser cleanup. Every checkpoint has a numbered PNG and JSON state
file, including repeated checkpoint names. Failed runs return a nonzero status
and retain a failure screenshot when a page exists. A browser launch failure
still produces a receipt.

Compare invariants and screenshots, not identical frame counts or random combat
outcomes. Position, time, camera and rendering can differ between clients. These
journeys do not establish complete game parity, audible sound, native desktop
input or performance. Review images and the raw browser reports before accepting
a result. Loaded PixiJS audio requests are classified as document retirement only
when their exact request and document replacement were observed; incomplete or
unrelated cancellations remain errors.

Run `npm run test:client-comparison` for the evidence-classification regressions.
These also run in the normal frontend test command.
