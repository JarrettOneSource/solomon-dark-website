# Renderer quality checks

The [2026-09-05 candidate measurements](Game%20Native%20Parity%20RE/287-2026-08-27-complete-stock-renderer-and-game-wide-vfx-reflection-reopening.md#current-implementation-acceptance--candidate-480bfde6)
pass every source, coverage, and runtime check. The strict mutation gate remains
failing with 29 diagnostic-name/label survivors. These are recorded without
exclusions, and the follow-up has not been pushed to main.

The lighting/material follow-up measures the complete runtime owners listed in
[`scope.mjs`](../frontend/tools/quality/scope.mjs). The scope includes the four
original files and their shared batch, surface, and texture-color responsibilities.
Callers whose only change imports the canonical color helper remain outside this
measurement scope. Test probes and analyzer adapters are development tooling.

Run from the Website root with the pinned Node/npm versions:

```sh
npm --prefix frontend ci --no-audit --no-fund
npm --prefix frontend run quality:renderer:static
npm --prefix frontend run quality:renderer
```

The static command runs the analyzer contract tests, complexity and source
checks, Knip, and jscpd. The full command also runs Node and Chrome/WebGL
coverage, computes CRAP, and runs a fresh Stryker mutation campaign. The full
command is part of `./scripts/validate.sh`. Browser execution uses installed
Chrome on the Mac mini; `SDR_CHROME_PATH` selects another Chrome executable.

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
| Mutation | Stryker 9.6.1 default mutators, TypeScript checker, Node tests and real GPU probes | `100%` valid-mutant score; no surviving, uncovered, ignored, or pending mutants |

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
All mutation statuses remain visible, including equivalent mutations such as
changes to required shader diagnostic names. These are not suppressed or
credited as killed. A surviving mutant still fails the configured strict gate.

The generated reports and Vite cache are ignored by Git. Durable measurements
and lifecycle findings belong in the
[native renderer ledger](Game%20Native%20Parity%20RE/287-2026-08-27-complete-stock-renderer-and-game-wide-vfx-reflection-reopening.md).
