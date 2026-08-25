---@meta

---@class SdArt
---@field boneyard fun(spec: table): table
---@field music fun(path: string, options?: table): table
---@field ref fun(key: string): table
---@field scene fun(spec: table): table
---@field sheet fun(spec: table): table
---@field sound fun(path: string, options?: table): table
---@field sprite fun(path: string, options?: table): table
---@field wearable fun(path: string): table

---@class SdKit
---@field affix fun(spec: table): table
---@field affix_pool fun(spec: table): table
---@field boneyard fun(spec: table): table
---@field enemy fun(spec: table): table
---@field item fun(spec: table): table
---@field potion fun(spec: table): table
---@field powerup fun(spec: table): table
---@field room fun(spec: table): table
---@field scene fun(spec: table): table
---@field scene_extension fun(spec: table): table
---@field shop fun(spec: table): table
---@field skill fun(spec: table): table
---@field spell fun(spec: table): table
---@field status fun(spec: table): table
---@field ui fun(spec: table): table

---@class Sd
---@field art SdArt
---@field kit SdKit
---@field mod fun(spec: table): table
---@field ref fun(kind: string, key: string, mod_id?: string): table

---@type Sd
sd = {}
