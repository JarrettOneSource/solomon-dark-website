# Boneyard workshop: edit, private test, return

## Boundary and evidence

This is the first integration slice of the approved complete stock editor work,
not a full stock-parity claim. Native Solomon Dark 0.72.5 (SHA-256
03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3) has
sandbox/testrun.boneyard and editor preview/generation paths. Existing Website
format recovery supplies the compiled Arena/RegionLayout geometry. The current
web runtime projects scenery and spawn, but does not execute imported native
recipes, triggers or timelines. That authoring/execution work remains pending
in the coordinator's full feature matrix.

The web integration boundary comprises the title-menu entry; shared standalone
and in-game editor surface; draft/history/selection/camera ownership; compile
and test admission; single-player authority; runtime presentation; cancellation,
failure, death and return; and save/score/social isolation. No active game may
remain behind the editor: entry belongs to the out-of-run title menu.

## Contract and membership

- Existing /boneyard, native/JSON import and export, draft IDs, cloud publishing,
  local autosave and quota warnings remain under the existing editor owner
- The editor remains mounted during a test, preserving document, undo/redo,
  selection, palette, rail widths, camera and incomplete tool state
- Testing suspends editor keyboard handlers and painting; returning restores
  its focus without reloading a draft or resetting the camera
- A bounded compiled native document goes to an ephemeral server-owned test
  admission; no published mod or active wizard is required
- The test host admits one fresh character, one authored map and no save/resume
  input, social broker, party join/recovery, save checkpoints or Hall receipts
- The regular authoritative client/renderer renders and plays the test map
- A persistent Return to editing action works during loading, play and failure;
  a late connection is destroyed, and ending the session reaps its host
- Native imported triggers/recipes/timelines are preserved in the document but
  remain outside this first runtime projection; the preview states that limit

## Validation contract

Focused admission/materialization and authority tests cover malformed/oversized
input, authored spawn/geometry, save rejection, no checkpoint/score/social
outputs, normal-session compatibility and teardown. Browser acceptance covers
standalone and title entry, editing, test/play/return, preserved camera/history,
interrupted/repeated tests, autosave failure and title return. Required full
Website gate and exact deployed browser verification are pending.

## Disposition

Integration members above: implementation in progress. Native recipe, trigger,
timeline and generation parity: pending later implementation, explicitly not
certified by this slice.

## Compact-screen ownership

The same editor canvas remains usable below 1050px. Palette and Inspector are
mutually exclusive dismissible overlays rather than permanently squeezing the
stage. Picking a palette item dismisses its panel. Width changes dismiss an
open compact panel without changing persisted desktop rail widths. Below 600px
viewport height, the tool rail becomes a horizontally scrollable bottom strip.
Optional rail-width persistence catches storage failures; draft autosave retains
its separate actionable warning and export fallback.

Development browser acceptance uses the actual backend endpoint and supervisor
on isolated loopback ports and storage. A harness-only example.invalid websocket
adapter maps the validated remote endpoint to its local authority; production
endpoint validation is unchanged. The production build/live journey remains the
release gate, independently of this development UI feedback.

## Focused verification (October 7)

On the M5 candidate, frontend application/test TypeScript and Release backend
compilation passed. Fourteen focused host/admission/socket cases passed, including
near-limit base64, malformed native data, authored spawn/geometry, rejecting
save/resume/intro, strict map selection, no checkpoints/Hall receipts/archives,
private presence/match/directory exclusion and repeated socket teardown. Backend
API transport/size/fail-closed test and all nine bootstrap cases passed. The API
test resets only its isolated server between groups to respect the production
six-admissions/minute policy.

Development Mac Chrome: title editor entry after the ordinary first-run tutorial
prompt; standalone route; authored gravestone and spawn; camera zoom; private
rendering and actual movement; repeated Test/Return; cancellation and service
failure retained exact document and camera; no JavaScript page errors. Desktop
1600x1000 and phone390x844 pixels reviewed, phone document width390px. The test
bar was lowered below the health HUD following review. These are focused results,
not the complete Website gate or production/live acceptance.
