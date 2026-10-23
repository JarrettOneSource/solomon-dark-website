# Hosted validation budget

The Website Validate job keeps `ubuntu-latest`, read-only repository permissions
and the complete `./scripts/validate.sh` entrypoint with its 150-minute ceiling.
It preserves backend, storage/content contracts, retained editor/library tests,
frontend checks and production build. The separately completed Rust artifact
is a required pinned input; game/desktop release gates moved with their source.
See [validation ownership](RUST-GAME-CUTOVER.md#validation-ownership).

Before the gate, the workflow records an allowlisted machine resource summary.
GNU `/usr/bin/time -v` preserves validation's exit status and records elapsed
CPU time and peak memory. An `always()` upload retains available Website
reports, including the admitted artifact revision/target/manifest identity.
Missing reports after a failure or timeout are not passing evidence.

The previous 150-minute limit was established after the TypeScript renderer's
full mutation gate exceeded 60 minutes (Validate run 37996408935). That renderer
and mutation harness now have a different implementation owner. No old or
partial mutation inventory is used as a Rust acceptance result. The retained
historical `tools/ci-mutation-diagnostics.py` is an independent read-only report
analyzer, not a current Website release gate.
