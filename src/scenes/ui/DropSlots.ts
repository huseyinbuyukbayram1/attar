import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import { INGREDIENTS } from '../../data/ingredients'
import { MAX_DROPS } from '../../game/scoring'
import { FLASK_X } from './Flask'
import { CREAM } from './theme'
import type { Tooltip } from './Tooltip'

// Layout: one row of MAX_DROPS circles under the flask, on the dark front face of the counter
const SPACING = 36
const ROW = { firstX: FLASK_X - ((MAX_DROPS - 1) * SPACING) / 2, spacing: SPACING, y: 662, radius: 15 } // centered under the flask
const POP = { scale: 1.25, ms: 150 } // a slot pops when a drop arrives
const TOOLTIP_GAP = 6 // space between the top of a slot and its tooltip

// The six drop slots. Filled slots show the ingredient color; hovering one shows its name, and
// clicking a filled slot empties just that one. It is a Container so shake() can wiggle the row.
export class DropSlots extends Phaser.GameObjects.Container {
  private filled: (Phaser.GameObjects.Arc | null)[] = [] // one entry per slot, redrawn on every change
  private current: (string | null)[] = []

  constructor(scene: Phaser.Scene, tooltip: Tooltip, onSlotClick: (index: number) => void) {
    super(scene, 0, 0)
    scene.add.existing(this)

    // The empty outlines are the interactive part; the colored circles drawn on top are not,
    // so clicks and hovers fall through to the outline underneath.
    for (let i = 0; i < MAX_DROPS; i++) {
      const outline = scene.add
        .circle(this.slotX(i), ROW.y, ROW.radius)
        .setStrokeStyle(2, CREAM, 0.6)
        .setInteractive({ useHandCursor: true })
      outline.on('pointerdown', () => {
        tooltip.hide() // the slot is about to be emptied
        onSlotClick(i)
      })
      outline.on('pointerover', () => {
        const id = this.current[i]
        if (!id) return
        const name = INGREDIENTS.find((ingredient) => ingredient.id === id)?.name ?? id
        tooltip.show(name, this.slotX(i), ROW.y - ROW.radius - TOOLTIP_GAP)
      })
      outline.on('pointerout', () => tooltip.hide())
      this.add(outline)
    }
  }

  // Redraws from scratch: simplest way to stay in sync. A null entry is an empty slot.
  setSlots(slots: (string | null)[]) {
    this.current = slots
    this.filled.forEach((dot) => dot?.destroy())
    this.filled = []
    slots.forEach((id, i) => {
      if (id === null) {
        this.filled.push(null)
        return
      }
      const color = INGREDIENT_COLORS[id] ?? FALLBACK_COLOR
      const dot = this.scene.add.circle(this.slotX(i), ROW.y, ROW.radius, color).setStrokeStyle(2, CREAM)
      this.add(dot)
      this.filled.push(dot)
    })
  }

  // The filled circle of one slot grows a little and settles back, to show a drop landed
  pop(index: number) {
    const dot = this.filled[index]
    if (!dot) return
    dot.setScale(POP.scale)
    this.scene.tweens.add({ targets: dot, scale: 1, duration: POP.ms, ease: 'Sine.easeOut' })
  }

  private slotX(index: number): number {
    return ROW.firstX + index * ROW.spacing
  }
}
