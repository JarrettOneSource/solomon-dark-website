-- Assets are named once, then referenced by content below.
local ingredient_icon = sd.art.sprite("art/information.png")
local potion_icon = sd.art.sprite("art/star.png")
local orb_icon = sd.art.sprite("art/zoom.png")
local shop_icon = sd.art.sprite("art/shoppingCart.png")
local coin_sound = sd.art.sound("audio/handleCoins.ogg", {volume = 0.55})
local page_sound = sd.art.sound("audio/bookOpen.ogg", {volume = 0.45})

local moondust = sd.kit.item({
  key = "moondust",
  name = "Moondust",
  description = "A stackable ingredient for beginner potion recipes.",
  stack = {maximum = 20},
  art = {icon = sd.art.ref("ingredient_icon")},
})

local warded = sd.kit.status({
  key = "warded",
  name = "Warded",
  description = "Reduces incoming damage for 20 seconds.",
  duration = "20s",
  stacking = "refresh",
  modifiers = {
    incoming_damage = {multiply = 0.75},
  },
})

local ward_tonic = sd.kit.potion({
  key = "ward_tonic",
  name = "Ward Tonic",
  description = "Applies Warded and restores a little mana.",
  duration = "20s",
  status = sd.ref("status", "warded"),
  on_use = sd.rules.all({
    sd.effect.status({
      target = "user",
      status = sd.ref("status", "warded"),
    }),
    sd.effect.resource({target = "user", mana = 15}),
    sd.effect.present({sound = sd.art.ref("page_sound")}),
  }),
  art = {icon = sd.art.ref("potion_icon")},
})

local survey_orb = sd.kit.powerup({
  key = "survey_orb",
  name = "Survey Orb",
  description = "A world pickup that restores mana immediately.",
  pickup = {radius = 44},
  effect = sd.effect.resource({target = "collector", mana = 25}),
  art = {
    world = sd.art.ref("orb_icon"),
    sound = sd.art.ref("coin_sound"),
  },
})

local clear_minded = sd.kit.affix({
  key = "clear_minded",
  name = "Clear Minded",
  description = "A robe affix that reduces mana costs by ten percent.",
  applies_to = {"robe"},
  modifiers = {
    mana_spend = {multiply = 0.9},
  },
})

local apprentice_reforge = sd.kit.affix_pool({
  key = "apprentice_reforge",
  name = "Apprentice Reforge",
  applies_to = {"robe"},
  rolls = 1,
  entries = {
    {affix = sd.ref("affix", "clear_minded"), weight = 1},
  },
})

local apothecary_shop = sd.kit.shop({
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
    {item = sd.ref("item", "moondust"), price = 8, quantity = 5},
    {item = sd.ref("potion", "ward_tonic"), price = 30, quantity = 2},
  },
  services = {
    {
      type = "reforge",
      pool = sd.ref("affix-pool", "apprentice_reforge"),
      price = 25,
    },
  },
  art = {npc = sd.art.ref("shop_icon")},
})

local empty_hands_boast = sd.kit.boast({
  key = "empty_hands",
  name = "EMPTY HANDS, FULL GLORY!",
  statement = "\"I need neither potion nor enchanted equipment!\"",
  response = "Provokatus nods at your reckless confidence.",
  instruction = "Survive through Wave 25 without breaking your boast.",
  fail_on = {"potion-use", "magical-equipment"},
  success_wave = 25,
  score_multiplier = 1.25,
  art = {icon = sd.art.ref("ingredient_icon")},
})

local survey_minimap = sd.kit.ui({
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

local spawn_orb = sd.rules.on("run.started", sd.effect.spawn({
  content = sd.ref("powerup", "survey_orb"),
  x = 1024,
  y = 512,
}))

-- first() chooses the first branch that produces an effect.
local remember_purchase = sd.rules.on("action.shop.purchase", sd.rules.first({
  sd.rules.when(
    {context = "participant_id"},
    sd.rules.all({
      sd.effect.state({key = "tutorial.first_purchase", value = true}),
      sd.effect.grant({
        target = "user",
        item = sd.ref("item", "moondust"),
        quantity = 1,
      }),
      sd.effect.present({sound = sd.art.ref("coin_sound")}),
    })
  ),
  sd.effect.present({sound = sd.art.ref("page_sound")}),
}))

local ping_sound = sd.rules.on(
  "action.ui.action",
  sd.rules.when(
    {context = "action", equals = "ping"},
    sd.effect.present({sound = sd.art.ref("page_sound")})
  )
)

return sd.mod({
  api = "1.0.0",
  assets = {
    coin_sound = coin_sound,
    ingredient_icon = ingredient_icon,
    orb_icon = orb_icon,
    page_sound = page_sound,
    potion_icon = potion_icon,
    shop_icon = shop_icon,
  },
  content = {
    moondust,
    warded,
    ward_tonic,
    survey_orb,
    clear_minded,
    apprentice_reforge,
    apothecary_shop,
    empty_hands_boast,
    survey_minimap,
  },
  rules = {
    spawn_orb,
    remember_purchase,
    ping_sound,
  },
})
