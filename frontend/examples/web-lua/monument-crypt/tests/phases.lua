local enemy
local scene
for _, content in ipairs(mod.content) do
  if content.key == "grave_keeper" then enemy = content end
  if content.key == "monument_crypt" then scene = content end
end

assert(enemy ~= nil)
assert(enemy.fields.stats.health == 320)
assert(enemy.fields.stats.attack_range == 230)
assert(scene ~= nil)
assert(#scene.fields.rooms == 2)
assert(#mod.reducers == 3)

return true
