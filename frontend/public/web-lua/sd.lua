---@meta

---@alias SdDuration integer|string
---@alias SdEventName "action.content.cast"|"action.content.pickup"|"action.content.use"|"action.portal.enter"|"action.scene.room"|"action.shop.purchase"|"action.ui.action"|"enemy.death"|"enemy.spawned"|"gold.changed"|"level.up"|"mod.enemy.damaged"|"mod.enemy.died"|"run.ended"|"run.started"|"session.started"|"wave.completed"|"wave.started"
---@alias SdScope "entity"|"participant-profile"|"participant-run"|"party-run"|"scene"|"session"
---@alias SdRule table
---@alias SdIntentValue table
---@alias SdSchemaDefinition table

---@class SdUiBinding
---@field state string

---@class SdUiVisibilityState
---@field state string
---@field equals? boolean|number|string

---@class SdUiVisibility
---@field scenes? ("hub"|"boneyard"|"room")[]
---@field state? SdUiVisibilityState

---@class SdReducerSpec
---@field key string
---@field scope SdScope
---@field schema_version integer
---@field state SdSchemaDefinition
---@field on SdEventName[]
---@field reduce function
---@field migrations? table<integer, function>

---@class SdAffixSpec
---@field key string
---@field applies_to? string[]
---@field description? string
---@field modifiers table
---@field name string

---@class SdAffixPoolSpec
---@field key string
---@field applies_to? string[]
---@field description? string
---@field entries table[]
---@field name? string
---@field rng_domain? string
---@field rolls? integer

---@class SdBoneyardSpec
---@field key string
---@field anchors? table
---@field art? table
---@field description? string
---@field environment? table
---@field name string
---@field roster? table[]
---@field source string
---@field triggers? SdRule[]
---@field waves? table[]

---@class SdBoastSpec
---@field key string
---@field art? table
---@field description? string
---@field fail_on? ("magical-equipment"|"mana-underflow"|"potion-use"|"secondary-cast")[]
---@field instruction string
---@field name string
---@field random_skill_choices? boolean
---@field response string
---@field score_multiplier? number
---@field statement string
---@field stock_icon? integer
---@field success_wave? integer

---@class SdEnemySpec
---@field key string
---@field art? table
---@field description? string
---@field loot? table
---@field name string
---@field stats? table

---@class SdItemSpec
---@field key string
---@field art? table
---@field description? string
---@field equipment? table
---@field name string
---@field stack? table
---@field use? SdRule

---@class SdPotionSpec
---@field key string
---@field art? table
---@field description? string
---@field duration SdDuration
---@field loot? table
---@field name string
---@field on_use SdRule
---@field presentation? table
---@field status? table

---@class SdPowerupSpec
---@field key string
---@field art? table
---@field description? string
---@field effect SdRule
---@field name string
---@field pickup? table

---@class SdRoomSpec
---@field key string
---@field art? table
---@field description? string
---@field geometry table
---@field name? string
---@field props? table

---@class SdSceneSpec
---@field key string
---@field art? table
---@field description? string
---@field name? string
---@field rooms table[]

---@class SdSceneExtensionSpec
---@field key string
---@field description? string
---@field features SdRule[]
---@field name? string
---@field scene "stock.boneyard"

---@class SdShopSpec
---@field key string
---@field art? table
---@field description? string
---@field mount? table
---@field name string
---@field npc? table
---@field restock? SdDuration
---@field services? table[]
---@field stock table[]
---@field stock_scope? "party"|"player"|"session"

---@class SdSkillSpec
---@field key string
---@field art? table
---@field description? string
---@field grants? table
---@field maximum_rank? integer
---@field name string
---@field offer? table
---@field parent? table
---@field prerequisites? table[]
---@field ranks table[]

---@class SdSpellSpec
---@field key string
---@field art? table
---@field behavior SdRule
---@field cooldown? SdDuration
---@field description? string
---@field mana? number
---@field name string
---@field slot "primary"|"secondary"

---@class SdStatusSpec
---@field key string
---@field description? string
---@field duration? SdDuration
---@field modifiers? table
---@field name? string
---@field stacking? "ignore"|"refresh"|"replace"|"stack"

---@class SdUiSpec
---@field key string
---@field accessible_name? string
---@field actions? string[]
---@field bindings? table<string, SdUiBinding>
---@field description? string
---@field mount "hud.bottom_left"|"hud.bottom_right"|"hud.overlay"|"hud.top_left"|"hud.top_right"
---@field name? string
---@field view SdRule
---@field visible? SdUiVisibility

---@class SdModSpec
---@field api "1.0.0"
---@field assets? table<string, table>
---@field content? table[]
---@field rules? SdRule[]
---@field systems? table[]

---@class SdArt
---@field boneyard fun(spec: string|table): table
---@field music fun(path: string, options?: table): table
---@field ref fun(key: string): table
---@field scene fun(spec: string|table): table
---@field sheet fun(spec: table): table
---@field sound fun(path: string, options?: table): table
---@field sprite fun(path: string, options?: table): table
---@field wearable fun(path: string): table

---@class SdKit
---@field affix fun(spec: SdAffixSpec): table
---@field affix_pool fun(spec: SdAffixPoolSpec): table
---@field boneyard fun(spec: SdBoneyardSpec): table
---@field boast fun(spec: SdBoastSpec): table
---@field enemy fun(spec: SdEnemySpec): table
---@field item fun(spec: SdItemSpec): table
---@field potion fun(spec: SdPotionSpec): table
---@field powerup fun(spec: SdPowerupSpec): table
---@field room fun(spec: SdRoomSpec): table
---@field scene fun(spec: SdSceneSpec): table
---@field scene_extension fun(spec: SdSceneExtensionSpec): table
---@field shop fun(spec: SdShopSpec): table
---@field skill fun(spec: SdSkillSpec): table
---@field spell fun(spec: SdSpellSpec): table
---@field status fun(spec: SdStatusSpec): table
---@field ui fun(spec: SdUiSpec): table

---@class SdRules
---@field on fun(event: SdEventName, node: SdRule): SdRule
---@field all fun(nodes: SdRule[]): SdRule
---@field first fun(nodes: SdRule[]): SdRule
---@field when fun(predicate: boolean|table, yes: SdRule, no?: SdRule): SdRule
---@field after fun(duration: SdDuration, node: SdRule): SdRule
---@field every fun(interval: SdDuration, node: SdRule, options: {times: integer}): SdRule

---@class SdEffect
---@field damage fun(spec: table): SdRule
---@field resource fun(spec: table): SdRule
---@field status fun(spec: table): SdRule
---@field spawn fun(spec: table): SdRule
---@field grant fun(spec: table): SdRule
---@field state fun(spec: table): SdRule
---@field present fun(spec: table): SdRule

---@class SdIntent
---@field damage fun(spec: table): SdIntentValue
---@field resource fun(spec: table): SdIntentValue
---@field status fun(spec: table): SdIntentValue
---@field spawn fun(spec: table): SdIntentValue
---@field grant fun(spec: table): SdIntentValue
---@field state fun(spec: table): SdIntentValue
---@field present fun(spec: table): SdIntentValue

---@class SdPrefab
---@field projectile fun(spec: table): SdRule
---@field area fun(spec: table): SdRule
---@field channel fun(spec: table): SdRule
---@field minimap fun(spec: table): SdRule
---@field portal fun(spec: table): SdRule

---@class SdSchema
---@field boolean fun(spec: table): SdSchemaDefinition
---@field integer fun(spec: table): SdSchemaDefinition
---@field number fun(spec: table): SdSchemaDefinition
---@field string fun(spec: table): SdSchemaDefinition
---@field enum fun(spec: table): SdSchemaDefinition
---@field array fun(spec: table): SdSchemaDefinition
---@field object fun(spec: table): SdSchemaDefinition

---@class SdAdvanced
---@field reducer fun(spec: SdReducerSpec): table

---@class Sd
---@field advanced SdAdvanced
---@field art SdArt
---@field effect SdEffect
---@field intent SdIntent
---@field kit SdKit
---@field mod fun(spec: SdModSpec): table
---@field prefab SdPrefab
---@field ref fun(kind: string, key: string, mod_id?: string): table
---@field rules SdRules
---@field schema SdSchema

---@type Sd
sd = {}
