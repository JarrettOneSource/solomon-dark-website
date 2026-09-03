-- Invincibility Potion: the smallest complete mod.
-- Each sd.* call tells the game about one thing.

-- A status is a temporary effect on a character. Its key is its permanent id.
local invincible = sd.status({
  key = "invincible",
  duration = "3m",
  stacking = "refresh",
  modifiers = {incoming_damage = 0, mana_spend = 0},
})

-- A potion applies its status when used. The icon path declares the art.
sd.potion({
  key = "invincibility_potion",
  name = "Invincibility Potion",
  description = "Grants invincibility and unlimited mana for 3 minutes.",
  status = invincible,
  on_use = {
    sd.effect.resource({target = "user", mana = "full"}),
    sd.effect.status({target = "user", status = invincible}),
  },
  loot = {ordinary = 0.5, boss = 1.0},
  icon = "art/invincibility_potion.png",
})
