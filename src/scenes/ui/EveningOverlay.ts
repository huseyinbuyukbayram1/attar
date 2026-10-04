import Phaser from 'phaser'
import type { TimeOfDay } from '../../game/gameState'
import { addCounterCrop } from './counterCrop'
import { addGlow, ensureGlowTexture } from './glow'
import { addGradientShape, addShapedLight, ensureShapedLight } from './shapedLight'
import type { Rect } from './shapedLight'

// All the evening look is tuned here. Positions are in 1280x720 canvas pixels.
export const EVENING_FADE_MS = 1500 // morning <-> evening crossfade; the scene waits this long before a customer enters
// a) a copy of the morning image, tinted warm, laid over it at partial alpha
export const TINTED_COPY = { tint: 0xffa66b, alpha: 0.55 }
// b) a dark violet layer that darkens everything it covers (multiply blend)
const VIOLET = { color: 0x3a2060, alpha: 0.18 }
// c) light coming in through the open door, in the shape of the opening. DOOR_RECT is the door's
// opening in shop_morning.jpg (measured: the lit area spans about x 573..724, y 198..490); only
// the bright pixels inside it are used, so the frame and the open leaf stay dark.
const DOOR_RECT: Rect = { x: 562, y: 190, width: 164, height: 308 }
const DOOR_LIGHT_COLOR = 0xff8a3d
const DOOR_SHARP_ALPHA = 0.85
const DOOR_BLOOM = { scale: 1.1, alpha: 0.35 }
// The light on the floor in front of the door: narrow at the sill, wide further down, fading
// from alpha 0.35 to 0 over about 140 px
const FLOOR_SPILL = {
  top: { y: 496, left: 600, right: 724 },
  bottom: { y: 636, left: 500, right: 830 },
  alpha: 0.35,
}
// d) the hanging lantern; its alpha flickers slowly between min and max
const LANTERN_GLOW = { x: 332, y: 245, radius: 90, color: 0xffc266, min: 0.85, max: 1, flickerMs: 1200 }

type Depths = { behind: number; counter: number }

// The evening look, built in code on top of the morning image (there is no evening
// picture). It has two parts, drawn at different depths:
//  - behind the customer: one container (tint copy, violet, glows), faded by one alpha tween
//  - in front of the customer: the counter crop in the same warm tint, so the counter is
//    evening-lit too. Nothing else may be drawn above the customer.
export class EveningOverlay {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private lanternGlow: Phaser.GameObjects.Image
  private counterCrop?: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, backgroundKey: string, depths: Depths, counterTopY: number) {
    this.scene = scene
    const { width, height } = scene.scale
    ensureGlowTexture(scene)

    const layers: Phaser.GameObjects.GameObject[] = []
    if (scene.textures.exists(backgroundKey)) {
      layers.push(
        scene.add
          .image(width / 2, height / 2, backgroundKey)
          .setDisplaySize(width, height)
          .setTint(TINTED_COPY.tint)
          .setAlpha(TINTED_COPY.alpha),
      )
    }
    layers.push(
      scene.add
        .rectangle(width / 2, height / 2, width, height, VIOLET.color, VIOLET.alpha)
        .setBlendMode(Phaser.BlendModes.MULTIPLY),
    )
    // The door light and the floor spill are in this container too, so they fade with the evening
    // and are behind the customer. The floor spill is behind the counter crop, too.
    ensureShapedLight(scene, backgroundKey, 'door_light', DOOR_RECT)
    layers.push(
      addGradientShape(
        scene,
        'door_floor_spill',
        [
          { x: FLOOR_SPILL.top.left, y: FLOOR_SPILL.top.y },
          { x: FLOOR_SPILL.top.right, y: FLOOR_SPILL.top.y },
          { x: FLOOR_SPILL.bottom.right, y: FLOOR_SPILL.bottom.y },
          { x: FLOOR_SPILL.bottom.left, y: FLOOR_SPILL.bottom.y },
        ],
        { x: 0, y: FLOOR_SPILL.top.y, alpha: FLOOR_SPILL.alpha },
        { x: 0, y: FLOOR_SPILL.bottom.y, alpha: 0 },
        DOOR_LIGHT_COLOR,
      ),
      ...addShapedLight(scene, 'door_light', DOOR_RECT, DOOR_LIGHT_COLOR, DOOR_SHARP_ALPHA, DOOR_BLOOM.scale, DOOR_BLOOM.alpha),
    )
    this.lanternGlow = addGlow(scene, LANTERN_GLOW.x, LANTERN_GLOW.y, LANTERN_GLOW.radius, LANTERN_GLOW.color)
    layers.push(this.lanternGlow)

    this.root = scene.add.container(0, 0, layers).setAlpha(0).setDepth(depths.behind)

    this.counterCrop = addCounterCrop(scene, backgroundKey, counterTopY)
    this.counterCrop?.setTint(TINTED_COPY.tint).setAlpha(0).setDepth(depths.counter)
  }

  // The counter crop belongs to the customer's view, so it is hidden in the MIX phase
  setCounterVisible(visible: boolean) {
    this.counterCrop?.setVisible(visible)
  }

  // instant = jump without the crossfade (used while a full-screen card hides the change)
  setTime(time: TimeOfDay, instant = false) {
    const evening = time === 'evening'
    const duration = instant ? 0 : EVENING_FADE_MS
    this.scene.tweens.killTweensOf(this.root) // a new fade replaces one still running
    this.scene.tweens.add({ targets: this.root, alpha: evening ? 1 : 0, duration })
    if (this.counterCrop) {
      this.scene.tweens.killTweensOf(this.counterCrop)
      this.scene.tweens.add({
        targets: this.counterCrop,
        alpha: evening ? TINTED_COPY.alpha : 0,
        duration,
      })
    }

    // The flicker only runs in the evening
    this.scene.tweens.killTweensOf(this.lanternGlow)
    this.lanternGlow.setAlpha(LANTERN_GLOW.max)
    if (time === 'evening') {
      this.scene.tweens.add({
        targets: this.lanternGlow,
        alpha: LANTERN_GLOW.min,
        duration: LANTERN_GLOW.flickerMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }
}
