import Phaser from 'phaser'
import { addGlow, ensureGlowTexture } from './glow'

// Candle flames and string-light bulbs of the counter_view picture, as soft glows. Positions are
// in 1280x720 canvas pixels (counter_view.jpg is 1600x900, shown at 80%); they were checked
// against the picture. Tune everything here.
const CANDLES = {
  radius: 38,
  color: 0xffc266,
  points: [
    { x: 606, y: 174 },
    { x: 877, y: 176 },
    { x: 735, y: 326 },
  ],
  min: 0.75, // alpha swings between min and 1
  durationMs: { min: 900, max: 1300 }, // slow flicker, each candle a different speed
  maxDelayMs: 800, // random start delay, so the candles are not in step
}
const BULBS = {
  radius: 14,
  color: 0xffe3a0,
  points: [
    { x: 277, y: 112 },
    { x: 415, y: 135 },
    { x: 467, y: 117 },
    { x: 580, y: 121 },
    { x: 646, y: 135 },
    { x: 725, y: 127 },
    { x: 789, y: 103 },
    { x: 850, y: 115 },
    { x: 932, y: 134 },
    { x: 1016, y: 124 },
    { x: 1173, y: 75 },
    { x: 1227, y: 77 },
  ],
  min: 0.8,
  durationMs: { min: 1600, max: 2400 },
  maxDelayMs: 2400,
}
const BRIGHTNESS = { morning: 0.35, evening: 1 } // multiplies every glow
const FADE_MS = 400 // same as the evening look in MIX

// The warm lights of the counter view. They sit above the picture and below the bottles and
// the flask. In the morning they are barely there; in the evening they shine fully.
export class MixLights {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene
    ensureGlowTexture(scene)
    this.root = scene.add.container(0, 0).setDepth(depth).setVisible(false)
    this.addGlows(CANDLES)
    this.addGlows(BULBS)
  }

  // One glow per point, each with its own endless alpha pulse
  private addGlows(group: typeof CANDLES | typeof BULBS) {
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
    this.root.setVisible(true)
    if (!evening) {
      this.root.setAlpha(BRIGHTNESS.morning)
      return
    }
    this.root.setAlpha(BRIGHTNESS.morning)
    this.scene.tweens.add({ targets: this.root, alpha: BRIGHTNESS.evening, duration: FADE_MS })
  }

  hide() {
    this.scene.tweens.killTweensOf(this.root)
    this.root.setVisible(false)
  }
}
