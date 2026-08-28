local keeper_sheet = sd.art.sheet({
  image = "art/grave-keeper.png",
  frame = {width = 192, height = 192},
  headings = 16,
  animations = {
    idle = {1, 2, 3, 4},
    move = {5, 6, 7, 8, 9, 10},
    attack = {11, 12, 13, 14},
    death = {15, 16, 17, 18},
  },
})
local bolt_icon = sd.art.sprite("art/target.png")
local crypt_music = sd.art.music("audio/dungeon_ambient_1.ogg", {volume = 0.24})
local door_sound = sd.art.sound("audio/doorOpen_1.ogg", {volume = 0.55})
local impact_sound = sd.art.sound("audio/metalClick.ogg", {volume = 0.5})
local crypt_map = sd.art.boneyard("levels/monument-crypt.boneyard")
local crypt_layout = sd.art.scene("scenes/crypt-layout.json")

local grave_mark = sd.kit.status({
  key = "grave_mark",
  name = "Grave Mark",
  description = "The Grave Keeper's retaliation briefly increases damage taken.",
  duration = "2s",
  stacking = "refresh",
  modifiers = {
    incoming_damage = {multiply = 1.1},
  },
})

local crypt_token = sd.kit.item({
  key = "crypt_token",
  name = "Crypt Token",
  description = "A small party-entry souvenir granted by the portal reducer.",
  stack = {maximum = 9},
  art = {icon = sd.art.ref("bolt_icon")},
})

local grave_bolt = sd.kit.spell({
  key = "grave_bolt",
  name = "Grave Bolt",
  description = "A narrow projectile used by the Grave Keeper.",
  slot = "primary",
  mana = 10,
  cooldown = "750ms",
  behavior = sd.prefab.projectile({
    radius = 22,
    speed = 700,
    duration = "2s",
    effects = {
      sd.effect.damage({target = "target_enemy", amount = 14}),
      sd.effect.present({sound = sd.art.ref("impact_sound")}),
    },
  }),
  art = {
    icon = sd.art.ref("bolt_icon"),
    effect = sd.art.ref("bolt_icon"),
    sound = sd.art.ref("impact_sound"),
  },
})

local grave_aura = sd.kit.spell({
  key = "grave_aura",
  name = "Grave Aura",
  description = "A wide area pulse around a chosen point.",
  slot = "secondary",
  mana = 24,
  cooldown = "3s",
  behavior = sd.prefab.area({
    radius = 280,
    duration = "1s",
    every = "250ms",
    effects = {
      sd.effect.damage({target = "hostiles_in_area", amount = 40}),
    },
  }),
  art = {
    icon = sd.art.ref("bolt_icon"),
    effect = sd.art.ref("bolt_icon"),
    sound = sd.art.ref("door_sound"),
  },
})

local grave_keeper = sd.kit.enemy({
  key = "grave_keeper",
  name = "Grave Keeper",
  description = "A custom directional enemy rendered from a CC0 animated model.",
  stats = {
    health = 320,
    speed = 0.8,
    scale = 0.9,
    collision_radius = 28,
    attack_range = 230,
    attack_cooldown = "1200ms",
    damage = 5,
  },
  loot = {
    gold = {minimum = 40, maximum = 65},
    experience = 100,
  },
  art = {
    atlas = sd.art.ref("keeper_sheet"),
    attack_sound = sd.art.ref("impact_sound"),
    death_sound = sd.art.ref("door_sound"),
  },
})

local monument_boneyard = sd.kit.boneyard({
  key = "monument_boneyard",
  name = "Monument Approach",
  description = "A stock-format Boneyard with six usable monuments.",
  source = "levels/monument-crypt.boneyard",
  environment = {mode = 1},
  anchors = {
    entry = {x = 1700, y = 1700},
  },
  roster = {
    sd.ref("enemy", "grave_keeper"),
  },
  waves = {
    {wave = 1, roster = {"stock.skeleton", sd.ref("enemy", "grave_keeper")}},
    {wave = 2, roster = {"stock.skeleton_mage", "stock.skeleton"}},
  },
  triggers = {
    sd.rules.on(
      "wave.started",
      sd.effect.present({sound = sd.art.ref("door_sound")})
    ),
  },
  art = {
    layout = sd.art.ref("crypt_map"),
    music = sd.art.ref("crypt_music"),
  },
})

local sealed_vestibule = sd.kit.room({
  key = "sealed_vestibule",
  name = "Sealed Vestibule",
  description = "The party enters together. Only the leader changes rooms.",
  geometry = {
    kind = "inline",
    width = 1120,
    height = 720,
    floor = "#211d28",
    walls = {
      {x = 180, y = 170, width = 760, height = 28, color = "#5c5266"},
      {x = 180, y = 500, width = 760, height = 28, color = "#5c5266"},
    },
  },
  props = {
    {kind = "seal", label = "Outer Seal", x = 560, y = 340, radius = 34, color = "#8f72ae"},
  },
})

local keeper_vault = sd.kit.room({
  key = "keeper_vault",
  name = "Keeper Vault",
  description = "Changing to this room spawns a Keeper in the suspended Boneyard.",
  geometry = {
    kind = "inline",
    width = 1120,
    height = 720,
    floor = "#151922",
    walls = {
      {x = 250, y = 120, width = 620, height = 36, color = "#4f5968"},
      {x = 250, y = 560, width = 620, height = 36, color = "#4f5968"},
      {x = 250, y = 156, width = 36, height = 404, color = "#4f5968"},
      {x = 834, y = 156, width = 36, height = 404, color = "#4f5968"},
    },
  },
  props = {
    {kind = "chest", label = "Keeper Chest", x = 560, y = 280, radius = 28, color = "#b29554"},
    {kind = "monument", label = "Return Stone", x = 560, y = 430, radius = 30, color = "#7d6a92"},
  },
})

local monument_crypt = sd.kit.scene({
  key = "monument_crypt",
  name = "Monument Crypt",
  description = "A party-owned two-room scene with a resumable parent run.",
  rooms = {
    sd.ref("room", "sealed_vestibule"),
    sd.ref("room", "keeper_vault"),
  },
  art = {layout = sd.art.ref("crypt_layout")},
})

local monument_portal = sd.kit.scene_extension({
  key = "monument_portal",
  name = "Monument Crypt Portal",
  scene = "stock.boneyard",
  features = {
    sd.prefab.portal({
      selector = {object_kind = "monument"},
      destination = sd.ref("scene", "monument_crypt"),
      policy = "leader_confirms",
      prompt = "Enter Monument Crypt",
    }),
  },
})

local keeper_state = sd.schema.object({
  phase = sd.schema.enum({"guarding", "enraged", "defeated"}),
  hits = sd.schema.integer({default = 0, min = 0, max = 999}),
})

local keeper_phase = sd.advanced.reducer({
  key = "keeper_phase",
  scope = "entity",
  schema_version = 1,
  state = keeper_state,
  on = {"mod.enemy.damaged", "mod.enemy.died"},
  reduce = function(current, event, context)
    local phase = "guarding"
    if event.current_health == 0 then
      phase = "defeated"
    elseif event.current_health * 2 <= event.maximum_health then
      phase = "enraged"
    end
    return {phase = phase, hits = current.hits + 1}, {
      sd.intent.damage({target = "user", amount = 1}),
      sd.intent.status({target = "user", status = sd.ref("status", "grave_mark")}),
      sd.intent.state({key = "keeper.phase", value = phase}),
      sd.intent.present({sound = sd.art.ref("impact_sound")}),
    }
  end,
})

local progress_state = sd.schema.object({
  entered = sd.schema.boolean({default = false}),
  label = sd.schema.string({default = "sealed", max_bytes = 32}),
  seals = sd.schema.array({
    item = sd.schema.string({max_bytes = 32}),
    max_items = 4,
  }),
})

local crypt_progress = sd.advanced.reducer({
  key = "crypt_progress",
  scope = "party-run",
  schema_version = 1,
  state = progress_state,
  on = {"action.portal.enter"},
  reduce = function(current, event, context)
    return {entered = true, label = "opened", seals = {"outer"}}, {
      sd.intent.grant({
        target = "user",
        item = sd.ref("item", "crypt_token"),
        quantity = 1,
      }),
      sd.intent.state({key = "crypt.entered", value = true}),
      sd.intent.present({sound = sd.art.ref("door_sound")}),
    }
  end,
})

local room_state = sd.schema.object({
  room = sd.schema.integer({default = 0, min = 0, max = 1}),
  door = sd.schema.enum({"sealed", "open"}),
})

local crypt_room = sd.advanced.reducer({
  key = "crypt_room",
  scope = "scene",
  schema_version = 1,
  state = room_state,
  on = {"action.scene.room"},
  reduce = function(current, event, context)
    if event.room_index == 1 then
      return {room = 1, door = "open"}, {
        sd.intent.spawn({enemy = sd.ref("enemy", "grave_keeper"), x = 1700, y = 1700}),
        sd.intent.state({key = "crypt.room", value = 1}),
      }
    end
    return {room = 0, door = "sealed"}, {
      sd.intent.state({key = "crypt.room", value = 0}),
    }
  end,
})

return sd.mod({
  api = "1.0.0",
  assets = {
    bolt_icon = bolt_icon,
    crypt_layout = crypt_layout,
    crypt_map = crypt_map,
    crypt_music = crypt_music,
    door_sound = door_sound,
    impact_sound = impact_sound,
    keeper_sheet = keeper_sheet,
  },
  content = {
    grave_mark,
    crypt_token,
    grave_bolt,
    grave_aura,
    grave_keeper,
    monument_boneyard,
    sealed_vestibule,
    keeper_vault,
    monument_crypt,
    monument_portal,
  },
  systems = {keeper_phase, crypt_progress, crypt_room},
})
