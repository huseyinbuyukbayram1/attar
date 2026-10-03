import Phaser from 'phaser'
import type { Order } from '../../data/customers'
import { INGREDIENT_COLORS, FALLBACK_COLOR } from '../../data/ingredientColors'
import { INGREDIENTS } from '../../data/ingredients'
import type { GameState } from '../../game/gameState'
import { MAX_DROPS } from '../../game/scoring'
import { Bottle } from './Bottle'
import { Button } from './Button'
import { DropSlots } from './DropSlots'
import { averageColor } from './liquidColor'
import { MixingVial } from './MixingVial'
import { addPanel, BORDER, FONT, TEXT_COLOR } from './theme'
import { MAX_SMELLS } from '../../game/gameState'

// Layout numbers for the 1280x720 screen
const REMINDER = { x: 640, y: 90, width: 760, height: 64 }
const VIAL = { x: 640, y: 290, width: 120, height: 230 }
// One position per ingredient, in INGREDIENTS order: 5 on the left of the vial, 5 on the right
const BOTTLE_POSITIONS = [
  { x: 150, y: 250 }, { x: 270, y: 250 }, { x: 390, y: 250 }, { x: 210, y: 420 }, { x: 330, y: 420 },
  { x: 890, y: 250 }, { x: 1010, y: 250 }, { x: 1130, y: 250 }, { x: 950, y: 420 }, { x: 1070, y: 420 },
]
const BUTTONS_Y = 600
const BUTTON_HEIGHT = 56
const CLEAR = { x: 500, width: 150 }
const SMELL = { x: 700, width: 260 }
const DELIVER = SMELL // out of smells, "Deliver" takes the place of "Let them smell"
const NO_SMELLS_NOTE = { y: 654, width: 330, height: 30 } // small line under that button

// Drop flight: a small circle arcs from the bottle's mouth to just above the vial
const DROP_MS = 400
const DROP_RADIUS = 9
const DROP_ARC_PX = 90 // how far above the higher end point the arc peaks
const VIAL_MOUTH_Y = VIAL.y - VIAL.height / 2 - 10

type Callbacks = { onSmell: () => void; onDeliver: () => void }

type Flight = { sprite: Phaser.GameObjects.Arc; tween: Phaser.Tweens.Tween }

// Phase MIX: the counter view. Bottles to pick from, the vial with its six slots, and the
// buttons. The GameState is updated the moment a bottle is clicked (so fast clicking can't
// overfill the vial); what is DRAWN catches up when the flying drop arrives.
export class MixView {
  private root: Phaser.GameObjects.Container
  private state: GameState
  private reminderText: Phaser.GameObjects.Text
  private vial: MixingVial
  private slots: DropSlots
  private clearButton: Button
  private smellButton: Button
  private deliverButton: Button
  private noSmellsNote: Phaser.GameObjects.Container

  private active = false
  private flights: Flight[] = []
  // Per slot: the id of the drop still flying towards it, or 0. Such a slot is drawn empty.
  private pending: number[] = new Array<number>(MAX_DROPS).fill(0)
  private nextFlightId = 1

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

    INGREDIENTS.forEach((ingredient, i) => {
      const spot = BOTTLE_POSITIONS[i]
      this.root.add(
        new Bottle(scene, spot.x, spot.y, ingredient, (fromX, fromY) => this.pick(ingredient.id, fromX, fromY)),
      )
    })

    this.vial = new MixingVial(scene, VIAL.x, VIAL.y, VIAL.width, VIAL.height)
    this.slots = new DropSlots(scene, (index) => this.emptySlot(index))
    this.clearButton = new Button(scene, CLEAR.x, BUTTONS_Y, CLEAR.width, BUTTON_HEIGHT, 'Clear', () => this.clear())
    this.smellButton = new Button(scene, SMELL.x, BUTTONS_Y, SMELL.width, BUTTON_HEIGHT, 'Let them smell', () => {
      if (this.active && this.state.canSmell()) callbacks.onSmell()
    })
    this.deliverButton = new Button(scene, DELIVER.x, BUTTONS_Y, DELIVER.width, BUTTON_HEIGHT, 'Deliver', () => {
      if (this.active && this.state.canDeliver()) callbacks.onDeliver()
    })
    const noteText = scene.add
      .text(DELIVER.x, NO_SMELLS_NOTE.y, 'No smells left: trust your nose.', {
        fontFamily: FONT,
        fontSize: '16px',
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
    this.noSmellsNote = scene.add.container(0, 0, [
      addPanel(scene, DELIVER.x, NO_SMELLS_NOTE.y, NO_SMELLS_NOTE.width, NO_SMELLS_NOTE.height, 15),
      noteText,
    ])
    this.root.add([this.vial, this.slots, this.clearButton, this.smellButton, this.deliverButton, this.noSmellsNote])
    this.root.setVisible(false)
  }

  // Draws everything from the state, so coming back via "Adjust" shows the slots as they were
  show(order: Order) {
    this.active = true
    this.reminderText.setText(`${order.customerName}: ${order.orderText}`)
    this.cancelFlights()
    this.refresh(false)
    this.root.setVisible(true)
  }

  hide() {
    this.active = false
    this.cancelFlights() // the state already holds those drops; show() will draw them
    this.root.setVisible(false)
  }

  private pick(id: string, fromX: number, fromY: number) {
    if (!this.active) return
    const slot = this.state.addDrop(id)
    if (slot === -1) {
      this.slots.shake() // full: no drop
      return
    }
    // The slot is taken in the state right now, but drawn empty until the drop lands
    const flightId = this.nextFlightId++
    this.pending[slot] = flightId
    this.refreshButtons()
    this.fly(slot, flightId, id, fromX, fromY)
  }

  private fly(slot: number, flightId: number, id: string, fromX: number, fromY: number) {
    const sprite = this.root.scene.add
      .circle(fromX, fromY, DROP_RADIUS, INGREDIENT_COLORS[id] ?? FALLBACK_COLOR)
      .setStrokeStyle(2, BORDER)
    this.root.add(sprite)

    // Quadratic Bezier: start, one control point high above, end. t runs 0 -> 1.
    const endX = VIAL.x
    const controlX = (fromX + endX) / 2
    const controlY = Math.min(fromY, VIAL_MOUTH_Y) - DROP_ARC_PX
    const progress = { t: 0 }
    const tween = this.root.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: DROP_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = progress.t
        const u = 1 - t
        sprite.x = u * u * fromX + 2 * u * t * controlX + t * t * endX
        sprite.y = u * u * fromY + 2 * u * t * controlY + t * t * VIAL_MOUTH_Y
      },
      onComplete: () => {
        sprite.destroy()
        this.flights = this.flights.filter((flight) => flight.sprite !== sprite)
        // Only draw the landing if this slot was not emptied or refilled in the meantime
        if (this.pending[slot] === flightId) {
          this.pending[slot] = 0
          this.refresh(true)
        }
      },
    })
    this.flights.push({ sprite, tween })
  }

  private emptySlot(index: number) {
    // A slot whose drop is still flying can't be removed yet
    if (!this.active || this.state.slots[index] === null || this.pending[index] !== 0) return
    this.state.removeSlot(index)
    this.refresh(true)
  }

  private clear() {
    if (!this.active) return
    this.cancelFlights()
    this.state.clear()
    this.refresh(true)
  }

  private cancelFlights() {
    for (const flight of this.flights) {
      flight.tween.stop()
      flight.sprite.destroy()
    }
    this.flights = []
    this.pending.fill(0)
  }

  // What is shown: the state's slots, minus drops that have not landed yet
  private shownSlots(): (string | null)[] {
    return this.state.slots.map((id, i) => (this.pending[i] === 0 ? id : null))
  }

  private refresh(animate: boolean) {
    const shown = this.shownSlots()
    const ids = shown.filter((id): id is string => id !== null)
    this.slots.setSlots(shown)
    this.vial.setTarget(ids.length / MAX_DROPS, ids.length > 0 ? averageColor(ids) : null, animate)
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
