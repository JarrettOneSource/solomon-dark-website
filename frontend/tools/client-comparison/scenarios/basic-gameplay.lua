-- One controller for both clients: normal UI/input, genuine enemies and loot.
-- Read-only navigation uses the admitted map; it never changes the authority.
qa.start("Ether"):await()
local college = qa.capture("college"):await()
qa.hold("KeyA", 400):await()
local moved = qa.observe():await()
assert(math.abs(moved.position[1] - college.position[1]) > 5, "ordinary movement must move the wizard")
qa.key("KeyI"):await()
qa.capture("inventory"):await()
qa.key("Escape"):await()
qa.enter_boneyard():await()
qa.capture("boneyard-entry"):await()
qa.approach_solomon():await()
qa.capture("combat-start"):await()

local function nearest(items, position)
    local best, best_distance
    for _, item in ipairs(items) do
        local distance = math.sqrt((item.x - position[1]) ^ 2 + (item.y - position[2]) ^ 2)
        if not best_distance or distance < best_distance then best, best_distance = item, distance end
    end
    return best, best_distance
end

local earned, health_potion_used
for step = 1, 900 do
    local state = qa.observe():await()
    assert(state.health > 0, "the wizard died before the gameplay checkpoints")
    if state.health < 28 and not health_potion_used then
        qa.key("Digit3"):await()
        health_potion_used = true
    end
    if state.pendingOffer then
        qa.capture("earned-skill-offer"):await()
        qa.click("first-skill"):await()
    else
        local enemy, distance = nearest(state.enemies, state.position)
        local loot = nearest(state.loot, state.position)
        if enemy then qa.cast_at(enemy.x, enemy.y, 150):await() end
        if loot then
            qa.walk_toward(loot.x, loot.y, 200):await()
        elseif enemy and distance < 150 then
            local dx, dy = state.position[1] - enemy.x, state.position[2] - enemy.y
            local length = math.max(distance, 1)
            local bounds = state.combatBounds
            local x = math.max(bounds.x + 45, math.min(bounds.x + bounds.width - 45,
                state.position[1] + (dx - dy) / length * 120))
            local y = math.max(bounds.y + 45, math.min(bounds.y + bounds.height - 45,
                state.position[2] + (dy + dx) / length * 120))
            qa.walk_toward(x, y, 200):await()
        else qa.sleep(100):await() end
        if state.kills > 0 and state.pickups > 0 and state.experience > 0 then
            earned = state
            break
        end
    end
end
assert(earned, "ordinary combat must produce a kill, XP and a collected drop within the bounded run")
qa.key("Escape"):await()
qa.wait("paused", true):await()
local paused = qa.capture("earned-and-paused"):await()
qa.sleep(350):await()
local still = qa.observe():await()
assert(still.tick == paused.tick, "Pause must stop the authoritative gameplay clock")
qa.click("leave"):await()
qa.capture("saved-title"):await()
qa.reload_and_continue():await()
local continued = qa.capture("fresh-document-continued"):await()
assert(continued.runId == earned.runId, "Continue must retain the actual run")
assert(continued.experience >= earned.experience, "Continue must retain earned XP")
assert(continued.gold >= earned.gold, "Continue must retain collected gold")
assert(continued.kills >= earned.kills, "Continue must retain credited kills")
qa.hold("KeyA", 300):await()
qa.key("Escape"):await()
qa.click("leave"):await()
