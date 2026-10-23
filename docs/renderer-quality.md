# Game renderer validation ownership

The TypeScript/Pixi renderer and its exclusive mutation/coverage tooling were
removed with the game cutover. The canonical Rust renderer, source presentation
kernels, native/WASM checks and ordinary browser/GPU acceptance are maintained
in the Rust game repository. See [the complete ownership map](RUST-GAME-CUTOVER.md#validation-ownership).

The Website still validates its retained canvas editor, native Boneyard parser,
authoring shelf, Site frontend and backend. A Website artifact hash check does
not claim a new renderer or desktop acceptance result. Historical renderer
metrics and equivalent-mutant reviews remain available at Website commit
`fa08ae249ff5563570bdb2a653e2ef9358ce7b83`; those metrics are not relabeled as Rust
coverage or mutation results.
