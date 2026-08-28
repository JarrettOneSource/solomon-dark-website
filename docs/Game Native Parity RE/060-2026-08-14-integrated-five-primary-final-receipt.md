# 2026-08-14 — Integrated five-primary final receipt

- The complete rebased Website tree passed `./scripts/validate.sh`: `23/23`
  backend/contracts, `420/420` frontend tests, `5/5` desktop tests, lint and
  game import boundaries, production frontend/game-host builds, and production
  media policy. Only the repository's existing Fast Refresh and large-chunk
  warnings remain.
- An isolated real-Chromium WebGL journey on Vite `127.0.0.1:5597` and host
  `127.0.0.1:45955` returned `status: ok` and `errors: []` after casting Ether,
  Fire, Air, Water, and Earth. Cast poses were `8, 8, 7, 7, 7`; every owning
  player's replicated and rendered heading was index `8`, derived from the
  player's accepted cast aim rather than a child-effect direction. Air and
  Water start/loop/stop ownership balanced, and each one-shot cue fired once.
- Inspected Hub captures and SHA-256 receipts are Ether
  `f01b158f6a161c25e0f756db9b66469d2c8bd222f8aec3cc475db1f628db5d2c`, Fire
  `71a4236309d4059c2ca2536480dbde7cf17559b635d10ed8e4763a6be339a605`, Air
  `c16590dd74f095e95f2fc449fe5e8c65f2c1f8193aad676072a254645c59be90`, and
  Water `123568328c58537dc9f7fb0f52a3c6f37e02f71cc491dd2ff6bc2d644ab8a87c`.
  Water is now a short layered blue-white spray; the operand-width audit's
  prior full-courtyard cyan wash is absent.
- Earth opening/mid/high/release captures are
  `2df9e9971f26b8121b954bf2f4b4cf383dea81790a4266681d23e7f239364ce6`,
  `100ca66cbece77bbcf6cd7ff2d596787834a87ebaba2b7723edd4f6614653389`,
  `0a171713a25de98d3c4e5dfdc7e071b64799c904aec791b1dd5e4b12bb7957f3`, and
  `3796367983b1a3720359c873d25858810c0a8a06ac428f30ce71c321a1aa3d4c`.
  They show glimmer handoff, shell growth, independently arriving rocks, and
  the actor-owned release/breakup. Boneyard held/released hashes are
  `58b454e9b3c1e2d369059e3d5bbfbb8ea8bb5eb8fe9328158f9b015e57f03c22` and
  `dc30a429a4727bd05054cda01fa8f4456cf5843cce91c53f455468f6c9583b69`;
  painter ordering and regional/outbound light ownership remained intact.
- Captures live under
  `/tmp/sdr-primary-vfx-main-ready-20260814.Lqi7Tc/`. The smoke paces only
  headless `requestAnimationFrame` to 30 Hz so SwiftShader presentation cannot
  starve WebSocket input; the authoritative host remains on its 100 Hz fixed
  tick, so this is a visual/state receipt rather than a performance claim.
  The owned browser, Vite server, and host were stopped after inspection.
- This closes instruction/asset/state/render-order parity for the implemented
  no-contact rank-1 slice. It does not claim sample-for-sample native global
  RNG, clean-stock color-management pixels, Water terrain wall-splay, or
  Ether/Fire contact VFX before the Website publishes semantic contact events.
