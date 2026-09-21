# Native Faculty burst entity decoding

Work session `6a583nbx`, 2026-09-21. The fourth real Windows/Mac endurance
attempt reached wave 32 and ended when both clients rejected a named equipment
identity. Three earlier paired replication stalls recovered. Their longest
backpressure interval was 3.747 seconds, with 64 snapshots skipped for Windows.
These are real pre-profiler observations; this change does not establish their
complete cause or resolve the separate equipment defect.

## Change

`uniqueEntityEntries` in `frontend/src/game/protocol/codecs/world.ts` now copies
healthy numeric rows with one indexed loop into a new owned array. It previously
constructed an intermediate slice and mapped array and formatted a field path
for every component. The fast path validates finite numbers directly. If a
component is malformed, the original component decoder runs on the error path,
preserving diagnostic text, error ordering, and sparse-array behavior.

Entity-count/component-count limits, ID validation, registration lookup, duplicate
checks, descriptor/sample validation, and output ownership remain in place. The
separate death-effect sample validator is unchanged.

## Matched measurement

A detached Mac Node 22.17.0 process decoded the same four saved native Faculty
payloads with old and new world codecs. Everything else in both full server-message
decoders was identical. Each shape had 12 warmups per variant, followed by eight
20-call blocks ordered reference/candidate/candidate/reference twice: 80 measured
calls per variant and shape. JSON parsing is included. Profiling was disabled for
these timing blocks. Process CPU includes runtime/GC helper threads.

| Native payload | Before decode | After decode | Wall-time reduction | Process CPU reduction |
| --- | ---: | ---: | ---: | ---: |
| One Faculty, delta | 6.766 ms | 5.161 ms | 23.73% | 20.72% |
| One Faculty, keyframe | 12.511 ms | 9.436 ms | 24.58% | 22.08% |
| Three Faculty, delta | 21.123 ms | 16.308 ms | 22.79% | 18.32% |
| Three Faculty, keyframe | 38.720 ms | 29.422 ms | 24.01% | 16.72% |

The delta fixture retains all current samples with an established descriptor
baseline. It does not create a new native trajectory. Both single and triple
peaks were produced earlier by real native Faculty death ticks; their saved
payload identities and decoded-output hashes are in the companion JSON.

Separate 64 KiB heap sampling included objects subsequently collected by both
minor and major GC. Across 300 single-Faculty delta decodes, sampled allocation
fell from 6,697.7 MiB to 2,767.6 MiB, **58.68%**. This is cumulative sampled
allocation volume, not retained heap. Neither comparison forced garbage collection.
The separate CPU/allocation profiles motivated this decoder change; their
instrumented elapsed times are not used in the table.

## Correctness and validation

All four old/new full decoded messages are deeply equal. Every decoded numeric
row is distinct from its input row, including the native peak arrays. An additional
146 malformed/boundary comparisons preserve exactly the old result or error name
and message, including nonnumbers, infinities, sparse rows, a hole followed by an
invalid value, duplicate rows, and component overflow.

The new canonical regression exercises owned row arrays and exact diagnostics
for each non-ID component in both samples and descriptors. The focused
investigation passed that test, the complete test TypeScript check, and changed-file
lint. The full frozen candidate gate is tracked by the parent as
`job_20260921T011922Z_359f785ac4` using `./scripts/validate.sh`; it was still running
when this receipt was finalized. The new decoder regression passed there as
test 1909 (3.923 ms), followed by the family-capacity regression as test 1910
(455.765 ms). The full gate result must still be checked before delivery.
The preceding combined gate stopped on an equipment fixture expectation; that
fixture was corrected by its author without changing this decoder.

Source identities:

- Original world codec: `4ea5e79c77e01eca16ffe33428ea196613c89d8c6d0450d79b32e6f04fb321bb`.
- Changed world codec: `0456bf07790dfdcf488226bc7b8de00c409304dba12e4ad073fb692acccca0d0`.
- Changed entity replication test: `bd92264a208bf1dea69dfbc32d5c068f065e0f5cd0fd93d44a0de10a9ba42548`.

## Limits and corrected preliminary evidence

This is a controlled decoding-path comparison. It does not measure Windows or
Mac browser FPS, GPU behavior, network transmission, or the entire authoritative
host loop. The real two-client endurance target remains both players naturally
entering wave 101. The measured triple-peak decoder still has substantial cost.

The fourth host profile began only after the final observed backpressure recovery.
Its 325.708 ms first sample spans Inspector startup and must not be attributed to
ordinary death-effect stepping. The archive's 327.978 ms worst core tick overlaps
that attachment. Only about 8.75 seconds of subsequently sampled execution preceded
the first disconnect; most of the 45-second capture is idle/post-disconnect hub work.

The first standalone full-core benchmark also had a fixture defect: the stored
native peak advanced its enemy clock while the unrelated loot store remained
272/275 ticks behind. Repeated full steps therefore measured artificial loot
catch-up. Those full-core results and their CPU/allocation profile are explicitly
invalidated in their receipts and `TIMING-CORRECTION.json`; no live loot bottleneck
is inferred from them. A subsequent diagnostic settled unrelated clocks with one
untimed full step, but remains a representative derived fixture. This issue does
not affect the full decoder comparison, which never advances simulation.

Raw comparison: `/tmp/solomon-decode-comparison-6a583nbx-run1/receipt.json`.
Job: `job_20260921T011512Z_1cfa62ce73`, exit 0. The companion
[JSON receipt](performance-entity-decoding-20260921.json) contains raw timing blocks,
input/output/source hashes, allocation totals, comparison counts, and artifact
identities. Root's overall endurance report remains the source for final run and
canonical validation outcomes.
