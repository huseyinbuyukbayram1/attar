import Phaser from 'phaser'
import { addGlow, ensureGlowTexture } from './glow'

// String-light bulbs and the hanging lantern of the counter_view picture, as soft glows. Positions
// are in 1280x720 canvas pixels (counter_view.jpg is 1600x900, shown at 80%); each was measured on
// the picture. Tune everything here.
const BULBS = {
  radius: 14,
  color: 0xffe3a0,
  points: [
    { x: 251, y: 66 },
    { x: 282, y: 90 },
    { x: 313, y: 112 },
    { x: 349, y: 115 },
    { x: 460, y: 114 },
    { x: 503, y: 126 },
    { x: 551, y: 128 },
    { x: 600, y: 118 },
    { x: 644, y: 102 },
  ],
  min: 0.8,
  durationMs: { min: 1600, max: 2400 },
  maxDelayMs: 2400,
}
// The lantern: a warm glow that is dim in the morning and strong in the evening (BRIGHTNESS below),
// with a gentle slow flicker in the evening only
const LANTERN = { x: 398, y: 100, radius: 70, color: 0xffc266, flickerMin: 0.85, flickerMs: 1800 }
const BRIGHTNESS = { morning: 0.35, evening: 1 } // multiplies every glow
const FADE_MS = 400 // same as the evening look in MIX

// The warm lights of the counter view. They sit above the picture and below the bottles and
// the flask. In the morning they are barely there; in the evening they shine fully.
export class MixLights {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private lantern: Phaser.GameObjects.Image

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene
    ensureGlowTexture(scene)
    this.root = scene.add.container(0, 0).setDepth(depth).setVisible(false)
    this.addGlows(BULBS)
    this.lantern = addGlow(scene, LANTERN.x, LANTERN.y, LANTERN.radius, LANTERN.color)
    this.root.add(this.lantern)
  }

  // One glow per point, each with its own endless alpha pulse
  private addGlows(group: typeof BULBS) {
    for (const point of group.points) {
      const glow = addGlow(this.scene, point.x, point.y, group.radius, group.color)
      this.root.add(glow)
      this.scene.tweens.add({
        targets: glow,
        alpha: group.min,
        duration: Phaser.Math.Between(group.durationMs.min, group.durationMs.max),
        delay: Phaser.Math.Between(0, group.maxDelayMs),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  // Called when the MIX phase starts: evening fades up to full brightness, morning stays dim
  show(evening: boolean) {
    this.scene.tweens.killTweensOf(this.root)
    this.scene.tweens.killTweensOf(this.lantern)
    this.lantern.setAlpha(1)
    this.root.setVisible(true)
    if (!evening) {
      this.root.setAlpha(BRIGHTNESS.morning)
      return
    }
    this.scene.tweens.add({
      targets: this.lantern,
      alpha: LANTERN.flickerMin,
      duration: LANTERN.flickerMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    this.root.setAlpha(BRIGHTNESS.morning)
    this.scene.tweens.add({ targets: this.root, alpha: BRIGHTNESS.evening, duration: FADE_MS })
  }

  hide() {
    this.scene.tweens.killTweensOf(this.root)
    this.scene.tweens.killTweensOf(this.lantern)
    this.root.setVisible(false)
  }
}
