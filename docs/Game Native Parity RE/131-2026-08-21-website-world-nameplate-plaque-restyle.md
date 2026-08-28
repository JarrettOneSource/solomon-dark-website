# 2026-08-21 — Website world nameplate plaque restyle

## Reported request and parity question

- The owner asked for the floating multiplayer nameplate (remote wizard name and
  health bar) to look better on the Website game, explicitly not in the Mod
  Loader. This is a presentation-only change to the existing explicit visual
  override recorded in the 2026-08-20 world-nameplate entry; no native fact was
  revised and no Mod Loader report changes.

## Evidence and provenance

- Before frames: the 2026-08-21 invitation/lighting journey captures
  (`hub-nameplates.png`, `boneyard-nameplates.png`) showed the previous plate as
  a flat dark box with the name over a two-colour bar; at native scale the bar
  sat on the hat brim and the small-caps glyph box overflowed the plate.
- Atlas ink measurement of the native Fonts group-6 face: capitals span
  `-19..+6` layout units, small caps `-15..0`, digits `-15..+3`, so a shared
  baseline needs the name centred on the capital box rather than the glyph
  bounds.
- Hat clearance from real frames: the first real Hub frame of the new plaque
  (bottom at anchor `+12`) still clipped the top of the hat brim by about
  three pixels; the Boneyard frame just touched it. The plate was lifted four
  pixels (bottom at anchor `+8`) and both scenes re-captured.

## System boundary and membership inventory

- Owner: `frontend/src/game/renderer/native-world-nameplate.ts`
  (`WORLD_NAMEPLATE_STYLE`, `WORLD_NAMEPLATE_ELEMENT_ACCENTS`,
  `WORLD_NAMEPLATE_GEOMETRY`, `worldNameplateVisualLayout`,
  `NativeWorldNameplateLayer`), tests in `native-world-nameplate.test.ts`.
- Unchanged members: the Hub and Boneyard renderer call sites and their
  projection (`project(actor.x, actor.y - 45)`), remote-only membership,
  the authoritative unsmoothed health ratio, the zero-health empty bar, the
  non-interactive layer, draw order above the world scenes, and the bitmap
  glyph layout from `layoutNativeAllyName`.
- New member: each derived item carries the wizard's `config.element` so the
  plaque can show the element accent.

## Web implementation consequence

- The plate is a 24-pixel chamfered plaque spanning anchor `-16..+8`: a
  one-pixel gold frame (`#c8a862`, `#f0d491` sheen row) over a dark plate
  (`#0f0c13` at `0.9`) with a faint bevel band, drawn as fill-only octagons on
  whole pixels with even widths (`max(56, ink + 18)`), so edges stay crisp with
  `antialias: false`.
- The name uses the native glyphs at `0.56` scale, centred on the capital box
  (`-19..+6` font units) so `Basil`, `basil`, `BASIL`, digits, and descender-free
  names share one baseline, tinted `#efe3c6` with a one-pixel black shadow.
- The health rail is recessed in the plaque foot (4 px tall, inset 3 px) using
  the native bar colours: fill `#b9342c`, highlight row `#e78369`, shade row
  `#8a241f`, empty track `#2b1312`, inside a `0.55` black channel.
- Element gems sit on both frame edges at the name centre: air `#d9f3ff`,
  earth `#86d65e`, ether `#c97cff`, fire `#ff8436`, water `#55b8ff`, each with a
  soft glow and a one-pixel white core.
- Redraws are keyed by `width:element` (plate) and `width:healthRatio` (rail);
  glyph sprites are rebuilt only when the name changes.
- The shared-Hub parties smoke read `data-gameplay-input-blocked` in the same
  tick the chat opened, but the Hub and Boneyard scenes only learn about the
  open chat through `GameChat`'s `onOpenChange` effect one commit later, so the
  read raced the React commit on the Mac; the smoke now waits for the gate. Its
  typing check also started while the click-to-move walk from `activatePlayer()`
  was still in flight and compared positions bit-exactly although Hub
  reconciliation nudges an idle wizard by sub-pixel amounts; it now waits for a
  250 ms rest and fails only above 2 px (a leaked walk covers about 15 px in
  150 ms at `PLAYER_CHARACTER_STEADY_SPEED = 100`).

## Validation contract

- Focused world-nameplate/ally matrix (`npm run test:world-nameplates`) covers
  derivation with the element, even widths, shared-baseline geometry, and one
  distinct accent per element.
- Lint and import boundaries stay clean; the production build stays inside the
  game bundle budget.
- The real two-client shared-Hub party journey (`npm run smoke:game:parties`)
  must pass in desktop and mobile pointer modes against a real supervisor,
  backend, and production bundle with empty page/console error lists, and its
  Hub and Boneyard captures must show the plaque clear of the hats.

## Implementation validation receipt

- Local WSL and Mac focused matrix `15/15`; lint and boundaries clean on both.
- Mac production build exit `0`; bundle budget `Game-DxMfObXt.js` gzip
  `107784/131072`, raw `383177/524288`, `status: ok`.
- Mac stack: `run-game-session-supervisor.ts` (protocol `solomon-dark/49`) +
  backend `Server.dll` (Development, `http://127.0.0.1:5210`) serving the
  production bundle from `backend/wwwroot`, with the smoke's gateway rewrite
  (`SDR_SHARED_HUB_GATEWAY_URL=ws://127.0.0.1:5222`,
  `SDR_SHARED_HUB_PUBLIC_ORIGIN=wss://nameplate-gateway.invalid`) because the
  backend only issues `wss://` admissions. Desktop (`1600 x 900`, mouse) and
  mobile (`844 x 390`, touch) journeys both returned `status: ok` with
  `consoleErrors: []`, `pageErrors: []`, and final health of zero sessions,
  players, parties, and runs; every launched supervisor/backend/Chrome process
  was disposed (`leftovers=0`).
- Evidence under
  `/Users/jarrett/.codex-worktrees/solomon-website-nameplate-redesign-20260821-claude/.claude-evidence/nameplate-redesign-20260821/`:
  desktop `hub-nameplates.png` `394acccff8e9da1fab51e420337c93229b5fddf57d874d8b0982333d38987c58` and `boneyard-nameplates.png` `c0182cf77f0e4f6f9efa26da7515035452157522515f1cbc3e6391180049a4a1`;
  mobile `hub-nameplates.png` `fab46aad2e40d9a0658a7da4c6371d9b45ce5c747934e3b240529dcd11f2da5b` and `boneyard-nameplates.png` `ffe3b6a2cefb5e203b1997cb97c67117450915cf44cb1689dc9046b3ee184173`; plus
  `party-invitation-deny.png`, `chat-hub-global.png`, `chat-boneyard-party.png`,
  and the desktop `boneyard-without-direct-player-light.png`.
- Publication state: branch `claude/nameplate-redesign-20260821` only. No push,
  deployment, or production change.
