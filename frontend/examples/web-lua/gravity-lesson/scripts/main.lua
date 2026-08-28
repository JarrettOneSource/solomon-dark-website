local well_sheet = sd.art.sheet({
  image = "art/star.png",
  frame = {width = 100, height = 100},
  animations = {pulse = {1}},
})
local pebble_icon = sd.art.sprite("art/target.png")
local beam_icon = sd.art.sprite("art/zoom.png")
local impact_sound = sd.art.sound("audio/metalClick.ogg", {volume = 0.55})
local lesson_sound = sd.art.sound("audio/bookOpen.ogg", {volume = 0.4})

local steady = sd.kit.status({
  key = "steady",
  name = "Steady",
  description = "Brief protection while concentrating on a gravity spell.",
  duration = "1s",
  stacking = "refresh",
  modifiers = {
    incoming_damage = {multiply = 0.9},
  },
})

local gravity_well = sd.kit.spell({
  key = "gravity_well",
  name = "Gravity Well",
  description = "A three-second area that pulses damage around its target.",
  slot = "secondary",
  mana = 22,
  cooldown = "2s",
  behavior = sd.prefab.area({
    radius = 180,
    duration = "3s",
    every = "500ms",
    effects = {
      sd.effect.damage({
        target = "hostiles_in_area",
        amount = 6,
        modifier = "gravity_well_damage",
      }),
      sd.effect.status({
        target = "caster",
        status = sd.ref("status", "steady"),
      }),
    },
  }),
  art = {
    icon = sd.art.ref("well_sheet"),
    effect = sd.art.ref("well_sheet"),
    sound = sd.art.ref("impact_sound"),
  },
})

local comet_pebble = sd.kit.spell({
  key = "comet_pebble",
  name = "Comet Pebble",
  description = "A fast projectile that stops on its first target.",
  slot = "primary",
  mana = 8,
  cooldown = "300ms",
  behavior = sd.prefab.projectile({
    radius = 18,
    speed = 900,
    duration = "1s",
    effects = {
      sd.effect.damage({target = "target_enemy", amount = 18}),
      sd.effect.present({sound = sd.art.ref("impact_sound")}),
    },
  }),
  art = {
    icon = sd.art.ref("pebble_icon"),
    effect = sd.art.ref("pebble_icon"),
    sound = sd.art.ref("impact_sound"),
  },
})

local steady_beam = sd.kit.spell({
  key = "steady_beam",
  name = "Steady Beam",
  description = "A short channel that damages targets along a narrow line.",
  slot = "secondary",
  mana = 18,
  cooldown = "1500ms",
  behavior = sd.prefab.channel({
    width = 30,
    duration = "1s",
    every = "100ms",
    effects = {
      sd.effect.damage({target = "hostiles_in_channel", amount = 3}),
    },
  }),
  art = {
    icon = sd.art.ref("beam_icon"),
    effect = sd.art.ref("beam_icon"),
    sound = sd.art.ref("lesson_sound"),
  },
})

local gravity_student = sd.kit.skill({
  key = "gravity_student",
  name = "Gravity Student",
  description = "Unlocks Gravity Well and improves its damage with each rank.",
  offer = {minimum_level = 2, weight = 2},
  grants = {sd.ref("spell", "gravity_well")},
  ranks = {
    {modify = {gravity_well_damage = {multiply = 1.0}}},
    {modify = {gravity_well_damage = {multiply = 1.2}}},
    {modify = {gravity_well_damage = {multiply = 1.2}}},
  },
  art = {icon = sd.art.ref("well_sheet")},
})

local pebble_practice = sd.kit.skill({
  key = "pebble_practice",
  name = "Pebble Practice",
  description = "A child lesson that unlocks Comet Pebble.",
  parent = sd.ref("skill", "gravity_student"),
  prerequisites = {sd.ref("skill", "gravity_student")},
  offer = {minimum_level = 3},
  ranks = {
    {grant = sd.ref("spell", "comet_pebble")},
  },
  art = {icon = sd.art.ref("pebble_icon")},
})

local beam_practice = sd.kit.skill({
  key = "beam_practice",
  name = "Beam Practice",
  description = "A child lesson that unlocks Steady Beam.",
  parent = sd.ref("skill", "gravity_student"),
  prerequisites = {sd.ref("skill", "gravity_student")},
  offer = {minimum_level = 3},
  ranks = {
    {grant = sd.ref("spell", "steady_beam")},
  },
  art = {icon = sd.art.ref("beam_icon")},
})

local lesson_state = sd.schema.object({
  casts = sd.schema.integer({default = 0, min = 0, max = 999}),
  rhythm = sd.schema.number({default = 0, min = 0, max = 1}),
  active = sd.schema.boolean({default = false}),
})

local lesson_streak = sd.advanced.reducer({
  key = "lesson_streak",
  scope = "participant-run",
  schema_version = 2,
  migrations = {
    [1] = function(old)
      return {casts = old.casts, rhythm = 0, active = old.casts > 0}
    end,
  },
  state = lesson_state,
  on = {"action.content.cast"},
  reduce = function(current, event, context)
    local next_casts = current.casts + 1
    return {
      casts = next_casts,
      rhythm = context.random("lesson-rhythm"),
      active = true,
    }, {
      sd.intent.resource({target = "caster", mana = 1}),
      sd.intent.state({key = "gravity.lesson.casts", value = next_casts}),
      sd.intent.present({sound = sd.art.ref("lesson_sound")}),
    }
  end,
})

local session_state = sd.schema.object({
  demonstrations = sd.schema.integer({default = 0, min = 0, max = 999}),
})

local demonstration_counter = sd.advanced.reducer({
  key = "demonstration_counter",
  scope = "session",
  schema_version = 1,
  state = session_state,
  on = {"session.started"},
  reduce = function(current)
    local next_count = current.demonstrations + 1
    return {demonstrations = next_count}, {
      sd.intent.state({key = "gravity.demonstrations", value = next_count}),
    }
  end,
})

local begin_lesson = sd.rules.on("run.started", sd.rules.all({
  sd.rules.after(
    "1s",
    sd.effect.present({sound = sd.art.ref("lesson_sound")})
  ),
  sd.rules.every(
    "2s",
    sd.effect.present({sound = sd.art.ref("impact_sound")}),
    {times = 3}
  ),
}))

return sd.mod({
  api = "1.0.0",
  assets = {
    beam_icon = beam_icon,
    impact_sound = impact_sound,
    lesson_sound = lesson_sound,
    pebble_icon = pebble_icon,
    well_sheet = well_sheet,
  },
  content = {
    steady,
    gravity_well,
    comet_pebble,
    steady_beam,
    gravity_student,
    pebble_practice,
    beam_practice,
  },
  rules = {begin_lesson},
  systems = {lesson_streak, demonstration_counter},
})
