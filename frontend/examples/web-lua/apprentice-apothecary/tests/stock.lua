-- sdmod exposes the package's compiled graph as `mod`.
local shop
for _, content in ipairs(mod.content) do
  if content.key == "apothecary_shop" then shop = content end
end

assert(shop ~= nil)
assert(#shop.fields.stock == 2)
assert(shop.fields.stock[1].price == 8)
assert(shop.fields.stock[1].quantity == 5)
assert(shop.fields.stock[2].price == 30)

return true
