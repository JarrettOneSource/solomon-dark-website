# Native audio ownership, cues, and clocks

The stock audio system is scene-owned. It is not the website jukebox and it
does not assign one generic hover/down sound to every browser button. The
native `MyApp` constructor builds a 233-entry registry at `0x004EE010` under
`DAT_008199D8`; the recovered catalog contains 171 `Sound` objects, 40
`SoundStream` objects, and 22 `SoundLoop` objects. `Sound::Start`
(`0x00407B70`) creates overlapping one-shots, while positional start
(`0x00407CD0`) applies a caller-supplied gain. `SoundStream::Play`
(`0x0040AF70`) owns one persistent channel per registered stream and restarts
that channel. Music owns two module channels and transitions by name through
`0x00409CD0`; `Music::Tick` (`0x00409610`) advances the incoming and outgoing
gains by `1 / transitionTicks` on the already-recovered 100 Hz game clock.

## Hail one-shot channel saturation

Overlap is bounded per native `Sound`; it is not an unlimited voice stream.
The four grouped Hail registry constructions at `0x004F1CDD`, `0x004F1D33`,
`0x004F1D89`, and `0x004F1DDF` each push `10` before constructing the by-value
path argument and calling `Sound_Load` at `0x004F1D24`, `0x004F1D7A`,
`0x004F1DD0`, and `0x004F1E26`. `Sound_Load` returns with `ret 0x20`; its final
dword is read from `[ebp+0x24]`, passed as the `max` argument to
`BASS_SampleLoad`, and stored at `Sound +0x20`.

The channel acquisition helper at `0x00407A20` first scans the Sound-owned
channel list. `BASS_ChannelIsActive(channel) == 1` keeps a channel occupied;
any inactive channel object is reused. If every retained channel is active,
instructions `0x00407A8F..0x00407A95` compare the list count with
`Sound +0x20`; a count greater than or equal to ten returns null at
`0x00407B5E` without calling `BASS_SampleGetChannel` or
`BASS_ChannelPlay`. Only a count below ten allocates another 16-byte channel
record and obtains a sample channel.

`Anim_Hail` therefore may request every native bounce edge, but each of its
four sample variants owns at most ten simultaneous channels: forty audible
Hail voices in total. Saturated requests are intentionally inaudible and do
not replace an active voice. Browser playback must preserve the same
per-sample active-voice gate and release capacity only when that exact sample
source ends. Creating an unbounded `AudioBufferSourceNode` and `GainNode` for
every replicated Hail edge is not native overlap.

The browser channel objects must also be retained. A normal Web Audio
`AudioBufferSourceNode` is one-use, so enforcing ten active nodes while
destroying and recreating a node and gain after each 0.11--0.26-second sample
still does not match the `Sound` list at `+0x08..+0x1C`. The stock list keeps
its ten 16-byte channel records and `0x00407A20` reuses an inactive record.
For Hail, the browser equivalent is one scene-owned audio-render-thread mixer
with four resident PCM buffers and ten persistent logical slots per buffer.
An admitted request resets one inactive slot to sample position zero with the
unchanged pitch and gain. The slot becomes inactive only after that PCM voice
finishes; saturation still rejects without replacing an active slot. The
shared mixer output passes through the existing game master gain and teardown
retires the processor once with the audio director.

The current scope changes music as follows:

| Owner | Native call site | Module entry | Transition |
| --- | --- | --- | --- |
| Title construction | `0x0058D940` | `solomondarktheme`, order 5 | default 100 ticks |
| Create/loadout construction | `0x00593C30` | `selection`, order 7 | default 100 ticks |
| Courtyard entry | `0x00508B20` | `academy`, order 6 | explicit 2 ticks |

The default duration comes from `MyApp + 0xC00`, initialized to `100` by
`0x0040B6B0`. Music therefore crossfades for one second on Title/Create and
20 ms on Courtyard entry. The source is `music/music.mo3` plus
`music/music.txt`, not the normalized website playlist. Browser game renders
must preserve the module start and source level: no silence trimming and no
loudness normalization. The source module SHA-256 is
`32bf92cc3191e136b6d186d77d75de48ad28f4bd58acae0c278204455fa57c82`.

## Title buttons

The shared native `Button` stores hover, press, and release sound pointers at
`+0x80`, `+0x84`, and `+0x88`. Pointer enter (`0x00430AC0`) plays only
`+0x80`; pointer down (`0x00430890`) and keyboard activation (`0x00430CF0`)
play `+0x84`; pointer up (`0x00430A40`) plays only `+0x88`. The four Title
buttons created by `0x0059A9D0` set only `+0x84` to registry offset `+0x18`,
`sounds\\click`; hover and release are null. The Create back skull is wired
the same way at `0x0059AD01`. These controls therefore play `click.wav` at
gain 1 on enabled press/keyboard activation and are silent on hover and
release. Disabled controls do not play. There is no separate Title select
cue. The exact source SHA-256 is
`8aeebcfeb69625bee2ee78fe9c63939e6b40edcc89d5facf2c0d35e1b5920307`.

## Create/loadout sequence

`CreateWizardMenu` owns its sounds from construction through finalization.
The hover handler at `0x0058BB50` only updates hit state/cursor and is silent.
The accepted element and discipline branches in the click handler
`0x0058BCE0` both play registry offset `+0x44`, `sounds\\pickskill`, at gain
1 immediately. Entry and selection then follow native fixed-update clocks:

- 200 ms after entry starts, countdown `120` reaches `100` and
  `sounds\\StartCast__Stream` begins;
- when the left hand reaches raised state at about 1.34 s, StartCast pauses,
  `sounds\\ChooseElement__Stream` begins, and element hit targets become live;
- 980 ms after an element click, its hand recurrence settles and plays the
  element one-shot: Ether `magicmissile`, Fire `throwfire`, Air
  `lightningstart`, Water `icestart`, or Earth `rockhit`, all at gain 1;
- on the next 100 Hz tick StartCast restarts, then pauses when the right hand
  settles at about 1.64 s and ChooseElement restarts as disciplines appear;
- a discipline click starts the native 50-tick hold/final recurrence; about
  880 ms later `sounds\\catchit__stream` plays and the Create scene completes.

`SoundStream` restart semantics matter here: the two ChooseElement calls reuse
and restart the same registered stream, and each StartCast call restarts its
channel rather than creating overlapping copies. The selected WAVs remain
bit-for-bit copies of the stock files. Their registry mapping is recorded in
`../Mod Loader/docs/reverse-engineering/native-audio-catalog.json`.

## Courtyard movement and Teacher cast

The common actor update at `0x00548B00` gates its entire movement-owned branch
on `actor[+0x158]^2 + actor[+0x15C]^2 > 0.01f`. Only after that gate passes can
the local player (`actor+0x5C == 0`) request a footstep on a global 100 Hz tick
divisible by 25. Normal release damping remains physically active for 21 ticks
from steady cardinal movement, then the threshold suppresses MoveStep, gait,
the surface query, its RNG draw, and sound together. Residual velocity below
the threshold is not movement and must remain silent. Requested movement still
owns gait and sound when collision blocks placement.

Courtyard surface test slot `+0x118` resolves to `0x005088F0`, an unconditional
false result, so the local Courtyard player randomly selects only registry
offsets `+0x23B8/+0x23E4`, `sounds\\Step\\step1` or `step2`. It never selects
`woodstep` there. The gain-only call multiplies region slot `+0x100` by `0.5`;
for the local listener-source pair that is gain `0.5`. Browser cadence must be
published by the authoritative 100 Hz player simulation at the exact tick of
the native decision. A client must consume a newly published event once; it
must not reconstruct old events from velocity snapshots or replay crossed
tick multiples as an audible burst after a gap.

Teacher update `0x0050B260` calls `Teacher::Cast` (`0x00505560`) once when its
267-tick charging pose releases, 4.45 s into the native 60 Hz Teacher cycle.
That helper plays registry offset `+0x1014`, `sounds\\summon`, at randomized
pitch `1.0..1.1` and gain `0.25 * attenuation`. Courtyard attenuation slot
`+0x100`, `0x005006C0`, measures source-to-local-player distance. It returns
1 through 150 units, falls linearly to 0 at half the active render width, and
clamps to a minimum of 0.25. `Region` base construction at `0x00652830` gets
that width from application state at `+0x1DC`; the recovered 1600-wide web
camera therefore uses an 800-unit radius. The audio release must share the
Teacher presentation clock so the burst and sound cannot drift.

## 2026-08-15 physical-iPhone playback ownership correction

An iPhone XR running iOS 18.7.6 and Safari 26.4 reproduced the reported
Boneyard stalls while moving and casting Earth. A clean 45.062-second Hub
receipt held 2,703 animation frames with 17 ms p95, 18 ms p99, a 28 ms
maximum gap, and no gap above 34 ms. During the exact Boneyard reproduction,
the same animation-frame and independent 25 ms timer probes both stopped for
long intervals: only 33 animation callbacks arrived in 30.222 seconds, with
848 ms median, 1,683 ms p95, and 1,822 ms p99/maximum frame gaps. No resource
load occurred during that capture. The agreement between both clocks proves
main-JavaScript-thread blocking rather than a renderer-only missed frame.

WebKit `ScriptProfiler` samples localized more than 53 percent of the active
stacks to synchronous `HTMLMediaElement.play()` calls reached from
`GameAudioDirector.playSound`, primary-spell loop starts, and primary-spell
one-shots. A transparent timing wrapper then retained real playback while
measuring 115 calls during the exact movement/cast flow. Known synchronous
time totaled about 4.667 seconds: `step2.wav` blocked for 2.193 seconds over
40 calls with a 505 ms maximum call; `step1.wav` blocked for 1.543 seconds
over 35 calls with a 358 ms maximum; and the Earth gather, rolling, and start
cues supplied most of the remainder. That run reached a 568 ms p99 and
1,446 ms maximum animation-frame gap. This directly falsifies a GPU,
snapshot-rate, or asset-download explanation for the reproduced freezes.

The browser loader had already fetched every audio URL, but that byte cache
was not the playback owner: `GameAudioDirector` constructed a fresh
`HTMLAudioElement` for every `Sound` request and every `SoundLoop` restart.
The native registry instead keeps samples resident, creates lightweight
overlapping channels from a resident `Sound`, retains one channel per
`SoundStream`, and retains one channel per `SoundLoop`. The browser ownership
contract is therefore:

- decode all `Sound`, `SoundStream`, and `SoundLoop` WAVs into one resident
  Web Audio buffer bank during the existing loader stage;
- create a new buffer-source channel for each overlapping `Sound` request,
  restart one keyed buffer-source channel for each `SoundStream`, and balance
  one keyed looping channel across all semantic owners of a `SoundLoop`;
- keep module-derived music on preloaded media channels so long tracks remain
  streamed, but reuse those loaded elements and retain the recovered
  authoritative scene selection and crossfade clocks; and
- resume the shared interactive audio context from the existing capture-phase
  user-gesture unlock, stop every owned source on teardown, and never fall
  back to per-cue `new Audio(...).play()` on the gameplay hot path.

Stock movement dispatch is local-player-only because `PlayerActor::Tick`
requires byte `+0x5C == 0`. Web multiplayer nevertheless simulates and
replicates each participant's authoritative `footstepTick`; remote movement
audio is an explicit multiplayer extension, not a newly claimed stock call
site. Each client must consume a changed tick once for every participant in
the listener's current Boneyard run or Hub region, select the deterministic
Step1/Step2 approximation from `(tick, playerId)`, apply the recovered `0.5`
base gain and Region distance attenuation, and suppress initial/repeated
snapshots. Primary-spell sounds and loops already follow the same replicated
same-world rule. Music selection remains driven by the replicated run/wave
phase, so clients choose the same gameplay entry without attempting an
invented cross-client sample clock.

The correction is accepted only if a real-device repeat preserves music,
Create streams, local and remote footsteps, spell starts/loops/releases, and
teardown while eliminating the long main-thread stalls. Desktop emulation is
supporting evidence only; the decisive receipt must again report physical
iPhone p95, p99, and maximum frame gaps during movement and casting.

The corrected production bundle passed that repeat on the same iPhone XR. An
idle Boneyard control delivered 601 frames in 10.023 seconds: frame p95 and
p99 were both 17 ms, the maximum was 27 ms, and neither the animation-frame
nor independent timer probe recorded a gap above 34 ms. A separate 30.012
second movement-and-Earth-cast pass delivered 1,800 frames with 17 ms p95,
18 ms p99, a 31 ms maximum, and zero gaps above 34 ms.

The instrumented audio confirmation then ran for 20.023 seconds while the
authoritative snapshot advanced from tick `25912.1` to `27913.2`, the player
traveled 329.27 units horizontally and 176.57 vertically, all five walk poses
appeared, and the renderer observed Earth, called-rock, and Earth-impact
states with as many as 40 simultaneous spell presentations. It consumed 47
distinct authoritative footstep ticks and started 72 resident Web Audio
buffer sources, including the keyed Earth loop. Every `start()` returned
within Safari's 1 ms timer resolution and the hot flow made zero
`HTMLMediaElement.play()` calls. Frame p95 was 20 ms, p99 was 24 ms, maximum
was 43 ms, with three gaps above 34 ms and none above 50 ms. The independent
timer reached 26 ms p99 and 56 ms maximum, with no gap above 100 ms. The user
also visually confirmed that the corrected physical-device flow looked good.
This replaces the reproduced 568 ms p99 / 1,446 ms maximum audio-stall receipt
without changing the 100 Hz simulation or 20 Hz snapshot clocks.

An isolated two-client Chromium journey then verified replicated ownership,
not merely local playback. Both clients consumed the same five-cue Hub
footstep sequence and the same five-cue Boneyard sequence from the moving
guest's authoritative ticks. The mover heard each cue at gain `0.5`; the
observer heard the same cues once with distance attenuation. Both clients
also consumed one remote Fire emission, started the same keyed Earth gather
loop, stopped that exact channel when the cast released, and started the
rolling-stone loop. Academy and Prelude each started once per client at the
authoritative Hub and Boneyard entries. Neither client made a gameplay-effect
`HTMLMediaElement.play()` call, and the journey reported no page or console
errors. Music is therefore scene-synchronized and replicated cue lifecycles
are client-consistent without claiming sample-accurate network music phase.

## Web ownership consequence and open questions

The `/game` route must stop and detach the public-site jukebox and its generic
pointer sounds. A game audio director owns the three scene music states,
overlapping native `Sound` one-shots, keyed `SoundStream` channels, autoplay
unlock, crossfades, and cleanup. Scene components emit recovered semantic
events; they do not know asset paths or create arbitrary audio timers.

That ownership boundary includes mute state. `/game` must not read or migrate
the public site's `sdr:muted` or `sdr:sfx-muted` local-storage preferences;
those keys govern only the public-site jukebox and effects rail. Native game
music and effects start enabled independently of those preferences. Any future
game mute control must be game-owned rather than bridged back to site state.

Confidence is high for every registry object, call site, gain, music name,
transition tick count, Create ordering, footstep cadence/surface choice, and
Teacher release/attenuation rule above. Global native RNG sequence is not
reproduced by the web, so equal-probability step choice and Teacher pitch are
deterministic/testable approximations within the recovered native ranges.
Browser media decoding and autoplay policy cannot reproduce BASS itself; the
implementation must preserve the requested scene at time zero and begin it on
the first permitted user gesture rather than silently skipping the intro.

Evidence: fresh read-only Ghidra decompilation and instruction traces for
`0x00406DE0`, `0x00407B70`, `0x00407CD0`, `0x00409610`, `0x00409CD0`,
`0x0040AF70`, `0x00430430`, `0x00430890`, `0x00430A40`, `0x00430AC0`,
`0x00430CF0`, `0x004EE010`, `0x005006C0`, `0x00505560`, `0x00508B20`,
`0x00548B00`, `0x0058A820`, `0x0058BB50`, `0x0058BCE0`, `0x0058D940`,
`0x00593C30`, and `0x0059A9D0`; the durable native reports
`../Mod Loader/docs/reverse-engineering/native-audio-system.md` and
`../Mod Loader/docs/reverse-engineering/native-audio-catalog.json`; and the
stock files under `SolomonDarkAbandonware/music` and
`SolomonDarkAbandonware/sounds`.

## 2026-08-13 footstep lifecycle correction

The reported mismatch reproduced in the current web kernel without changing
assets: after movement through tick 100 and release, the snapshot inference
emitted footsteps at ticks `125`, `150`, `175`, and `200`, while stock emitted
none of them. The web movement plan kept applying exponentially small deltas,
and `nativeMovementOccurredBetween` separately treated any residual velocity
above `0.01` units per second as movement. Both rules contradicted the native
per-tick squared-displacement gate and made the audible error unbounded.

Fresh read-only analysis used retail `SolomonDark.exe` SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `0x00400000`. Instructions `0x0054AD54..0x0054AD7B`
perform the strict `0.01f` comparison and jump over the movement-owned branch;
`0x0054AE6E..0x0054AE94` enforce local slot zero and tick modulo 25;
`0x0054AF92` and `0x0054AFEC` dispatch wood and default-ground sounds.
Courtyard vtable `0x00792644` maps attenuation slot `+0x100` to `0x005006C0`
and surface slot `+0x118` to the unconditional-false `0x005088F0`. The durable
native contract is in
`../Mod Loader/docs/reverse-engineering/native-audio-events.md`.

Implementation consequence: the shared player kernel must suppress placement
and gait once the exact native displacement gate fails. The authoritative
server tick must latch the resulting 25-tick footstep event into replicated
player state; Hub audio consumes a changed event tick once and retains the
existing exact Step WAVs, deterministic two-choice approximation, and gain
`0.5`. Client-side velocity/snapshot-gap inference is removed completely.

Confidence is high for branch ownership, threshold, cadence, local-player
gate, Courtyard surface choice, assets, and gain. The web still cannot match a
particular retail run's Step 1/2 sequence because native selection shares its
RNG stream with unrelated gameplay draws. Special state `actor+0x154 == 2`
and non-Courtyard region surfaces lead to the separately recovered splash and
wood branches; their world-material ownership remains outside this Courtyard
correction rather than being guessed here.

### Implementation validation receipt

The finished Website tree passed the canonical `./scripts/validate.sh` gate:
the backend Release build, all 23 Python contract/integration tests, all 147
frontend tests, all 5 desktop tests, the production frontend/game-host build,
and the production media CSP check. Protocol version 6 and player-kernel
version `kernel-2` carry both the strict `0.01f` movement threshold and the
authoritative `footstepTick` event latch through host, client prediction, and
presentation snapshots.

A fresh Chromium session exercised real input and the shipped media paths. Its
first three held-movement footstep dispatches were separated by `239.9 ms` and
`239.3 ms`, used only the exact `Step 1.wav` / `Step 2.wav` family at gain
`0.5`, and resolved media starts without console or page errors. Release
admitted one cadence-phase-dependent tail step, then issued no further
footstep request for the next `700 ms`; this distinguishes stock's finite
physical release tail from the former unbounded residual-velocity loop.

The companion Mod Loader report was checked in a fresh NTFS worktree with
`Verify-Workspace.ps1 -Configuration Debug`: source organization passed for
721 source/header fragments, the loader plus launcher/UI/updater built with 0
errors (29 pre-existing C4702 warnings), all 40 mods were listed disabled, and
the isolated `verify-footsteps-ntfs-20260813` stage completed with the binary
layout and debug-UI configs present. The verifier ended with `Workspace
verification passed`; it did not launch or alter the stock game installation.

## 2026-08-12 implementation validation receipt

The integrated Website validation gate passed after rebasing onto
`e94d462`: backend Release build with zero warnings/errors, all 22 Website
contract/integration tests, frontend lint and game-boundary checks, all 95
frontend tests, and the production frontend/game-host build. A real Chromium
run against the authoritative local game host then observed, in order,
`solomondarktheme`, `selection`, and `academy`; silent Title/Create hovers;
press and keyboard `click`; both StartCast and ChooseElement stream cycles;
`pickskill`, the Fire reveal, and `catchit`; repeated 0.5-gain Courtyard
footsteps on authoritative tick boundaries; and the Teacher `summon` at
0.0625 gain and pitch 1.075896. No unexpected site music or browser errors
were observed. The browser receipt is reproducible with
`npm run smoke:game-audio`. The separate game-runtime Chromium smoke also
passed with authoritative player movement, all five walking poses, advancing
robe and Teacher frames, and no page or console errors.

## 2026-08-28 iPhone streamed-music gain reopening

### Reported smell and process correction

- Owner report: the `MUSIC VOL:` slider changes on mobile but has no audible
  effect.
- This reopens the audio system because the earlier Settings receipt proved the
  stored scalar and the director's abstract channel value, but did not prove the
  effective iPhone output sink. That skipped the platform branch in the
  downstream-consumer sweep.
- The parity question is therefore not one slider event. It is whether every
  streamed-music gain producer reaches an output mechanism that iPhone Safari
  can actually attenuate while retaining streamed residency, native scene
  selection, transition clocks, and teardown.

### Evidence and causal trace

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Reused retail audio evidence | retail `SolomonDark.exe` 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `Music::Tick 0x00409610`, transition owner `0x00409CD0`, audio apply `0x005D8FC0 -> 0x00407340` | User music gain multiplies both active native music channels while the 100 Hz transition envelope continues independently. | high |
| Current Website trace | Website `origin/main` `6220c5a7`; `GameSettingsDialog.tsx -> game-settings.ts -> MainMenuScene.tsx -> GameAudioDirector.setVolumes`; `game-audio-browser.ts` | Slider input and persistence reach the director. Sound uses a Web Audio master `GainNode`, but current/outgoing scene music, silent priming, and mod music all assign `HTMLAudioElement.volume`. | high |
| Apple iOS platform contract | Apple, *Safari HTML5 Audio and Video Guide*, “iOS-Specific Considerations,” retrieved 2026-08-28, `https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html` | On iOS the media-element `volume` property is not settable and reads as `1`; a scalar can change in React while effective output remains full volume. | high |
| Apple Web Audio path | Apple, *Playing Sounds with the Web Audio API*, retrieved 2026-08-28, `https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/PlayingandSynthesizingSounds/PlayingandSynthesizingSounds.html` | Safari/iOS supports routing an existing media element through `createMediaElementSource()` and controlling a downstream `GainNode`. This retains streaming rather than decoding whole music tracks. | high |
| Complete Website assignment census | `rg '\.volume\\s*=' frontend/src` at `6220c5a7` | The only production raw media-volume writers are game scene/mod music, the public-site jukebox fade, and public-site effects. No fourth production assignment family remains. | high |

The proven causal chain is: touch input updates `musicVolumePercent`; the
normalized scalar reaches `GameAudioDirector`; the director computes the right
user gain and transition envelope; the browser adapter writes that result to a
property iOS fixes at one. The fault is the final output adapter, not touch
dispatch, persistence, React state, scene ownership, or the recovered native
clock.

### System boundary and complete membership

System: every Website streamed `HTMLAudioElement` whose authored or live gain
must work on iOS, plus all Settings siblings needed to falsify a broader mobile
control failure. Resident game one-shots, loops, streams, and voices already
use Web Audio buffers and remain a separate output lane.

| Member | Disposition | Required result |
| --- | --- | --- |
| Title `solomondarktheme`, Create `selection`, Hub `academy`, Boneyard `prelude`, combat, and Game Over/death scene music | exact-ported | keep streamed media; route each element through a Web Audio gain; preserve scene choice, loop, current time, and native transition ticks |
| Current/incoming and outgoing transition envelopes | exact-ported | both gains change live on iOS; no full-volume overlap or abrupt stop replaces the recovered crossfade |
| Non-current music priming on the first permitted gesture | exact-ported | gain zero is effective before `play()`; no sibling song becomes audible while its reusable channel is armed |
| User `MUSIC VOL:` over active, outgoing, future, and primed channels | exact-ported | `0..100%` changes effective output immediately without changing the envelope or restarting playback |
| Web-mod `startAssetMusic` owners and authored gain | exact-ported | authored gain and user music gain multiply through the same effective output; stop/destroy disconnects task-owned media graphs |
| `SOUND VOL:` over resident one-shots, keyed streams, and loops | verified-already-at-parity | existing Web Audio master gain changes live and independently; modal sound mute still restores the newest value |
| Camera FOV, UI Scale, Light Quality range inputs | verified-already-at-parity | touch changes both displayed/stored values and the Hub/Boneyard renderer/HUD consumers |
| Settings toggles/actions, scrolling, Back/Done, and mobile fullscreen capability branch | verified-already-at-parity | touch reaches the existing consumers; unsupported iPhone fullscreen remains honest install guidance, not a fake toggle |
| Public-site jukebox start, fade-in/out, focus resume, mute, shuffle, and requested track | exact-ported as browser extension | the authored `0.09` gain and every fade use effective Web Audio gain; `/game` remains isolated from the site keys and lifecycle |
| Public-site effects rail and all quiet UI/ambient one-shots | exact-ported as browser extension | every caller-supplied gain uses effective Web Audio gain; mute stops and disconnects every active effect |

No member is `blocked-by-platform`: Web Audio media-element routing represents
the required MP3 streaming and gain on Safari/iOS. The pre-existing fullscreen
automatic-reentry platform limitation remains in the Settings ledger and is
unrelated to audio.

### Implementation and validation contract

- Put the platform adaptation in one browser media-gain module. Do not add an
  iPhone user-agent branch, duplicate slider callbacks, decode the long music
  catalog into resident buffers, or change native transition timing.
- The game browser adapter, site jukebox, and site effects must all consume that
  module. Graph disconnection must be idempotent; a retained game music channel
  must reconnect when reused after route teardown.
- Focused tests must model iOS by keeping the underlying media element volume at
  one while proving the routed gain follows zero, fractional, and full values;
  they must cover disconnect/reconnect and the director's active/outgoing/mod
  membership.
- A Mac mobile-browser journey must touch every Settings range and the relevant
  toggles, prove stored values and live Hub/Boneyard consumers, inspect the
  effective music gain with raw media volume fixed at one, and report page,
  console, and failed-response arrays. A public-site journey must prove the
  jukebox and effects use routed gains under the same platform model.
- The exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`
  on the Mac mini. Physical-iPhone auditory proof remains separately labeled if
  no device is attached; emulation is not upgraded into a device receipt.

### Implementation and validation receipt

- `media-element-gain.ts` is the one browser adaptation. It routes a streamed
  media element through `MediaElementAudioSourceNode -> GainNode ->
  AudioContext.destination`, clamps the effective gain, disconnects
  idempotently, and reconnects on reuse. It never writes the media element's
  platform volume.
- `game-audio-browser.ts` wraps every retained scene channel and every mod music
  channel in that output. `GameAudioDirector` preserves all recovered envelope
  math and now disconnects mod channels on stop and retained channels on route
  teardown. The site jukebox and effects rail use the same adapter through
  their separate site-owned context; the `/game` and public-site preference
  boundaries remain unchanged.
- The focused red test first failed because the adapter was absent. The final
  Mac run passed `47/47` audio tests, including an iOS model whose raw media
  volume always reads one, zero/fractional/full effective gain,
  disconnect/reconnect, every native crossfade/priming branch, and mod authored
  gain plus cleanup.
- On Apple arm64 macOS `26.6.2`, Chrome `151.0.7922.174`, a `896x414`, DPR 2,
  touch-enabled iPhone-user-agent journey forced raw media volume to remain
  `1`. Real touch moved all five ranges: Sound `100 -> 0`, Music `100 -> 0`,
  FOV `100 -> 75`, UI Scale `100 -> 75`, and Light Quality `100 -> 24` before
  setting the final test values. Effective game music was
  `0.4000000059604645`, sound master `0.6499999761581421`, public-site music
  `0.08932500332593918`, and its quiet effect `0.1599999964237213`, while every
  corresponding raw media value stayed `1`.
- The same journey proved Hub camera `0.96`, HUD scale `1.5`, Boneyard camera
  `1.08`, light quality `0.05999999865889549`, Complex Lighting/Shadows/
  Multiple Shadows Off, Zoom Effects Off, zero complex-shadow records, and
  empty page, console, and failed-response arrays. The desktop sibling journey
  passed the same Settings/Hub/Boneyard consumers with empty error arrays.
- The exact byte-identical local/Mac candidate passed the complete supported
  `/opt/homebrew/bin/bash ./scripts/validate.sh` gate: backend Release build and
  `28/28` contracts, lint/boundaries with only `17` pre-existing warnings,
  generated-content checks, `1,686/1,686` broad game tests, `76/76` ML host
  tests, the remaining focused frontend suites, `5/5` desktop tests,
  production frontend/game-host builds, media policy, and the game bundle
  budget (`262,692` raw / `79,676` gzip bytes).
- No physical iPhone was attached to the Mac mini, so this is not labeled an
  auditory device receipt. The platform cause is instruction-backed by Apple
  and the fixed-volume browser model proves the corrected output graph; a later
  physical listen is optional confirmation, not an undispositioned member.
