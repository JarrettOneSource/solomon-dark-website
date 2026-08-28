# Final survival-combat browser acceptance — 2026-08-15

The final browser runs use ordinary UI, keyboard, and pointer input against an
authoritative host. Their deterministic seeds and collision planners exist
only in the smoke constructors; no debug teleport, damage, spawn, death, wave,
or loadout control is exposed to production clients.

## Solomon, waves, combat, projectile, death, and second run

The frozen single-player waves journey exited 0 after 527.061 seconds. Its
exact JSON receipt is
`/tmp/solomon-dark-waves-spawn-placement-final-receipt.json`, mode 0444,
17,518 bytes, SHA-256
`552fe2d3a28e461de3dc18dd0811c6822d2874e43e4aac36acbb7cb88e6bc730`.
It proves:

- a 47-node physical route crossed the replicated gate and reached Solomon's
  `speaking` contact; ordered hello/laugh/taunt cues led to the run event and
  an opening population of 10 with five pending;
- one accepted Fire cast retired Skeleton actor 3 and emitted the semantic
  shatter plus stock Skeleton death cue;
- the retail schedule advanced after 42 kills to Archer actor 61 and Arrow
  projectile 16; 22 authoritative motion samples were rendered before its
  once-only retirement event at tick 48012;
- ordinary enemy damage drove the player from 28.359 HP through dying to
  spectating, emitted DeathGuitar, and reached Game Over; the then-current
  manual acknowledgement returned to retained loadout. This receipt is now
  superseded for Game Over lifecycle acceptance by the 2026-08-16 reopening;
- confirmation created a different run ID with the same zero seed, alive
  50-HP/100-MP player, zero enemies, active phase, and Solomon digging again;
  browser/page and wire error arrays were empty.

The 1600x900 artifacts are the `-speaking`, base run/opening, `-combat`,
`-archer-projectile`, `-death`, `-game-over`, and `-loadout` siblings of
`/tmp/solomon-dark-waves-spawn-placement-final.png`.

## Two-player spectator, Game Over, and same-session loadout

The final self-hosted two-browser journey exited 0 with empty host and guest
console/page-error arrays. The designated host died first and reached
`spectating` at death tick 192 while the guest remained alive at 32.891 HP.
The host selected semantic `player-2`, and both `cameraFocusX/Y` values exactly
matched that participant's rendered authoritative sample.

Left and right clicks preserved/wrapped the sole valid target; attempted
movement and casting produced displacement 0 and mana 100 to 100 while the
camera continued following the moving guest. After the proof window, ordinary
combat killed the survivor and both frames entered the same run's `game-over`
phase. The host Continue control was enabled, the guest control said it was
waiting for the host, retained Fire/Ether loadouts exposed confirmation only
to the host, and one host confirmation returned both semantic players to the
same Hub with player count 2.

Artifacts and SHA-256 values are:

- `/tmp/solomon-dark-multiplayer-first-death.png` —
  `29edad51524b49cc43899505046ebcc502ea340abcf5e31e63d28bacd1246f1a`;
- `/tmp/solomon-dark-multiplayer-game-over.png` —
  `81b5b444d47e1d57eac138c1e4911e6e55c7b780217eb9225c03fa79badea8b0`;
- `/tmp/solomon-dark-multiplayer-loadout.png` —
  `a162250068752936af061dc256e08c1c50a184619847ebb308a2660c3d87418d`;
- `/tmp/solomon-dark-multiplayer-returned-hub.png` —
  `4c986dfac0a8c8137a5b43f6758beb2ff3805f7aac2789cb6ad1a7730a6d367f`.

## Skill, spell, audio, and collision surfaces

- The real SkillPicker browser journey selected among three offered actions,
  committed skill 21, and projected booked rank 2 without page/console error.
- The five-element primary-spell matrix exited 0 with an empty error array.
  Ether and Fire emitted their one-shot actors/cues; Air and Water emitted and
  stopped their channel loops; Earth crossed opening, mid, and high assembly,
  release/impact, and Boneyard held/release states with authoritative mana and
  pose samples. Its ten screenshots are under
  `/tmp/solomon-dark-primary-final/`.
- The audio journey exited 0 with native title/selection/academy/Boneyard
  music, click/cast/element/skill/spell cues, four Hub footsteps, eight
  Boneyard footsteps at exact 25-tick semantic spacing, and no browser error.
- The two-player Boneyard collision journey exited 0 against geometry SHA-256
  `7877af1cf88fcb133f229106e7ea813974b9411fa47104038980d66af177000d`;
  the initially coincident actors resolved to 50.29 units and retained 50
  units of passive displacement. Its artifact is
  `/tmp/solomon-dark-boneyard-collision-final.png`.

## Final supported validation

After all runtime, test, smoke, package, and ledger changes above,
`./scripts/validate.sh` exited 0. It restored the pinned toolchain; built the
backend with zero warnings and errors; passed all 23 Website/backend contract
tests; passed frontend lint and game architecture boundaries; passed the full
test-project TypeScript and Node battery; built the production Website and
authoritative game host; and passed deployment CSP media policy. Output
contained only the repository's existing Fast Refresh warnings and Vite's
non-fatal large-chunk advisory.
