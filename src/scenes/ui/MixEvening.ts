import Phaser from 'phaser'
import { addGlow, ensureGlowTexture } from './glow'

// The evening look for the MIX phase, drawn over the counter_view picture and behind the
// bottles and flask. Positions are in 1280x720 canvas pixels; tune everything here.
const FADE_MS = 400
const TINTED_COPY = { tint: 0xffa66b, alpha: 0.5 }
const VIOLET = { color: 0x3a2060, alpha: 0.2 }
const WINDOW_GLOW = { x: 110, y: 300, radius: 200, color: 0xff8a3d, alpha: 1 } // low sun through the window
const LANTERN_GLOW = { x: 343, y: 165, radius: 110, color: 0xffc266, alpha: 1 } // the hanging lantern

export class MixEvening {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene, backgroundKey: string, depth: number) {
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
      addGlow(scene, WINDOW_GLOW.x, WINDOW_GLOW.y, WINDOW_GLOW.radius, WINDOW_GLOW.color).setAlpha(WINDOW_GLOW.alpha),
      addGlow(scene, LANTERN_GLOW.x, LANTERN_GLOW.y, LANTERN_GLOW.radius, LANTERN_GLOW.color).setAlpha(LANTERN_GLOW.alpha),
    )
    this.root = scene.add.container(0, 0, layers).setDepth(depth).setVisible(false)
  }

  // Called when the MIX phase starts: evening customers get the look, faded in; morning gets nothing
  show(evening: boolean) {
    this.scene.tweens.killTweensOf(this.root)
    if (!evening) {
      this.root.setVisible(false)
      return
    }
    this.root.setAlpha(0).setVisible(true)
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: FADE_MS })
  }

  hide() {
    this.scene.tweens.killTweensOf(this.root)
    this.root.setVisible(false)
  }
}
