# Solomon Dark Web Modding

This glossary defines the shared language for authored content and behavior in
the Solomon Dark web port. The Website is the sole runtime target; the retired
native Mod Loader is not part of this context.

## Packages and definitions

**Mod Package**:
An immutable, versioned archive containing one mod definition and its owned assets.
_Avoid_: plugin, native mod, loader package

**Mod Definition**:
The complete immutable graph of content, rules, and presentation declared by a mod package.
_Avoid_: entry script, registration script, mod instance

**Content Definition**:
One immutable authored concept in a mod definition, such as an item, spell, enemy, shop, or scene.
_Avoid_: object, row, registration

**Content Key**:
The permanent mod-local name from which a content definition's stable identity is derived.
_Avoid_: numeric ID, native subtype, recipe UID

**Content Reference**:
An opaque, serializable reference to a content definition owned by this mod, a declared dependency, or the stock catalog.
_Avoid_: pointer, handle, raw content ID

**Content Instance**:
A live occurrence of a content definition, such as one dropped item, active status, enemy, spell field, or room visit.
_Avoid_: definition, registration

**Definition Graph**:
The complete set of content definitions and their typed references, validated as one atomic unit before play.
_Avoid_: load-order registry, callback collection

**Kit**:
A beginner-facing constructor that expands into ordinary definition-graph nodes with safe defaults.
_Avoid_: special runtime, template engine

**Prefab**:
A reusable Website-owned behavior or presentation recipe referenced by a content definition.
_Avoid_: arbitrary script, native function

## Behavior and lifetime

**Rule**:
A bounded declaration that maps a semantic event and condition to framework-owned effects.
_Avoid_: hook, patch, event handler

**Advanced Reducer**:
An authority-only function that receives immutable semantic input and returns complete next state plus validated intents atomically.
_Avoid_: raw mutation callback, tick hook

**Intent**:
A validated request for the Website authority to perform one semantic operation.
_Avoid_: packet, direct mutation, RPC

**Status**:
A scoped, potentially timed set of modifiers and presentation owned by one target.
_Avoid_: timer table, buff callback

**Scope**:
The ownership lifetime that determines replication, persistence, and automatic teardown for live mod state.
_Avoid_: global table, manual cleanup list

**Definition Phase**:
The pre-play phase in which the Website evaluates and atomically validates a mod definition.
_Avoid_: startup tick, runtime registration

**Simulation Authority**:
The game host that alone decides shared modded gameplay outcomes for a party.
_Avoid_: client host, local owner

**Presentation Model**:
A bounded read-only model interpreted by trusted browser renderers without executing mod Lua in the browser.
_Avoid_: client Lua, DOM script, draw packet stream

## Gameplay content

**Item**:
Content that can exist in an inventory, equipment slot, shop, or world carrier and has stable save identity.
_Avoid_: pickup, potion

**Potion**:
An inventory item consumed to apply one or more effects to its user.
_Avoid_: powerup, status

**Powerup**:
A world pickup that applies its effect immediately instead of entering inventory.
_Avoid_: potion, item drop

**Affix**:
A persistent modifier attached to equipment by generation or an authored service.
_Avoid_: reforge effect, native effect row

**Affix Pool**:
A deterministic weighted collection of affixes applicable to specified equipment families.
_Avoid_: reforge table, random effect list

**Skill**:
A ranked progression definition that can grant passives, spells, statuses, or other capabilities.
_Avoid_: spell, perk row

**Subskill**:
A skill whose prerequisite and presentation parent are another skill or spell.
_Avoid_: anonymous spell upgrade, nested callback

**Spell**:
A castable primary or secondary action with authority-owned admission, cost, targeting, behavior, and lifecycle.
_Avoid_: skill, VFX

**Enemy Archetype**:
An authored hostile definition combining a verified behavior base with stats, attacks, loot, and presentation.
_Avoid_: actor instance, native enemy type

**Boneyard**:
A validated authored combat-world definition that supplies geometry, waves, environment, and named anchors to a party run.
_Avoid_: room, arbitrary binary overlay

## Interaction and worlds

**Shop**:
An authority-owned catalog and transaction policy attached to an NPC or other interaction point.
_Avoid_: inventory screen, trader actor

**UI Surface**:
A bounded declarative browser presentation with read-only bindings and typed authority intents.
_Avoid_: React component, DOM overlay, client script

**Scene**:
A loaded world context with one authoritative lifecycle, transition policy, and presentation catalog.
_Avoid_: screen, route, room

**Room**:
An authored place within a scene graph, with geometry, anchors, props, and ambience.
_Avoid_: scene, Hub region ID

**Anchor**:
A stable semantic location or object attachment point declared by a room or exposed by a stock scene.
_Avoid_: raw coordinate, array index, pointer

**Trigger**:
A bounded condition attached to an anchor or volume that submits a declared intent when activated.
_Avoid_: polling callback, collision patch

**Portal**:
A trigger whose accepted intent transitions a player or party to a destination room or scene.
_Avoid_: teleporter script, raw region switch
