-- Run unchanged against PixiJS and Rust. Funding is an explicit QA prerequisite
-- through the real cheat UI; all purchases/removal use the normal shop controls.
qa.start("Fire"):await()
qa.wait("tonics", 0):await() -- use a fresh QA account; College purchases persist
qa.key("Backquote"):await()
qa.fill("gold", "20000"):await()
qa.click("set-gold"):await()
qa.wait("gold", 20000):await()
qa.key("Backquote"):await()
qa.click("Hagatha"):await()
qa.capture("hagatha-before"):await()

qa.click("tonic"):await() -- select; this selection remains after the first purchase
for count = 1, 2 do
    qa.click("tonic"):await() -- buy the selected offer
    qa.wait("tonics", count):await()
    qa.wait("tonicControls", count):await()
    qa.capture("hagatha-tonic-" .. count):await()
end

local state = qa.observe():await()
assert(state.charmCapacity == 9, "two tonics must leave nine charm slots")
assert(state.gold == 16000, "first tonic costs 3000; subsequent tonic costs 1000")
qa.click("life-charm"):await()
qa.click("life-charm"):await()
qa.wait("hasLifeCharm", true):await()
qa.click("remove-life-charm"):await()
qa.wait("hasLifeCharm", false):await()
qa.wait("tonics", 2):await()
qa.capture("hagatha-after-removal"):await()
qa.click("close-panel"):await()
qa.click("Hagatha"):await()
qa.wait("tonicControls", 2):await()
qa.capture("hagatha-reopened"):await()
qa.click("close-panel"):await()
qa.key("Escape"):await()
qa.click("leave"):await()
