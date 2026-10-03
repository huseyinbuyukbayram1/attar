import Phaser from 'phaser'
import { INGREDIENT_COLORS, FALLBACK_COLOR } from '../../data/ingredientColors'
import { MAX_DROPS } from '../../game/scoring'

// Layout: a strip with MAX_DROPS slots, left of the action buttons
const CENTER_X = 380
const CENTER_Y = 500
const SLOT_SPACING = 56
const SLOT_RADIUS = 20
const PADDING = 20
const STROKE = 0xf3e2b3

// The mixing vial: shows the chosen drops, in order, as small colored circles
export class Vial {
  private scene: Phaser.Scene
  private dots: Phaser.GameObjects.Arc[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const width = MAX_DROPS * SLOT_SPACING + PADDING
    scene.add.rectangle(CENTER_X, CENTER_Y, width, SLOT_RADIUS * 2 + PADDING, 0x2a1f1a).setStrokeStyle(2, STROKE)

    // Empty outlines so the player can see how many drops are left
    for (let i = 0; i < MAX_DROPS; i++) {
      scene.add.circle(this.slotX(i), CENTER_Y, SLOT_RADIUS).setStrokeStyle(1, STROKE, 0.3)
    }
  }

  // Redraws from scratch: simplest way to stay in sync after Undo/Clear
  setDrops(drops: string[]) {
    this.dots.forEach((dot) => dot.destroy())
    this.dots = drops.map((id, i) =>
      this.scene.add
        .circle(this.slotX(i), CENTER_Y, SLOT_RADIUS, INGREDIENT_COLORS[id] ?? FALLBACK_COLOR)
        .setStrokeStyle(2, STROKE),
    )
  }

  private slotX(index: number): number {
    const left = CENTER_X - ((MAX_DROPS - 1) * SLOT_SPACING) / 2
    return left + index * SLOT_SPACING
  }
}
