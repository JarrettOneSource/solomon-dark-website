import { Application, Container, Sprite } from 'pixi.js'
import { hub, skillPicker } from '../src/lib/assets.ts'
import { loadGameTextureMap } from '../src/game/renderer/game-webgl.ts'
import { nativeUiAtlasSource } from '../src/game/native-ui/assets.ts'
import { nativeUiPixiFor, destroyNativeUiPixiFor } from '../src/game/native-ui/pixi.ts'
import { installNativeFixedFunctionRenderPipeline } from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { loadModPresentationTextures } from '../src/game/renderer/mod-presentation-assets.ts'
import { buildInventory } from '../src/game/renderer/hub-inventory/pages.ts'
import { createGameSimulation } from '../src/game/core-server/game-simulation.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { createEquipmentInventoryItem, DOWSING_EQUIPMENT_RECIPES } from '../src/game/core-kernels/hub-economy.ts'
import { nativeEquipmentTooltipSets } from '../src/game/core-kernels/native-equipment-effects.ts'
import { hubInventoryEquipmentSlotRects } from '../src/game/renderer/hub-inventory-render-contract.ts'

export async function createSetFrameProof() {
  const textures = await loadGameTextureMap({ stock: [hub.trader.inventoryAtlas,
    hub.trader.skillsAtlas, hub.trader.uiAtlas, nativeUiAtlasSource('Library'), skillPicker.fontsAtlas] })
  const mods = await loadModPresentationTextures([])
  const app = new Application()
  await app.init({ autoStart: false, width: 1600, height: 900, resolution: 1,
    antialias: false, preference: 'webgl', preferWebGLVersion: 2, background: 0 })
  app.stop()
  installNativeFixedFunctionRenderPipeline(app.renderer)
  document.body.style.margin = '0'
  document.body.append(app.canvas)
  const state = createGameSimulation({ wizard: { displayName: 'Set frames', discipline: 'arcane', element: 'ether' } })
  const player = createGameSnapshot(state, 'wizard').players.wizard
  const setRecipes = new Set(nativeEquipmentTooltipSets().flatMap(set => set.memberRecipeIndices))
  let id = 100
  const item = (type, member = true) => createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES.find(
    recipe => recipe.type === type && setRecipes.has(recipe.sourceIndex) === member), id++)
  const setAmulet = item('amulet')
  const ordinary = item('amulet', false)
  const unknown = { ...ordinary, id: id++, recipeIndex: null }
  const setHat = item('hat'), setRobe = item('robe'), setRing = item('ring')
  const backpack = [setAmulet, ordinary, unknown, setHat, setRobe, setRing].map((value, index) => ({ ...value, inventorySlot: index * 2 }))
  const equipment = { amulet: setAmulet, hat: setHat, robe: setRobe, rings: [setRing, ordinary, null], weapon: null }
  const context = { textures, modTextures: mods, unforgeTarget: new Container(),
    // The stopped fixture omits the player-preview branch (runSummary=null).
    playerCharacterAtlas: null, elementVfxTextures: null }
  const adapter = nativeUiPixiFor(textures)
  const records = new Map([9, 10, 14, 15].map(record => [adapter.texture('Inventory', record), record]))
  let layer
  const flatten = node => [node, ...(node.children ?? []).flatMap(flatten)]
  function render(companion = false, selected = false, ordinaryEquipment = false) {
    if (layer) { context.unforgeTarget.removeFromParent(); layer.destroy({ children: true }) }
    layer = new Container()
    app.stage.addChild(layer)
    const actualEquipment = ordinaryEquipment ? { amulet: ordinary, hat: null, robe: null, rings: [null, null, null], weapon: null } : equipment
    const economy = { ...player.economy, backpack, equipment: actualEquipment, ownedPerkSelectors: [19] }
    const selection = selected ? { owner: 'backpack', equipmentSlot: null, id: setAmulet.id, startedAtMs: 0 } : null
    buildInventory(context, layer, { runSummary: null, belt: player.belt, config: player.config,
      economy, progression: player.progression, companion, selection, sackPath: [], sackTransition: null, statsPage: 0 })
    app.renderer.render(app.stage)
    const nodes = flatten(layer)
    const frames = nodes.filter(node => node instanceof Sprite && records.has(node.texture)).map(node => {
      const point = node.toGlobal({ x: 0, y: 0 })
      return { record: records.get(node.texture), x: point.x, y: point.y, width: node.width, height: node.height, alpha: node.alpha }
    })
    const tiled = nodes.filter(node => node.label?.startsWith('native-item-tiled-frame-')).map(node => ({
      label: node.label, x: node.x, y: node.y, tiles: node.children.map(tile => ({ x: tile.x, y: tile.y,
        width: tile.width, height: tile.height, frame: { ...tile.texture.frame }, uvs: { ...tile.texture.uvs } })),
    }))
    const identities = nodes.filter(node => node instanceof Sprite).map(node => node.texture)
    for (let tick = 0; tick < 10; tick++) app.renderer.render(app.stage)
    const retained = nodes.filter(node => node instanceof Sprite).every((node, index) => node.texture === identities[index])
    return { companion, selected, ordinaryEquipment, frames, tiled, retained,
      expectedEquipment: Object.fromEntries(['amulet', 'hat', 'robe', 'ring-0', 'ring-1', 'ring-2'].map(slot => [slot, hubInventoryEquipmentSlotRects(slot, companion)])),
      itemIds: backpack.map(value => value.id), recipeIndices: backpack.map(value => value.recipeIndex) }
  }
  return { render, destroy() { layer?.destroy({ children: true }); destroyNativeUiPixiFor(textures); mods.destroy(); textures.destroy(); app.destroy(true) } }
}
