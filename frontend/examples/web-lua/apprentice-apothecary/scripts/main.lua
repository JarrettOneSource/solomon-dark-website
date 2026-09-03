-- Apprentice Apothecary: a small shop, a potion, a pickup, an affix, a boast,
-- and a minimap. Each sd.* call tells the game about one thing, and the game
-- collects everything the script created when it ends.

-- Sounds are named here because rules below reuse them.
local coin_sound = sd.sound("audio/handleCoins.ogg", {key = "coin_sound", volume = 0.55})
local page_sound = sd.sound("audio/bookOpen.ogg", {key = "page_sound", volume = 0.45})

sd.item({
  key = "moondust",
  name = "Moondust",
  description = "A stackable ingredient for beginner potion recipes.",
  stack = {maximum = 20},
  icon = "art/information.png",
})

sd.status({
  key = "warded",
  name = "Warded",
  description = "Reduces incoming damage for 20 seconds.",
  duration = "20s",
  stacking = "refresh",
  modifiers = {
    incoming_damage = {multiply = 0.75},
  },
})

-- Content refers to other content by key. "warded" is the status above.
sd.potion({
  key = "ward_tonic",
  name = "Ward Tonic",
  description = "Applies Warded and restores a little mana.",
  duration = "20s",
  status = "warded",
  on_use = {
    sd.effect.status({target = "user", status = "warded"}),
    sd.effect.resource({target = "user", mana = 15}),
    sd.effect.present({sound = page_sound}),
  },
  icon = "art/star.png",
})

sd.powerup({
  key = "survey_orb",
  name = "Survey Orb",
  description = "A world pickup that restores mana immediately.",
  pickup = {radius = 44},
  effect = sd.effect.resource({target = "collector", mana = 25}),
  world = "art/zoom.png",
  sound = coin_sound,
})

sd.affix({
  key = "clear_minded",
  name = "Clear Minded",
  description = "A robe affix that reduces mana costs by ten percent.",
  applies_to = {"robe"},
  modifiers = {
    mana_spend = {multiply = 0.9},
  },
})

sd.affix_pool({
  key = "apprentice_reforge",
  name = "Apprentice Reforge",
  applies_to = {"robe"},
  rolls = 1,
  entries = {
    {affix = "clear_minded", weight = 1},
  },
})

-- The shop's npc field is the character, so its portrait goes under art.
sd.shop({
  key = "apothecary_shop",
  name = "Apprentice Apothecary",
  description = "A tiny per-player shop beside the courtyard traders.",
  stock_scope = "player",
  restock = "2m",
  mount = {
    scene = "hub.courtyard",
    x = 1510,
    y = 665,
  },
  npc = {name = "Pip the Apprentice"},
  stock = {
    {item = "moondust", price = 8, quantity = 5},
    {item = "ward_tonic", price = 30, quantity = 2},
  },
  services = {
    {
      type = "reforge",
      pool = "apprentice_reforge",
      price = 25,
    },
  },
  art = {npc = "art/shoppingCart.png"},
})

sd.boast({
  key = "empty_hands",
  name = "EMPTY HANDS, FULL GLORY!",
  statement = "\"I need neither potion nor enchanted equipment!\"",
  response = "Provokatus nods at your reckless confidence.",
  instruction = "Survive through Wave 25 without breaking your boast.",
  fail_on = {"potion-use", "magical-equipment"},
  success_wave = 25,
  score_multiplier = 1.25,
  icon = "art/information.png",
})

sd.ui({
  key = "survey_minimap",
  name = "Survey Minimap",
  accessible_name = "Apprentice survey minimap",
  mount = "hud.top_right",
  visible = {scenes = {"boneyard"}},
  bindings = {
    first_purchase = {state = "tutorial.first_purchase"},
  },
  actions = {"ping"},
  view = sd.prefab.minimap({
    size = {width = 180, height = 180},
    range = 600,
    layers = {"party", "visible_hostiles", "powerups"},
  }),
})

-- Rules react to game events. sd.on attaches them on its own.
sd.on("run.started", sd.effect.spawn({
  content = "survey_orb",
  x = 1024,
  y = 512,
}))

-- sd.first runs the first branch that produces an effect.
sd.on("action.shop.purchase", sd.first(
  sd.when(
    {context = "participant_id"},
    sd.all(
      sd.effect.state({key = "tutorial.first_purchase", value = true}),
      sd.effect.grant({target = "user", item = "moondust", quantity = 1}),
      sd.effect.present({sound = coin_sound})
    )
  ),
  sd.effect.present({sound = page_sound})
))

sd.on("action.ui.action", sd.when(
  {context = "action", equals = "ping"},
  sd.effect.present({sound = page_sound})
))
