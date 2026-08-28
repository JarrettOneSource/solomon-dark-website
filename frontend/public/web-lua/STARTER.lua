local icon = sd.art.sprite("art/icon.png")

local status = sd.kit.status({
  key = "example_status",
  duration = "5s",
  modifiers = {incoming_damage = {multiply = 0.8}},
})

return sd.mod({
  api = "1.0.0",
  assets = {icon = icon},
  content = {
    status,
    sd.kit.item({
      key = "example_item",
      name = "Example Item",
      art = {icon = sd.art.ref("icon")},
    }),
  },
})
