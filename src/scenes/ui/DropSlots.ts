import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import { INGREDIENTS } from '../../data/ingredients'
import { MAX_DROPS } from '../../game/scoring'
import { FLASK_X } from './Flask'
import { CREAM, FONT } from './theme'
import type { Tooltip } from './Tooltip'

// Layout: one row of MAX_DROPS circles under the flask, on the dark front face of the counter
const SPACING = 36
const ROW = { firstX: FLASK_X - ((MAX_DROPS - 1) * SPACING) / 2, spacing: SPACING, y: 662, radius: 15 } // centered under the flask
const POP = { scale: 1.25, ms: 150 } // a slot pops when a drop arrives
const FADE_MS = 250 // the slots empty with a short fade when the flask is emptied
const TOOLTIP_GAP = 6 // space between the top of a slot and its tooltip
// Ghosts: the mix that was in the flask before it was emptied, shown faintly in the slots as a
// reminder. The name sits under the slot; odd slots are a little lower so neighbouring names
// (the slots are only 36 px apart) do not touch. Cream text, because the front face is dark.
const GHOST = {
  alpha: 0.3,
  lineWidth: 1, // a thin outline
  lineAlpha: 0.6,
  labelSize: 10, // px
  labelColor: '#f6e7c1',
  labelAlpha: 0.9,
  labelDy: [24, 35], // px under the slot center: even slots, odd slots
}

// The six drop slots. Display only: filled slots show the ingredient colors in the order they were
// poured, and hovering one shows its name. After the flask is emptied the previous mix stays as ghosts. A drop cannot be taken out once it is in the flask.
export class DropSlots extends Phaser.GameObjects.Container {
  private filled: (Phaser.GameObjects.Arc | null)[] = [] // one entry per slot, redrawn on every change
  private current: (string | null)[] = []
  private ghostIds: string[] = [] // the previous mix, in order (UI only; not part of the game state)
  private ghostObjects: Phaser.GameObjects.GameObject[] = []

  constructor(scene: Phaser.Scene, tooltip: Tooltip) {
    super(scene, 0, 0)
    scene.add.existing(this)

    // The empty outlines are the hover targets (no hand cursor, they cannot be clicked); the
    // colored circles drawn on top are not interactive, so hovers fall through to the outline.
    for (let i = 0; i < MAX_DROPS; i++) {
      const outline = scene.add
        .circle(this.slotX(i), ROW.y, ROW.radius)
        .setStrokeStyle(2, CREAM, 0.6)
        .setInteractive()
      outline.on('pointerover', () => {
        const id = this.current[i] ?? this.ghostIds[i] // a filled slot, or the ghost in an empty one
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
    this.drawGhosts() // real drops replace the ghosts in their slots
  }

  // The previous mix to show faintly in the empty slots (an empty list shows none)
  setGhosts(ids: string[]) {
    this.ghostIds = [...ids]
    this.drawGhosts()
  }

  // A ghost is drawn in every empty slot that has one; a real drop in the same slot hides it
  private drawGhosts() {
    this.ghostObjects.forEach((object) => object.destroy())
    this.ghostObjects = []
    this.ghostIds.forEach((id, i) => {
      if (i >= MAX_DROPS || this.current[i]) return
      const color = INGREDIENT_COLORS[id] ?? FALLBACK_COLOR
      const name = INGREDIENTS.find((ingredient) => ingredient.id === id)?.name ?? id
      const circle = this.scene.add
        .circle(this.slotX(i), ROW.y, ROW.radius, color, GHOST.alpha)
        .setStrokeStyle(GHOST.lineWidth, CREAM, GHOST.lineAlpha)
      const label = this.scene.add
        .text(this.slotX(i), ROW.y + GHOST.labelDy[i % 2], name, { fontFamily: FONT, fontSize: `${GHOST.labelSize}px`, color: GHOST.labelColor })
        .setOrigin(0.5)
        .setAlpha(GHOST.labelAlpha)
      this.add([circle, label])
      this.ghostObjects.push(circle, label)
    })
  }

  // Fades all filled circles out; the caller redraws the empty slots afterwards
  fadeOut(onDone: () => void) {
    const dots = this.filled.filter((dot) => dot !== null)
    if (dots.length === 0) {
      onDone()
      return
    }
    this.scene.tweens.add({ targets: dots, alpha: 0, duration: FADE_MS, onComplete: onDone })
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
