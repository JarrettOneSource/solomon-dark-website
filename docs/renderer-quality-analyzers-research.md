# Renderer quality analyzers

**Research date:** 2026-09-05  
**Scope:** TypeScript renderer complexity and CRAP measurement. This note defines the selected tools and measurement semantics. Analyzer execution, integration checks, and production measurements run on the Mac mini.

## Selected dependencies

Use the existing npm toolchain with these exact versions. Registry metadata confirms their compatibility with the frontend's Node 22.17.0: ESLint requires Node `^22.13.0` on the Node 22 release line, the parser accepts ESLint 10 and TypeScript `>=4.8.4 <6.1.0`, and SonarJS accepts ESLint 10. ([ESLint 10.10.0](https://registry.npmjs.org/eslint/10.10.0), [parser 8.69.0](https://registry.npmjs.org/@typescript-eslint/parser/8.69.0), [SonarJS 4.2.0](https://registry.npmjs.org/eslint-plugin-sonarjs/4.2.0))

| Measurement | Package | Unit and gate |
| --- | --- | --- |
| TypeScript parsing | `@typescript-eslint/parser@8.69.0` | Original source with locations and ranges |
| Cyclomatic complexity | `eslint@10.10.0`, core `complexity` rule | Each callable, classic variant, `< 22` |
| Cognitive complexity | `eslint-plugin-sonarjs@4.2.0`, `sonarjs/cognitive-complexity` | Each callable's own control flow, `< 22` |
| Halstead Difficulty | `estree-halstead@0.4.0` | Each complete function/method AST subtree, `< 80` |
| CRAP | Original CRAP formula with measured per-callable line coverage | Each callable, `< 25` |

`estree-halstead` 0.4.0 is a published MIT-licensed package requiring Node `>=18.18`. Its release points to commit `c25c3e76b27e30cc7080ecfe8609c744bcf7228c`; its published dependencies use TypeScript-ESLint 7 visitor keys. Use the locked package and verify its combination with the selected current parser on the actual scoped source. ([Release metadata](https://registry.npmjs.org/estree-halstead/0.4.0), [package source](https://github.com/ota-meshi/estree-halstead/blob/c25c3e76b27e30cc7080ecfe8609c744bcf7228c/package.json))

## Halstead API and exact boundary

`analyze(node)` accepts an ESTree or TypeScript-ESTree node and returns `difficulty`, `vocabulary`, `length`, `volume`, `effort`, `time`, and `deliveredBugs`. `extractTokens(node)` exposes operator/operand collections with `distinctSize` and `totalSize`. Difficulty is `(distinct operators / 2) * (total operands / distinct operands)`; the package uses an operand ratio of one when there are no operands. Record the raw counts with the returned difficulty for auditability. ([Published implementation](https://github.com/ota-meshi/estree-halstead/blob/c25c3e76b27e30cc7080ecfe8609c744bcf7228c/src/index.ts))

The syntax visitors explicitly handle arrows, methods, constructors represented as methods, private identifiers, optional member/call access, nullish operators, TS accessibility modifiers, and type annotations. `PrivateIdentifier` contributes its `#name` as an operand. TS signatures remain part of the authored measurement. ([Token visitors](https://github.com/ota-meshi/estree-halstead/blob/c25c3e76b27e30cc7080ecfe8609c744bcf7228c/src/extract-tokens.ts), [private-member fixture](https://github.com/ota-meshi/estree-halstead/blob/c25c3e76b27e30cc7080ecfe8609c744bcf7228c/tests/fixtures/js/private-identifier.js), [TS method fixture](https://github.com/ota-meshi/estree-halstead/blob/c25c3e76b27e30cc7080ecfe8609c744bcf7228c/tests/fixtures/ts/method-definition.ts))

The adapter should use these boundaries:

- Enumerate `FunctionDeclaration`, `FunctionExpression`, and `ArrowFunctionExpression`, conveniently through ESLint's `:function` listener.
- For a class method, getter, setter, or constructor, measure its enclosing `MethodDefinition` once. For an object shorthand method/getter/setter, measure its enclosing `Property`. Their value `FunctionExpression` represents the same implementation; do not create a duplicate row.
- For other function expressions and arrows, measure the complete function node. Identify rows by file and source range, preserving a display name separately. Different anonymous functions must retain distinct rows.
- Do not measure only `node.body`: that removes the signature and changes which operators and operands the analyzer sees.

These adapter choices preserve the library's treatment of method parents and signatures. Its walker recursively visits the entire supplied subtree, including nested callable bodies. Therefore **Halstead is inclusive of nested lexical implementations**; report the nested callables separately too. Do not delete nested bodies, average their difficulties, or subtract child difficulties from a parent's difficulty. The counts of distinct operands/operators do not support that subtraction. ([Method/function visitors](https://github.com/ota-meshi/estree-halstead/blob/c25c3e76b27e30cc7080ecfe8609c744bcf7228c/src/extract-tokens.ts#L472), [walker](https://github.com/ota-meshi/estree-halstead/blob/c25c3e76b27e30cc7080ecfe8609c744bcf7228c/src/walker.ts))

The parser's `parseForESLint(source, options)` returns `ast`, `visitorKeys`, `scopeManager`, and `services`; `loc: true` and `range: true` provide positions. Alternatively, configure it as ESLint's language parser so the rule receives nodes with parent links. The metric call itself is simply:

```js
import { analyze, extractTokens } from 'estree-halstead'

const halstead = analyze(implementationNode)
const tokens = extractTokens(implementationNode)
```

Here `implementationNode` is the complete callable boundary above. This example specifies an API contract, not an alternative token counter. ([Parser API](https://typescript-eslint.io/packages/parser/), [Halstead API](https://github.com/ota-meshi/estree-halstead/blob/c25c3e76b27e30cc7080ecfe8609c744bcf7228c/src/index.ts))

## Cyclomatic and cognitive values

ESLint's classic rule starts a separate code-path counter at one, increments for branching constructs, and reports each function independently. It includes default arguments, logical assignments, and optional calls/member accesses. Class field initializers and static blocks have independent implicit-function counters. Keep those diagnostic kinds explicit if present; they must not be confused with named methods. ([ESLint rule source](https://github.com/eslint/eslint/blob/v10.10.0/lib/rules/complexity.js), [rule documentation](https://eslint.org/docs/latest/rules/complexity))

SonarJS 4.2.0 maintains `functionOwnComplexity` independently of its file aggregate and nested-function calculations. Its per-function diagnostic uses that own-function value. The file metric is a different aggregation and must not replace per-function numbers. ([Published SonarJS rule](https://github.com/SonarSource/SonarJS/blob/8cb7855fdbf857c00674edbf2e2b421bda4dbd49/packages/analysis/src/jsts/rules/S3776/rule.ts))

For ordinary enforcement, a maximum of `21` implements the strict `< 22` gates. For a numeric inventory, both rules accept threshold zero and report values strictly greater than it. With a successful parse, every explicit callable must have a cyclomatic result; an enumerated callable without a cognitive diagnostic at threshold zero has cognitive complexity zero. Match diagnostics by source location to the normalized callable boundary, never by display name alone. Parse failures, unmatched diagnostics, or missing callable records are measurement failures. ([ESLint implementation](https://github.com/eslint/eslint/blob/v10.10.0/lib/rules/complexity.js), [SonarJS implementation](https://github.com/SonarSource/SonarJS/blob/8cb7855fdbf857c00674edbf2e2b421bda4dbd49/packages/analysis/src/jsts/rules/S3776/rule.ts))

## CRAP with measured line coverage

The original CRAP definition is `C² * (1 - coverage/100)³ + C`, where `C` is the method's cyclomatic complexity and coverage comes from automated tests. Its authors specifically used basis-path coverage. A global function-coverage percentage or a single boolean “this function was called” does not measure that method's covered code. ([Original authors' definition](https://www.artima.com/weblogs/viewpost.jsp?thread=215899))

An established line-coverage variant appears in `phpunit/php-code-coverage` 12.5.2. It computes executed/executable lines per method and function, then supplies that percentage to CRAP when path coverage is unavailable. A body with no executable lines has line coverage 100 in this implementation. ([Method calculation](https://github.com/sebastianbergmann/php-code-coverage/blob/12.5.2/src/Node/File.php#L387), [function calculation](https://github.com/sebastianbergmann/php-code-coverage/blob/12.5.2/src/Node/File.php#L415))

Report **CRAP (line coverage, original formula)**, retaining `C`, covered executable lines, total executable lines, and the raw score per callable. Apply the original formula without rounding before `< 25`. PHP's `CrapIndex` has a display shortcut that collapses coverage at or above 95% to `C`; the proposed raw calculation deliberately retains the original formula throughout, so it is not an exact emulation of that display shortcut. At 100% coverage, CRAP equals `C`. ([PHP calculation](https://github.com/sebastianbergmann/php-code-coverage/blob/12.5.2/src/Node/CrapIndex.php), [original formula](https://www.artima.com/weblogs/viewpost.jsp?thread=215899))

Implementation requirements for the Istanbul adapter: map executable statements to callable source ranges before forming each callable's executable-line set, use original source positions, and retain same-line column distinctions during ownership mapping. Otherwise an executed declaration can falsely credit the body of an uncalled one-line arrow on the same physical line. Missing instrumentation or an absent coverage record is unmeasured, rather than 100%. Keep the separate statement, branch, function, and line coverage gates; line-based CRAP does not establish basis-path or branch coverage. These are integration requirements derived from the chosen measurement boundary.

## Alternatives inspected

- `ts-complex` 1.0.0 was published in 2018 and depends on TypeScript `^2.8.3`. Its AST token classifier only recognizes ordinary identifiers/literal kinds as operands, and it stores named-function results by unqualified name, allowing identical method names in different classes to overwrite each other. It is a poor default for the current TypeScript renderer. ([Package metadata](https://registry.npmjs.org/ts-complex), [Halstead source](https://github.com/anandundavia/ts-complex/blob/e8d33c0398ac8477b56e7124d40047401e320d56/lib/src/services/halstead.service.js), [name utility](https://github.com/anandundavia/ts-complex/blob/e8d33c0398ac8477b56e7124d40047401e320d56/lib/src/utilities/name.utility.js))
- `typhonjs-escomplex` 0.1.0 was published in 2018. Its public API accepts external ASTs, but parser acceptance alone does not establish modern-node metric support; the inspected Babylon syntax plugin has `ClassMethod` support without a `ClassPrivateMethod` handler. The selected package has direct modern TypeScript and private-member visitors. ([Package registry](https://registry.npmjs.org/typhonjs-escomplex), [API](https://docs.typhonjs.io/typhonjs-node-escomplex/typhonjs-escomplex/class/src/ESComplex.js~ESComplex.html), [syntax plugin](https://github.com/typhonjs-node-escomplex/escomplex-plugin-syntax-babylon/blob/d0ce535ccebb2f8afc4bc991db6611fcd7e01ce5/src/PluginSyntaxBabylon.js))
- Mozilla `rust-code-analysis` recognizes TypeScript method and arrow spaces. Current source at `37e5d83c056c8cbf827223d5814a93c5218df1a9` uses Rust edition 2024 and Tree-sitter TypeScript 0.23.2, while the latest published 0.0.25 release is from 2023 and provides Linux/Windows x86_64 binaries only. Its TypeScript Halstead classifier omits private-property identifiers; cyclomatic excludes nullish/optional decisions counted by ESLint; cognitive has different lambda nesting semantics. Its JSON complexity sums and Halstead maps merge child spaces. It adds a Rust installation and semantic caveats that the selected npm tools avoid. ([Current manifest](https://github.com/mozilla/rust-code-analysis/blob/37e5d83c056c8cbf827223d5814a93c5218df1a9/Cargo.toml), [release assets](https://github.com/mozilla/rust-code-analysis/releases/tag/v0.0.25), [TS classifiers](https://github.com/mozilla/rust-code-analysis/blob/37e5d83c056c8cbf827223d5814a93c5218df1a9/src/getter.rs#L230), [cyclomatic](https://github.com/mozilla/rust-code-analysis/blob/37e5d83c056c8cbf827223d5814a93c5218df1a9/src/metrics/cyclomatic.rs#L159), [cognitive](https://github.com/mozilla/rust-code-analysis/blob/37e5d83c056c8cbf827223d5814a93c5218df1a9/src/metrics/cognitive.rs#L395), [space aggregation](https://github.com/mozilla/rust-code-analysis/blob/37e5d83c056c8cbf827223d5814a93c5218df1a9/src/spaces.rs))

## Integration evidence still required

On the Mac mini, exercise the selected adapter on the scoped files and a small syntax/ownership fixture containing a constructor, TS-private method, `#private` member, getters/setters, object method, nested arrow, same-line arrows, and optional/nullish expressions. Confirm each callable appears exactly once, that parent/child metrics have the declared boundaries, and that coverage ownership does not credit uncalled bodies. This research inspection does not claim those executable checks passed.
