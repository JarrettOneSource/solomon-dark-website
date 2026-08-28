# 2026-08-26 browser-only Tutorial-decline routing

Follow-up report: choosing `NO` on the Website's `PLAY THE TUTORIAL?` prompt
still led into the College title walk. This is not a native parity branch.
Retail owns the completed-Tutorial Game Over handoff into the first story Game,
but it does not own the Website's pre-game yes/no offer. The existing browser
handler merely dismissed the prompt; the later ordinary New Game request still
saw a fresh profile with `collegeIntroPending=true` and therefore selected the
College admission path.

The Website product policy is now explicit:

- `YES` enters the stock Tutorial. Completing that Tutorial retains the exact
  stock College title walk, Office introduction, Create, and Courtyard handoff.
- `NO` records the Tutorial as declined and returns control to the title menu;
  it does not start a game. The next ordinary Play -> New Game selection enters
  Create, and the selected wizard then enters the Hub without any College
  admission program.
- The decline is authoritative save state, not a page-local preference. The
  client sends a fresh-admission-only intent; the host clears the existing
  `tutorialPending` and `collegeIntroPending` fields before its welcome and
  connected checkpoint. Reloading that checkpoint cannot offer the Tutorial or
  arm College later.
- A decline intent is incompatible with a save/resume token or a simultaneous
  College request. This prevents a browser from erasing onboarding state on an
  existing wizard.

Protocol 81 carries only that admission intent. Save schema 15 remains current
because the two durable booleans already belong to the profile. Responsive
browser acceptance must choose `NO`, remain at the title until Play -> New Game,
then reach Create without a College scene. The host regression must prove that
the connected checkpoint restores both flags as false and that College arming
is then a no-op.
