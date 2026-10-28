-- Private stress fixture: invulnerable Fire/Water with no mana spending.
-- Casts still use ordinary input edges, native cooldowns, and learned skills.
sd.status({
  key = "protected", duration = "1m", stacking = "refresh",
  modifiers = {incoming_damage = 0, mana_spend = 0},
})

local function normalized(x, y)
  local length = math.sqrt(x * x + y * y)
  if length < 0.001 then return {x = 0, y = 0} end
  -- Leave room for the strict <= 1 input validator after float conversion.
  return {x = x / length * 0.999, y = y / length * 0.999}
end

sd.advanced.reducer({
  key = "pilot", scope = "participant-run", schema_version = 2,
  migrations = {
    [1] = function(previous)
      local migrated = {}
      for key, value in pairs(previous) do migrated[key] = value end
      migrated.next_quickbar = 0
      return migrated
    end,
  },
  state = sd.schema.object({
    x = sd.schema.number({default = 0}), y = sd.schema.number({default = 0}),
    stuck = sd.schema.number({default = 0}), decisions = sd.schema.number({default = 0}),
    escape_x = sd.schema.number({default = 0}), escape_y = sd.schema.number({default = 0}),
    escape_remaining = sd.schema.number({default = 0}),
    recovering = sd.schema.boolean({default = false}),
    target = sd.schema.number({default = -1}), target_health = sd.schema.number({default = 0}),
    stale_target = sd.schema.number({default = 0}), sidestep = sd.schema.number({default = 0}),
    next_quickbar = sd.schema.number({default = 0}),
  }),
  on = {"player.control"},
  reduce = function(state, event)
    local player = event.player
    if player.offer then
      local selected, best = player.offer.options[1], -1000
      for _, option in ipairs(player.offer.options) do
        local score = 0
        if option.skill_id == player.primary_skill_id then score = 90 end
        if option.name == "Explode" or option.name == "Chaining" then score = 85 end
        if option.name == "More Missiles" or option.name == "Hail" then score = 80 end
        if option.name == "Embers" or option.name == "Burn" then score = 70 end
        if option.name == "Mana Up" then score = 65 end
        if option.name == "Faster Caster" then score = 60 end
        if option.name == "Channel Mana" or option.name == "Battle Mage" then score = 55 end
        if option.name == "Meditation" then score = 50 end
        if option.name == "Mind Discipline" then score = 45 end
        if option.name == "Spell Welding" then score = -50 end
        -- Acquire offered secondary abilities for the stress workload, then
        -- continue improving their ordinary ranks and the selected primary.
        if option.category == 2 then score = option.rank == 1 and 100 or 88 end
        score = score - option.rank * 0.1
        if score > best then selected, best = option, score end
      end
      return state, {
        sd.intent.status({target = "user", status = sd.ref("status", "protected")}),
        sd.intent.resource({target = "user", mana = "full"}),
        sd.intent.select_skill({
        offer_sequence = player.offer.sequence, choice_index = selected.choice_index,
        skill_id = selected.skill_id,
      })}
    end

    local position = player.position
    local movement = {x = 0, y = 0}
    local target = event.enemies[1]
    local aim = target and target.position or nil
    local stale = target and target.id == state.target and target.health >= state.target_health
      and state.stale_target + 1 or 0
    local sidestep = math.max(0, state.sidestep - 1)
    if stale >= 30 then stale, sidestep = 0, 10 end
    local recovering = false
    if event.entry then
      movement = event.entry.movement
    else
      local destination = nil
      for _, loot in ipairs(event.loot) do
        local dx, dy = loot.position.x - position.x, loot.position.y - position.y
        -- Observations are sorted by distance; later rows cannot be in range.
        if dx * dx + dy * dy >= 250 * 250 then break end
        if loot.kind == "orb" or loot.kind == "bonus" then
          destination = loot.position
          break
        end
      end
      if not destination and target then
        local dx, dy = target.position.x - position.x, target.position.y - position.y
        if dx * dx + dy * dy > 180 * 180 then
          destination = target.position
        elseif sidestep > 0 and not recovering then
          movement = normalized(-dy, dx)
        end
      end
      if destination then
        movement = normalized(destination.x - position.x, destination.y - position.y)
      end
    end
    local travelled = (position.x - state.x)^2 + (position.y - state.y)^2
    local escape_x, escape_y = state.escape_x, state.escape_y
    local escape_remaining = event.entry and 0 or math.max(0, state.escape_remaining - 1)
    if escape_remaining > 0 then movement = {x = escape_x, y = escape_y} end
    local moving = movement.x * movement.x + movement.y * movement.y > 0.01
    local stuck = moving and travelled < 0.5 and state.stuck + 1 or 0
    if not event.entry and stuck >= 15 then
      local angle = math.floor(state.decisions / 15) * 2.399963
      escape_x, escape_y = math.cos(angle) * 0.999, math.sin(angle) * 0.999
      -- Keep walking away for three seconds after movement resumes; otherwise
      -- the next decision immediately drives back into the same obstacle.
      escape_remaining, stuck = 30, 0
      movement = {x = escape_x, y = escape_y}
    end
    local quickbar, next_quickbar, nearest_slot = nil, state.next_quickbar, 8
    if not event.entry and player.secondary_ready then
      for _, ability in ipairs(player.secondary_abilities) do
        local distance = (ability.slot - state.next_quickbar) % 8
        if ability.cooldown_ticks <= 0 and not ability.active
          and ability.slot ~= player.held_quickbar and distance < nearest_slot then
          quickbar, nearest_slot = ability.slot, distance
        end
      end
      if quickbar ~= nil then next_quickbar = (quickbar + 1) % 8 end
    end
    return {x = position.x, y = position.y, stuck = stuck,
      escape_x = escape_x, escape_y = escape_y, escape_remaining = escape_remaining,
      decisions = state.decisions + 1, recovering = recovering,
      target = target and target.id or -1, target_health = target and target.health or 0,
      stale_target = stale, sidestep = sidestep, next_quickbar = next_quickbar}, {
      sd.intent.status({target = "user", status = sd.ref("status", "protected")}),
      sd.intent.resource({target = "user", mana = "full"}),
      sd.intent.input({movement = movement, aim = aim,
        quickbar = quickbar,
        -- Air and Water arm on a press edge. Release briefly to re-arm after
        -- an interruption such as a level-up offer cancelling the channel.
        primary = not event.entry
          and state.decisions % 20 ~= 0}),
    }
  end,
})
