---
status: proposed
---

# Lower a friendly authoring layer onto the Web Lua 1.0 graph

Web Lua 1.0 keeps one declarative definition graph, atomic admission, digest
reverification, and host-only rules. Above that graph the definition runtime
accepts a shorter authoring form: every `sd.*` constructor registers what it
creates, `sd.mod` is optional, content keys derive from names, content keys and
asset paths stand in for `sd.ref` and `sd.art.ref`, lists of effects stand in
for `sd.all`, potions default their `on_use` and `duration` from a `status`, and
`sd.include` splits a package across scripts that pack-time bundling folds back
into one entry script. The friendly form is lowered to the explicit graph before
validation, so the two forms compile to the identical graph digest. Diagnostics
carry the script file and line that created a value, and suggest close names
for unknown members, globals, fields, events, references, and assets. This
chooses beginner throughput and strong error messages over a smaller runtime
surface, and keeps the graph as the only contract the host and backend see.

## Consequences

- The graph, compiler output, content catalog, host, and backend are unchanged;
  the definition runtime, the schema and compiler messages, and the pack command
  grew.
- Auto-collection means a constructed but unused kit or asset enters the graph;
  an effect created outside a rule or content field is rejected instead of being
  dropped.
- Derived content keys make `name` load-bearing. Renaming a name without writing
  the key renames the content identity, so the guide recommends explicit keys
  once a package has saves.
- Packages stay single-entry-script at the format boundary. Included scripts
  ship as a trailing bundle line whose graph is proven equal at pack time and
  reverified by digest at session admission; the backend and inspector need no
  change.
- The predicate grammar (`equals`, `not_equals`, `above`, `below`, `at_least`,
  `at_most`, `all`, `any`, `none`) is finite and serializable, so `sd.when`
  stays data rather than a callback.
- Definition scripts have a 250 ms budget, strict globals, and read-only `sd`
  namespaces, so mistakes surface at `sdmod check` with a file and line rather
  than at play time.
