import Phaser from 'phaser'
import type { Order } from '../../data/customers'
import { INGREDIENTS } from '../../data/ingredients'
import { MAX_SMELLS } from '../../game/gameState'
import type { GameState } from '../../game/gameState'
import { MAX_DROPS } from '../../game/scoring'
import { Bottle } from './Bottle'
import type { BottleLayout } from './Bottle'
import { Button } from './Button'
import { DropSlots } from './DropSlots'
import { Flask } from './Flask'
import { averageColor } from './liquidColor'
import { addPanel, FONT, TEXT_COLOR } from './theme'
import { Tooltip } from './Tooltip'

// Layout numbers for the 1280x720 screen. In counter_view the counter's top surface (light
// wood) spans y 524..620; below that is the dark front face. Things stand on the surface.
const REMINDER = { x: 640, y: 90, width: 760, height: 64 }

// Two rows of bottles to the right of the flask (the brass scale and alembic are at x < 285).
// The front row is shifted by half a spacing, so a label never hides a bottle.
const BOTTLES_PER_ROW = 5
const BACK_ROW = { firstX: 625, spacing: 145, bottom: 552, height: 80 }
const FRONT_ROW = { firstX: 552, spacing: 145, bottom: 610, height: 92 }
// The three bottle shapes rotate in this fixed order over the ten ingredients
const BOTTLE_TEXTURES = ['bottle_round', 'bottle_dropper', 'bottle_square']

// Buttons on the dark front face, bottom right
const SMELL = { x: 950, y: 680, width: 200, height: 44 } // "Deliver" takes its place when out of smells
const DELIVER = SMELL
const CLEAR = { x: 1150, y: 680, width: 120, height: 44 }
const NO_SMELLS_NOTE = { x: 700, y: 680, width: 280, height: 28 } // small line just left of that button

type Callbacks = { onSmell: () => void; onDeliver: () => void }

// Phase MIX: the counter view. Bottles to pick from, the flask with its six slots, and the
// buttons. The GameState is updated the moment a bottle is clicked; the drawing follows at once.
export class MixView {
  private root: Phaser.GameObjects.Container
  private state: GameState
  private reminderText: Phaser.GameObjects.Text
  private flask: Flask
  private slots: DropSlots
  private clearButton: Button
  private smellButton: Button
  private deliverButton: Button
  private noSmellsNote: Phaser.GameObjects.Container
  private active = false

  constructor(scene: Phaser.Scene, state: GameState, callbacks: Callbacks) {
    this.state = state
    this.root = scene.add.container(0, 0)

    this.reminderText = scene.add
      .text(REMINDER.x, REMINDER.y, '', {
        fontFamily: FONT,
        fontSize: '19px',
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: REMINDER.width - 40 },
      })
      .setOrigin(0.5)
    this.root.add([addPanel(scene, REMINDER.x, REMINDER.y, REMINDER.width, REMINDER.height, 24), this.reminderText])

    // Added in this order, so the back row is behind the front row, and the flask is above both
    const tooltip = new Tooltip(scene)
    INGREDIENTS.forEach((ingredient, i) => {
      const row = i < BOTTLES_PER_ROW ? BACK_ROW : FRONT_ROW
      const layout: BottleLayout = {
        x: row.firstX + (i % BOTTLES_PER_ROW) * row.spacing,
        bottom: row.bottom,
        height: row.height,
      }
      const textureKey = BOTTLE_TEXTURES[i % BOTTLE_TEXTURES.length]
      this.root.add(new Bottle(scene, layout, textureKey, ingredient, tooltip, () => this.pick(ingredient.id)))
    })

    this.flask = new Flask(scene)
    this.slots = new DropSlots(scene, tooltip, (index) => this.emptySlot(index))
    this.clearButton = new Button(scene, CLEAR.x, CLEAR.y, CLEAR.width, CLEAR.height, 'Clear', () => this.clear())
    this.smellButton = new Button(scene, SMELL.x, SMELL.y, SMELL.width, SMELL.height, 'Let them smell', () => {
      if (this.active && this.state.canSmell()) callbacks.onSmell()
    })
    this.deliverButton = new Button(scene, DELIVER.x, DELIVER.y, DELIVER.width, DELIVER.height, 'Deliver', () => {
      if (this.active && this.state.canDeliver()) callbacks.onDeliver()
    })
    const noteText = scene.add
      .text(NO_SMELLS_NOTE.x, NO_SMELLS_NOTE.y, 'No smells left: trust your nose.', {
        fontFamily: FONT,
        fontSize: '14px',
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
    this.noSmellsNote = scene.add.container(0, 0, [
      addPanel(scene, NO_SMELLS_NOTE.x, NO_SMELLS_NOTE.y, NO_SMELLS_NOTE.width, NO_SMELLS_NOTE.height, 13),
      noteText,
    ])
    // The tooltip goes last so it is drawn above everything, including the flask
    this.root.add([this.flask, this.slots, this.clearButton, this.smellButton, this.deliverButton, this.noSmellsNote, tooltip])
    this.root.setVisible(false)
  }

  // Draws everything from the state, so coming back via "Adjust" shows the slots as they were
  show(order: Order) {
    this.active = true
    this.reminderText.setText(`${order.customerName}: ${order.orderText}`)
    this.refresh(false)
    this.root.setVisible(true)
  }

  hide() {
    this.active = false
    this.root.setVisible(false)
  }

  private pick(id: string) {
    if (!this.active) return
    if (this.state.addDrop(id) === -1) {
      this.slots.shake() // full: no drop
      return
    }
    this.refresh(true)
  }

  private emptySlot(index: number) {
    if (!this.active || this.state.slots[index] === null) return
    this.state.removeSlot(index)
    this.refresh(true)
  }

  private clear() {
    if (!this.active) return
    this.state.clear()
    this.refresh(true)
  }

  private refresh(animate: boolean) {
    const ids = this.state.drops
    this.slots.setSlots(this.state.slots)
    this.flask.setTarget(ids.length / MAX_DROPS, ids.length > 0 ? averageColor(ids) : null, animate)
    this.refreshButtons()
  }

  private refreshButtons() {
    this.clearButton.setEnabled(this.state.drops.length > 0)
    // Smells are limited, adjusting is not. Once the smells are used up, Deliver replaces Smell.
    // smellsUsed only changes in the REACT phase, and show() calls this when MIX opens again.
    const outOfSmells = this.state.smellsUsed >= MAX_SMELLS
    this.smellButton.setVisible(!outOfSmells)
    this.deliverButton.setVisible(outOfSmells)
    this.noSmellsNote.setVisible(outOfSmells)
    this.smellButton.setEnabled(this.state.canSmell())
    this.deliverButton.setEnabled(this.state.canDeliver())
  }
}
