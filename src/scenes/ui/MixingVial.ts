import Phaser from 'phaser'
import { CREAM } from './theme'
import { lerpColor } from './liquidColor'

const GLASS_FILL = 0xfff6e0
const GLASS_RADIUS = 24
const LIQUID_INSET = 8 // gap between the glass wall and the liquid
const LIQUID_RADIUS = 16
const LIQUID_MS = 300
const START_COLOR = 0xf3e2b3

// The mixing vial: a glass shape whose liquid rises with the number of drops and takes
// the average color of the drops. Draws with absolute screen coordinates.
export class MixingVial extends Phaser.GameObjects.Container {
  private liquid: Phaser.GameObjects.Graphics
  private cx: number
  private cy: number
  private glassWidth: number
  private glassHeight: number

  // What is drawn right now, where the last change started and where it is heading
  private level = 0
  private color = START_COLOR
  private from = { level: 0, color: START_COLOR }
  private to = { level: 0, color: START_COLOR }
  // Tweened 0 -> 1; the level and color are blended from it (see setTarget)
  private progress = { t: 1 }

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    super(scene, 0, 0)
    scene.add.existing(this)
    this.cx = x
    this.cy = y
    this.glassWidth = width
    this.glassHeight = height

    const glass = scene.add.graphics()
    glass.fillStyle(GLASS_FILL, 0.3)
    glass.fillRoundedRect(x - width / 2, y - height / 2, width, height, GLASS_RADIUS)
    glass.lineStyle(3, CREAM, 1)
    glass.strokeRoundedRect(x - width / 2, y - height / 2, width, height, GLASS_RADIUS)
    // A small rim at the top so it reads as a vial, not a box
    glass.fillStyle(CREAM, 1)
    glass.fillRoundedRect(x - width / 2 - 8, y - height / 2 - 8, width + 16, 14, 6)

    this.liquid = scene.add.graphics()
    this.add([glass, this.liquid])
  }

  // level is 0..1 (drops / MAX_DROPS). A null color keeps the current one, used when empty.
  setTarget(level: number, color: number | null, animate: boolean) {
    this.scene.tweens.killTweensOf(this.progress)
    this.from = { level: this.level, color: this.color }
    this.to = { level, color: color ?? this.color }
    // An empty vial has no color to blend from, so the first drop shows its own color at once
    if (this.from.level === 0) this.from.color = this.to.color

    if (!animate) {
      this.progress.t = 1
      this.drawAt(1)
      return
    }
    this.progress.t = 0
    this.scene.tweens.add({
      targets: this.progress,
      t: 1,
      duration: LIQUID_MS,
      onUpdate: () => this.drawAt(this.progress.t),
    })
  }

  private drawAt(t: number) {
    this.level = this.from.level + (this.to.level - this.from.level) * t
    this.color = lerpColor(this.from.color, this.to.color, t)

    this.liquid.clear()
    const innerWidth = this.glassWidth - LIQUID_INSET * 2
    const liquidHeight = (this.glassHeight - LIQUID_INSET * 2) * this.level
    if (liquidHeight < 1) return

    const radius = Math.min(LIQUID_RADIUS, liquidHeight / 2)
    this.liquid.fillStyle(this.color, 0.92)
    this.liquid.fillRoundedRect(
      this.cx - innerWidth / 2,
      this.cy + this.glassHeight / 2 - LIQUID_INSET - liquidHeight,
      innerWidth,
      liquidHeight,
      { tl: 0, tr: 0, bl: radius, br: radius },
    )
  }
}
