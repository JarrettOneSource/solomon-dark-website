# Renderer quality checks

The [2026-09-05 candidate measurements](Game%20Native%20Parity%20RE/287-2026-08-27-complete-stock-renderer-and-game-wide-vfx-reflection-reopening.md#current-implementation-acceptance--candidate-3bbfdf9e)
identified 29 surviving diagnostic-name/label mutations. The CI repair below
classifies those reviewed equivalents explicitly. Behavioral mutations remain
subject to the existing 100% threshold; ignored equivalents stay visible in
the raw report and are never credited as killed.

The test cleanup removes unused CPU shader-math copies and their tests. GPU
pixel checks and the Water mesh's geometry, ordering, and lifecycle tests remain;
diagnostic labels are not asserted merely to increase the mutation score.

The presentation checks measure the complete runtime owners listed in
[`scope.mjs`](../frontend/tools/quality/scope.mjs). The scope includes the four
original files and their shared batch, surface, and texture-color responsibilities.
It also includes the runtime progression comparison that refreshes InventoryScreen
after equipment changes, with its regression tests. Callers whose only change
imports the canonical implementation remain outside this measurement scope.
Test probes and analyzer adapters are development tooling.

Run from the Website root with the pinned Node/npm versions:

```sh
npm --prefix frontend ci --no-audit --no-fund
npm --prefix frontend run quality:renderer:static
npm --prefix frontend run quality:renderer
```

The static command runs the analyzer contract tests, complexity and source
checks, Knip, and jscpd. The full command also runs Node and Chrome/WebGL
coverage, computes CRAP, and runs a fresh Stryker mutation campaign. The full
command is part of `./scripts/validate.sh`. Browser execution uses Playwright's
installed stable Chrome channel on Linux and macOS; `SDR_CHROME_PATH` selects
another executable. The canonical script creates an isolated Python test
environment from `tests/requirements.txt`, including Pillow for asset tests.
GitHub Actions provisions Python 3.12 and checks that Chrome is installed.
The workflow allows 60 minutes for the complete fresh mutation campaign.
The deployment worker allows 90 minutes for validation, packaging, and cutover.

A failing stage stops the quality command immediately. For example, a browser
launch failure must be reported before any dependent CRAP or mutation work;
missing downstream reports are not additional root causes.

| Gate | Implementation | Required result |
| --- | --- | --- |
| Cyclomatic complexity | ESLint classic, each callable and field initializer | `< 22` |
| Cognitive complexity | SonarJS, each callable's own control flow | `< 22` |
| Halstead Difficulty | estree-halstead, complete callable subtree including signature and nested functions | `< 80` |
| Source size | Physical authored lines, including comments and blanks | `< 1000` per file |
| Explicit prohibited types | TypeScript AST `any`/`unknown` keyword nodes | `0` |
| Coverage | Istanbul, every scoped file initialized with zero counts, merged Node and browser execution | `100%` statements, branches, functions, and lines |
| CRAP | Original formula using measured executable-line coverage per callable | `< 25` |
| Dead code | Knip production browser/host graph; gate scoped unused files, exports, types, enum members, duplicate exports, and unresolved references | `0` findings |
| Duplication | jscpd mild mode, minimum 5 lines and 50 tokens | `0` duplicate blocks |
| Mutation | Stryker 9.6.1 default mutators, TypeScript checker, Node tests and real GPU probes | `100%` valid non-equivalent mutant score; no surviving, uncovered, pending, or unjustifiably ignored mutants |

The [research note](renderer-quality-analyzers-research.md) records the pinned
analyzer sources and metric definitions. The adapter tests exercise private
fields, constructors, methods, accessors, nested and same-line arrows,
optional/nullish expressions, malformed input, and coverage ownership.

Istanbul instruments TypeScript after position-preserving type erasure. It does
not count transpiler helpers as authored statements. The GPU probes separately
check shader output, context restoration, atlas sampling, retained transforms,
staff draw plans, and resource disposal. Stryker mutates TypeScript and shader
string literals; it does not parse the GLSL operators inside those literals.

CRAP uses `C² × (1 − coveredLines / executableLines)³ + C`. Statement positions
belong to the smallest containing function body, so executing an arrow's
declaration cannot credit its uncalled body on the same line. Missing function
instrumentation fails the measurement. At full line coverage, CRAP equals the
method's cyclomatic complexity.

Reports are generated under `frontend/reports/renderer-quality/`:

- `summary.json` and `static-summary.json`: machine-readable gate results.
- `complexity.json` and `crap.json`: every measured implementation unit.
- `coverage/`: JSON/HTML reports, source digests, and raw Node/browser counters.
- `mutation/`: the complete Stryker JSON and HTML reports.
- `dead-code/`: the complete Knip graph findings and the scoped result.
- `duplication/`: the jscpd report.

Complexity, coverage, CRAP, and mutation inputs must match the current source.
Stale or incomplete inputs fail report generation. Stryker incremental reuse is
disabled because its command runner cannot track changes to the browser probes.
The TypeScript checker uses the production tsconfig and its accurate strategy.
Invalid typed programs remain visible as `CompileError`; they are not counted
as killed. Stryker 9.6.1 uses Babel 7 and supports the pinned Node 22.17.0;
Stryker 10's Babel 8 dependency requires at least Node 22.18.0 on the Node 22
release line.
All mutation statuses remain visible. A surviving mutant still fails the gate.
Only an `Ignored` mutation with a nonempty `Equivalent: ` reason can be accepted;
an empty run, or one containing only compile errors and equivalents, fails.
`summary.json` includes the location, mutator, and reason for every accepted
equivalent under `equivalentMutants`. The mutation-summary regression tests
cover survivors, missing coverage, unfinished runs, unjustified ignores, and
the distinction between reviewed equivalents and detected mutations.

## Reviewed equivalent mutations

The 2026-09-05 CI review examined all 29 survivors at 20 source locations against
the installed Pixi 8.19.0 implementation and the production callers:

| File | Mutations | Reviewed effect |
| --- | ---: | --- |
| `native-material-batch.ts` | 3 | Shader-bit names label generated GLSL comments. |
| `native-fixed-function-render-pipeline.ts` | 7 | Shader-bit comments and the unused `SHADER_NAME` diagnostic macro. |
| `native-arena-render-pipeline.ts` | 8 | Shader-bit comments and the unused `SHADER_NAME` diagnostic macro. |
| `boneyard-building-surface-view.ts` | 2 | A shader diagnostic name and GPU buffer label. |
| `native-boneyard-surface-view.ts` | 6 | Scene labels with no runtime lookup consumers, including two label-only options objects. |
| `player-enchant-staff-view.ts` | 3 | Scene labels with no runtime lookup consumers, including one label-only options object. |

Pixi's [shader compiler](https://cdn.jsdelivr.net/npm/pixi.js@8.19.0/lib/rendering/high-shader/compiler/compileHighShader.mjs)
keys shader-bit caching by object identity and templates, not names.
[`addBits`](https://cdn.jsdelivr.net/npm/pixi.js@8.19.0/lib/rendering/high-shader/compiler/utils/addBits.mjs)
uses names only as comment delimiters, while
[`setProgramName`](https://cdn.jsdelivr.net/npm/pixi.js@8.19.0/lib/rendering/renderers/gl/shader/program/preprocessors/setProgramName.mjs)
adds the unused diagnostic macro. The resource labels neither supply shader
data nor control scene ownership. Production code does not look up these
specific scene labels.

The exceptions use Stryker's documented
[`disable next-line` comments with reasons](https://stryker-mutator.io/docs/stryker-js/disable-mutants/).
They apply only to the reviewed `StringLiteral` mutations and the three
label-only `ObjectLiteral` mutations. There is no global mutator exclusion,
file exclusion, lowered threshold, or removal of debug names. Shader code,
blend and sampling strings, branch conditions, resource disposal, and geometry
remain eligible for mutation. Revisit an annotation if its label becomes a
lookup key or its options object gains behavioral properties.

The generated reports and Vite cache are ignored by Git. Durable measurements
and lifecycle findings belong in the
[native renderer ledger](Game%20Native%20Parity%20RE/287-2026-08-27-complete-stock-renderer-and-game-wide-vfx-reflection-reopening.md).
