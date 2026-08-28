# 2026-08-20 — Solomon Dig state-0 digging audio emitter

## Reported smell and parity question

- Reported web behavior: Solomon Dig animates in the default Boneyard but his
  repeated digging has no shovel impact or thrown-dirt sound.
- Stock behavior to recover: the full state-0 sound recurrence, including both
  sample pools, cursor gates and rearming, RNG draw order, spatial gain,
  lifecycle, and every branch that is intentionally silent.
- Reproduction scene: a default generated Boneyard from entry until player
  contact, with the camera both near and outside the native attenuation bands;
  custom Boneyards without the retail encounter are the negative scene.
- Falsifiers: either native call is pitch-and-gain rather than gain-only; an
  asset outside registry rows 209/210/222/223 is reachable; sound is keyed to a
  rendered frame rather than the authoritative cursor; or contact/scene exit
  explicitly stops an already-started sample.

This reopens the 2026-08-14 Solomon encounter entry. That pass stopped after
recovering the visible frame program and voice/wave state, and did not drain
the state-0 audio bytes, registry rows, or cursor perturbation branches. Under
the current system-membership rule, the earlier perpetual five-tick loop was
not a complete disposition of the native digging system.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | retail `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; read-only Ghidra project; constructor `0x00481C20`; state-0 body/instructions `0x00481FC0..0x0048249C` | Constructor gates are program slots `4` and `15`; armed bytes are `+0x240/+0x248`; cursor recurrence, strict comparisons, RNG draws, rearm, and contact ordering are instruction-derived. | high |
| Instructions | call spans `0x00482061..0x0048207A` and `0x004820E5..0x004820FE`; `Sound::Play(gain) 0x00407B70`; hit-point gain `0x004622D0` | Both pools use fixed pitch `1.0`. Shovel passes `0.5 * hitGain`; dirt passes `hitGain`. No stop follows state transition. | high |
| Asset/data | `native-audio-catalog.json` rows 209, 210, 222, 223 and retail `sounds/shovel`, `sounds/throwdirt` | Exactly two shovel and two throw-dirt PCM variants exist; every file hash, size, sample rate, channel count, and bit depth is known. | high |
| Existing durable evidence | `native-audio-events.md`, `native-solomon-dig-and-wave-director.md`, and executable-wide immediate-offset sweep | The prior census correctly identified both pools but incorrectly described random pitch. Runtime play references are exclusive to `Solomon_Dig` state 0; other matching offsets are registry lifetime code. | high |
| Current web owner trace | `core-kernels/boneyard-encounter.ts`, `host/game-snapshot.ts`, protocol 30, `BoneyardScene.tsx`, `game-audio-native.ts`, `game-audio-assets.ts` at base `a4cf029` | Host advances only a uniform `1/5` phase and publishes voice events. No dig event, sample, manifest row, hit-gain projection, or browser playback path exists. | high |

Addresses are preferred-image virtual addresses at image base `0x00400000`.
No stale process, runtime base, or injected-loader observation is used in this
entry.

## System boundary and membership inventory

Native system: `Solomon_Dig` state-0 digging audio, from the authoritative
float32 cursor and two armed threshold bytes through uniform registry
selection, gain-only dispatch, browser playback, interruption, and teardown.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof required by this pass |
| --- | --- | --- | --- |
| shovel variant 1 | registry 209, `sounds\shovel\shovel1.wav` | exact-ported | exact PCM/hash manifest, cue-selection test, browser play receipt |
| shovel variant 2 | registry 210, `sounds\shovel\shovel2.wav` | exact-ported | exact PCM/hash manifest and pool-membership test |
| throw-dirt variant 1 | registry 222, `sounds\throwdirt\throwdirt1.wav` | exact-ported | exact PCM/hash manifest, cue-selection test, browser play receipt |
| throw-dirt variant 2 | registry 223, `sounds\throwdirt\throwdirt2.wav` | exact-ported | exact PCM/hash manifest and pool-membership test |
| cursor/rearm and RNG branch | `0x00481FC0`, fields `+0x218/+0x23C/+0x240/+0x244/+0x248` | exact-ported | deterministic per-tick event/cursor contract tests |
| Region hit-point gain, live player | vslot `+0x104 -> 0x004622D0` | exact-ported | inner/middle/outer attenuation tests; shovel half-gain assertion |
| Region hit-point gain, death/alternate presentation | `0x004622D0`, local actor byte `+0x160` | exact-ported | middle-band `0.1` test plus full/zero early-return tests |
| default opening placement mode 10 | builder `0x00465920`, type 5009 | exact-ported | authoritative snapshot and real default-Boneyard browser journey |
| later/random or scripted placement modes 2..5 | dispatcher `0x00467230`, same type 5009 class | verified-already-at-parity | no alternate audio implementation exists; any materialized type-5009 actor uses the same state body. General scripted materialization remains owned by the separately documented scripting subsystem. |
| placement modes 6..9 and empty/duplicate candidate branch | `0x00467230`, `0x00467160` | out-of-system (no `Solomon_Dig` actor exists to emit audio) | native placement inventory and web `solomonDig: null` negative test |
| states 1 turning, 2 speaking, 3 retreat, 4 escape/gone | dispatch `0x0048A8B0` | verified-already-at-parity (intentionally no dig request) | state-transition test proves no new dig event after contact; voice remains separately owned |
| audio-disabled/user-muted playback | Sound engine gate and browser audio director | verified-already-at-parity | semantic events still advance; the existing user audio gate suppresses output without changing simulation |
| late join/current-run hydration | native immediate calls; web latched snapshot transport | exact-ported | joining client initializes at latest event id and does not replay history |

No member is `blocked-by-platform`; Web Audio represents these four one-shots,
fixed pitch, overlap, and scalar attenuation directly. Stock's per-sample
ten-channel cap is unreachable under the recovered state-0 cadence because a
given variant's PCM finishes before that variant can recur.

## Native ownership thread

- Owner and construction: `Solomon_Dig 0x00481C20` constructs the program,
  threshold slots, armed bytes, initial cursor, and debris-motion draw. Arena
  dispatch `0x0048A8B0` invokes state 0 at 100 Hz.
- Upstream state: cursor begins at zero and advances in float32. Program wrap,
  not render completion or browser time, rearms both events.
- Transition graph: `cursor > 4` fires shovel once; `cursor > 15` fires dirt
  once before constructing debris; cursor jitter/slowdown runs; late-cycle
  contact may enter state 1; otherwise wrap optionally resumes at cursor 4.
- Downstream: `Integer(2)` selects a registry member, Arena vslot `+0x104`
  computes scalar hit gain, and `Sound::Play(gain) 0x00407B70` starts a fresh
  record at pitch one.
- Siblings: all type-5009 placement policies share the same state body. No
  other actor or registry consumer plays these four rows.
- Interruption/reset/teardown: contact prevents future emissions but does not
  stop a playing sample. A new constructed actor starts with fresh armed bytes;
  no actor means silence.

## Recovered behavioral contract

- Timing: add float32 `0.2`; fire on strict `>4` and `>15`; subtract unsigned
  native `Float(0.09)` in `(4,10)` or above `15`; subtract float32 `0.05` above
  `24`; wrap at `>=29`, optionally restart at `4`, then rearm.
- Order/randomness: shovel selection draw precedes that tick's cursor-jitter
  draw. Dirt selection precedes jitter and `Anim_Flydirt`. Wrap consumes
  `Integer(2)` and then `Float(5)`. The web owner must use the checked-in native
  55-word generator rather than a render-local random choice.
- Audio: shovel1/2 are a uniform pool at fixed pitch one and half hit gain;
  throwdirt1/2 are a uniform pool at fixed pitch one and full hit gain.
- Spatial model: source is Solomon's world root. Hit gain is one through the
  strictly-inside `0.1 * visibleWorldWidth` radius, linear to zero at
  `0.5 * visibleWorldWidth`, with the native death-presentation `0.1`
  multiplier on the interpolated branch. Exact equality at the inner radius
  is therefore death-damped.
- Network authority: the host chooses cue and monotonically identifies each
  one-shot. Clients consume each unseen id once; interpolation cannot invent or
  duplicate calls.
- Boundary: browser frame drops may delay presentation but cannot change event
  count, variant, ordering, or simulation recurrence.

## Nearby-system findings

- The prior native audio census labeled both calls as pitch-plus-gain with
  float-RNG pitch. Raw instructions prove gain-only calls and fixed pitch one.
  The sibling Mod Loader audio event table and Solomon report are corrected in
  this pass.
- The prior web dig animation's uniform five-tick cursor omitted native
  `Float(0.09)` perturbation, last-five-slot `0.05` slowdown, half-cycle resume,
  and rearm draws. Audio cannot be made authoritative while keeping that
  refuted clock.
- `Anim_Flydirt 0x00453A70` consumes no additional RNG; omitting that separate
  visual actor does not hide an audio-selection draw. Its presentation remains
  a nearby visual-system question, not an audio fallback.

## Confidence and open questions

- Confirmed: complete four-row membership, call wrappers, fixed pitch, gain
  formulas, thresholds, flags, cursor constants, RNG order, state membership,
  and lifecycle.
- Inferred: none used for implementation.
- Unknown: none within this audio-system boundary.

## Web implementation consequence

- Keep ownership in `boneyard-encounter.ts`; add bounded authoritative dig
  event history and exact native RNG/cursor recurrence.
- Extend the Solomon snapshot and protocol, with an explicit protocol bump, so
  every peer receives cue identity exactly once.
- Add all four untouched PCM assets and native manifest rows.
- Compute native hit-point attenuation in the Boneyard presentation owner and
  play gain-only one-shots at default playback rate.
- Remove the uniform cursor approximation; do not derive sounds from Pixi
  frames, React lifecycle, or wall-clock timers.

## Validation contract

- Focused tests cover strict threshold crossings, both pools, rearming/wrap,
  native RNG advancement, no post-contact event, event-history bounds, and
  late-join/no-replay selection.
- Asset tests pin all four SHA-256 hashes and registry offsets. Protocol tests
  require ordered bounded cue/id rows and reject unknown cues/duplicates.
- Spatial tests cover live/death inner, middle, and outer hit-gain branches and
  exact shovel `0.5` versus dirt `1.0` multipliers.
- A real Chromium default-Boneyard journey must observe both event families,
  more than one checked-in variant over deterministic runs, default playback
  rate one, nonzero near-camera gain, one play per event id, no event after
  contact, and no page/console errors.
- The exact tree must pass `./scripts/validate.sh`; the sibling Mod Loader RE
  contracts must pass after the corrected fixed-pitch evidence is recorded.

## Implementation validation receipt

- `core-kernels/boneyard-encounter.ts` now owns the exact float32 cursor
  perturbation/slowdown, native 55-word RNG draw order, strict shovel/dirt
  gates, wrap rearming, bounded monotonic cue history, and contact cutoff. The
  former uniform five-tick approximation is gone. Protocol 34 carries the
  bounded cue rows through snapshots and interpolation without replaying
  hydration or a new run.
- `game-audio-native.ts`, `game-audio-assets.ts`, and `BoneyardScene.tsx` own
  the four exact registry WAVs, fixed pitch-one requests, strict native
  hit-point attenuation, shovel half gain, dirt full gain, and one-time local
  playback. All four checked-in PCM hashes match retail.
- The exact rebased Website tree at `origin/main` base `b874445` passed
  `./scripts/validate.sh`: 40 loot tests, 140 prerequisite tests, 981
  Boneyard/frontend tests, 5 level-up tests, 6 diagnostics tests, 14 Hub UI
  tests, and 5 desktop tests; both production builds, the game-entry budget
  (`202,475` raw / `58,792`
  gzip), and media policy passed. The log is
  `/tmp/solomon-dig-audio-validate-final-push.log`, SHA-256
  `1aef88fd4e9015268efc949afb57a57109cea958f359572edb13454639911a51`.
- The sibling Mod Loader CI-safe RE suite passed 489/489 on rebased
  `origin/main` base `167a9ad1`. Its JSON receipt is
  `/tmp/solomon-dig-audio-loader-re-publish.json`, SHA-256
  `6df05b308c4bbe0e7aa480c2ef835f0a39a0585d731db1dd3a74f0948e3b8338`.
- The real 1600-by-900 Chromium default-Boneyard journey decoded and started
  `shovel-1`, `shovel-2`, `throw-dirt-1`, and `throw-dirt-2`, all at playback
  rate `1.0`. Entry-camera events correctly had zero gain. At a collision-safe
  distance of `209.3706` world units, shovel playback reached `0.404179` while
  the paired dirt envelope reached `0.808359`, preserving the exact half/full
  relation. The cue id advanced monotonically, stopped advancing after
  contact, and the journey completed dialogue, retreat, the opening ten-enemy
  wave, and entrance retirement with empty page, console, and wire error
  lists. The log is `/tmp/solomon-dig-audio-browser-publish.log`, SHA-256
  `2f0f30687bfe40a31be7a05e58bf52d38bb0a42a807d78931c27ace24409ac4a`;
  the speaking frame is `/tmp/solomon-dig-audio-browser-publish-speaking.png`,
  SHA-256
  `fb57860a4acf3b5da9b64504bf2f07b5c9dedfde1f73df592208129b0db3cef0`.
- No audio-system member is blocked by the browser platform and no unknown
  remains in this boundary. General scripted Solomon materialization and the
  separate `Anim_Flydirt` visual actor remain owned by their already-declared
  scripting/presentation systems; neither substitutes for or weakens this
  complete audio emitter.
