# Lua player control

Lua mods may drive an existing connected player through the same authoritative
input and skill-choice paths used by the browser. The browser remains a normal
client: it receives snapshots, renders the world, sends its viewport and input,
and owns its connection and save. Control does not create another player.

The existing Web Lua 1.0 advanced reducer is the decision owner. A
`participant-run` reducer subscribed to `player.control` receives a bounded
observation up to ten times per second. The event runs before simulation and
continues while a skill offer freezes the simulation tick. Ordinary pause,
renderer readiness, and custom-scene barriers retain their existing ownership.

`sd.intent.input` supplies `movement = {x, y}`, optional world-space `aim`,
`primary`, and optional zero-based `quickbar`. The movement magnitude must not
exceed one, matching browser input. The host keeps the browser's viewport. Supplying
only `release = true` returns control to browser input. Inputs expire after
250 ms without another valid decision and are cleared on disconnect, run
change, restoration, or mod teardown. Two reducers cannot own the same player's
input at once. These intents can affect only the participant named by their
event scope.

`sd.intent.select_skill` supplies `offer_sequence`, zero-based `choice_index`,
and `skill_id` from the observed offer. The ordinary skill-choice validator
checks the current offer and applies the choice; it cannot grant arbitrary
skills or levels.

The observation contains the participant's position, resources, primary skill,
current offer, combat bounds, wave, and bounded nearby hostile and loot rows.
During entry it also contains the next collision-aware movement from the shared
Boneyard entrance navigator. Lua may use that direction to reach Solomon and
start the ordinary encounter. The ML controller uses the same navigator.
Only connected living participants in an active Boneyard receive it. Lua makes
the decisions; the framework provides observations, validation, input lifetime,
and atomic intent application. No Lua or decision callback runs in the browser.

If the execution budget interrupts an event dispatch, its partial reducer state
and intents roll back together. A scheduled rule that exceeds its budget also
applies no effects and is cancelled. Functional tests use a controlled budget
clock; dedicated regressions force budget exhaustion between reducers and
during a timer. Production retains the ordinary 4 ms budget and clock.

The implementation belongs to the prepared mod host and its player-control
module. GameHost applies its resulting inputs before the normal shared/private
simulation step. Existing statuses provide invincibility; the controller API
does not change damage, collision, progression, waves, or scoring rules.

Verification covers movement and attacks through simulation, human takeover,
stale and invalid input, participant isolation, skill selection during frozen
ticks, and teardown. A separate private monitoring mod and production Mac/NFO
run will validate sustained behavior through wave 50.

`frontend/tools/monitor-game-run.mjs` opens real Mac Chrome and starts a normal
game. It records frame p95/p99/max, long tasks, browser task/script CPU time,
heap, snapshot cadence, ingress, waves, and entity counts. Set
`SDR_MONITOR_OUTPUT`, `SDR_MONITOR_WAVE`, and optionally
`SDR_MONITOR_TOKEN_FILE` before running it with Node. The token file uses the
existing Website login token and is never included in output. The pilot toggle
is checked during combat; set `SDR_MONITOR_PILOT=0` to observe another controller.
Completion requires entering the wave after the requested wave, so wave 50 is
actually completed rather than only opened.

On NFO, `python3 ops/nfo/monitor-game-run.py` records service CPU, resident and
cgroup memory, restart/OOM counters, supervisor health, and machine load every
five seconds. Service CPU uses 100 percent for one fully occupied core; machine
CPU uses 100 percent for the entire machine. Browser ingress counts decoded
WebSocket payload bytes rather than compressed network traffic. The existing
private run archive supplies aggregate authoritative tick timings after the
session closes.
