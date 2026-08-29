import { Container, MeshSimple, Sprite } from 'pixi.js'

import {
  nativeEnchantStaffDrawPlan,
  type NativeEnchantStaffDrawInput,
  type NativeEnchantStaffDrawPlan,
} from '../player-enchant-staff-presentation.ts'
import {
  nativeArenaPackedColor,
  setNativeArenaVertexColors,
} from './native-arena-render-pipeline.ts'
import {
  nativeFixedFunctionPackedColor,
  setNativeFixedFunctionVertexColors,
} from './native-fixed-function-render-pipeline.ts'
import type { PlayerWorldTextures } from './world-player-textures.ts'

const QUAD_INDICES = new Uint32Array([0, 1, 2, 1, 2, 3])
const QUAD_UVS = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])

export class PlayerEnchantStaffView {
  readonly container = new Container({ label: 'native-player-staff-attachment' })
  private readonly aura: MeshSimple
  private readonly auraArenaColors = new Uint32Array(4)
  private readonly auraFixedFunctionColors = new Uint32Array(4)
  private readonly auraVertices = new Float32Array(8)
  private readonly body: Sprite
  private readonly bodyAdditive: Sprite
  private readonly primaryHand: Sprite
  private readonly secondaryHand: Sprite
  private readonly textures: PlayerWorldTextures['enchantStaff']
  private currentPlan: NativeEnchantStaffDrawPlan | null = null

  constructor(textures: PlayerWorldTextures['enchantStaff']) {
    this.textures = textures
    this.container.sortableChildren = true
    this.container.eventMode = 'none'
    this.body = centeredSprite(0)
    this.bodyAdditive = centeredSprite(1)
    this.bodyAdditive.blendMode = 'add'
    this.aura = new MeshSimple({
      indices: QUAD_INDICES,
      texture: textures.auras[0],
      topology: 'triangle-list',
      uvs: QUAD_UVS,
      vertices: this.auraVertices,
    })
    this.aura.autoUpdate = false
    this.aura.blendMode = 'add'
    this.aura.eventMode = 'none'
    this.aura.label = 'native-enchant-staff-aura'
    this.aura.zIndex = 2
    setNativeFixedFunctionVertexColors(this.aura, this.auraFixedFunctionColors)
    setNativeArenaVertexColors(this.aura, this.auraArenaColors)
    this.primaryHand = centeredSprite(3)
    this.secondaryHand = centeredSprite(4)
    this.container.addChild(
      this.body,
      this.bodyAdditive,
      this.aura,
      this.primaryHand,
      this.secondaryHand,
    )
  }

  update(
    input: NativeEnchantStaffDrawInput,
    front: boolean,
  ): void {
    const visible = input.living && input.nativeStaff && input.selectedPrimarySkillId >= 0
    this.container.visible = visible
    if (!visible) {
      this.currentPlan = null
      this.bodyAdditive.visible = false
      this.aura.visible = false
      return
    }

    const bodyTextures = this.textures.bodies[input.selector]
    if (bodyTextures === undefined) throw new RangeError('missing native Staff body selector')
    const body = (front ? bodyTextures.front : bodyTextures.back)[input.headingIndex]?.[input.pose]
    const primaryHand = (
      front ? this.textures.hands.primary.front : this.textures.hands.primary.back
    )[input.headingIndex]?.[input.pose]
    const secondaryHand = (
      front ? this.textures.hands.secondary.front : this.textures.hands.secondary.back
    )
      [input.headingIndex]?.[input.pose]
    if (body === undefined || primaryHand === undefined || secondaryHand === undefined) {
      throw new RangeError('missing native Staff body/hand attachment frame')
    }
    this.body.texture = body
    this.bodyAdditive.texture = body
    this.primaryHand.texture = primaryHand
    this.secondaryHand.texture = secondaryHand
    this.container.zIndex = front ? 5 : 1

    const plan = nativeEnchantStaffDrawPlan(input)
    this.currentPlan = plan
    this.bodyAdditive.visible = plan !== null
    this.aura.visible = plan?.auraRecord !== null && plan?.auraRecord !== undefined
    if (!this.aura.visible || plan === null || plan.auraRecord === null) return

    const aura = this.textures.auras[plan.auraRecord - 11]
    if (aura === undefined) throw new RangeError(`missing Clothes aura record ${plan.auraRecord}`)
    this.aura.texture = aura
    this.auraVertices.set(plan.vertices)
    this.auraFixedFunctionColors.set([
      nativeFixedFunctionPackedColor(plan.tint, plan.nearAlpha),
      nativeFixedFunctionPackedColor(plan.tint, plan.nearAlpha),
      nativeFixedFunctionPackedColor(plan.tint, plan.farAlpha),
      nativeFixedFunctionPackedColor(plan.tint, plan.farAlpha),
    ])
    this.auraArenaColors.set([
      nativeArenaPackedColor(plan.tint, plan.nearAlpha),
      nativeArenaPackedColor(plan.tint, plan.nearAlpha),
      nativeArenaPackedColor(plan.tint, plan.farAlpha),
      nativeArenaPackedColor(plan.tint, plan.farAlpha),
    ])
  }

  setMaterialTint(tint: number): void {
    this.body.tint = tint
    this.bodyAdditive.tint = tint
    this.primaryHand.tint = tint
    this.secondaryHand.tint = tint
  }

  get active(): boolean {
    return this.currentPlan !== null
  }

  get auraRecord(): number | null {
    return this.currentPlan?.auraRecord ?? null
  }

  get nearAlpha(): number {
    return this.currentPlan?.nearAlpha ?? 0
  }

  get tint(): number | null {
    return this.currentPlan?.tint ?? null
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}

function centeredSprite(zIndex: number): Sprite {
  const sprite = new Sprite()
  sprite.anchor.set(0.5)
  sprite.eventMode = 'none'
  sprite.zIndex = zIndex
  return sprite
}
