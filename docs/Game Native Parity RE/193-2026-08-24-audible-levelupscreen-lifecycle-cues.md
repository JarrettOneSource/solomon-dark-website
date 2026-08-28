# 2026-08-24 — Audible LevelupScreen lifecycle cues

## Reported smell and parity question

- Reported web behavior: the skill picker appears, but its level-up sounds are
  inaudible.
- Stock behavior to preserve: an ordinary local threshold requests
  `sounds\\levelup` once, the initial picker build requests `sounds\\openpanel`,
  and the remaining picker actions keep their recovered audible cue edges.
- Reproduction scenes: an owned three- or four-card picker in Hub and
  Boneyard; initial reveal, card selection, Sorceror's Charm reroll/save,
  queued rebuild, final close, and a peer-only cohort wait.
- Falsifiers: a retail `LevelupScreen` sound-mute acquisition; a picker cue on
  a different audio class; a queued offer that replays the threshold cue; or a
  Website request whose effective master gain is already positive.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions | Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, size `4,723,200`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; threshold `0x0067C250 -> 0x005C88B0 -> 0x00528A3E`; picker `0x00658620`, `0x0066F920`, `0x00671470`, `0x0067DF80` | The threshold requests entry 52 once. Initial build, card activation, reroll, save, queued rebuild, and close request entries 64, 1, 93, 0, 102, and 64 respectively. | high |
| Retail modal/audio ownership | `LevelupScreen` open `0x0067CAC0..0x0067CAED`, destructor `0x006588C0`; sound/music setters `0x004073A0` / `0x00407340`; `Audio::Pause 0x00407400` | The screen acquires gameplay suspension and requests `openpanel`; it does not change sound gain or call device-wide pause. | high |
| Durable native reports | Mod Loader `docs/skill-picker-re.md`, `docs/reverse-engineering/native-audio-events.md`, and `docs/reverse-engineering/native-gameplay-pause.md` | The complete audio membership and the absence of a modal sound-mute edge were already closed by static instruction/xref sweeps. | high |
| Website causal trace | `MainMenuScene.tsx`, `SkillPicker.tsx`, `game-audio-director.ts`, and `smoke-skill-picker.mjs` at Website `4021fce5` | `levelUpModalActive` drove `setSoundMuted(true)` in a layout effect before the threshold and picker effects requested their cues. The requests existed at the correct rates but were recorded at master gain zero. | high |

## System boundary and membership inventory

Native system: the complete local `LevelupScreen` sound lifecycle and its
adjacent PlayerActor threshold request. The Website's peer-only cohort waiting
surface is included because it shares the former mute predicate.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Ordinary one-or-many-level threshold | `0x00528A3E`, entry 52 `levelup`, gain/rate 1 once after the threshold loop | exact-ported | barrier identity arms one audible request; offer sequences cannot rearm it |
| Forced picker without a threshold | `0x0067C320` | verified-already-at-parity | no Website producer; future producer must not synthesize entry 52 |
| Three-card and Creativity four-card initial build | `0x0066FAA4`, entry 64 `openpanel`, gain/rate 1 | exact-ported | both owned layouts use the same audible screen entry |
| Pointer, keyboard, and gamepad focus | no native call | verified-already-at-parity | focus remains silent |
| Card activation and close | `0x00671635`, entry 1 `pickskill`; `0x00670D35`, entry 64 at rate 0.75 | exact-ported | action receipt and audible browser events |
| Sorceror's Charm reroll | `0x00671532`, entry 93 `summon` at rate 0.8 | exact-ported | one audible request per accepted reroll |
| Sorceror's Charm save and close | `0x00671568`, entry 0 `click`; `0x00670D35`, entry 64 at rate 0.75 | exact-ported | audible save lifecycle receipt |
| Queued-choice rebuild | `0x00670CD3`, entry 102 `unlockskill`, then the settled replacement | exact-ported | audible request with no threshold or initial-open replay |
| Local close tail | screen alpha/direction owner through teardown | exact-ported | sound stays live through the pitched close request |
| Peer-only cohort waiting surface | Website multiplayer extension with no local `LevelupScreen` | out-of-system (no corresponding native screen) | retains the existing non-music mute until the barrier releases |
| First-run Tutorial MsgBox | independent Title flow before New Game | out-of-system (pre-game navigation) | browser acceptance declines the real semantic `NO` action before entering the tested picker flow |
| Pause Menu and compact HUD selector | independent modal owners | out-of-system (different modal families) | their existing sound-only mute policy is unchanged |
| Registry entry 53 `levelupskill` | loaded with no retail dispatch | verified-already-at-parity | remains undispatched |

No member is blocked by the browser platform and no native row remains
undispositioned.

## Native ownership thread and recovered behavioral contract

- PlayerActor owns the one threshold request and 180-tick sparkle/light
  presentation. `LevelupScreen` separately owns entry, actions, rebuild, close,
  and teardown. Moving either cue family to an offer-sequence watcher would
  replay it on queued choices.
- Retail modal acquisition holds the actor world but does not mute audio. The
  screen-local `Sound` requests therefore reach the same live sound scalar as
  every other registry one-shot.
- The Website regression was downstream of every correct semantic request:
  the session-level layout effect set the shared resident-buffer master to
  zero whenever `levelUpModalActive` became true. No asset, cue identity,
  playback rate, event timing, or Web Audio implementation is missing.
- The corrected client mute predicate excludes every locally owned picker
  phase, including opening, settled, reroll/rebuild, and closing. It retains
  mute for a barrier participant with no local offer or close presentation,
  which is a web-only cohort waiting state rather than a native screen.
- User sound volume remains authoritative. A user-selected zero still makes
  these requests inaudible; this correction removes only the modal multiplier.

## Nearby-system findings

- The 2026-08-23 sound-only modal policy correctly documented that stock has
  no sound-only modal mute. Its LevelupScreen membership is superseded here;
  Pause Menu, compact-selector, stream/loop continuation, music exclusion, and
  current-setting restoration remain unchanged.
- Entry 53 `levelupskill` is not a substitute for the missing playback. The
  Website already uses untouched entries 52 and 64 at the recovered edges.
- Current first-run profiles present the stock Tutorial MsgBox before the
  Title `Play` action is available. Picker acceptance must decline that real
  prompt through `NO`; bypassing or hiding it would test a nonexistent route.
- No new retail constant, asset, function, or call site was recovered. Mod
  Loader documentation changes only to keep the Website policy boundary
  current.

## Web implementation consequence

- Keep the shared `GameAudioDirector` mute multiplier and every cue producer.
- Narrow the `MainMenuScene` predicate to Pause, compact-selector, and
  peer-only cohort waiting ownership. Do not add per-cue bypasses, alternate
  buses, retries, delayed playback, or duplicate picker effects.
- Replace smoke assertions that accepted zero-gain picker events with checks
  that entry, action, rebuild, and close events begin at the current positive
  sound master. Keep exact rate/count assertions.
- Teach both owned-picker journeys to decline the current first-run Tutorial
  MsgBox through its semantic `NO` button before entering New Game.
- Arm the two-client finite-particle probe before the terminal combat loop,
  with a bound longer than that loop, so host authority can lead a slow browser
  without observation beginning after the 2.39-second native lane expires.
- Read Boneyard's real `canvas.__sdrBoneyardFrame.levelUpParticleCount` owner,
  not the Hub-only dataset attribute, while polling both client pages at 20 ms;
  the game clocks remain untouched and both receipts require a positive count.
- Give the existing multiplayer combat journey a bounded level-up-only exit
  after VFX, audio, waiting ownership, frozen authority, and resumed advance;
  its full mode retains exact one-tick release plus the independent shield and
  later hit-flash assertions.

## Validation contract

- Focused source contracts must prove the owned picker is excluded from mute,
  peer-only waiting remains included, and the director continues to receive
  one session-level predicate.
- At the user's explicit direction, the final skill-picker browser journey for
  this pass runs on native Windows Chrome rather than the normal Mac gate. It
  must cross ordinary thresholds in Hub and Boneyard, observe `levelup` and
  `openpanel` as the picker appears with playback rate 1 and positive master
  gain, then observe native action, rebuild, and close rates/counts with
  positive gain.
- The same journey must retain barrier identity, three/four-card behavior,
  silent focus, queued/no-threshold-replay behavior, live frozen-world
  rendering, and empty page/console/failed-response arrays.
- The two-client Boneyard journey must show both owned pickers with the sound
  master live, then show only the participant whose choice is complete acquire
  the peer-wait mute while the other participant's picker remains audible.
- The complete supported `./scripts/validate.sh` gate, invoked through native
  Windows Git Bash with the pinned toolchain, and the existing Pause/compact
  selector browser contracts must remain green.

## Implementation validation receipt

- `MainMenuScene` retains the shared sound-master multiplier but narrows its
  owner to Pause, the compact selector, and a peer-only cohort wait. Every
  locally owned LevelupScreen phase stays on the live sound lane; cue assets,
  rates, counts, semantic producers, user volume, music, and authority are
  unchanged.
- On the untouched pre-fix Website base, the new Windows source contract failed
  exactly because `levelUpWaitingForPeers` did not exist while the other
  `17/18` Pause contracts passed. The manifest-identical candidate passed
  `18/18`.
- Native Windows 10 Pro `10.0.19045` used Node `22.17.0`, npm `10.9.2`, Python
  `3.13.5`, .NET `10.0.302`, and Chrome `151.0.7922.170`. The final documented
  Website tree passed `./scripts/validate.sh`: backend build and 22 contracts,
  formatting/lint/import boundaries, every frontend group including Boneyard,
  level-up, Tutorial, parties, ML, Hall, and Hub UI, five desktop tests,
  production frontend/GameHost builds, bundle budget, and media policy.
- The rebased Mod Loader documentation passed the registered Windows static-RE
  suite `499/499`; log SHA-256 is
  `c6ba036497d594c1635392661715987c093d6267f33a220e6dedda1d314e2ad0`.
- The single-client Windows Chrome/WebGL2 journey crossed ordinary Hub and
  Boneyard thresholds. Both owned picker receipts reported mute `false` and
  master `[1]`; `levelup` rates were `[1,1]`, `openpanel` rates were
  `[1,0.75,0.75,0.75,1,0.75,0.75]`, `unlockskill` rates were `[1,1,1]`, and
  all 19 threshold/entry/action/rebuild/close requests began at positive master
  gain. It retained the live frozen world, reached 50 particles, rendered at
  1600 x 900 WebGL2, and had empty page, console, and failed-response arrays.
  Log SHA-256 is
  `ae7901b6f504800b8520ac194cc6ac0e7d35ed7245e1999a87a52655ebb0cbd1`.
- The two-client Windows Boneyard journey observed positive local level-up
  particles `2/3`, exact rate-one `levelup`, positive `openpanel`, and master
  gain one on both clients. Owned-picker mute state was `false/false`; after
  the host chose, waiting state was host `true`, guest `false`. The barrier
  froze at tick 11211 and resumed at 11212, with empty page/console arrays.
  Log SHA-256 is
  `2c23024e6f3e7db11cdc2e3f7072d713356a1aef27d75f18d785d7f3cbed21ff`.
- Reviewed single-client settled/reveal/Boneyard captures have SHA-256
  `741cf76d35be2b09128870542fd106284830523399a90f7c1b06f94f7e49f31e`,
  `7c398744f58d6053c8c03e1dcbffd4cf8afc714dca0ea05eb76b1b0a363ef018`,
  and `03da04c05d847c9ac426e9af16a7ac46c7cb459e9cc7e21c634c387e68cb7db7`.
  Two-client picker/waiting captures have SHA-256
  `57a7d359e9f5cbdc88929e931ad90f67caf4ae86a6189261df75e71ec637b8f9`
  and `6aa087c37de33e850a40d81c644addfe8e614f5420fb82b9b6e17e5137b6d1b4`.
- No member is blocked by the browser platform and no material unknown remains.
  Publication and task-scaffolding cleanup are recorded separately after the
  authorized fast-forward push.
