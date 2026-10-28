-- Install the unchanged tools/party-soak-pilot.lua package in this private QA
-- account first. That shared authority Lua owns combat, protection, mana and
-- ability rotation; this shared browser Lua owns menus and acceptance evidence.
qa.start("Fire", true):await() -- acknowledge the installed mod's local-play prompt
qa.set_seed(qa.seed):await()
qa.enter_boneyard():await()
local entry = qa.capture("seeded-entry"):await()
assert(entry.seed == string.format("%08x", qa.seed) .. string.rep("0", 24),
    "the authority must admit the requested seed")

local completed, captured = nil, -1
local previous_tick, stale_samples = entry.tick, 0
-- Six hours at two-second observations. The pilot uses ordinary simulation
-- input and cooldowns; no wave, enemy, kill or reward state is advanced here.
for sample = 1, 10800 do
    local state = qa.observe():await()
    stale_samples = state.tick == previous_tick and stale_samples + 1 or 0
    assert(stale_samples < 15, "the authority stopped advancing at tick " .. state.tick)
    previous_tick = state.tick
    assert(state.health > 0, "the protected pilot died")
    if state.wave >= 1 then
        assert(state.protected, "the shared endurance protection status is absent")
        assert(state.mana > 0, "the unlimited-mana pilot ran out of mana")
    end
    local milestone = math.floor(state.wave / 10)
    if milestone > captured or state.wave > 60 then
        qa.capture("wave-" .. state.wave):await()
        captured = milestone
    end
    if state.wave > 60 then completed = state; break end
    qa.sleep(2000):await()
end
assert(completed, "the pilot must clear wave 60 and enter wave 61 within six hours")
assert(completed.castSequence > 100, "the run must contain sustained accepted primary casts")
assert(completed.secondaryCastSequence > 10, "the run must repeatedly cast secondary abilities")
assert(#completed.secondarySkills >= 2, "the run must use more than one secondary ability")
assert(completed.kills > 100, "the pilot must earn combat kills")
assert(completed.pickups > 0 and completed.experience > 0, "the pilot must collect loot and earn XP")

qa.key("Escape"):await()
qa.wait("paused", true):await()
local paused = qa.capture("wave-60-cleared-paused"):await()
qa.sleep(500):await()
local still = qa.observe():await()
assert(still.tick == paused.tick, "Pause must stop the authoritative endurance run")
qa.click("leave"):await()
qa.capture("wave-60-saved-title"):await()
qa.reload_and_continue():await()
qa.sleep(2000):await()
local continued = qa.capture("wave-60-fresh-document-continued"):await()
assert(continued.runId == completed.runId, "Continue must restore the actual endurance run")
assert(continued.seed == entry.seed, "Continue must retain the run seed")
assert(continued.wave >= completed.wave, "Continue must retain cleared waves")
assert(continued.kills >= completed.kills and continued.experience >= completed.experience,
    "Continue must retain earned progression")
assert(continued.protected and continued.health > 0 and continued.mana > 0,
    "the same protected pilot must resume after restoration")
qa.key("Escape"):await()
qa.wait("paused", true):await()
qa.click("leave"):await()
