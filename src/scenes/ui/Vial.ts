import Phaser from 'phaser'
import { INGREDIENT_COLORS, FALLBACK_COLOR } from '../../data/ingredientColors'
import { INGREDIENTS } from '../../data/ingredients'
import { MAX_DROPS } from '../../game/scoring'

// Layout: one row of MAX_DROPS slots, left of the action buttons
const CENTER_X = 380
const CENTER_Y = 500
const SLOT_SPACING = 60
const SLOT_RADIUS = 20
const SLOT_OFFSET_Y = -8 // slots sit above the middle so the name fits under them
const LABEL_OFFSET_Y = 12 // gap between the bottom of a slot and its name
const PADDING = 20
const HEIGHT = 80
const STROKE = 0xf3e2b3
const SHAKE_PX = 6

// The mixing vial: MAX_DROPS fixed slots. Filled slots show the ingredient's color and
// name; clicking a filled slot empties just that one.
export class Vial {
  private scene: Phaser.Scene
  private fixed: Phaser.GameObjects.Shape[] = [] // strip and outlines, never recreated
  private filled: (Phaser.GameObjects.Arc | Phaser.GameObjects.Text)[] = [] // redrawn on every change
  private shaking = false

  constructor(scene: Phaser.Scene, onSlotClick: (index: number) => void) {
    this.scene = scene
    const width = MAX_DROPS * SLOT_SPACING + PADDING
    this.fixed.push(
      scene.add.rectangle(CENTER_X, CENTER_Y, width, HEIGHT, 0x2a1f1a).setStrokeStyle(2, STROKE),
    )

    // The outlines are the clickable part; colored circles drawn on top are not
    // interactive, so clicks fall through to the outline underneath.
    for (let i = 0; i < MAX_DROPS; i++) {
      const outline = scene.add
        .circle(this.slotX(i), this.slotY(), SLOT_RADIUS)
        .setStrokeStyle(1, STROKE, 0.4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => onSlotClick(i))
      this.fixed.push(outline)
    }
  }

  // Redraws from scratch: simplest way to stay in sync with the state
  setSlots(slots: (string | null)[]) {
    this.filled.forEach((object) => object.destroy())
    this.filled = []
    slots.forEach((id, i) => {
      if (id === null) return
      const color = INGREDIENT_COLORS[id] ?? FALLBACK_COLOR
      const name = INGREDIENTS.find((ingredient) => ingredient.id === id)?.name ?? id
      this.filled.push(
        this.scene.add.circle(this.slotX(i), this.slotY(), SLOT_RADIUS, color).setStrokeStyle(2, STROKE),
        this.scene.add
          .text(this.slotX(i), this.slotY() + LABEL_OFFSET_Y + SLOT_RADIUS, name, {
            fontFamily: 'Georgia, serif',
            fontSize: '11px',
            color: '#f3e2b3',
          })
          .setOrigin(0.5),
      )
    })
  }

  // Tiny wiggle for "the vial is full". The flag stops repeated clicks from stacking
  // tweens, which would leave the vial slightly off position.
  shake() {
    if (this.shaking) return
    this.shaking = true
    this.scene.tweens.add({
      targets: [...this.fixed, ...this.filled],
      x: `+=${SHAKE_PX}`,
      duration: 50,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.shaking = false
      },
    })
  }

  private slotX(index: number): number {
    const left = CENTER_X - ((MAX_DROPS - 1) * SLOT_SPACING) / 2
    return left + index * SLOT_SPACING
  }

  private slotY(): number {
    return CENTER_Y + SLOT_OFFSET_Y
  }
}
