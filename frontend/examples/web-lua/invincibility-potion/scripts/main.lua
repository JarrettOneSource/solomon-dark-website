local icon = sd.art.sprite("art/invincibility_potion.png")

return sd.mod({
  api = "1.0.0",
  assets = {invincibility_potion = icon},
  content = {
    sd.kit.status({
      key = "invincible",
      duration = "3m",
      stacking = "refresh",
      modifiers = {incoming_damage = 0, mana_spend = 0},
    }),
    sd.kit.potion({
      key = "invincibility_potion",
      name = "Invincibility Potion",
      description = "Grants invincibility and unlimited mana for 3 minutes.",
      duration = "3m",
      stacking = "refresh",
      status = sd.ref("status", "invincible"),
      on_use = sd.rules.all({
        sd.effect.resource({target = "user", mana = "full"}),
        sd.effect.status({target = "user", status = sd.ref("status", "invincible")}),
      }),
      loot = {ordinary = 0.5, boss = 1.0},
      art = {icon = sd.art.ref("invincibility_potion")},
    }),
  },
})
