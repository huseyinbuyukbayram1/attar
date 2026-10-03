import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import { INGREDIENTS } from '../../data/ingredients'
import { MAX_DROPS } from '../../game/scoring'
import { addPanel, BORDER, FONT, TEXT_COLOR } from './theme'

// Layout: one row of MAX_DROPS circles on a cream strip, under the vial
const PANEL = { x: 640, y: 462, height: 84 }
const SPACING = 56
const RADIUS = 16
const SLOT_OFFSET_Y = -8 // circles sit above the middle so the name fits under them
const NAME_GAP = 12 // space between the bottom of a circle and its name
const SHAKE_PX = 6

// The six drop slots. Filled slots show the ingredient color and name; clicking a filled
// slot empties just that one. It is a Container so shake() can wiggle the whole strip.
export class DropSlots extends Phaser.GameObjects.Container {
  private filled: Phaser.GameObjects.GameObject[] = [] // redrawn on every change
  private shaking = false

  constructor(scene: Phaser.Scene, onSlotClick: (index: number) => void) {
    super(scene, 0, 0)
    scene.add.existing(this)
    this.add(addPanel(scene, PANEL.x, PANEL.y, MAX_DROPS * SPACING + 20, PANEL.height, 20))

    // The empty outlines are the clickable part; the colored circles drawn on top are not
    // interactive, so clicks fall through to the outline underneath.
    for (let i = 0; i < MAX_DROPS; i++) {
      const outline = scene.add
        .circle(this.slotX(i), this.slotY(), RADIUS)
        .setStrokeStyle(2, BORDER, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => onSlotClick(i))
      this.add(outline)
    }
  }

  // Redraws from scratch: simplest way to stay in sync. A null entry is an empty slot.
  setSlots(slots: (string | null)[]) {
    this.filled.forEach((object) => object.destroy())
    this.filled = []
    slots.forEach((id, i) => {
      if (id === null) return
      const color = INGREDIENT_COLORS[id] ?? FALLBACK_COLOR
      const name = INGREDIENTS.find((ingredient) => ingredient.id === id)?.name ?? id
      const dot = this.scene.add.circle(this.slotX(i), this.slotY(), RADIUS, color).setStrokeStyle(2, BORDER)
      const label = this.scene.add
        .text(this.slotX(i), this.slotY() + RADIUS + NAME_GAP, name, {
          fontFamily: FONT,
          fontSize: '12px',
          color: TEXT_COLOR,
        })
        .setOrigin(0.5)
      this.add([dot, label])
      this.filled.push(dot, label)
    })
  }

  // Tiny wiggle for "the vial is full". The flag stops repeated clicks from stacking
  // tweens, which would leave the strip slightly off position.
  shake() {
    if (this.shaking) return
    this.shaking = true
    this.scene.tweens.add({
      targets: this,
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
    return PANEL.x - ((MAX_DROPS - 1) * SPACING) / 2 + index * SPACING
  }

  private slotY(): number {
    return PANEL.y + SLOT_OFFSET_Y
  }
}
