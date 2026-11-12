import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import NativeUiSprite from '../src/game/native-ui/NativeUiSprite.tsx'
import NativeUiStrip from '../src/game/native-ui/NativeUiStrip.tsx'
import NativeUiNineSlice from '../src/game/native-ui/NativeUiNineSlice.tsx'
import NativeUiPlanView from '../src/game/native-ui/NativeUiPlanView.tsx'
import NativeUiTextGlyphs from '../src/game/native-ui/NativeUiTextGlyphs.tsx'
import { NativeSkillIcon } from '../src/game/SkillQuickbar.tsx'
import { HallSprite, HallNineSlice } from '../src/game/HallOfFamePrimitives.tsx'
import { nativeUiAtlasSource } from '../src/game/native-ui/native-ui-assets.ts'
import { nativeUiAtlas, nativeUiRecord, nativeUiFont } from '../src/game/native-ui/native-ui-catalog.ts'
import { layoutNativeUiText } from '../src/game/native-ui/native-ui-text.ts'
import '../src/game/hall-of-fame.css'
import ModEnemies from '../src/game/mod-ui/ModEnemies.tsx'
import ModPowerups from '../src/game/mod-ui/ModPowerups.tsx'
import ModSpellEffects from '../src/game/mod-ui/ModSpellEffects.tsx'
import { playerCharacterAtlasCssFrame } from '../src/game/renderer/player-character-atlas.ts'
import playerHead from '../src/assets/game/player-character-head-air.png'
import playerRobe from '../src/assets/game/player-character-robe-dynamic-air.png'

let mounted
let host
let current
const rows = [
  { role: 'sprite', atlas: 'Create', record: 11, scale: 2.3958 },
  { role: 'mask', atlas: 'Create', record: 11, scale: 2.3958 },
  { role: 'strip', atlas: 'UI', record: 37, scale: .9 },
  { role: 'nine-slice', atlas: 'UI', record: 4, scale: 1.111 },
  { role: 'slice', atlas: 'Create', record: 11, scale: 1 },
  { role: 'hall-sprite', atlas: 'UI', record: 37, scale: .9 },
  { role: 'hall-nine-slice', atlas: 'UI', record: 4, scale: 1.111 },
  { role: 'glyph', atlas: 'Fonts', record: 72, scale: 1 },
  ...Object.entries(nativeUiAtlas('Skills').records)
    .filter(([, row]) => row.frame[2] !== row.logicalSize[0] || row.frame[3] !== row.logicalSize[1] || row.trimOrigin.some(value => value !== 0))
    .map(([record]) => ({ role: 'quickbar', atlas: 'Skills', record: Number(record), scale: 3.5 })),
  { role: 'quickbar', atlas: 'Skills', record: 8, scale: 3.5 },
  ...['authored-enemy', 'authored-powerup', 'authored-spell'].flatMap(role => [
    { role, frame: [0, 0, 8, 8], scale: 1 },
    { role, frame: [3.25, 2.375, .5, .25], scale: 1 },
  ]),
  { role: 'packed-player', sheet: 'player-character-head-air', image: playerHead, scale: 2.25 },
  { role: 'packed-player', sheet: 'player-character-robe-dynamic-air', image: playerRobe, scale: 2.25 },
]

export function cssSamplingCases() { return rows }

export async function mountCssSampling(index) {
  mounted?.unmount(); host?.remove()
  current = rows[index]
  const { role, atlas, record, scale } = current
  host = document.createElement('div')
  Object.assign(host.style, { position: 'absolute', left: '64.375px', top: '64.625px',
    transform: `rotate(.125rad) scale(${scale})`, transformOrigin: 'top left' })
  document.body.append(host)
  const props = { atlas, record }
  let node
  if (role === 'sprite' || role === 'mask') node = createElement(NativeUiSprite, { ...props, ...(role === 'mask' ? { maskTint: 0x55ff66 } : {}) })
  if (role === 'strip') node = createElement(NativeUiStrip, { ...props, width: 600 })
  if (role === 'nine-slice') node = createElement(NativeUiNineSlice, { ...props, width: 300, height: 180 })
  if (role === 'slice') node = createElement(NativeUiPlanView, { plan: { width: 256, height: 224, actions: [], nodes: [
    { kind: 'slice', ...props, sourceUv: [.125, .125, 1, 1], bounds: { left: 0, top: 0, width: 230, height: 192 } },
  ] } })
  if (role === 'hall-sprite') node = createElement(HallSprite, { ...props, x: 210, y: 40, scale: 1, tint: 0x99aa88 })
  if (role === 'hall-nine-slice') node = createElement(HallNineSlice, { record, rect: { left: 0, top: 0, width: 300, height: 180 } })
  if (role === 'glyph') node = createElement(NativeUiTextGlyphs, { layout: layoutNativeUiText({ font: 'body', text: 'i', x: 0, y: 50, scale: 3.5 }) })
  if (role === 'packed-player') node = createElement('span', { style: playerCharacterAtlasCssFrame(current.sheet, 0, 0) })
  if (role.startsWith('authored-')) {
    host.className = 'boneyard-scene'
    Object.assign(host.style, { width: '800px', height: '640px' })
    Object.assign(host.dataset, { cameraZoom: '7.5', localPlayerScreenX: '200', localPlayerScreenY: '150' })
    const [x, y, width, height] = current.frame
    const actor = { id: 1, mod_id: 'sampling-test', image_path: 'tight.png', image_width: 4080, image_height: 170,
      frame_x: x, frame_y: y, frame_width: width, frame_height: height, x: 0, y: 0,
      current_health: 100, maximum_health: 100, life_state: 'alive', scale: 1, light_color: 0x9c7ad9, light_radius: 0,
      kind: 'projectile', target_x: 0, target_y: 0, started_tick: 1 }
    const runtime = { enemies: [actor], powerup_actors: [actor], powerup_events: [], spell_effects: [actor] }
    const session = { playerId: 'sampling-test', modAssets: [{ kind: 'image', modId: 'sampling-test', path: 'tight.png', sha256: 'sampling-test-tight-sheet' }],
      getSnapshot: () => ({ tick: 1, players: { 'sampling-test': { position: { x: 0, y: 0 } } } }),
      getModRuntime: () => runtime, onModRuntime: () => () => {}, onSnapshot: () => () => {} }
    const component = role === 'authored-enemy' ? ModEnemies : role === 'authored-powerup' ? ModPowerups : ModSpellEffects
    node = createElement(component, { session, audio: { playAsset() {} } })
  }
  if (role === 'quickbar') node = createElement(NativeSkillIcon, { record, cooldown: false, style: { display: 'block', backgroundRepeat: 'no-repeat' } })
  mounted = createRoot(host)
  flushSync(() => mounted.render(node))
  const source = new Image()
  source.src = role === 'packed-player' ? current.image : role.startsWith('authored-')
    ? '/api/game/content/sampling-test-tight-sheet' : nativeUiAtlasSource(atlas)
  await source.decode()
  current = { ...current, source }
  await new Promise(requestAnimationFrame)
  for (const animation of host.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 0 }
}


// Replace the page image with independently isolated original-record pixels.
// The component's transforms, clipping, source slice and geometry stay intact.
export async function isolateCssSamplingReference() {
  const { atlas, record, source, role } = current
  const authored = role.startsWith('authored-')
  const definition = role === 'packed-player' ? { frame: [0, 0, 170, 170] } : role.startsWith('authored-')
    ? { frame: current.frame } : role === 'glyph' ? nativeUiFont('body').glyphs['105'] : nativeUiRecord(atlas, record)
  const [frameX, frameY, width, height] = definition.frame
  const [atlasWidth, atlasHeight] = role.startsWith('authored-') || role === 'packed-player'
    ? [source.width, source.height] : nativeUiAtlas(atlas).dimensions
  const canvas = document.createElement('canvas')
  canvas.width = authored ? atlasWidth : Math.max(1, Math.ceil(width))
  canvas.height = authored ? atlasHeight : Math.max(1, Math.ceil(height))
  const context = canvas.getContext('2d')
  if (authored) {
    // Pixelated CSS can rasterize an 8-pixel crop differently from its 4080-pixel
    // page. Preserve dimensions, opacity and texel positions while replacing all
    // pixels outside the record's integer support with a color absent from the fixture.
    context.fillStyle = '#ffff00'; context.fillRect(0, 0, canvas.width, canvas.height)
    const left = Math.floor(frameX); const top = Math.floor(frameY)
    const supportWidth = Math.ceil(frameX + width) - left
    const supportHeight = Math.ceil(frameY + height) - top
    context.drawImage(source, left, top, supportWidth, supportHeight, left, top, supportWidth, supportHeight)
  } else {
    context.drawImage(source, frameX, frameY, width, height, 0, 0, canvas.width, canvas.height)
  }
  const reference = new Image(); reference.src = canvas.toDataURL()
  await reference.decode()
  const url = `url("${reference.src}")`
  if (role === 'packed-player') {
    Object.assign(host.firstElementChild.style, { backgroundImage: url, backgroundSize: `${width}px ${height}px`,
      backgroundPosition: '0 0', left: '0', top: '0', width: `${width}px`, height: `${height}px` })
    await new Promise(requestAnimationFrame)
    return
  }
  let replacements = 0
  for (const element of host.querySelectorAll('*')) {
    for (const prefix of ['background', 'mask']) {
      const image = element.style[`${prefix}Image`]
      if (!image || image === 'none' || !image.includes('url(')) continue
      const imageUrl = image.match(/url\(["']?([^"')]+)/)?.[1]
      if (!imageUrl || new URL(imageUrl, location.href).href !== source.src) continue
      element.style[`${prefix}Image`] = url
      replacements += 1
      if (authored) continue
      const dimensions = element.style[`${prefix}Size`].split(' ').map(Number.parseFloat)
      const scaleX = dimensions[0] / atlasWidth
      const scaleY = dimensions[1] / atlasHeight
      const position = element.style[`${prefix}Position`].split(' ').map(Number.parseFloat)
      element.style[`${prefix}Size`] = `${width * scaleX}px ${height * scaleY}px`
      element.style[`${prefix}Position`] = `${position[0] + frameX * scaleX}px ${position[1] + frameY * scaleY}px`
    }
  }
  if (authored && replacements !== 1) throw new Error(`Expected one authored background replacement, got ${replacements}`)
  await new Promise(requestAnimationFrame)
}

export function destroyCssSampling() { mounted?.unmount(); host?.remove(); mounted = null; host = null }

export async function compareCssSamplingImages({ actual, expected }) {
  const pixels = async data => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
    return context.getImageData(0, 0, image.width, image.height).data
  }
  const actualPixels = await pixels(actual)
  const expectedPixels = await pixels(expected)
  let maximumDelta = 0
  let changedChannels = 0
  let visiblePixels = 0
  for (let index = 0; index < actualPixels.length; index += 1) {
    const delta = Math.abs(actualPixels[index] - expectedPixels[index])
    maximumDelta = Math.max(maximumDelta, delta)
    if (delta > 2) changedChannels += 1
    if (index % 4 === 0 && (expectedPixels[index] !== 51 || expectedPixels[index + 1] !== 51 || expectedPixels[index + 2] !== 51)) visiblePixels += 1
  }
  return { maximumDelta, changedChannels, visiblePixels }
}
