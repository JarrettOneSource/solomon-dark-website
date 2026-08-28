local skill
for _, content in ipairs(mod.content) do
  if content.key == "gravity_student" then skill = content end
end

assert(skill ~= nil)
assert(#skill.fields.ranks == 3)
assert(skill.fields.ranks[1].modify.gravity_well_damage.multiply == 1.0)
assert(skill.fields.ranks[2].modify.gravity_well_damage.multiply == 1.2)
assert(skill.fields.offer.minimum_level == 2)

return true
