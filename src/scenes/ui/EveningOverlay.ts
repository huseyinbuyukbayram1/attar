import Phaser from 'phaser'
import type { TimeOfDay } from '../../game/gameState'

// All the evening look is tuned here. Positions are in 1280x720 canvas pixels.
const FADE_MS = 1500 // morning <-> evening crossfade
// a) a copy of the morning image, tinted warm, laid over it at partial alpha
const TINTED_COPY = { tint: 0xffa66b, alpha: 0.55 }
// b) a dark violet layer that darkens everything it covers (multiply blend)
const VIOLET = { color: 0x3a2060, alpha: 0.18 }
// c) light coming in through the open door
const DOOR_GLOW = { x: 642, y: 346, radius: 170, color: 0xff8a3d, alpha: 1 }
// d) the hanging lantern; its alpha flickers slowly between min and max
const LANTERN_GLOW = { x: 332, y: 245, radius: 110, color: 0xffc266, min: 0.85, max: 1, flickerMs: 1200 }

const GLOW_TEXTURE = 'glow'
const GLOW_TEXTURE_SIZE = 256

// A white radial gradient (opaque center, transparent edge), made once in code. It is
// colored with setTint, so one texture serves every glow.
function ensureGlowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(GLOW_TEXTURE)) return
  const texture = scene.textures.createCanvas(GLOW_TEXTURE, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE)
  const context = texture?.getContext()
  if (!texture || !context) return
  const half = GLOW_TEXTURE_SIZE / 2
  const gradient = context.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE)
  texture.refresh()
}

// ADD blending adds the glow's color to what is underneath, so it reads as light
function addGlow(scene: Phaser.Scene, x: number, y: number, radius: number, color: number) {
  return scene.add
    .image(x, y, GLOW_TEXTURE)
    .setDisplaySize(radius * 2, radius * 2)
    .setTint(color)
    .setBlendMode(Phaser.BlendModes.ADD)
}

// The evening look, built in code on top of the morning image (there is no evening
// picture). Everything sits in one container, so a single alpha tween fades it all in.
export class EveningOverlay {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private lanternGlow: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, backgroundKey: string) {
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
      addGlow(scene, DOOR_GLOW.x, DOOR_GLOW.y, DOOR_GLOW.radius, DOOR_GLOW.color).setAlpha(DOOR_GLOW.alpha),
    )
    this.lanternGlow = addGlow(scene, LANTERN_GLOW.x, LANTERN_GLOW.y, LANTERN_GLOW.radius, LANTERN_GLOW.color)
    layers.push(this.lanternGlow)

    this.root = scene.add.container(0, 0, layers).setAlpha(0)
  }

  setTime(time: TimeOfDay) {
    this.scene.tweens.killTweensOf(this.root) // a new fade replaces one still running
    this.scene.tweens.add({
      targets: this.root,
      alpha: time === 'evening' ? 1 : 0,
      duration: FADE_MS,
    })

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
