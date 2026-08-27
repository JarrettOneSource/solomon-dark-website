# Solomon Dark rebuilt runtime architecture

Status: accepted; authoritative, GPU-client, shared-Hub party/chat,
desktop-solo, headless-crowd, and compact-replication slices implemented,
2026-08-24

This document records the load-bearing runtime decisions for the rebuilt game.
It does not replace `game-native-parity-re.md`: the native game remains the
visual and behavioral oracle, while this document defines where recovered
behavior lives in the clean rebuild.

## Product topology

Every play mode is an authoritative client/server session. "Peer hosted" means
that a player's desktop owns the authoritative server process; it does not mean
distributed or lockstep simulation.

| Mode | Client | Authoritative host |
| --- | --- | --- |
| Desktop solo | Packaged shared client | Server bundle spawned as a separate localhost process |
| Desktop host | Host's shared client plus remote desktop clients | The same server bundle on the host's machine |
| Desktop join | Packaged shared client | Peer-hosted or dedicated server |
| Web singleton party | Shared browser client | The process-wide shared Hub host; a party-scoped run instance after launch |
| Web multiplayer party | Shared browser clients | The same shared Hub host, then one party-scoped Boneyard run instance |
| Web private College | Shared browser clients | One provisioned in-process host whose sealed mod set belongs to the room |
| Dedicated | Any compatible client | The same server bundle run headlessly |

The website is the control plane for browser admission, account identity,
subscribed content, cloud saves, and publishing. A packaged web-port client may
still provide local solo play with local identity and an empty content set, but
the Website no longer owns a DLL loader, custom-protocol launcher hand-off,
native-lobby directory, or native-save ZIP service.

Browser play has no launcher lobby namespace or URL join. New Game first
chooses global-Hub versus private-College intent. The browser-local Shared Hub
preference selects a private College when disabled; an explicit public-party
join cannot bypass that choice. A participant whose durable
first-story admission is pending enters the interactive Office before Create;
all later generations enter Create directly. The accepted discipline starts the loading
barrier; only behind it does the page request one single-use ticket. Mods,
cheats, and local-only saves choose a private College. The global Hub rejects
modded, cheats-on, and local-only handshakes at authoritative seams.
Players discover one another in the Courtyard itself, inspect a name-only
profile, and exchange party invitations over the gameplay protocol. The
current party leader alone can launch from any stable Hub room; that
transition freezes the current party roster across all stable Hub rooms and
moves exactly those player entities into a party-scoped Boneyard instance
while unrelated Hub residents keep ticking in the shared Hub instance.

Each live Hub participant may also publish one ephemeral activity value:
`paused`, `occupied`, or clear. Pause/Settings maps to `paused`; every other
optional input-owning Hub surface maps to `occupied`. The host authenticates
and republishes that connection-local presence in Hub participant snapshots,
but it never enters saves, party-directory rows, Hall state, Lua, or simulation
rules. Player cards and a post-world same-region badge are presentation
consumers. Activity clears when the participant leaves the Hub.

The Play submenu and Dark Cloud keep distinct visual wrappers over one headless
party-directory/join module. Opted-in singleton and grouped shared-Hub parties
may be public or invite-only; private parties remain unlisted. A rotatable
eight-character Party ID is a direct-join capability and appears only in the
leader cog. Resolution creates a ten-minute in-memory intent, while the actual
host ticket is minted only after Create. Invite-only requests are memory-only,
guest-capable, leader-approved, and expire with their party or supervisor.
Only the current leader can issue Courtyard Player Card invitations.
Starting a Boneyard does not remove an opted-in party from either directory.
The host projects the retained membership together with its active run as an
`IN GAME` listing carrying the authored Boneyard name and current squad
size/capacity. Both visual wrappers disable admission for that state, and the
supervisor independently rejects new public, request, and Party-ID joins until
the same party returns to the College. A former member may use only its opaque,
host-issued active-run rejoin capability from the owner save. That capability
cannot admit a new wizard, reveal a private party, or bypass the run/content
identity it names. Visibility remains authoritative throughout the run, so
private parties stay absent rather than becoming observable in game.

The frozen launch roster is also the durable continuation roster. Transport
loss removes only the actor binding: it leaves the member, original leader,
reserved capacity, last authoritative ally state, and recovery lineage attached
to the run. Ordinary checkpoints are revision-bound recovery seeds, so an empty
run or an unplanned same-revision host restart may spin up on the first former
member's `Resume Game` request. That first returner restores the entire ordered
party but does not wait for absent members; those rows are projected as
disconnected and the run may progress. Every later former member's claim routes
to that already-live authority and imports only that member, even if the run has
advanced since its browser checkpoint. A coordinated cross-revision deployment
still uses its explicit target-revision checkpoint.

An active run freezes only when detaching a recoverable living member leaves at
least one connected dead human and no materialized living actor. The remaining
client sees `Waiting for players to rejoin`; all-dead arbitration cannot consume
the run while that owner is pending. The returning living member must
materialize and acknowledge renderer readiness before the existing three-second
countdown releases the exact frozen tick. If everybody disconnects, no dead
browser is kept as simulation authority: the live instance suspends and the
same durable recovery path spins it up on demand.

The same authenticated gameplay connection carries ephemeral text chat. A
public-Hub singleton sees Global; a grouped Hub participant defaults to Party
and may switch to Global. Entering a Boneyard exposes and initially selects a
match-owned Boneyard channel; later manual channel choices survive chat
close/reopen while that world remains active. Global reaches every opted-in
authenticated participant on the process-wide shared-Hub host, whether that
participant is in the Hub or any party run. Party reaches only current party
members in the Hub. Boneyard reaches only participants in the sender's exact
live run. A Whisper is an explicit one-to-one request: the client supplies a
target player id, while the host derives the sender, resolves one currently
connected target on the same host, and echoes the authoritative event to
exactly that pair. Selecting Boneyard does not suspend Global or Whisper
receipt; those events continue into their bounded channel histories and unread
counts. The Hub player projection is the only target-discovery surface; there
is no cross-host directory, transcript service, offline delivery, or chat
persistence in saves.

Browser-local Online Features settings own four subordinate choices. The
master is an effective gate over Activity Messages, Global Chat, Shared Hub,
and Submit Runs to Server while retaining the child choices for a later
re-enable. Global Chat has the same persisted control beside its chat tab.
Effective activity requires both Activity Messages and Global Chat: the actor
then emits, and opted-in recipients receive, the exact host-authored College
join, ordinary Boneyard-start, and disconnect lines. Effective Submit Runs is
sent at authentication and on live settings changes; it gates only that
player's future signed global receipt and shared Memoratorium portrait. Local
Hall recording and every teammate's eligibility are independent. Shared Hub
changes apply to the next admission rather than migrating a live wizard
between authoritative hosts.

The same authoritative chat event also feeds a client-local world-speech
projection. It keeps at most the newest event per sender, joins the host-authored
sender id to the active presented player map, and draws a noninteractive
screen-space bitmap bubble above that actor in Hub or Boneyard. The transcript
remains the semantic and historical owner. World speech adds no wire field,
simulation state, persistence, recipient widening, or optimistic draft: a
client can draw only an event it was already authorized to receive. It holds
for three seconds, fades linearly for two, and then retires on the monotonic
presentation clock.

The same presentation boundary owns small social cues. An authoritative chat
delivery produces one cue for every recipient, including the sender's accepted
echo; optimistic drafts, rejections, and duplicate sequences are silent. A
client already resident in the Hub compares consecutive authoritative
participant-id sets and emits one cue for each join and one for each departure,
including a party leaving for a Boneyard. Initial connection and return-to-Hub
snapshots seed a silent baseline. These cues use pitch-distinguished instances
of the exact resident `click` asset and obey the existing non-music master mute;
they add no server audio message or replay queue.

## Shared identities and boundaries

The source tree owns four distinct modules:

- `core-kernels`: browser-safe deterministic movement, collision, and other
  explicitly predicted behavior. The client and server import the same source.
- `core-server`: authoritative world composition, actors, AI, RNG ownership,
  saves, and fixed-update scheduling. It imports the kernels; clients do not.
- `game-protocol`: versioned messages and one codec used by every transport.
- `game-client`: connection, input command production, prediction,
  reconciliation, interpolation, presentation snapshots, and teardown. The web
  and desktop shells use the same client implementation.

The authoritative session owns players in one dense ECS outside any particular
world. Stable player-entity IDs index separate identity, character-config,
locomotion, primary-cast, progression, skill-book, stat-book, and belt component
stores. A whole
`PlayerCharacterState` is only a short-lived system or protocol projection; it
is not a second authoritative player record. The active world owns spawn
selection, static geometry, ambient actors, enemies, projectiles, and other
location rules. It may query player locomotion, resolve requested movement,
and commit locomotion components, but it neither owns nor clones player
progression. Hub-to-Boneyard placement resets the location-facing locomotion
slice while retaining the same player entity, progression books, selected
concentrations, and A/B replacement cursor. Post-run loadout reconstruction
is a stronger, separate generation boundary: after Game Over, each validated
Create confirmation replaces level/XP, skill/stat books, runtime, offers,
selected skills, advanced unlocks, and belt with the selected native fresh
loadout while preserving only durable profile/Hagatha state. It also advances
component revisions so a client cannot reuse the completed Game Over
generation's inventory or skill projection. Ordinary post-run confirmation
also derives the new starter Hat/Robe appearance from that confirmation's
fresh generation seed and selected element, then advances the economy revision
before publication. The one-shot post-Tutorial College branch is deliberately
different: College constructs its green starter garments before Create, so its
confirmation preserves those authored item colors while replacing the fresh
skill generation.
Connected-run death likewise stays on that player entity. Dying and spectating
do not reset that participant's progression, skill book, or economy; only the
completed all-dead Game Over route and later Create confirmation establish the
next player generation. The progression
column owns an internal 100 Hz death age and derives the multiplayer mod's
60 Hz logical corpse clock from it; tick 159 owns only the corpse burst and
collision retirement, while five-second expiry owns `dying -> spectating`.
The selected spectator target and camera remain client-local presentation
derived from authoritative eligible-player snapshots. A scheduled Boneyard
wave's one `wave-threshold -> wave-lull-delay` completion transition is the
host-owned respawn edge: before
all-dead arbitration it restores only eligible non-positive-HP entities at the
world's authored spawn, clears their cast/locomotion/death slice, and preserves
entity ID, death epoch, heading, progression, books, inventory, equipment, and
every living peer. Ordered snapshots publish that one mutation; there is no
client respawn command or parallel vitals-correction authority.
The skill-book column also owns first-learned public-row order, the selected
primary, two concentration slots and their replacement cursor. A separate
player-belt column owns the eight heterogeneous Game/BeltButton entries: empty,
skill, recursive Health/Mana potion alias, or exact native item identity.
Inventory and skill-book mutations are sibling producers into that belt; input,
HUD/modal presentation, refresh, snapshots, and save restore are consumers.
Every fresh generation ranks all eight native root rows at one, stores only the
selected element/discipline roots as offer owners, and keeps only the starting
primary/secondary pair in learned display order.
Inventory, SkillScreen, and the compact selected-HUD
selector are shared by Hub and Boneyard; scenes request the participant-owned
surface but never clone its state. Protocol 36 introduced strict belt, primary,
and general concentration intents. Protocol 63 added a distinct addressed A/B
concentration command for the HUD buttons while retaining the general
SkillScreen command. Protocol 65 added the durable resume versus profile-backed
New Game intent. Protocol 66 added strict Hub activity intent and participant
projection. Protocol 67 added the host-resolved locked-Goodie interaction edge.
Protocol 68 retained both selection paths, the authoritative Hagatha one-shot
state and six frozen active-Weld component ranks, and added the fresh-profile
tutorial-pending field. Protocol 69 added the one-use developer observer
hello/welcome contract. Protocol 70 added the host-owned stock Tutorial
controller/narration state plus its bounded start and modal-surface facts.
Protocol 71 added the complete survival-Hub NPC interaction state, optional
Skorcha population, and bounded dialogue/service actions.
Protocol 72 added the Tutorial's selected-HUD acknowledgement byte and
the two bounded primary/concentration-A selector-open facts. It also carries
Solomon's authoritative dig-body offset and ticked dirt/audio semantic events.
Protocol 73 adds the shared-Hub Memoratorium's ten-slot portrait
archive: fixed slot ages/markers, the `100..109` portrait-id ring, and frozen
semantic portrait recipes. The host publishes the complete bounded state so a
live update and a late join consume one authority value rather than browser
history.
Protocol 74 adds the bounded Tutorial camera-lock age. The 300-tick
cleanup countdown remains separate: the client derives one persistent
recursive camera bound for both rendering and hit projection, while the host
uses the exact Tutorial entrance Fence as an enemy-birth admission domain.
Save schema 10 adds a nullable 256-bit active-party rejoin capability to the
owner-only continuation summary. It changes no gameplay wire shape. Schemas
1..9 migrate with no capability and keep their existing ordinary resume path.
Protocol 75 adds the participant-private ten-row native Hub help state
and the bounded Provokatus/Fomentius/Luthacus acknowledgement action. Save
schema 11 persists those rows; schemas 1..10 migrate them as already
acknowledged, while a genuinely fresh profile starts with all ten rows set.
Protocol 76 adds the client-private `materializingPlayerIds` projection used by
detached party-rejoin catch-up. Save schema 12 expands the nullable rejoin value
to a bounded HMAC-signed recovery claim; schemas 1..11 retain their strict
legacy parsing and are not restart-seedable.
Protocol 77 adds the participant-local durable party-roster projection used by
the Website's retained-membership extension. Current-schema claims bind the
run, ordered roster, original leader, owner document, sealed content, scoring
lineage, and admissible host revision. Connection and life state remain
orthogonal: a disconnected row retains its last authoritative life/health state,
then switches immediately to the live actor state when that member returns.
Protocol 78 adds the participant-local first-College-admission state,
the bounded client request that may start it only while the host-owned durable
profile still marks it pending, and a renderer-ready acknowledgement that can
release—but never advance—the initial Office cover clock. The state then owns
normal Office input/dialogue, the covered exit-to-Create boundary, and the
post-selection Courtyard handoff.
Save schema 13 persists the one-shot admission bit; schemas 1..12 normalize it
completed.
Protocol 79 adds Web Lua existing-slot wearable item identity. Save
schema 14 admits the bounded wearable identity, package-owned art paths, dyes,
and native death shape inside ordinary inventory items; schema 13 remains
readable.
Protocol 80 corrects the first-College admission projection to the
stock Courtyard title walk, covered Office transition, transformed Office walk,
and automatic Archchancellor dialogue. Each Hub participant carries its
bounded admission phase/cursors/cover/speed/contact state; the 35-character
dialogue-acknowledgement discriminator is admitted in full. The same protocol
also permits an addressed nullable skill-quickbar binding so a populated stock
`BeltButton` can be pulled off without inventing a replacement skill.
Protocol 81 adds the browser-only, fresh-admission
`declineTutorial` intent. It is mutually exclusive with save/resume and College
admission. Before welcome, the host atomically clears the existing
`tutorialPending` and `collegeIntroPending` profile fields; the ordinary
`connected` checkpoint therefore persists Create-to-Hub routing without a
College replay. Completing the actual Tutorial still follows protocol 80's
stock College sequence.
Save schema 15 persists that College state and the participant's exact Hub
region, transition, and position. Schemas 1..14 retain their versioned shapes;
a schema-13/14 legacy direct-Office admission migrates to the complete
Courtyard sequence, while ordinary legacy Hub continuations remain settled.
Save schema 16 adds the Tutorial's movement-instruction acknowledgement;
schemas 1..15 normalize it false. It changes no Tutorial stage, player
position, or forced-intro motion.
Save schema 17 adds one nullable, bounded `nativeSource` attachment at the
document root. It holds the hashed retail `darkdata.cfg`, one local-wizard
`gamestate.sav`, its safe run name, and a bounded hashed table of opaque
non-gamestate launcher-slot files such as Hall/portrait bytes; it is
preservation/projection input,
never simulation, account, party, Hall, or leaderboard authority. Account slot
I and title Settings -> Save Transfer can strict-decode a copied stock source
into the same cloud-or-IndexedDB `local-only` settled-Hub continuation and
export the current wizard by patching only recovered fields in that preserved
base (or the controlled Hub template). The semantic projection includes the
ordered Hagatha/Tonic outcomes and the complete resumable Boast lifecycle;
stock-only Serendipity/Reverie active flags reset because retail does not write
them to disk. Retail also omits Unforge base HP/MP `+0x6C/+0x78`; stock import
rebuilds maximum vitals and retains only each serialized current/max ratio,
while stock export reports any web-only maximum-vital bonus. The host carries the
attachment per participant through resume, checkpoints, Game Over profile
archival, and wizard retirement without interpreting it. Schemas 1..16 migrate
with `nativeSource = null`.
Protocol 86 changes the existing Hagatha selector projection from a sorted
unique set to the retail ordered outcome vector. Ordinary selectors remain
unique; selector 27 may repeat twice, and its count must match
`tonicPurchases` and capacity 3/6/9. This is a protocol break because an older
client rejects the native order/Tonic membership even though no field name was
added.
The host applies
either skill selection only to the authenticated
participant before publishing a new progression revision.
Protocol 82 enriches each retained shared-Hub Memoratorium portrait with its
nullable host-authenticated account username and final Hall-owned run summary:
elapsed ticks, wave, level, kills, awesomeness, and optional awesomest kill.
Those are bounded authority facts for Painting inspection, not a second
leaderboard or presentation-side score calculation.
Protocol 83 adds the authoritative resume-grace projection and readiness edge
described below. Protocol 84 adds the Tutorial movement acknowledgement and
consistent camera-lock clocks described below. Protocol 85 broadens the
existing nullable eight-slot skill quickbar value from permanently learned
categories 1/2 to categories 1/2/3.
Category 3 consumes a rising slot edge through the existing general
concentration owner; it does not become a secondary cast or change automatic
category-1/2 hotbar population.
Protocol 89 replaces that incomplete skill-only snapshot member with the
separate eight-entry belt component. Stock categories 1/2 and the disclosed
category-3 Website extension use skill entries; subtype-0/1 potions normalize
to recursive Health/Mana aliases; every other stock-bindable item retains its
native type and exact participant-owned item ID. One addressed bind replaces
one entry, refresh clears a disappeared exact item or unlearned skill, and all
keyboard/mouse/touch/controller producers resolve the same current entry.
Inventory Sack browse paths remain client-local UI state and therefore do not
cross protocol 89. Save schema 18 persists the belt separately from the skill
book. Schema 17 and earlier nullable skill arrays migrate to skill entries and
seed the two potion aliases only where historical slots 3/4 are empty.
Protocol 90 retains that shape but corrects the strict retained Earth-weld
contract: Ethereal Boulder and Hailstones carry independent native scale
ceilings of `.75` and `1`, while their optional Bind Rocks vector lane remains
the separate toughness value. This is a clean protocol break because a
protocol-89 client asserts the refuted toughness-derived ceiling. Save schema
18 is unchanged because retained primary-spell actors are session state, not
checkpoint state.
Protocol 91 adds the run-owned `party-rejoin-wait` resume-grace reason. It uses
the existing sequence-qualified renderer-ready intent and nullable countdown;
it adds no client pause vote and changes no save shape.
Protocol 92 widens chat with the `boneyard` channel, host-authored semantic
Global activity events, a required complete effective online-preference set in
`client-hello`, and an authenticated runtime preference replacement message.
Global membership is the opted-in client set of the process-wide shared-Hub
host rather than Hub-world residency. Boneyard membership is exact live-run
identity. Preferences remain connection sideband state and never enter world
snapshots or saves.
The compact selector
uses its own `skill-selector` pause source only in an active Boneyard, so the
host cannot accept an addressed HUD mutation from a full SkillScreen pause (or
vice versa). In the Hub both selectors are local activities and mutations stay
authenticated without acquiring any gameplay-pause owner.
The session also owns the fixed-step accumulator and tick; neither clock is
nested inside a Hub ambient actor or another world-specific subsystem.

`PlayerId` identifies the connected participant. It is deliberately distinct
from the in-world character and from native gameplay-slot ordinals. This keeps
reconnect, future spectating, and world transitions from leaking connection
identity into position or actor behavior.

Party identity is also distinct from participant and world identity. Every
connected browser participant belongs to exactly one party. A new participant
creates a singleton party and is its leader. Accepting an invitation atomically
moves a singleton participant into the inviter's party; it never derives
authority from connection order. Leader disconnect promotes the earliest
remaining member. Rejoining the same active run does not revoke that promotion.
Invitations are invalidated when either endpoint disappears, the target ceases
to be a singleton, or the party starts a run. Party identity, public listing
identity, Party ID, connection-resume token, and active-run rejoin capability
are separate opaque values. Leave and Kick move a shared-Hub participant into
a fresh private singleton. A private College projects all connected clients as
one party whose leader follows host transfer.

Chat identity is never a fifth client-provided identity. A client chat command
contains only a channel and bounded text. The host derives player ID and
display name from the authenticated socket, resolves recipients against the
current party/world graph, allocates the ordered chat sequence, and echoes the
authoritative event. Client history is an 80-event presentation buffer, not an
authority store.

The browser supervisor owns one shared-Hub host for its process lifetime and a
bounded set of single-use admission tickets. The host owns a shared Hub simulation plus zero or more
party-scoped Boneyard simulations. Each socket receives snapshots only for its
current world instance, while party-control messages remain session-wide.
The shared Hub world also owns one ten-slot Memoratorium archive. When any
party run crosses the authoritative Hall archive edge, the world coordinator
adds each completed participant whose current effective Submit Runs preference
is enabled, in deterministic writer order. It consumes the native marker draw
only for an admitted portrait, evicts the smallest persisted slot age, and
publishes the new portrait atomically. One participant's opt-out does not
suppress another's portrait. Party partition/merge, disconnect, and a client-held
  save cannot fork or erase that archive. Before the completed state is
  published, the global supervisor atomically replaces its protected state file
  and fsyncs the containing state directory. Supervisor restart hydrates that
  exact bounded state; a missing file alone creates stock defaults, while an
  invalid file fails startup instead of silently erasing the archive.
Leaving or a failed heartbeat removes the participant's materialized actor
from its world and live party membership. When another member keeps that
Boneyard active, the host retains one bounded run/player capability plus an
owner-only durable-state projection; it does not keep ticking a ghost actor.
`LAST GAME` claims that exact slot before ordinary save restore. The returning
actor remains detached while any pending or missed actor-private offers are
resolved. Its staging client receives the current live world plus private
progression and a materializing marker, but no live actor, party member,
collision, input, target, or effect exists. The existing run continues unless
its materialized participants own an independent barrier/pause; further shared
levels append to the detached sequence. The final choice atomically imports at
the authored Boneyard spawn with transient input, casts, projectiles, and
modifiers cleared. If the run is terminal or empty, the capability is invalid
and ordinary owner-save resume remains the fallback. An
empty run retires independently, and an empty shared Hub remains ready for the
next ticket. Health reports active players, parties, runs, and
deployment-drain state. A validated release closes admissions, freezes
authoritative hosts, requests one final owner checkpoint from every connected
browser player, and only then disconnects occupied sessions for cutover; an
empty resident Hub is not an occupied session. That final checkpoint is sealed
for the announced target revision. After replacement, the first valid former
member reconstructs the exact run and becomes current leader; later former
members converge on the same recovery identity regardless of old leadership.

Run liveness and admission capacity are separate counts. A connected browser
is a transport owner, a materialized participant is an actor currently present
in a world, and a detached recovery member is capacity reserved beside a live
run. Recovery capacity never makes a run runnable by itself. Disconnecting an
actor is one atomic run-owned transition: if another materialized actor remains,
the run and detached capability survive; if none remains, the run, every
run-scoped capability/reservation, gameplay pause, and prepared mod scene retire
together. A private College then becomes empty and closes; the process-lifetime
shared Hub remains available without retaining the party Boneyard. The fixed
step scheduler therefore receives either a nonempty active run or no run—never
an active `GameSimulationState` with zero player entities.

The shared Hub also owns the session-global conditional-NPC clock. Skorcha's
host fixed-tick schedule alternates visible/absent windows independently of
participant count and room occupancy; snapshots publish only the current
authoritative actor state. Phase changes are immediate and remove or restore
collision, prompts, rendering, and local dialogue ownership together. This
timer is shared-world state, not player-save state.

NPC and trader progression remains at the existing player-entity boundary.
Gold, shops/offers, inventory/storage, Boast, Lace, Hagatha ownership, and
Machinimbus unlock rows are read and mutated through the authenticated
participant's economy/progression components. A newly admitted shared-Hub
player receives fresh defaults and never inherits another resident's service
state; actor visibility itself is not progression-gated.
Hagatha ownership retains the native ordered outcome vector rather than a
sorted set: ordinary charm/curse selectors occur once, while selector 27 Tonic
may occur twice in purchase order. `tonicPurchases` and capacity 3/6/9 are
validated against those entries. That same ordered vector feeds the Hall
projection and schema-17 stock bridge, so Tonic membership is neither hidden
during web play nor reconstructed heuristically during export.

The host also owns the safe public-party projection. A bearer-protected
supervisor control-plane read exposes that projection to the Website backend;
public clients receive only the bounded DTO from `GET /api/game/parties`.
Private Colleges are bounded supervisor session records with per-player tickets;
they close after their final player and proxy leave. Their reusable standing
credential and leaderboard signing key were removed.

Browser visual assets follow the native screen/actor lifetime instead of one
route-wide resident manifest. Startup owns only Loader and immediately-next
Title images plus the app-global compiled audio registry. Title, Create, Hub,
Boneyard, SkillPicker, inventory/traders, pause, and mod presentation each
acquire their renderer-contracted texture membership through the renderer that
consumes it and destroy that membership with the renderer. Player appearances
retain every dynamic element/equipment/death variant through a compact
multi-page atlas, mirroring the native `Clothes` bundle page set. They do not
retain one decoded 170-pixel padded image for every extracted logical sheet.
The shared image-promise map is an in-flight deduplication seam, not residency:
entries are removed as soon as a scene has constructed its Pixi textures.
Browser loading is bounded to four concurrent tasks so HTTP/2 and
`Image.decode()` cannot turn native per-owner acquisition into an unbounded
mobile memory spike. Scene transition barriers remain the readiness authority;
a scene cannot accept gameplay input until its own renderer publishes the
first ready frame.

The compiled game-audio registry has two browser output lanes. Resident
`AudioBuffer` one-shots, keyed streams, voices, loops, and ambience share one
Web Audio master gain; scene music and crossfades use independent music
channels. User sound and music settings remain separate scalars. A local or
authoritative Pause Menu, the compact primary/A/B HUD skill selector for its
owner or a waiting peer, and a peer-only level-up cohort waiting surface
temporarily multiply only the non-music master by zero. An owned
`LevelupScreen` remains on the live sound lane so its threshold, entry,
activation, rebuild, and close cues are audible at their native lifecycle
edges. Muted source and owner lifecycles continue silently, music keeps
playing, and release restores the newest user sound value without replaying
muted events.
The party-state subscription seeds an invitation-id cursor from the connected
baseline and requests the native resident `click` one-shot once for each newly
introduced id; unchanged revisions, scene remounts, and reconnect history do
not replay it.

The TLS edge is part of the browser-game release contract, not an out-of-band
host prerequisite. The release artifact carries the checked-in Caddy site;
deployment compares its expected hash with the live site even when the runtime
SHA already matches, validates a candidate before installation, backs up and
atomically installs changed configuration, reloads Caddy gracefully, and
restores the prior site with the runtime rollback. Shared `/game-hub` and
private `/game-sessions/*` handlers must precede the ordinary Website
fallback.

Production deployment is an intentional browser-game restart, not an
occupancy wait. After validation, artifact staging, and database backup, the
worker authenticates to the supervisor control plane with the existing
server-only secret and announces the exact target revision. The supervisor
rejects new tickets, private provisioning, and WebSocket upgrades; freezes all
shared/private hosts; and asks every connected client to persist a forced final
host-authored checkpoint. The Website remains live while anonymous clients
commit IndexedDB and authenticated clients complete cloud-slot requests. Ready
acknowledgements are bounded because a dead browser cannot execute a final
write; an unresponsive client falls back to its latest prior owner checkpoint
if one exists and cannot defer the release indefinitely. A party guest with no
prior continuation cannot acquire one after its browser stops responding. The supervisor then
closes clients with restart code `1012` and reason `game updating`, and the
worker restarts only the Website and browser-game units. A no-store deployment
manifest proves the target revision before active or idle `/game` pages reload;
a generic HTTP `200` or guessed delay is not release identity.

Browser connection diagnostics use endpoint-class correlation rather than a
credential: `shared-hub` for the resident host, a 32-character private
session id, or `null` before endpoint selection. Client and backend validate
that same closed set; arbitrary labels are rejected.

Platform shells remain deliberately different. A desktop shell can supervise
a child process and access local storage; a browser shell asks the website to
provision a remote instance. Those adapters may differ without creating a
second game client or game server.

The portable server release identity is:

`server bundle hash + content manifest hash + protocol version + pinned Node version`

The JavaScript server bundle is identical across supported platforms. Each
distribution carries the pinned platform-specific Node runtime. The game host
does not run inside Electron's Node runtime and must not acquire native npm
dependencies without revisiting this release invariant.

Production generation identity has one owner: the immutable
`DEPLOYED_GIT_SHA` beside the deployed server bundle. The supervisor reads and
validates that file at process start. A protected environment variable must not
duplicate the revision because doing so couples an application release to the
version of the machine-local deployment worker.

The machine-local worker is itself a validated release member. When its packaged
copy changes, the current worker installs that copy only after the complete gate
has passed, discards the artifact built under the older worker, and exits before
remote cutover. The replacement worker then validates and packages the commit
again. The release also owns the exact game systemd unit: its checksum
participates in current-state detection, the candidate is verified and backed
up before daemon-reload and start, and rollback restores the prior unit before
the prior release restarts. A failed remote candidate is terminal for automatic
attempts at that SHA: the worker captures candidate unit status and bounded
journal tails, rolls back, records the failed target, and does not drain players
again until an explicit operator reinstall or a different `main` commit.

## Authority and time

- All gameplay mutations happen in `core-server` through deterministic fixed
  ticks. The current Courtyard evidence establishes a `100 Hz` tick for the
  reconstructed Hub.
- Render cadence, network snapshot cadence, and simulation cadence are separate
  clocks. Protocol messages identify simulation ticks, not wall-clock time.
- The server owns actors, collision response, AI, RNG, pause policy, and save
  serialization. Clients submit intent rather than positions.
- Boneyard loot is one authoritative subsystem, not a renderer consequence.
  Hostile death publishes the actor-private seed at the enemy owner; the
  Boneyard loot store alone advances the shared native stream, applies native
  collision placement, allocates Gold/Orb/Sack/Bonus actors, advances Goodies,
  resolves strict pickup order, and emits semantic audio/text edges. Currency,
  resources, inventory, and Bonus state are committed at the session-owned
  player-entity boundary after that one accepted pickup. A client interaction
  action never names a Goodie: the host repeats the exact nearest-facing query,
  consumes one recursive Wizard Key, and only then arms the Goodie's fixed
  100/200/250-tick phase lifecycle.
- Active-Boneyard Pause Menu state is world-instance-owned. The Boneyard ESC
  menu, player Inventory, and Skill Book use one source-qualified first-request
  barrier; a party-run hold freezes every party member without pausing the
  shared Hub or another run. In the continuously live Hub, every optional
  participant-owned surface is local: ESC/Settings, Inventory, full
  SkillScreen, compact primary/A/B selector, NPC dialogue/service, chat,
  player profile, party settings, and the Boneyard picker block only that
  participant's input while Hub simulation and rendering remain live. The
  client suppresses and the host rejects every Hub gameplay-pause source. The
  host uses the separate many-participant activity projection for
  `paused`/`occupied` presence; it is not a simulation barrier. An active-
  Boneyard authoritative pause owner closes its matching modal or
  disconnects to release only that world-instance barrier. Resumption never
  turns elapsed pause time into catch-up simulation.
- Session chat is a temporary input layer, not another gameplay modal or pause
  source. In either world it may open over retained player Inventory, full
  SkillScreen, compact primary/concentration selector, mandatory level-up
  Skill Picker, and the Pause Menu. `chatOpen` continues to idle/block world
  input, while a distinct modal-suspension input makes the retained menu inert
  without closing it or releasing its existing pause/barrier. Closing chat
  restores that menu's focus owner. Pause-owned Game Settings/control rebinding,
  loading, Tutorial policy, resume grace, and Game Over remain exclusive
  application surfaces where chat is disabled.
- The shared player input record carries normalized movement, a nullable world
  aim point, and independent primary/secondary held levels. Browser mouse edges
  publish immediately; the authoritative queue preserves each level transition
  on its own fixed tick, while unchanged held state and same-level aim updates
  may coalesce. Spell systems consume this seam later rather than importing DOM
  button events or browser coordinates.
- The shared Hub is a noncombat social world. Its world boundary preserves
  movement and category-1 primary-selection intents but replaces primary cast
  levels and every category-2 quickbar action with idle input before spell
  authority. The browser also removes the Hub touch-primary affordance and
  suppresses primary mouse output, but the server gate remains decisive for a
  crafted client. Party Boneyards continue to consume the complete combat
  input, including primary, secondary, and staff-action families.
- The shared-Hub Memoratorium is world-owned presentation history, not an
  account leaderboard. Its ten physical Painting slots start with the stock
  residents and persisted age permutation. An opted-in completed run participant freezes
  identity, nullable authenticated account username, equipment appearance,
  heading, scale, capture tick, and the final Hall-owned runtime, wave, level,
  kills, awesomeness, and awesomest-kill facts. Strict-min age eviction supplies
  FIFO behavior and the portrait id wraps through `100..109`. Hub frames carry
  that bounded state discretely, so every resident and late joiner renders and
  inspects the same current record. Bundled ids `0..9` retain stock eulogies;
  dynamic ids format only the carried authority facts.
- The client predicts only explicitly shared kernels needed for the local
  player. Remote actors and server-only systems are presented from buffered
  authoritative snapshots.
- A party-owned run lifecycle is `hub -> active -> game-over -> loadout -> hub`.
  An all-eligible-dead edge freezes the terminal Boneyard world while the
  session tick and replicated Game Over presentation clocks continue. The
  requested normal presentation opens run/event-scoped continuation at tick
  500 and uses a 20-tick exit; its Riff-completion fallback begins at tick 951
  and uses the native 250-tick unattended exit. World retirement and loadout
  reset occur atomically on the fixed tick after exact black, so neither client
  rendering nor continuation can destroy the image beneath an active fade.
  Loadout readiness is participant-owned: every current party member submits
  only their own element/discipline pair, and the final confirmation merges the
  same party and freshly rebuilt player generations into shared Hub. Ordinary
  carried equipment/backpack is discarded by Website product policy; existing
  durable storage and the explicit Last Word ground-recovery result remain.
  No private post-run Hub or host-selected guest loadout may remain resident.
- Active-run rejoin is a delayed materialization edge inside `active`, not a
  second run start and not browser-save authority. The host validates the saved
  player, character, sealed content, recovery/run identity, and one-use
  reservation. A live host uses its retained detached actor; only a replacement
  supervisor may use the old host's revision-bound, exact-document-sealed owner
  actor/world checkpoint to seed the lost authority. Missed shared milestones
  add exactly one pending choice per crossed level to the detached actor and
  consume the live RNG at their ordinary event/action edges without mutating
  the live barrier. Further milestones stack while the picker is open. When no
  pending choice remains, one cold import adds economy/progression/books/Hall
  row, allocates fresh world identity/light bindings, and preserves the current
  world. A second disconnect retains the unresolved detached sequence without
  holding peers. No elapsed disconnect time becomes simulation catch-up. New
  Party-ID/public/invite-only members remain excluded from an active run.
- A fresh normal wizard has one participant-local College admission before
  Create and ordinary Courtyard control. The host holds the unselected player
  at Office `(512,562)` and alpha one until that client's real Hub renderer
  acknowledges readiness; only then does the 100-tick incoming reveal begin.
  Ordinary Office movement and the conditional story Archchancellor/Polisher
  dialogue are then live. Physical contact with the normal south exit starts
  the existing outgoing transition; exact black opens Create and freezes the
  covered Courtyard handoff. Element/Discipline confirmation resumes the
  existing Courtyard incoming kernel. Tutorial entry does not consume this
  owner; Tutorial completion enters it before any retained loadout. Other Hub
  participants and rooms keep ticking, while run-start and non-Office service
  mutations from the admitting participant remain sealed. Exact Courtyard
  loadout confirmation clears both durable onboarding bits and emits the owner
  completion edge before the ordinary incoming reveal. An interruption before
  confirmation resumes the College obligation; an interruption after it can
  never re-arm Tutorial or College behavior.
- Player-character movement uses a two-phase shared kernel: first plan native
  intent/velocity, then let the active world resolve collision, then commit the
  resolved position plus native heading/gait state. Hub and Boneyard geometry
  therefore vary at the world seam without forking character behavior. The
  player ECS derives one finite non-negative movement multiplier from native
  status, Rush/concentration, and equipment state; every ordinary world passes
  it to the shared planner. Protocol 50 projects that authoritative scalar so
  Hub local prediction runs the same kernel. Scripted room-transition motion
  keeps its separate authored speed and ignores ordinary input multipliers.
- A single pinned build on one platform must replay the same input script
  reproducibly. Cross-platform bit-identical floating-point results are useful
  measurements, not a correctness dependency. There is no fixed-point or
  lockstep requirement unless redundant cross-machine authority is introduced.
- Chat is a transport/UI sideband outside the fixed-step simulation, snapshots,
  saves, Hall eligibility, and Lua state. Opening the HTML composer stops only
  that client's gameplay input; it does not acquire the world pause lane. Its
  five-second readable hold and fade are client-local wall-clock presentation,
  refreshed by local or authoritative incoming activity. Each accepted
  authoritative delivery also produces one client-local little cue; a draft,
  rejection, or duplicate sequence produces none.
- World speech is a second presentation consumer of the same delivered chat
  event. Its latest-per-sender replacement, three-second hold, two-second fade,
  active-region projection, and expiry are client-local monotonic state; they
  cannot delay, reorder, acknowledge, or widen authoritative chat delivery.
- College join/leave audio is another client-local presentation consumer. It
  compares consecutive Hub participant-id sets only while the observer remains
  in Hub, excludes self, and treats initial connection or re-entry as a silent
  baseline. A removal covers both disconnect and departure to find Solomon.

## Protocol and transport rails

There is one gameplay protocol and codec over an authenticated message
transport interface. A transport rail may select different connectivity and
trust mechanisms without changing game messages or authority:

- desktop solo: `ws` over loopback plus an unguessable bootstrap credential;
- provisioned web or remote dedicated: `wss` with ordinary public PKI, normally
  terminated by a gateway;
- desktop peer host: an authenticated encrypted direct or platform transport;
  pinned-certificate `wss`, Steam Networking Sockets, and an optional relay are
  eligible adapters after connectivity evidence is gathered.

The host binds only to loopback by default. Non-loopback binding is explicit
host intent and the v0 Node listener permits it only behind an explicitly
trusted TLS gateway with a nonempty origin allowlist. Direct desktop peer
exposure remains deferred until the encrypted transport adapter is chosen. A
localhost listener still authenticates, validates `Host`, and
rejects unapproved browser origins: arbitrary websites can initiate localhost
WebSocket requests. Bootstrap secrets travel through an inherited private
channel or environment, never a visible command-line argument in a packaged
launcher.

A website-origin game client never connects to localhost, RFC1918, or another
private-network address. Browser clients use provisioned remote instances. This
is an architectural ban, not a dependency on volatile browser mixed-content or
Local Network Access exceptions.

Protocol compatibility is exact-match until a proven compatibility policy is
needed. The first handshake carries the protocol version, server tick rate,
session content manifest, complete player-character configuration,
prediction-kernel identity and parameters, and a reserved resume token.
Protocol `36` welcomes a client with one complete snapshot plus its sequence.
Subsequent messages keep session-owned players at the frame root and use a
discriminated world payload. Both Hub and Boneyard carry a compact
replicated-entity lane. Boneyard keeps encounter, gate, and wave-scheduling
state in its direct world payload, while enemy actors, enemy projectiles,
Maggots, and independent enemy-death effects use registered entity descriptors
and dynamic samples. Run-scoped
semantic enemy events remain a separate ordered lane so interpolation cannot
invent, duplicate, or erase combat edges. Unknown or malformed messages fail
closed.

Loot and Goodie use their own registered descriptors and fixed numeric samples;
the nested carried item remains in authoritative server state until pickup and
is projected through the player's economy afterward. A separate ordered loot
event lane carries drop settlement, pickup, and Goodie edges so sound and the
native 300-update notification manager consume each event once rather than
inferring a disappearance between snapshots. Item trees, generated FX, wearable
colors, actor IDs, and event order are bounded and recursively validated.

Each player projection includes level/XP thresholds, a monotonic progression
revision, compact nonzero permanent/effective rank rows, and at most one
ordered pending skill offer. Immutable stat metadata, descriptions, caps, and
native icon records are content-versioned client/server assets rather than
repeated in every snapshot. Each offer option carries its authoritative next
rank so the client can render the stock rank suffix without reconstructing or
mutating book state. A skill-choice command names both the offer
sequence and skill ID; the host accepts it only for that connection's current
authoritative offer. While a choice is pending the server ignores normal player
input, matching the mandatory native pause boundary. Renderers continue
presenting the complete frozen world behind the SkillPicker curtain; the
barrier stops simulation, not world membership or painter traversal.

Each client acknowledges the newest complete snapshot sequence it has
reconstructed. The host computes entity spawn, retire, and dynamic samples
against that acknowledged baseline rather than assuming delivery. It sends a
complete entity keyframe when the baseline is unavailable, the client requests
recovery, or the five-second recovery interval expires. A missing descriptor,
invalid sample, or sequence gap makes the client request a keyframe; it never
guesses missing entity state. Baseline recovery is a per-peer lifecycle rather
than a one-frame flag: after sending the requested complete keyframe, the host
stops adding snapshots to that peer's ordered WebSocket queue until the
keyframe is acknowledged. Pre-keyframe acknowledgements are stale members of
the same episode, not new warnings or new keyframe requests. Other peers,
fixed-step authority, sideband messages, and transport heartbeats remain live;
the keyframe acknowledgement resumes current-state deltas from the repaired
baseline.
Authenticated clients also measure application-level transport RTT with a
nonce ping that the host echoes immediately outside the simulation and snapshot
clocks. The measurement is client-local diagnostics state and never enters an
authoritative world snapshot.

Protocol 49 adds the original chat sideband. Client text is trimmed, nonempty,
control-character-free, and bounded to 180 UTF-16 code units and 512 UTF-8
bytes. The host admits five messages per authenticated client in a rolling
five-second window, returns a bounded rejection for a valid but unavailable or
rate-limited request, and does not log message content. Protocol 92 replaces
the original Hub-resident Global and cross-transition Party-run policy with
process-host Global, Hub Party, and exact-run Boneyard membership. Semantic
activity shares the same bounded ordered transcript but never becomes world
speech. Chat events are not snapshot deltas and gaps in their host-global
sequence are expected when other recipient sets receive intervening messages.

Protocol 50 adds the server-derived player movement multiplier to every player
frame. It is not client input: the host remains the sole owner of passive,
equipment, and status composition. The field exists so the already-bounded Hub
predictor can use the same movement plan as authority instead of hard-coding
scale one and reconciling every boosted tick.

Protocol 51 extends authoritative primary-spell snapshots with the native
Boulder contact lifecycle. Ordinary Earth and welded Ethereal Boulder carry
separate retained-shell membership and current shell-radius scalars; each
finite accepted ordinary contact can publish one independent
`earth-boulder-bit` actor, while EBoulder continues using its concrete Weld
BoulderBit actor family. The host owns pool/charge mutation, child RNG and
retirement. Clients copy/interpolate the finite semantic state and never infer
contact children from hit or death presentation.

Protocol 52 adds the Website social-profile and Whisper contracts. Client hello
carries bounded informational account name, highest-wave, and local-playtime
fields; the host republishes them in party-state profiles but never uses them
for authentication or gameplay authority. `client-chat` carries
`targetPlayerId` exactly for Whisper, and `server-chat` carries the resolved
recipient exactly for Whisper. Self, missing, and disconnected targets receive
the bounded `target-unavailable` rejection. The existing chat rate limit,
normalization, local 80-event history, and nonpersistent lifecycle apply to all
three channels.

Protocol 66 adds `client-hub-activity` with exactly `paused`, `occupied`, or
`null`, plus the corresponding required field on every Hub participant in full
and delta snapshots. The value is connection-owned, Hub-only, and discrete in
the presentation timeline. It clears held/queued input for that participant
but does not gate the Hub fixed tick, other participants, prediction/rendering,
or any Boneyard. The core Hub participant and save-document shapes remain
unchanged. Protocol 66 also removes the shared-Hub optional-pause topology:
every `client-gameplay-pause` source is rejected while its sender is in Hub.

Protocol 53 adds the mutable native target-replacement policy to welded
MagicMissile-derived projectile snapshots. Pure Ether already carried the same
field. The host now publishes whether FireMissile, FrostMissile, or
BallLightning may replace an unresolved target after applying its
class-specific constructor threshold and any later failed replacement. Clients
copy this semantic state; they do not reacquire targets or steer projectiles in
presentation.

Protocol 54 adds session kind, content-addressed mod asset references, party
visibility and Party IDs, external join-request views, leader decisions,
Leave/Kick, rotation, and typed party-action results. Compatibility remains an
exact host/client match and the two bundles deploy together.

Protocol 55 adds one correlated save-before-leave request and response. The
existing ordered checkpoint message remains the only save payload; the response
only identifies which checkpoint must reach durable storage before the client
may disconnect.

Protocol 56 separates target-owned `Mod_CircleSlow` from `Mod_ColdSlow`.
The host publishes both clocks/factors, bounded modifier attachment order, and
the fully composed movement scalar, so simultaneous ColdSlow, CircleSlow,
Frozen, Stun, and Dazzle multiply without client inference. ColdSlow alone owns
the cyan target material; CircleSlow does not retain that material after the
cold modifier expires.

Protocol 57 adds the full Game Over continuation and participant-owned post-run
loadout state. Run snapshots carry clicked/automatic exit kind and sorted
loadout-ready participant IDs. `client-continue-game-over` is scoped to the
active run nonce and monotonic Game Over event. `client-confirm-loadout`
carries one validated element/discipline pair and can update only the sending
participant. The run remains in loadout until every connected eligible member
has confirmed; disconnect synchronization removes departed members without
granting one client authority over another player's pair.

Protocol 58 closes the shared Fire detonation lifecycle. Live Ember snapshots
carry the native four-tick contact cadence and actor-light registration through
the complete `(0,3]` life interval. Shared Fire explosions carry their
transient-light registration, stable sound pitch, and 37-tick semantic life;
clients project the three native child clocks from that one authority state.
The host owns damage, Ember motion/contact, registration order, and retirement;
renderers own only display-frame jitter and local Region point gain.

Protocol 59 adds the authoritative held one-shot attack-pose latch. The
fixed-tick host publishes it with player cast state, and Hub/Boneyard clients
retain it discretely without inferring pose lifetime from render frames.

Protocol 65 separates `resume` from `new-game` when a client supplies a saved
document while retaining protocol 64's Hagatha/Weld state. Resume revives the
nullable continuation and requires the saved character; New Game hydrates only
the durable profile into the newly selected character and constructs a fresh
world/run. Every checkpoint, including Game Over, carries a document; terminal
checkpoints carry a null continuation rather than a null document.

Protocol 70 adds the bounded first-player Tutorial start and modal-surface
facts plus the complete Tutorial state in Boneyard snapshots/frames. Stage,
spawns, narration, protection, scripted drops, and clocks remain host-owned;
clients can report only inventory/skills open or close facts.
Protocol 72 adds the selected-HUD lesson acknowledgement to that state. A
client may report only an eligible primary or concentration-A selector open;
the host persists the idempotent acknowledgement without changing Tutorial
stage. The same authoritative skill-choice transaction now performs native
progression refresh's A/B and invalid-primary selection auto-fill, in native
RNG order, before publishing the next progression revision.

## Saves, identity, and content

- The authoritative game host is the only producer of browser-save contents.
  Schema 13 is one atomic envelope with a durable participant profile (economy,
  Hagatha one-shot runtime, and NPC service state) and a nullable current-wizard
  continuation.
  The continuation summary explicitly says whether an active Boneyard run
  exists; a Hub save is resumable but is not a saved Boneyard run. The host
  emits the document at semantic progression/world boundaries and bounded
  checkpoints. A Tutorial continuation also carries the resumable controller
  and pre-Tutorial profile-economy baseline. Schema 9 persists the
  camera-lock age separately from the cleanup countdown; schema 8 retains the
  preceding Tutorial owner and normalizes the missing age, schema 7 retains
  that owner while normalizing absent Hub-NPC state, and schema 6 normalizes
  with neither owner. Schema 10 adds the active-party rejoin capability;
  schemas 1 through 9 migrate it as absent. Schema 11 additionally persists
  the ten native NPC help rows; schemas 1 through 10 migrate an absent table as
  already acknowledged. Schema 12 permits a signed recovery claim whose
  normalized owner-document digest, run/player/content/provenance, and optional
  deployment target are verified by supervisor and host; schemas 1 through 11
  cannot seed a replacement process.
  Schema 13 adds the College-admission bit; schemas 1 through 12 normalize it
  completed.
  Browser code transports the document and may invalidate a
  strictly decoded continuation, but never derives profile state from a
  rendered snapshot.
- The first browser slot is always zero. An authenticated website account uses
  its owner-scoped transactional database row; an anonymous browser uses an
  IndexedDB row on that device. Both adapters store the same host-authored
  document and revision contract. Retired launcher-native ZIP slots are not a
  browser-save surface.
- `Last Game` is enabled only when the stored envelope contains a continuation.
  It gives that document to a fresh game host, which bounds, migrates, validates,
  and revives the simulation and loaded-Boneyard state before welcome. New Game
  first opens the current-wizard replacement prompt. Resume keeps the document
  unchanged. Kill Wizard commits the host-authored latent scavenged profile as
  profile-only before Create; the subsequent new-game intent keeps gold,
  storage, Hagatha state, Shlorio fee, permanent unforge/stat bonuses, and
  retained items while constructing the selected character and a fresh world.
  Slot zero is replaced only after that new host produces its first checkpoint.
- A resumed Hub owner keeps durable character/progression/economy state, but
  the Hub scene is regenerated. Position, velocity, facing/cast state, region,
  an in-flight transition, ambient/student state, and runtime caches do not
  survive. The participant enters the Courtyard at `HUB_SPAWN`. Boneyard
  continuation state remains exact.
- Save checkpoint sequence is scoped to one `GameClientSession`; a local stream
  id disambiguates a later host that restarts numbering at one. The coordinator
  returns the exact persistence promise for an accepted `(stream, sequence)`,
  while cloud/IndexedDB revision remains the independent cross-tab/device write
  order. A deployment may wait for checkpoint N after N+1 without relabeling N
  invalid or writing it again. Replacement seals the current stream, older
  stream ids cannot return, and the coordinator retains only pending outcomes
  plus the latest settled checkpoint rather than every document in a long
  session.
- Fresh player construction uses retail initializer `0x005A8390`'s 500 gold.
  It also carries the initializer's durable `tutorialPending` bit. Existing
  schemas migrate that bit false so already-playing web wizards do not enter a
  future tutorial retroactively, and existing saves retain their gold amount.
  `createHubEconomy`/`addPlayerEntity` is the single handoff for the forthcoming
  tutorial port; no tutorial reward, scene, or completion behavior is guessed
  here.
- The first authoritative transition from an active run to Game Over emits a
  profile-only checkpoint. Its completed-run projection retains represented
  carried goods, applies the Last Word ground Sack/Gold sweep, preserves durable
  economy/stat state, and sets the continuation to null. The adapter serializes
  that write after prior checkpoints, so the completed run cannot be resumed or
  recreated by an older in-flight checkpoint while the profile survives.
- Schemas 1 through 5 are explicit historical inputs. Their envelope, RNG,
  skill-runtime, primary-cast, run-lifecycle, Hall, and Boneyard fields are
  normalized before authority changes; the first new checkpoint rewrites schema
  5. Unknown schemas and malformed trees still fail closed.
- The public supervisor proxy and inner authoritative host share one exported
  WebSocket payload bound sized above the 8-MiB document maximum. The proxy may
  not close a valid save-bearing hello before the host's strict decoder sees it.
- Semantic publication remains immediate and periodic browser autosave runs on
  a 30-second authoritative-tick cadence. Both cover every connected player,
  across the global Hub and private Colleges. In a party world, the host projects the same
  authoritative state to one owner at a time, so every participant can resume
  an individual continuation without serializing another player's actor into
  their slot. Selecting gameplay `MAIN MENU` requests one forced final owner
  checkpoint and keeps the session/menu alive until the selected cloud or
  IndexedDB adapter confirms that exact sequence; only then does the client
  disconnect and return to Title. A failed store write leaves the game paused
  and connected for retry. Deployment-final publication uses the same durable
  acknowledgement contract for every connected player.
- Website slot writes use optimistic revision checks and a content hash. The
  document is capped at 8 MiB. Schema 4 carries integrity, the immutable session
  content manifest, and one bounded normalized `sd.state` snapshot per active
  Lua mod; schema 3 is accepted only as a conservative local-only migration.
- Local profiles and direct-host identities require no website account. Website
  or platform identities are optional attestations; public rankings can only
  trust sessions whose authority and identity they can verify.
- The handshake reserves the exact active content set as
  `(id, version, content SHA-256)`. This follows the existing host-manifest
  contract.
- A Website account owns `ModSubscription` rows. Subscription controls Library
  membership; `enabled` controls the next post-loadout admission snapshot. The backend
  resolves exact latest published versions, validates the complete dependency
  graph, reopens and hashes every package, and sends only accepted Lua and typed
  Boneyard members with the single-use Hub ticket or private-session request.
- The global Hub admits only the empty content manifest. A private College
  retains one immutable host manifest for every joiner; its run owns one
  isolated Lua VM per active Lua member and a room-local Boneyard catalog.
  Other Colleges cannot observe or mutate that content. Subscription changes
  affect only a later admission or explicit signed-in sync.
- On resume, the title owner first compares the stored manifest with the
  already-loaded account preview. Once that preflight is accepted, it starts
  the matching Hub/Boneyard loading barrier before requesting a ticket; the
  admission and host handshake remain the authoritative content check. Exact
  matches restore matching mod
  state. Added mods start empty; removed or version/content-changed mods discard
  their old state only after explicit Continue. Cancel leaves the save and
  active subscriptions untouched.
- The web package contract rejects DLL entry points, native `images/`
  replacement overlays, and arbitrary untyped native `data/` overlays. Those
  mechanisms require a mutable process filesystem and compiled native atlas
  destinations that the browser authority does not own. Accepted packages are
  sandboxed Lua, typed Boneyards, or both.

### Global leaderboard authority

The Website backend seals an authenticated account id into each single-use Hub
or private-session admission. The supervisor retains it as server-only ticket
material, and the game host associates it with the authenticated socket. It is
never accepted from a gameplay packet or exposed in a snapshot.

When the authoritative simulation archives a completed Hall row, the host
serializes the immutable row with that account id and signs the opaque payload
with a domain-separated HMAC. Protocol 47 introduced the signed receipt carried
only to
the matching client. The leaderboard API accepts only that receipt, verifies
its signature and account id against the caller's JWT, revalidates every Hall
bound, and persists the sealed values. The browser cannot choose score fields,
and the client bundle receives neither the supervisor/signing secret nor an
account-id override.

The connection's current effective Submit Runs preference is a separate
voluntary output gate. When disabled at that player's completion edge, the host
does not sign or deliver a receipt for that player and the shared-world
coordinator does not add that player's Memoratorium portrait. It does not
change score-integrity taint, local Hall recording, or any teammate's receipt.

Global eligibility starts only on a fresh account-bound global-Hub admission. Initial or
live ordinary `Enable Cheats` state permanently revokes it for that connection;
an accepted ordinary-host authoritative Lua console request revokes it
independently. A server-authenticated developer connection is exempt from both
cheat-origin taints, including developer-only bot and player-grant commands. Any
ineligible member taints the current party run for every participant. A
  host-authenticated active-run rejoin restores the detached connection's
eligibility record instead of treating its editable checkpoint as a new saved
lineage. A replacement-process recovery may do the same only after the stable
secret verifies the exact normalized document and target deployment revision;
the original run ID keeps Hall submission idempotent. The run's independent
  taint remains authoritative. Local Hall history remains available. Save schemas
12 through 17 carry durable `global-clean` or `local-only` integrity, explicit
active-run state, and the nullable active-party rejoin capability. Schemas 13
through 17 also carry the one-shot College-admission pending bit; schemas 1 through 3
migrate conservatively to `local-only`, schema 4 preserves its authored
integrity, schema 5 migrates its prior envelope, and schemas 6 through 9 preserve
their authored integrity and active-run summary. Schema 9 additionally retains
Tutorial camera-lock age independently from its cleanup countdown. Schemas 1
through 9 carry no live rejoin capability. Schema 10 adds that capability;
schema 11 adds the native NPC help rows; schema 12 upgrades the capability to a
revision-bound signed claim; schema 13 adds the College-admission bit; schema 14
adds Web Lua wearable identity; schema 15 adds resumable College participant
state and exact Hub continuation geometry; schema 16 adds the Tutorial
movement-copy acknowledgement; schema 17 adds bounded native-source
preservation and the stock/web wizard projection. Each
participant receives an
authoritative profile/continuation checkpoint, and Game Over removes only that
participant's current-wizard continuation.

Every save document held by a browser is mutable, including an authenticated
cloud document after it has been returned to the client. Supplying any such
document in `client-hello` therefore prevents global eligibility for both
`resume` and profile-hydrating `new-game`; the host tests document presence and
does not trust the document's `integrity` claim. Anonymous clients persist slot
zero only in IndexedDB. Authenticated clients use only the JWT-owned cloud slot,
whose read, write, and delete endpoints all require an account; a cloud failure
never falls back to local storage. Cloud persistence is continuity, not save
attestation, so it does not make a loaded lineage globally rankable.

The normalized web continuation deliberately rebuilds disk-owned skill state
at its save boundary. All eight native root rows are rank one. Permanent ranks,
offer ownership, Hagatha state, Firewalker, selected primary, concentration
A/B plus replacement cursor, and eight skill Belt bindings survive. Mindstar,
Regenerate, Mind Chug, Plane Orb hold, and active cast presentation are not
retail disk members and reset before encoding/restoring a disk-style
checkpoint. The active synthetic Weld build is also absent from retail disk;
learned row 52 survives but selected/belted Weld is warned and reset by the
stock bridge. This disk projection never mutates the live authoritative state.

## Rendering boundary

There is one composed client, not one DOM client and one canvas client.

- Loader, Title, and Create/loadout pixels render through one scene-scoped
  PixiJS/WebGL canvas, just like the gameplay worlds. React owns
  transparent semantic controls, focus, gamepad/touch routing, status text, and
  the HUD; those overlays are input/accessibility surfaces, not a second visual
  game renderer.
- Stock UI art and bitmap text cross one pure plan seam. The complete generated
  catalog owns all presentation-atlas records and ten finite font wrappers;
  `native-ui-plan.ts` composes raw sprites, text, frames, buttons, tabs,
  messages, and SimpleMenu without owning screen state. A scene-scoped Pixi
  adapter renders the visible plan and destroys its derived subtextures before
  its source page set. `NativeBitmapText.tsx` consumes the same glyph layout
  for DOM-owned presentation. React semantic controls use the plan's returned
  action rectangles, so the accessible hit plane and WebGL art share geometry.
- Player-authored chat is deliberately an HTML overlay: its real focusable
  `<input>` supports IME and the Steam Deck on-screen keyboard, while its
  semantic live region and textual channel labels remain usable without color.
  `T` opens chat by explicit product policy; the otherwise stock SkillScreen
  remains on its HUD tome and uses `K` as the Website keyboard shortcut.
- The transient copy over a speaking player is deliberately not another HTML
  chat owner. A shared noninteractive Pixi layer reuses the recovered world
  bitmap font and each scene's final camera transform, includes the local
  sender as well as visible remote senders, and stays `aria-hidden`; the HTML
  transcript remains the sole live-region announcement.
- Controller input is one browser producer over the same semantic seams as
  keyboard/mouse/touch. Standard-mapped pads provide radial left-stick/D-pad
  movement, retained right-stick torso aim, held RT primary and X quickbar
  levels, LB/RB eight-slot selection, and edge-only Hub/inventory/skills/pause
  actions. One persistent focus router owns menu/modal A/B/D-pad/bumper input;
  Hub and Boneyard keep those controls in gameplay until a modal becomes the
  top input owner. Blur, hidden/pagehide, loading, pause, disconnect, and scene
  teardown clear every controller lane and require neutral before rearming.
  Raw pads without the W3C `standard` mapping are not guessed; Steam Input or
  the browser must provide the canonical layout.
- The optional Mobile UI profile is browser-local presentation state. An
  absent profile leaves the adaptive coarse-pointer HUD rules authoritative;
  a valid complete profile projects normalized centre, uniform scale, and
  rotation variables onto the existing skull, diagnostics, two joysticks,
  eight semantic belt slots, inventory/tome/XP, and potion presentations only
  under a coarse pointer. The Settings editor drafts transforms on a zoomable
  silver page and commits one versioned local record. It does not create new
  controls, cross the protocol, change tutorial/scene gates, or own input
  intent. Reset removes the record and restores the adaptive default.
- The Courtyard and Boneyard worlds and cameras now render through PixiJS
  WebGL canvases.
  Native draw plans, blend operations, frame selectors, render offsets, and
  painter ordering remain renderer-independent inputs.
- A loaded Boneyard composes its immutable stock-generator output once into
  bounded GPU tiles and tightly cropped resident main-layer textures. The
  recovered native effective-Y queue interleaves those main layers with GPU
  actors; camera motion transforms them and display frames update only their
  depths. Neither path reruns the Canvas2D native painter at the `20 Hz`
  snapshot cadence.
  The native surface prefix no longer enters those Canvas tiles: the Pixi
  target supplies the opaque-black Arena clear and one scene-owned GPU surface
  submits source-ordered indexed Road meshes first. Road textures stay wrapped
  and linear with native world UVs and per-vertex edge/link alpha. A transparent
  post-Road tile bank then owns Terrain and the remaining pre-main placement
  passes. This keeps the Region-light composite boundary unchanged while
  removing the former captured ground tile and outlined Canvas road quads. The
  explicitly withdrawn DeadHawg-20/21 ring/oval overlay remains outside this
  runtime change rather than entering through a refuted source-over material.
  Players, Solomon Dig, and moving gate leaves remain dynamic GPU residents.
  Loot actors and Goodie phases are also dynamic GPU residents in the recovered
  effective-Y queue. Gold/Orb pickup fades reuse the world effect lane; the
  screen notification layer uses the extracted native body-font atlas and is
  driven only by the ordered semantic event stream.
  `npm --prefix frontend run smoke:game:loot-drops` is the deterministic
  two-client browser acceptance for this boundary.
  The Region field owns engine-wide world darkness and every dynamic source.
  Modes 1/2 add a transparent, bounded record-18 player-light surface between
  the world canvas and HUD; it never fills or masks the viewport. The optional
  native record-9 target remains absent with its unmodeled target-grid actors.
- Gameplay camera motion is isolated at Pixi render-group boundaries. Boneyard
  owns one camera group; the Hub owns separate primary-Courtyard and recovered
  southern-parallax groups, plus one active private-room group. Group boundaries
  follow existing painter banks, so they never split an intra-bank z-order.
- Immutable Boneyard sprites carry their complete texture-frame world
  rectangles. Each display frame intersects those rectangles with a `32`
  world-unit padded camera view and toggles only static sprite renderability.
  Oversized and overhanging art stays resident whenever any part of its
  rectangle can be visible. Dynamic actors and moving gates remain uncullable
  live views.
- Hub static art is deliberately not camera-culled. Controlled physical-GPU A/B
  measurement found its complete baseline scene costs about `0.02 ms` per
  synchronous render, with no measurable benefit from per-sprite visibility
  checks. Keeping the castle bank, circular platforms, statue, fountain,
  telescope, and complete Astronomer ensemble live removes a visual-risk surface
  while the three existing camera render groups retain cheap transform updates.
- Boneyard culling does not prune the recovered effective-Y painter plan.
  Offscreen main layers remain in depth calculation, while tint and z-index
  writes are restricted to residents that will render; an entering resident is
  updated before the same frame is submitted.
- Actor and menu presentation is pooled inside the active GPU scene. The old
  per-actor and per-menu-art DOM/style painters are removed; React continues to
  own HUD semantics, accessibility text, focusable hit targets, and touch
  controls.
- Hub Student views cache discrete texture inputs and write body, head, and prop
  textures only when their heading, pose, reading state, scale, or palette
  changes. Continuous position, depth, bob, and prop transforms still update
  every display frame. Retired views enter a bounded scene-owned pool and are
  reset before reuse.
- Student visibility is currently instrumentation only. It reports conservative
  candidate counts without changing `renderable`. It never owns a Courtyard
  camera bank or any southern architecture, telescope, Astronomer, statue,
  fountain, tent, or other authored art.
- The client presents buffered server snapshots at display cadence. The Hub
  applies bounded local prediction through the shared movement kernel;
  Boneyard presentation interpolates received players and gate leaves without
  duplicating its authoritative collision simulation. The `100 Hz` simulation,
  `20 Hz` transport snapshots, and browser/display refresh remain separate
  clocks. Snapshot sequence and arrival time do not create simulation time:
  same-tick packets atomically replace the newest payload without restarting
  that tick's interpolation epoch, and only a strictly greater authoritative
  tick starts another interval. Hub local prediction resets to and samples the
  authoritative player while a level-up barrier or gameplay pause holds the
  world, then resumes from that state without catch-up.
- Courtyard-owned cosmetic actors with native fixed-update state retain one
  scene-local clock. Astronomer and PotionGuy advance only through elapsed
  integer ticks, while repeated display samples render the current frame
  without replaying tick history. Their random-access reconstructions are
  parity/seek oracles, not display-loop painters.
- Texture residency is scene-scoped. Hub and Boneyard keep every wizard
  appearance available because authenticated participants may use different
  elements and equipment. Those variants share compact player-atlas pages and
  trim/origin metadata; decoded page memory scales with the page set rather
  than with 7,723 padded logical frames. Scenes outside gameplay do not retain
  those GPU textures.
- Arena world-weather state advances only on the recovered fixed-tick clock.
  Its persistent drop and splash actors feed their pooled Pixi views directly;
  display frames do not allocate a second immutable plan graph for the full
  live population. The diagnostic plan remains an explicit snapshot oracle,
  not the production painter path.

WebGL is the production baseline. PixiJS keeps the renderer backend replaceable,
but WebGPU remains experimental follow-up work rather than a compatibility
requirement. Electron is the initial desktop shell and does not own simulation:
it serves the same static bundle and supervises a separately executable pinned
Node host. Stack changes require a failed measured gate, not preference.

## Explicit deferrals

- peer NAT traversal beyond LAN/direct address and manual port forwarding;
- first-party relay, UPnP, WebRTC/WebTransport, or Steam transport selection;
- browser-to-residential-peer hosting, which is unsupported without a relay;
- host migration;
- automatic crash restart and seamless multiplayer rejoin;
- a binary entity wire codec or per-client spatial interest sets until a
  declared product load crosses their measured adoption gates;
- a third-party/general-purpose ECS dependency. The focused dense player ECS is
  implemented because native progression introduces independently owned
  components with different lifetimes; other entity families keep their
  existing stores until shared membership queries justify a common library;
- cross-platform fixed-point determinism;
- WebGPU or a lower-level renderer before a recovered-load WebGL gate fails;
- replacement of Electron before its package, lifecycle, or platform gates fail;
- player-count and cloud-capacity promises before native limits and product
  targets are recovered.

The protocol reserves a resume token and the server save design includes
periodic checkpoints so later reconnect and restart work does not require a
wire-format break. The first implementation only needs honest failure reporting
and preservation of the last complete save.

## Evidence program and pivot triggers

Current evidence proves that the reconstructed Hub core runs headlessly in
Node, contains no DOM or ambient clock, and is inexpensive at the current
Student population. It does not prove full combat scalability. The software-
rendered browser profile and the documented Chromium compositor failure show
that the DOM world painter is not a safe final endpoint; they do not constitute
a real-GPU benchmark.

Before final stack commitments:

1. Recover native worst-case actor, projectile, painter, and multiplayer loads.
2. Run that load through the headless Node core on the declared minimum desktop
   CPU and candidate cloud instance. Node passes if the `10 ms` authoritative
   tick never accumulates backlog over a sustained run.
3. Render the recovered painter load from authoritative snapshots through the
   candidate GPU renderer at the recovered presentation rate on declared
   minimum hardware.
4. Measure local server spawn, socket lifecycle, input latency, teardown, and
   failure behavior in the packaged shell.
5. Continue measuring compact JSON snapshots at each declared combat load;
   adopt the measured binary lane only when that product load justifies its
   transport and tooling complexity.
6. Replay one input recording through loopback and cloud-hosted instances and
   compare discrete events plus declared continuous-state tolerances. Measure,
   but do not require, cross-platform hash identity.
7. Run a desktop acceptance path with external networking disabled: create a
   profile, start solo, save, exit, relaunch, and resume.

A host-language or renderer pivot is justified only by a failed recovered-load
gate after profiling and focused optimization. Until then, TypeScript/Node and
a GPU canvas are the lowest-risk continuation of the current work.

## Completed foundation sequence

1. Extend `GameSimulationState.world` and the v2 snapshot world union with the
   authoritative Boneyard state; retain session-owned player entities.
2. Implement Boneyard collision as the world-side resolver for the existing
   player-character movement plan/commit seam.
3. Recover combat state and rules into focused shared kernels or authoritative
   world systems according to native ownership; do not pre-invent fields.
4. Provision the same host remotely for web sessions, then prove the desktop
   child-process packaging path.
5. Migrate the Courtyard world to WebGL, preserve the recovered painter plan,
   and prove keyboard, controller, and touch presentation in real browsers.
6. Package the same client with a pinned external Node host for desktop solo.

No further menu/Create rewrite, general-purpose ECS adoption, alternative host
language, relay network, or speculative orchestration layer belongs in this
foundation. The later focused player-ECS cutover is an evidence-driven
progression slice, not a broad entity-framework commitment.

## Foundation implementation receipt

The first vertical slice now exists in source rather than only as a target
design:

- session-owned player characters, the native movement kernel, generic actor
  physics, and the authoritative Hub world are separated by enforced import
  fences;
- the versioned protocol validates bounded messages, identifies the content and prediction
  kernel, and carries tick-indexed client intent plus authoritative snapshots;
- one Node game host owns all mutation and supports multiple independently
  configured authenticated characters, while the shared client presents every
  root-level player from interpolated session snapshots;
- the shared client reconciles acknowledged intent and automatically disables
  local prediction if the host advertises a different kernel;
- `npm run dev:game` supervises a real separate loopback host and the Vite
  client, with exact child-process teardown; and
- the static client accepts a platform-injected runtime endpoint, so the
  desktop preload and browser provisioner configure the same client bundle
  without build-time forks;
- the website provisions isolated browser sessions through a loopback-only
  supervisor, while the TLS gateway routes opaque session paths to the same
  authoritative host implementation used by development and future desktop
  packaging; and
- the Loader, Title, Create/loadout, Hub, and Boneyard visual scenes use PixiJS/WebGL,
  while React retains the HUD, semantic menu controls, accessibility surface,
  and Pointer Events joystick.

Encrypted direct peer hosting, save persistence, combat load recovery, and
minimum-hardware qualification remain the next product slices. None requires
replacing this protocol, client, kernel, renderer plan, or server boundary.

## 2026-08-12 implementation verification

The completed foundation passed the repository's canonical validation from an
isolated worktree: a warning-free .NET build, 22 Website/backend contracts,
backend formatting, the architecture import fence, 110 frontend tests, all
five desktop-shell tests, lint with only seven pre-existing Fast Refresh
warnings, and the production client plus game-host build. The desktop suite is
part of that canonical gate, and `npm audit --audit-level=high` reports zero
vulnerabilities.

The Linux x64 package is relocatable: its stored manifest names the relative
`solomon-dark` executable rather than the build worktree. A real packaged
Electron `43.4.0` smoke started the bundled, checksum-pinned Node `22.17.0`
runtime as a separate authoritative process, served the shared client from an
ephemeral loopback origin, entered the Hub through WebGL, and moved the player
from X `950.64` to `1000.89`. The host credential was absent from Electron and
descendant command lines, and the child host was reaped when the shell exited.
The client is served with a strict CSP; Pixi's static shader path does not add
`unsafe-eval`.

A real Chromium browser regression moved the authoritative player from X
`950.64` to `1043.83` while observing every native robe walk pose and 24
distinct display-rate samples between `20 Hz` snapshots. Controller-only Steam
Deck navigation reached the Hub and proved both stick and D-pad movement, a
real touch-event sequence moved the landscape mobile player, and portrait
mobile displayed its orientation gate. These
receipts validate the shared client and current Linux package boundary; they
do not yet qualify minimum physical GPU hardware, Windows/macOS packages,
encrypted peer transport, or save/resume.

The final integration pass also made touch ownership an explicit acceptance
contract. Snapshot-driven React renders may replace a joystick callback, but
only pointer release, pointer cancellation, or actual component unmount may
clear the held touch vector. A real `800 ms` mobile gesture must cross at least
`40` world units; the retained receipt crossed `61.89`. This prevents UI render
frequency from leaking into the authoritative input lifetime without adding
command polling or a mobile-only simulation path.

## 2026-08-14 crowd, headless, and replication cutover

### Authoritative data and scheduling

Hub Students now live in a purpose-built structure-of-arrays store owned by
`HubStudentPopulationState`. Stable numeric slots hold hot scalar fields;
stable ID order remains the system iteration contract; retired slots are
reused only after removal. The `students` accessor is a scalar compatibility
adapter for snapshots and tests, not the hot storage owner. The current route
planner consumes scalar work views whose objects and nested vectors are reused
in place each tick; it does not yet claim to be a direct typed-array kernel.
This is an ECS-shaped data layout without a general ECS package or a whole-game
entity rewrite.

`HubWorldRuntime` owns reusable plans, body arrays, position maps, the Student
neighbor grid, and the generic dynamic actor grid. The grid is rebuilt from
stable source slots once per fixed tick and emits candidates in the previous
source-body order before narrow phase. Focused randomized tests retain the
all-pairs solver as an oracle and require identical candidate sets and final
motion. Static Hub collision and all render-only art remain outside this grid.

The ML seam is `HubHeadlessEnvironment`:

- `reset({ seed, studentCount })` creates an isolated deterministic Hub world;
- one packed six-float action carries movement, optional aim, and two cast
  levels;
- one fixed-stride `Float32Array` observation carries the player header and a
  bounded Student lane;
- `stateHash()` hashes canonical authoritative state, excluding runtime scratch
  buffers, for replay checks;
- `HubHeadlessBatch` steps many same-thread worlds into reusable packed output;
- `HubHeadlessWorkerPool` partitions isolated worlds across persistent Node
  worker threads and transfers packed buffers rather than cloning world graphs.

The ordinary game host remains the authoritative runtime. The headless seam
does not remove collision, AI, RNG, or lifecycle systems and does not depend on
Pixi, React, WebSocket, or wall-clock scheduling.

### Replicated entity contract

The Hub entity lane separates immutable descriptors from quantized dynamic
samples. Student type `1` sends scale, reading mode, and prop appearance only
on spawn/keyframe, then sends ID, position, heading, frame phase, and gait.
Position uses `1/16`-world-unit precision; headings and gait use `1/64` degree;
frame phase uses `1/1024` frame. Authoritative state remains full-precision
JavaScript numbers. Quantization is a transport decision and cannot feed back
into simulation.

Every future replicated family must satisfy this contract before entering the
lane:

1. Allocate a stable numeric type ID that is never silently reused.
2. Register strict descriptor and sample validators and bound every variable
   length before raising protocol limits.
3. Put immutable presentation/configuration in the spawn descriptor and only
   snapshot-varying presentation state in the dynamic sample.
4. Preserve full authoritative precision, stable lifecycle order, and semantic
   gameplay events outside presentation interpolation.
5. Add round-trip and maximum-error tests for quantization, spawn, retire,
   late join, periodic keyframe, missing-baseline recovery, and stale frames.
6. Materialize through the shared registry on every client; a sample without a
   known descriptor is a recovery gap, not a partially rendered enemy.
7. Keep the current near-state snapshot cadence until a separate interest/LOD
   contract proves that an approaching entity receives its descriptor and at
   least two samples before visibility, with hysteresis at both boundaries.

The registry now assigns type `1` to Hub Students, type `2` to Boneyard enemy
actors, type `3` to enemy projectiles, and type `4` to Coffin-owned Maggots.
Enemy descriptors freeze immutable family/configuration state; samples carry
only authoritative presentation fields such as position, heading, action,
the Skeleton/Mage head-facing offset, vitals, shields, effects, payload, and
lifecycle clocks. Protocol 32 adds that signed fixed-tick field to type 2's
54-component sample; clients hold it discretely and never reroll it. Wave
scheduling emits spawn intents and consumes the authoritative enemy store's
live count; it does not own a second enemy list. Connected-client coverage exercises spawn,
retirement, late join, periodic keyframes, missing-baseline recovery, strict
codec bounds, and stale-frame rejection for the Boneyard families.

### Measured gates

The warmed WSL Node 50-tick episodic benchmark now measures `0.1150`, `0.1421`,
`0.2578`, `0.5490`, and `1.9883 ms` per authoritative tick at `16`, `32`, `64`,
`128`, and `256` deterministic Students. The original `256` directional
baseline was `5.392 ms`, so the matching short-episode stress case is about
`63.1%` faster while the equivalence tests preserve current authoritative
outcomes.

The default training-oriented benchmark no longer hides later route and push
work behind frequent resets. It keeps the exact population active by reversing
routes and runs `1,000` uninterrupted ticks. Across three warmed runs, median
tick costs were `0.1246`, `0.1511`, `0.2990`, `0.8218`, and `2.8296 ms`; every
run produced the same deterministic hash for its population. The `256` lane
sustained `353.4` ticks per second, over `3.5x` the authoritative `100 Hz`
requirement on WSL Node `22.17.0`.

The five-second, `20 Hz` compact-JSON benchmark averages `20.61`, `31.77`,
`54.15`, `99.34`, and `190.55 KiB/s` per client at the same populations. That
is a `91.79%` to `95.04%` reduction from the legacy full authoritative Student
snapshot shape. At `256`, an ordinary delta frame is about `9,371` bytes and a
recovery keyframe about `47,907` bytes, versus `196,533` bytes for the legacy
full frame.

A benchmark-only packed entity lane estimates `5,548` bytes for the same
`256`-Student message and about `10.7 microseconds` of entity encoding. Deflate
reaches `4,278` bytes but costs about `143.8 microseconds` per message. Neither
was production transport at that measurement. Re-evaluate the binary lane when
snapshot encoding becomes a measured server phase or compressed representative
traffic exceeds its declared budget; the stock roster still does not justify
mixed text/binary tooling today.

### Browser WebSocket compression gate — 2026-08-20

The compression deferral above is now closed. A hardware-Mac, two-browser Hub
sample on protocol 29 measured `109.37 KiB/s` of logical snapshot text per
client at `19.99 Hz` with only two players and `11..15` live Students. The
average delta was `5,419` bytes and the periodic recovery keyframe was `23,638`
bytes. Per top-level logical lane, players consumed `45.56 KiB/s`, secondary
abilities `31.12 KiB/s`, and the Hub world/entity lane `24.52 KiB/s`. This is a
representative product load above the earlier `64 KiB/s` adoption trigger, not
the synthetic 256-Student stress case.

The transport therefore negotiates `permessage-deflate` on both direct game
host browser connections and the public supervisor's browser-facing socket.
Compression is bounded deliberately:

- messages below `1,024` bytes remain uncompressed;
- both client and server disable context takeover, bounding per-connection
  zlib state and making each snapshot independently recoverable;
- server compression uses level `3`, memory level `7`, and global concurrency
  limit `4`; and
- the supervisor's loopback upstream socket explicitly disables compression,
  avoiding decompression/recompression on both sides of the same machine.

The wire change does not alter protocol 29, snapshot contents, the `100 Hz`
simulation, the `20 Hz` snapshot clock, acknowledgements, keyframe cadence, or
entity baseline semantics. The runtime measurement retains logical-byte lanes
for protocol-bloat diagnosis and adds a conservative independent-deflate
estimate for the negotiated no-context-takeover policy. Browser and Node
integration tests require the extension on direct and proxied connections;
sequence/tick/acknowledgement assertions remain unchanged.

The runtime network harness keeps those assertions topology-aware without
weakening its direct-host default. A local two-page run expects two players,
one shared broadcast sequence lane, identical ticks, at least 60 percent
independent-deflate reduction, and at most 64 KiB/s per client. Public New Game
provisioning intentionally gives each anonymous page its own one-player
supervised session, so production acceptance declares one expected player, no
cross-session sequence identity, and a 50 percent reduction floor while keeping
the same 20 Hz, acknowledgement, zero-gap, negotiated-extension, hardware-GPU,
and 64-KiB/s requirements. The values are explicit environment inputs rather
than URL heuristics. Launch-owned performance probes also close the browser as
the resource owner instead of awaiting every live page first; this prevents a
remote WebSocket page from retaining the probe process or supervised session
after a completed receipt.

### Scene code residency gate — 2026-08-20

The `/game` route formerly imported Hub, Boneyard, and SkillPicker presentation
owners synchronously through `MainMenuScene`. The production `Game` entry was
therefore `6,666,378` bytes (`4,165,490` gzip) before the title could execute,
even though none of those three scene owners was reachable on the title or
Create screens.

Hub and Boneyard now use React lazy boundaries at the same transitions already
owned by `MatchLoadingScreen`. Their chunk fetch does not create a new loading
state or clock: the existing Hub/Boneyard barrier remains visible and completes
only when the scene renderer calls its normal `onReady`. SkillPicker is also a
lazy member, preloaded as soon as an authoritative Boneyard snapshot arrives,
well before the first level threshold; its native reveal and barrier clocks do
not start until the authoritative offer exists.

The resulting production `Game` entry is `189,625` bytes (`55,559` gzip).
Hub, Boneyard, and SkillPicker retain distinct generated chunks, and the build
now fails if the entry exceeds `512 KiB` raw or `128 KiB` gzip or if any of
those three scene boundaries collapses back into it. This is code residency,
not asset-policy drift: the resident image/audio readiness program and every
native renderer asset remain unchanged.

### Low-rate diagnostics under transient populations

Student visibility instrumentation remains outside the render-authority path
and still performs its view census at most once per 120 presentation frames in
steady state. It now also refreshes on a Student population-count edge. Without
that edge, the diagnostic compared a stale visible count against a live native
birth/retirement count and could fail the performance harness (`15 != 14`)
while the renderer itself remained correct. The new predicate preserves the
steady-state cost and makes every performance receipt internally coherent.

`SDR_HUB_BENCH_STUDENTS` and `SDR_HUB_BENCH_SEED` inject a deterministic,
empty-player Hub fixture only into the development host. The count is capped at
the current `256`-Student protocol limit. This fixture alone reverses a Student
at each route endpoint so the population stays exact and moving throughout a
sample; the stock population retains native retirement. The measurement records
arrival, minimum, maximum, and final counts and requires all four to match.
`SDR_GAME_CDP_URL` lets the same measurement connect to a dedicated Windows
Chrome process so GPU identity and physical-device receipts are not inferred
from WSL software rendering. `SDR_GAME_PERF_MOVE_SCRIPT` accepts bounded
`w|a|s|d:milliseconds` steps so the same exact-population receipt can sample and
capture camera extrema rather than validating only the spawn view.

Headed Windows Chrome `151.0.7922.110` on the physical Radeon RX 9070 XT held
the exact moving fixture at the presentation ceiling with no frame over `20
ms`:

| Students | Average FPS | 1% low | Browser task time | Snapshot ingress |
| ---: | ---: | ---: | ---: | ---: |
| 16 | `130.673` | `123.023` | `0.491 s` | `34.034 KiB/s` |
| 64 | `130.897` | `120.069` | `0.666 s` | `67.994 KiB/s` |
| 128 | `130.582` | `120.482` | `0.839 s` | `110.383 KiB/s` |
| 256 | `131.605` | `123.239` | `1.316 s` | `201.790 KiB/s` |

The final post-guard two-page run on that same Windows machine received `101`
snapshots per page over `5.012 s` at `20.150 Hz`, sequences `3597..3697`, with
zero gaps, one keyframe per page, exact `256`-Student samples, and identical
shared ticks. Measured snapshot ingress was `207.141 KiB/s` per page; aggregate
ingress plus ACK egress was `417.100 KiB/s`. This is a two-client wire receipt,
not a claim about two distinct physical devices.

The exact-256 southern stress sweep reached player position `(1196.031,
1074.941)` at `131.645` average FPS and `122.699` one-percent low. A separate
zero-crowd camera-control run removed actor pushing from the path and reached
the true east extreme at `(1972.254, 1071.001)`, measuring `129.766` average FPS
and `123.457` one-percent low. Direct inspection of
`/mnt/c/Temp/sdr-hub-telescope-extreme-final.png` retained the castle row,
circular architecture, animated statue base, telescope, and Wizards. Both runs
reported all `16` southern architecture sprites, all `19` southern-bank
children, and no frame over `20 ms`. The scene guard verifies visibility and
parent ownership, rather than treating `renderable` alone as sufficient.

## Browser presentation rate

All Pixi game scenes submit through one client-local presentation scheduler.
The scheduler accepts at most `400` frames per second by default. Its internal
`setGamePresentationUncapped` and `toggleGamePresentationUncapped` controls can
disable that application cap for profiling now and for a future settings menu;
the default remains capped. The same controls are exposed to local diagnostics
as `window.__sdrGamePresentation` together with the accepted frame count. Until
the settings UI owns this choice, local diagnostics can call
`window.__sdrGamePresentation.setUncapped(true)` or
`window.__sdrGamePresentation.toggleUncapped()`.

Display-paced browsers stay on `requestAnimationFrame`. Sustained animation
opportunities below the `2.5 ms` cap interval select a deadline-aware timer path
for Chromium's unlimited launch mode. A persistent `MessageChannel` separates
successive timer tasks so the HTML nested-timer floor cannot reduce a requested
`400 FPS` ceiling to roughly `200 FPS`; the timestamp gate still rejects every
early wake and never catches up with a burst.

`SDR_GAME_PERF_UNCAPPED=1` launches benchmark Chromium with its own frame limit
and GPU synchronization disabled, but deliberately leaves the application's
`400 FPS` policy active. Adding `SDR_GAME_PRESENTATION_UNCAPPED=1` selects the
explicit full-send application path. Benchmark reports identify both settings
and compute FPS from accepted presentation frames rather than raw browser
callbacks.

This scheduler owns renderer submission and adjacent per-frame presentation
work only. It does not throttle or accelerate the authoritative `100 Hz`
simulation, `20 Hz` snapshot production, transport, non-render timers, or
headless environments. The setting is local and multiplayer-neutral.

On headed Windows Chrome `151.0.7922.138` and the physical Radeon RX 9070 XT,
the final exact-`16` Hub probe measured `143.54 FPS` in ordinary Chrome,
`374.16 FPS` with Chromium's frame limit disabled and the application cap on,
and `1,634.73 FPS` with both limits disabled. Every run retained `20 Hz`
snapshots, three camera render groups, `16` southern architecture sprites, `19`
southern-bank children, and the Astronomer ensemble without errors.

## Web Lua extension boundary

Lua is an authority extension, not another world model. The portable Node game
host owns one lazily initialized Lua 5.4 VM for the browser developer console
and one VM for each active mod in a private session or launched shared-Hub
party. Every VM imports `core-server` only through `host/lua` semantic adapters.
Core kernels, protocol codecs, snapshots, clients, React, and Pixi never import
a VM. Mod VMs never share globals, callbacks, timers, command queues, or state
maps.

The fixed-tick order is:

```text
accepted host console requests + per-mod due Lua timers + runtime.tick callbacks
  -> validate and apply queued semantic player commands
  -> pass queued enemy spawn intents into the existing Boneyard materializer
  -> authoritative simulation tick
  -> derive subscribed run/wave/enemy/gold/level notifications from before/after state
  -> dispatch Lua notifications (their commands wait for the next tick)
  -> publish ordinary snapshots/results
```

This preserves one mutation boundary and prevents Lua callbacks from entering
the simulation recursively. The host checks dynamic session host identity or
the account-bound developer entitlement on every console request. `Enable
Cheats` controls ordinary-host installation of the DevTools API; it is never
trusted as network authorization. Protocol 72 retained the
server-authored developer boolean from a one-use admission into the welcome
and gives observer admissions a distinct read-only handshake.
Protocol 73 retains that authorization contract unchanged while adding the
bounded shared memorial to Hub snapshots and frames.
Protocol 74 retains both contracts while adding only the Tutorial camera age.
Protocol 75 retains them again while adding participant-private NPC help rows.
Protocol 76 adds the client-private detached-party materialization projection.
Protocol 77 adds the bounded retained-party roster projection.
Protocol 78 retains those contracts while adding only the first-College
admission discriminant and its false-by-default client start request; the host
still requires its own pending profile fact before entering Office. The
renderer-ready message releases only the initial cover; neither message may
open Create or complete the Courtyard transition.
An entitled account keeps the setting and ordinary shared-Hub routing off
while still receiving the DevTools API. No client-authored field can grant the
entitlement.
Initial and live setting state is nevertheless replicated as a separate
global-score eligibility input for ordinary connections, and accepting an
ordinary-host console request revokes eligibility even if a crafted client
misreported the setting. The same paths consult the sealed developer admission
before changing score eligibility or save integrity; the browser cannot claim
that exemption.
The protocol-61 lineage added the validated logical viewport width to
ordinary input. The host consumes it only as the stock Fireball forward-query
geometry; collision selection and all consequences remain server-owned.
Authoritative gameplay pause freezes this fixed-tick Lua lane together with the
world; new console requests fail immediately while paused instead of waiting on
a tick that cannot run.

The developer VM is cold by default. Private-session mod VMs initialize before
the host listens; shared-Hub mod VMs initialize in canonical
dependency/priority/id order while the launching party is frozen, before that
party enters its run. Every entry script runs exactly once per runtime lifetime.
The JavaScript bridge is bundled into both portable server entry points and its
immutable Lua 5.4 WASM sits beside them. Creation, callback/timer registries,
UTF-8/JSON wire expansion, output capture, state, queued commands, and every
allocator have explicit per-VM and aggregate bounds. Instruction hooks
interrupt both entry chunks and stored callbacks. A package with no Lua member
creates no VM.

The developer-only `sd.dev` and `sd.bots.summon()` adapters exist only in the
console VM. `sd.dev` enumerates and grants the complete stock browser-owned
inventory catalog (nine Fomentius rows, two skill books, and 47 equipment recipes), all
72 skill rows, and ten native Weld builds. Gold, item, skill, and Weld commands
target the active developer by default or another live player id in the same
Hub/run, enter the bounded fixed-tick command queue, and mutate the ordinary
player economy/skill components. Hub grants therefore cross run launch through
the same shared-world partition and player-entity reset as earned state.

`sd.bots.summon()` accepts only an entitled player currently in the resident shared Hub,
reserves one server-capacity slot, and queues participant creation at the fixed
tick boundary. With no options each call creates a unique Arcane/Fire player;
developers may supply an exact native `element` and `discipline` table to run
the same policy through any pure-primary character. Both paths use the ordinary
entity, replication, Hub, party, loadout, progression, and inventory owners.
The participant has idle input in the Hub. Any ordinary
eligible party leader can issue the existing invitation; the bot accepts that
same invitation after a three-second monotonic delay if it is still live.

After party launch, a host-side entrance adapter follows collision-safe
waypoints through the authored moving gate and into Solomon contact. It idles
during dialogue, then hands control to the selected schema-v7 checkpoint at a
ten-tick decision cadence. Inference runs in one server-only worker shared by
all summoned participants; each bot retains its own observer and intent queue.
Potion actions use the ordinary consume path. Checkpoints without an explicit
learned-choice marker retain the scripted schema-v7 chooser. A checkpoint
marked `choicePolicyMode=learned` evaluates the live offer observation,
138-value option rows, and legality mask in that same worker, then dispatches
the selected option through the ordinary progression path. Because every bot
originates from the sealed developer binding, bot-assisted runs are
developer-cheat neutral and otherwise eligible human participants may receive
global leaderboard receipts. Bots never enter the WebSocket client map or human player-count
callback, and all remaining bots are removed when the last human disconnects,
so they cannot keep a private session or deployment drain alive.

The training bridge derives five pure-primary and ten Weld start rows from the
native skill catalog and `NATIVE_WELD_BUILDS`; consecutive seeds rotate the
entire 15-row curriculum. Schema v7 carries exact uint16 skill/build identities.
Channel-active primary remains a legal held action on the next policy decision,
and episode metrics attribute decisions, ticks, runs, kills, and wave depth to
the exact current loadout even if a learned choice changes primary mid-run.

API `1.0.0` replaces the package callback runtime with one atomic definition
graph. A stripped admission VM evaluates `sd.mod`, kits, prefabs, finite rules,
and typed references; the compiler resolves stable `sd.content.v1` identities,
assets, dependencies, cycles, mounts, budgets, capabilities, and a canonical
graph digest before a ticket exists. Prepared sessions reverify that digest,
run bounded server-only reducers, and commit reducer cells plus validated
intents transactionally. The removed 0.2 content registry, entrypoint
registration, manual capability arrays, and native Loader metadata have no
runtime aliases.

Typed family engines own items, statuses, powerups, affixes, skills, spells,
enemies, Boneyards, shops, UI, rooms, scenes, and portals behind the same host
adapter. The browser receives immutable catalogs and bounded runtime
projections; trusted lazy-loaded components own presentation, including the
Minimap. Protocol content references remain decimal strings so JavaScript never
rounds a 63-bit ID. Typed package bytes remain immutable
`{sha256, byteLength, contentType, kind}` resources served from
`/api/game/content/{sha256}` and verified before play.

The browser must carry the current account token into the optional-auth
`/api/game/hub` admission request. Loading `/api/mods/active` is only a UI
preview; the admission response is what seals immutable per-player content into
the single-use game ticket. Guests deliberately pass no token and retain an
empty content manifest. Party launch compares those sealed content identities,
so a signed-in request that silently becomes anonymous must fail the admission
regression before it can strand a mixed-content party in the Hub.

The schema-nine 1.0 checkpoint codec persists reducer cells, statuses,
powerups, spell cooldowns, skills, shops, custom enemies, scene stacks,
allocator cursors, and revisions. It restores only when every package and graph
digest matches, and rolls the complete prepared host back if any family rejects
the checkpoint. Client-authored Lua,
cross-mod buses, raw Lua networking, general-purpose input synthesis, time
scaling, recipe-backed dynamic items, and every native-memory/debug path remain
absent until their web owners exist. The only bot and navigation surface is the
developer-entitled server participant path described above; it is not
available to mod VMs.
The complete disposition is recorded in `game-native-parity-re.md` and the Mod
Loader's `web-lua-runtime-parity-contract.md`.

## Durable party roster and absent leader

Party membership is durable social state; a WebSocket and a materialized
player actor are not. During an active recoverable Boneyard, socket loss
detaches the actor and marks the member disconnected while retaining the
membership's ordered member IDs and original `leaderPlayerId`. Only the
explicit Leave Party and Kick transactions remove membership. Because the
server process owns simulation ticks, it needs no replacement player leader to
continue the active world. Leader-only requests remain unavailable until the
leader reconnects or intentionally leaves.

Protocol 77 adds the local bounded party-roster projection. The active recovery
lineage owns that ally projection for every retained
member: player ID, display name, element, last authoritative current/maximum
health, life state, and connection state. A live actor supersedes the retained
vitals on each projection; a detached actor supplies its host-held projection;
and, after a coordinated process replacement, the signed recovery roster
supplies members that have not returned yet. This projection is delivered in
local party state and never becomes simulation authority. Hub and Boneyard HUD
code use it only when a member has no live snapshot actor.

Connection and life are orthogonal. Dead players remain rows with a red health-
bar overlay. Disconnected players retain the last authoritative ratio and gain
a distinct signal-loss treatment. A staged catch-up player is connected but
not materialized, so peers retain the row without the disconnect treatment and
the world has no targetable ghost actor. Golems keep their stock live-only row
lifecycle.

The replacement-safe recovery claim is versioned and binds the full ordered
roster, original leader, visibility, and retained ally projections alongside
the existing owner document, run, content, integrity, account lineage, and
target revision. The first valid former member reconstructs the authority run
and that exact party; return order cannot elect a new leader. Later claims may
attach only their sealed actor to that lineage. Recovery capacity counts every
connected or retained member once. Game Over, loadout, returned Hub, a replaced
run, or teardown retires the active recovery projection and capability.

`GameSnapshot.hostPlayerId` remains the leader/leader-only-action identity and
may therefore name a retained party member absent from `snapshot.players`.
Consumers may compare it with the local ID but must not use it as proof of a
live actor or index `players` without a presence check.

## Player equipped-element phase ownership

The host's `PlayerPrimaryCastState.weaponPulse` is the active fixed-tick clock
for the native PlayerWizard equipped-element/light phase. Primary Cast 1,
Constant, and Ether Blast write it only on their recovered event edges;
ordinary secondary Cast 2 reports its first action update to the simulation,
which writes the same clock after primary advancement. Every other tick applies
the native float32 `0.899999976` decay. Action occupancy and held input are not
phase writers.

`PlayerLightingState.overlayEffectPhase` remains only as the previously saved
secondary-action component while old in-flight state decays; it has no
occupancy writer. Snapshot projection takes the single effective maximum, so
the Staff element painter and analytic player light consume the same protocol
sample. Hub and Boneyard timelines interpolate that numeric sample while light
registration, drive ownership, action admission, and the held-pose product
override remain discrete. This changes no protocol shape or gameplay authority.

## Authoritative resume grace

An active run has a second suspension owner beside player-owned gameplay
pause: ephemeral resume grace. A standalone host stores one record; a shared
host stores one per active party run. Each record has a monotonic sequence, an
enumerated admission reason, a set of returning players whose Boneyard
renderers must become ready, and either a pending marker or a host-monotonic
expiry deadline. It is never serialized into a save.

Multiplayer Pause Menu, Inventory, full Skill Book, compact skill-selector,
and final mandatory SkillPicker release atomically enter a 3,000-ms grace only
when that active run contains more than one connected materialized human.
Solo modal release stays immediate. Active-party rejoin, same-player takeover,
and active saved-run restart install grace even for one player. A restarted or
returning client acknowledges its exact sequence from the Boneyard renderer's
ready edge; the clock waits for every addressed returner and for older gameplay
pause/level-up owners to clear. This prevents the grace from expiring beneath
loading or another modal.

Protocol 83 projects `gameplayResumeGrace` in welcome and live messages as
`{ sequence, reason, remainingMs }`. `remainingMs=null` means the run is held
while readiness or an older owner remains pending. Positive remaining time is
sampled when the message is encoded; clients derive the visible whole-second
`3,2,1` countdown from their monotonic receipt clock. The authenticated
`client-resume-grace-ready` message carries the sequence and cannot release or
shorten authority.

Grace joins gameplay pause and level-up in the complete input/prediction/
presentation hold predicate. Shared-world stepping excludes the union of
pause-held and grace-held party IDs while Hub and unrelated runs continue.
Standalone stepping stops while either hold exists. Expiry clears queued and
held input again; standalone resets its next-tick wall-clock deadline, while a
shared run rejoins the already-live scheduler on its next ordinary edge. No
elapsed wall time becomes catch-up simulation. The visible countdown overlay
exists only after readiness and is presentation-only; it never owns expiry.

## Tutorial opening guidance and selective hostile hold

Protocol 84 extends the strict Tutorial snapshot with one host-owned
`movementInstructionAcknowledged` boolean. The Boneyard movement owner now
projects the same strict native movement-epoch result consumed by collision and
automatic Staff admission. Only the conjunction of a nonzero authenticated
player movement request and an admitted movement epoch can set the Tutorial
boolean; raw or sealed input alone cannot, and the stock forced-intro velocity
lacks the authenticated request. Save schema 16 persists that fact, while
schemas 1 through 15 normalize it false.

The per-player movement-epoch projection also encloses both native Staff
contact sources. A nonempty ordered root-contact result retains priority and a
zero-result epoch may use the facing-qualified current-contact fallback, but a
stationary tick reaches neither branch. This fact is internal fixed-tick state;
it is consumed before action creation and is not replicated as a protocol
member.

The Tutorial's requested first-combat hold is not gameplay pause or resume
grace. While the active controller is at stage 2, the hostile store accepts the
authored opening spawn intents and advances its `lastStepTick`, but preserves
existing hostile actors, Maggots, projectiles, effects, death lanes, and RNG.
The same stage-2 predicate holds the solo player's translation by feeding the
Boneyard movement planner zero retained velocity, idle movement input, and
movement scale zero. Aim and primary-cast simulation remain live, as do
Tutorial/narration clocks, UI, and the application pointer clock. The first
accepted primary cast advances the controller to stage 3 on the next 100-Hz
tick; player and hostile movement then resume with no elapsed-time replay. This
remains a solo Tutorial rule and adds no party-wide pause message or scheduler
hold.
