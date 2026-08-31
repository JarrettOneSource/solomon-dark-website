# Web Lua showcase mods

These three packages are both tutorials and the Web Lua 1.0 acceptance suite.
Each package must stay small enough for a junior developer to read from top to
bottom. Shared engine behavior belongs in Web Lua, not in copied helper code.

## Teaching rules

- One idea per short local variable.
- Define assets first, content second, and `sd.mod` last.
- Prefer `sd.kit`, `sd.rules`, `sd.effect`, and `sd.prefab` over reducers.
- Use a reducer only when the example genuinely needs persistent procedural
  state.
- Comments explain *why* a field exists, not Lua punctuation.
- No compatibility shims, callback wrappers, generic utility libraries, or
  copied engine logic.
- Package tests read like examples and exercise the real definition.

## 1. Apprentice Apothecary

The beginner package adds a material, timed ward potion, survey-orb world
pickup, robe affix, two-row shop, reforge service, and Minimap.

Public surfaces:

- assets: `sprite`, `sound`, `ref`;
- content: `item`, `potion`, `status`, `powerup`, `affix`, `affix_pool`, `shop`,
  `ui`;
- rules: `on`, `all`, `first`, `when`;
- effects: `resource`, `grant`, `status`, `spawn`, `state`, `present`;
- prefab: `minimap`;
- state scope: `participant-profile` for the one-time tutorial purchase marker.

The package should teach this progression:

1. declare an icon;
2. create a stackable ingredient;
3. create a status and potion that applies it;
4. create an immediate pickup;
5. put the items in a shop;
6. add a reforge pool;
7. add the Minimap without browser code.

Acceptance:

- purchase and reforge commit through the real host and browser controls;
- player-scoped stock and semantic purchase state remain viewer-specific;
- the powerup appears in the Boneyard, animates, plays its sound, and appears on
  both clients' Minimap;
- save data restores in a fresh prepared host without orphan state.

## 2. Gravity Lesson

The intermediate package. It adds one offered skill and three deliberately
small spells that demonstrate area, projectile and channel behavior.

Public surfaces:

- assets: `sprite`, `sheet`, `sound`, `ref`;
- content: `skill`, `spell`, `status`;
- rules: `on`, `all`, `after`, `every`;
- effects: `damage`, `status`, `present`;
- prefabs: `area`, `projectile`, `channel`;
- reducer scopes: `participant-run` for a lesson streak and `session` for a
  deterministic demonstration counter;
- schemas: `object`, `integer`, `number`, `boolean`;
- intents: `resource`, `state`, `present`.

The three spells remain independent examples:

- **Gravity Well**: one area with repeated damage and a caster protection status;
- **Comet Pebble**: one projectile with collision and impact presentation;
- **Steady Beam**: one short caster-owned channel with repeated line hits.

Acceptance:

- the skill appears in the real level-up barrier, Skill Book and quickbar;
- its rank modifies Gravity Well and survives save/resume;
- host and guest casts dedupe, spend mana once, respect cooldown, damage legal
  targets and show matching VFX/audio;
- active effects and bounded timers checkpoint and restore deterministically;
- run teardown retires the package's timers and state scopes.

## 3. Monument Crypt

The advanced package. A Boneyard Monument opens a two-room party crypt with a
custom animated Grave Keeper, then returns the party to the exact suspended
parent run.

Public surfaces:

- assets: `sheet`, `music`, `sound`, `scene`, `boneyard`, `ref`;
- content: `enemy`, `boneyard`, `room`, `scene`, `scene_extension`, `spell`,
  `status`;
- effects/intents: `spawn`, `damage`, `status`, `grant`, `state`, `present`;
- prefabs: `portal`, `projectile`, `area`;
- reducer scopes: `entity` for the boss phase, `party-run` for crypt progress,
  and `scene` for doors/chests;
- schemas: `object`, `array`, `enum`, `integer`, `number`, `string`, `boolean`.

Its Grave Keeper sheet is rendered from a downloaded Quaternius CC0 animated
3D model by the checked-in Blender workflow. The package contains the derived
PNG and source attribution, not the source-pack archive.

Acceptance:

- both clients complete the Boneyard asset-readiness gate before simulation;
- the trusted room overlay replicates the same room index and party map;
- the enemy moves through Boneyard collision, attacks, takes damage, awards
  gold/XP, and renders the same animation/heading to host and guest;
- save/resume restores the scene stack, encounter and reducer state;
- Return restores the exact parent checkpoint with no duplicate actors/events;
- teardown closes enemies, music, presentation and scoped state.

## Executable coverage

The headless showcase suite admits and runs all three packages. Browser smokes
exercise their visible surfaces, while the separate wearable smoke covers the
existing Hat, Robe, and Staff path.
