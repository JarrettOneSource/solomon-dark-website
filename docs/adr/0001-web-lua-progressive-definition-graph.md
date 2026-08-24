---
status: proposed
---

# Build Web Lua 1.0 around a progressive definition graph

Web Lua 1.0 will target only the Solomon Dark Website, keep Lua on the game host,
and atomically compile one immutable mod definition graph before play. Beginner
kits and prefabs will expand into the same graph as raw advanced definitions;
authority-only advanced reducers may return validated state and intents when a
finite rule graph is insufficient. Browsers will interpret trusted presentation
models and will not run mod Lua. This chooses predictable multiplayer, atomic
failure, automatic lifecycle ownership, and junior usability over a larger flat
`sd.*` surface, fluent runtime handles, per-client Lua, or compatibility with the
retired native Mod Loader.

## Consequences

- Stable content identity, authority routing, replication, persistence, timing,
  asset ownership, and teardown live behind the framework interface.
- The Website must version its definition, rule, intent, and presentation schemas.
- Novel simulation behavior uses a transactional reducer; novel client rendering
  requires a new bounded Website-owned presentation primitive.
- API `0.2.0` receives a finite migration window and an offline converter, not a
  permanent compatibility layer inside the 1.0 runtime.
