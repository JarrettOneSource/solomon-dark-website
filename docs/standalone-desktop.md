# Standalone desktop ownership

The Electron launcher, sandboxed preload, encrypted PSK peer transport,
updates and static asset policy now live with the Rust game. The gameplay
child is the canonical native Rust authority. No Website game bundle or
Node gameplay process is packaged here.

The Rust repository's `docs/DESKTOP-RUNTIME.md` and `desktop/README.md` own
packaging, release repository selection and actual Electron acceptance.
Commands include `npm run test:desktop`, `npm run package:desktop` and
`npm run smoke:desktop` **from that repository**. Game delivery requires
native/WASM/save-tools from the same reviewed revision plus the retained
ordinary save/restart/peer journey; shell unit tests alone do not establish it.

Website CI consumes only the configured verified Rust artifact. Desktop
release publication belongs to the Rust repository. Historical Website
packaging is available at `fa08ae249ff5563570bdb2a653e2ef9358ce7b83`.
See [artifact boundary and gate mapping](RUST-GAME-CUTOVER.md).
