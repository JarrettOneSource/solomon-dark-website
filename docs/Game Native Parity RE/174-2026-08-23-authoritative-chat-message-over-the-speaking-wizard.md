# 2026-08-23 — Authoritative chat message over the speaking wizard

## Reported smell and parity question

- Reported web behavior: a sent message appears only in the HTML chat history;
  no text appears with the sending wizard in the rendered world.
- Requested behavior: keep the transcript entry and also place the same
  authoritative message above that wizard, hold it briefly, then fade it away
  slowly.
- Stock boundary: the closed native chat census remains valid. Retail `Chat`,
  `ChatExtend`, and `Notebox` are trader/book/note surfaces, not player speech.
  The native world-indicator ExactText primitive is the presentation sibling;
  routing, timing, wrapping, and speech-panel styling are explicit Website
  policy.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native negative census | `native-player-chat-boundary.md`; fresh `Chat` update/render `0x004FFEE0`/`0x004F9380`, `ChatExtend::Render 0x004F7BA0` | No player actor, authenticated sender, transport event, or overhead speech owner exists. | high |
| Native world-text sibling | world indicator `Arena::Render 0x0046EC80`, `PlayerWizard 0x0054BA80`, ExactText `0x0043BCD0`, Fonts group 6 | A post-world, screen-space, actor-following bitmap-text lane is already recovered and ported for remote nameplates. | high |
| Existing Website authority | protocol 52 `GameChatMessage`; host sender/routing; client-session ordered delivery; `GameChat.tsx` | The transcript already appends one authoritative event and exposes host-authored `sender.playerId`, channel, sequence, and normalized text. | high |
| Existing renderers | `NativeWorldNameplateLayer`, Hub/Boneyard world renderers | Both scenes already own the exact font atlas, presented player map, camera projection, active-region filtering, resize, and teardown seam needed by a sibling layer. | high |

## System boundary and membership inventory

| Member | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| accepted local submission | existing authoritative chat echo | verified-already-at-requested-policy | transcript and world state consume the same server event; rejected drafts never appear |
| incoming Global message | host Hub routing | out-of-system native extension | visible only to clients that received it and only beside an actor in the active Hub region |
| incoming Party message in Hub/Boneyard | host party routing | out-of-system native extension | no cross-party widening |
| incoming/outgoing Whisper | host pair routing | out-of-system native extension | only sender/recipient clients can derive it; off-scene actor remains hidden |
| local sender actor | active presented player map | out-of-system native extension | local player is included even though native nameplates are remote-only |
| remote sender actor | same map and region predicate as nameplates | out-of-system native extension | follows the presented actor/camera |
| Courtyard and all private Hub regions | Hub renderer active-region predicate | out-of-system native extension | no bubble for another region |
| Boneyard/Arena | Boneyard renderer | out-of-system native extension | same shared layer and lifecycle |
| latest-per-sender replacement | client presentation model | out-of-system native extension | newer sequence replaces older; stale/duplicate sequence is inert |
| 3,000 ms hold + 2,000 ms linear fade | client monotonic clock | out-of-system native extension | alpha 1 before hold, linearly decreases, absent at 5,000 ms |
| wrapping/full authoritative text | bounded 180-code-unit message plus Fonts group-6 layout | out-of-system panel geometry; exact native font primitive | full supported text wraps at a bounded screen width; transcript retains unsupported glyphs |
| unsupported glyph | native ExactText no-fallback rule | exact-ported failure boundary | omit unsupported bitmap glyph; never introduce OS-font text into WebGL |
| absent/disconnected/off-region/invalid player | renderer derivation | exact lifecycle boundary | no item; transcript remains |
| pause/level-up/resize/camera feedback | existing presentation loops/transforms | verified-already-at-parity sibling | layer follows the same final screen transform and expires by wall time without simulation authority |
| session replacement/teardown | `MainMenuScene` and both renderers | exact lifecycle boundary | presentation state and derived textures are cleared/destroyed |
| accessibility | existing HTML `aria-live` transcript | verified-already-at-requested-policy | WebGL duplicate is `aria-hidden` and never double-announces |

No member is blocked by the browser. The designed panel is noninteractive,
drawn after the world/nameplate layer and before later screen feedback. Its
anchor is a fixed screen-space speech tail above the actor/nameplate; it does
not enter actor painter sorting, collision, lighting, protocol snapshots,
saves, Hall state, or Lua.

## Web implementation consequence and validation contract

- Add a pure bounded presentation model for authoritative receipt, latest-
  per-sender replacement, exact hold/fade samples, expiry, and active-player
  derivation. `GameChat` keeps history ownership and emits the same received
  event to the session-level presentation owner.
- Add one shared Pixi layer using the existing Fonts group-6 atlas and final
  Hub/Boneyard screen projection. Do not add scene-local chat subscriptions,
  optimistic drafts, protocol fields, DOM player bubbles, system-font
  fallback, or per-message simulation state.
- Focused tests cover all channels, local/remote ownership, stale/replacement,
  hold/fade boundaries, wrapping/long words, unsupported glyphs, off-region and
  disconnect filtering, projection, and bounded cleanup.
- A real two-client Mac Chrome journey must send in Hub and Boneyard, prove the
  same sequence/text in transcript and above the correct local/remote actor,
  move the actor/camera, observe full alpha then an intermediate fade alpha and
  final removal, verify another-region/outsider privacy, and finish with empty
  page, console, and unexpected-response arrays.

## Implementation validation receipt

- `world-speech-presentation.ts` owns the bounded latest-per-sender records and
  monotonic hold/expiry deadlines. `GameChat` emits only the authoritative
  received event while retaining transcript ownership. One shared
  `NativeWorldSpeechLayer` renders the native group-6 bitmap glyphs, dark/gold
  speech panel, and tail for local and remote players; Hub and Boneyard keep
  active-region filtering, screen-space scale, resize, and teardown.
- The integration sweep found that Boneyard nameplates omitted the secondary
  camera-displacement term even though the world applied it. The refuted split
  transform was replaced for both nameplates and speech with the actual final
  `world.position`/scale in the same pass; focused source and projection tests
  pin the shared transform.
- Mac red began with missing presentation/renderer modules. Green coverage is
  `19/19` world nameplate/speech plus the `48/48` party/chat matrix: all three
  channels, local/remote binding, stale replacement, exact alpha boundaries,
  64-speaker bound, wrapping and long words, unsupported-glyph no-fallback,
  missing/off-region actors, and both renderer integrations.
- Built protocol-63 desktop acceptance showed local Hub sequence `3` and remote
  sequence `5` at alpha `1`, sampled the remote fade at
  `0.7812999999970198`, observed its retirement, and showed local Boneyard
  sequence `7` at alpha `1`. Mobile independently showed sequences `10`, `12`,
  and `14`, remote fade `0.7711500000059605`, and retirement. Both finished
  with zero sessions/players/parties/runs and empty page, console, HTTP failure,
  and unexpected request-failure arrays.
- Reviewed final screenshots: desktop Hub full/fading/Boneyard SHA-256 values
  are `cd090890ac7cad95f57cfd3adc14afabce88d06183377b71b2ede738d2a78208`,
  `fb109634a230b06ef834563d243019d2eccc147b7eb64789ce7a93d388a33bb4`,
  and `650f3d52b52ac95e80794053e7ca958354c8b46b34d8c93d348dd7e77663b058`;
  mobile Hub/Boneyard are
  `10519fee80e2f853fb980566473af5564ed007886254362c504c5c49640fb04d`
  and `e8a974c16ac412ca0e8ed59082e43ecc11711f3a1bb52df757412c8ff8c15534`.
  The panel is visibly anchored above the corresponding wizard/nameplate in
  both viewports. No member is browser-blocked and no native absence is
  mislabeled as retail parity.
