-- Web Lua starter. Each sd.* call tells the game about one thing.
-- Save this as scripts/main.lua, put a PNG at art/icon.png, and run "sdmod check".

-- A status is a temporary effect on a character.
local tough = sd.status({
  key = "example_tough",
  duration = "5s",
  modifiers = {incoming_damage = {multiply = 0.8}},
})

-- An item can be carried, sold, and granted. The icon path declares the art.
sd.item({
  key = "example_item",
  name = "Example Item",
  icon = "art/icon.png",
})

-- A potion with a status applies that status when it is used.
sd.potion({
  key = "example_potion",
  name = "Example Potion",
  status = tough,
  icon = "art/icon.png",
})

-- Rules react to game events. This one hands the potion out when a run starts.
sd.on("run.started", sd.effect.grant({target = "user", item = "example_potion", quantity = 1}))
