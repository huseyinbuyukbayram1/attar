import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import type { Order } from '../../data/customers'
import { INGREDIENTS } from '../../data/ingredients'
import type { SoundEvent } from '../../game/audio'
import { MAX_SMELLS } from '../../game/gameState'
import type { GameState } from '../../game/gameState'
import { MAX_DROPS } from '../../game/scoring'
import { Bottle, HOVER_LIFT, HOVER_SCALE } from './Bottle'
import type { BottleLayout } from './Bottle'
import { Button } from './Button'
import { DropSlots } from './DropSlots'
import { Flask, FLASK_MOUTH } from './Flask'
import { liquidColor } from './liquidColor'
import { FINAL_MIX_ENABLED, playMixAnimation } from './mixAnimation'
import { playPourStream, STREAM_REACH_MS } from './pourStream'
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
// Tooltips sit at one fixed height above the tallest bottle of the back row (counting its hover
// scale and lift), so a tooltip never covers any bottle.
const TOOLTIP_BOTTOM = BACK_ROW.bottom - BACK_ROW.height * HOVER_SCALE - HOVER_LIFT - 6
// The three bottle shapes rotate in this fixed order over the ten ingredients
const BOTTLE_TEXTURES = ['bottle_round', 'bottle_dropper', 'bottle_square']

// Buttons on the dark front face, bottom right
const SMELL = { x: 950, y: 680, width: 200, height: 44 } // "Deliver" takes its place when out of smells
const DELIVER = SMELL
const CLEAR = { x: 1150, y: 680, width: 120, height: 44 }
// Pouring: the bottle's mouth stops a little right of, and above, the flask's mouth
const POUR = { offsetX: 14, above: 30, flyMs: 300, returnMs: 250, minStreamLength: 30 }
const NO_SMELLS_NOTE = { x: 700, y: 680, width: 280, height: 28 } // small line just left of that button

type Callbacks = { onSmell: () => void; onDeliver: () => void; onSound: (event: SoundEvent) => void }

// Phase MIX: the counter view. Bottles to pick from, the flask with its six slots, and the
// buttons. The GameState is updated the moment a bottle is clicked; the drawing follows at once.
export class MixView {
  private root: Phaser.GameObjects.Container
  private state: GameState
  private reminderText: Phaser.GameObjects.Text
  private flask: Flask
  private bottles: Bottle[] = []
  private scene: Phaser.Scene
  private slots: DropSlots
  private clearButton: Button
  private smellButton: Button
  private deliverButton: Button
  private noSmellsNote: Phaser.GameObjects.Container
  private active = false
  private busy = false // true while a pour or the mix animation plays: input is ignored
  private tooltip: Tooltip
  private onSound: (event: SoundEvent) => void

  constructor(scene: Phaser.Scene, state: GameState, callbacks: Callbacks) {
    this.state = state
    this.scene = scene
    this.onSound = callbacks.onSound
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
    this.tooltip = tooltip
    INGREDIENTS.forEach((ingredient, i) => {
      const row = i < BOTTLES_PER_ROW ? BACK_ROW : FRONT_ROW
      const layout: BottleLayout = {
        x: row.firstX + (i % BOTTLES_PER_ROW) * row.spacing,
        bottom: row.bottom,
        height: row.height,
        tooltipY: TOOLTIP_BOTTOM,
      }
      const textureKey = BOTTLE_TEXTURES[i % BOTTLE_TEXTURES.length]
      const bottle = new Bottle(scene, layout, textureKey, ingredient, tooltip, () => this.pick(ingredient.id, bottle))
      this.bottles.push(bottle)
      this.root.add(bottle)
    })

    this.flask = new Flask(scene)
    this.slots = new DropSlots(scene, tooltip, (index) => this.emptySlot(index))
    this.clearButton = new Button(scene, CLEAR.x, CLEAR.y, CLEAR.width, CLEAR.height, 'Clear', () => this.clear())
    this.smellButton = new Button(scene, SMELL.x, SMELL.y, SMELL.width, SMELL.height, 'Let them smell', () => {
      if (this.active && !this.busy && this.state.canSmell()) this.stir(callbacks.onSmell)
    })
    this.deliverButton = new Button(scene, DELIVER.x, DELIVER.y, DELIVER.width, DELIVER.height, 'Deliver', () => {
      if (!this.active || this.busy || !this.state.canDeliver()) return
      // Final stir before the score, unless it is switched off
      if (FINAL_MIX_ENABLED) this.stir(callbacks.onDeliver)
      else callbacks.onDeliver()
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
  // `evening` warms the bottles and the flask, matching the evening look of the background
  show(order: Order, evening: boolean) {
    this.active = true
    this.busy = false
    this.bottles.forEach((bottle) => bottle.setEvening(evening))
    this.flask.setEvening(evening)
    this.reminderText.setText(`${order.customerName}: ${order.orderText}`)
    this.refresh(false)
    this.root.setVisible(true)
  }

  hide() {
    this.active = false
    this.root.setVisible(false)
  }

  // The state changes right here, at click time. The pour that follows is only a picture of it.
  private pick(id: string, bottle: Bottle) {
    if (!this.active || this.busy) return // one pour at a time, extra clicks are dropped
    const index = this.state.addDrop(id)
    if (index === -1) {
      bottle.shake() // full: no pour, just a "no"
      return
    }
    this.busy = true
    this.tooltip.hide()
    this.onSound('bottle')

    // The bottle must be drawn above the flask while it pours; its old place in the list is
    // remembered so it goes back there (the front row has to stay in front of the back row).
    const place = this.root.getIndex(bottle)
    this.root.bringToTop(bottle)
    this.root.bringToTop(this.tooltip)

    const mouth = { x: FLASK_MOUTH.x + POUR.offsetX, y: FLASK_MOUTH.y - POUR.above }
    bottle.flyToMouth(mouth, POUR.flyMs, () => {
      // The liquid rises while the stream runs; the slot pops when the stream reaches the flask
      const ids = this.state.drops
      const level = ids.length / MAX_DROPS
      this.onSound('pour')
      this.flask.setTarget(level, liquidColor(ids), true)
      this.scene.time.delayedCall(STREAM_REACH_MS, () => {
        this.slots.setSlots(this.state.slots)
        this.slots.pop(index)
        this.refreshButtons()
      })
      const bottom = Math.max(mouth.y + POUR.minStreamLength, this.flask.surfaceYAt(level))
      playPourStream(this.scene, this.root, mouth.x, mouth.y, bottom, INGREDIENT_COLORS[id] ?? FALLBACK_COLOR, () => {
        bottle.flyHome(POUR.returnMs, () => {
          this.root.moveTo(bottle, place)
          this.busy = false
        })
      })
    })
  }

  // The mix animation (shake, swirl, sparkles), then onDone. Public because the scene also plays
  // it when delivering from the REACT phase. Input is ignored until it ends.
  stir(onDone: () => void) {
    if (!this.active) return
    this.busy = true
    this.tooltip.hide()
    this.onSound('mix')
    playMixAnimation(this.scene, this.flask, () => {
      this.busy = false
      if (this.active) onDone()
    })
  }

  private emptySlot(index: number) {
    if (!this.active || this.busy || this.state.slots[index] === null) return
    this.state.removeSlot(index)
    this.refresh(true)
  }

  private clear() {
    if (!this.active || this.busy) return
    this.state.clear()
    this.refresh(true)
  }

  // Redraws everything from the state (no pour: used for show, clear and emptying a slot)
  private refresh(animate: boolean) {
    const ids = this.state.drops
    this.slots.setSlots(this.state.slots)
    this.flask.setTarget(ids.length / MAX_DROPS, ids.length > 0 ? liquidColor(ids) : null, animate)
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
