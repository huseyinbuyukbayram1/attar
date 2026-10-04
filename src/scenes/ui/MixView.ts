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
import { BASE_FRACTION, baseY } from './counterBand'
import { DropSlots } from './DropSlots'
import { Flask } from './Flask'
import { liquidColor } from './liquidColor'
import { FINAL_MIX_ENABLED, playMixAnimation } from './mixAnimation'
import { Notebook } from './Notebook'
import { playPourStream, STREAM_REACH_MS } from './pourStream'
import { addPanel, FONT, TEXT_COLOR } from './theme'
import { Tooltip } from './Tooltip'

// Layout numbers for the 1280x720 screen. In counter_view the counter's top surface (light
// wood) spans y 497..617 (COUNTER in counterBand.ts); below that is the dark front face.
const REMINDER = { x: 640, y: 90, width: 760, height: 64 }

// Two rows of bottles to the right of the flask (the brass scale, alembic and notebook are at x < 375).
// The front row is shifted by half a spacing, so a label never hides a bottle.
const BOTTLES_PER_ROW = 5
// Their bases are fractions of the counter-top band (see counterBand.ts)
// `scale` is the perspective: the back row is further away, so its bottles are drawn smaller
const BACK_ROW = { firstX: 625, spacing: 145, bottom: baseY(BASE_FRACTION.backRow), height: 80, scale: 0.92 }
const FRONT_ROW = { firstX: 552, spacing: 145, bottom: baseY(BASE_FRACTION.frontRow), height: 92, scale: 1 }
// Tooltips sit at one fixed height above the tallest bottle of the back row (counting its hover
// scale and lift), so a tooltip never covers any bottle.
const TOOLTIP_BOTTOM = BACK_ROW.bottom - BACK_ROW.height * BACK_ROW.scale * HOVER_SCALE - HOVER_LIFT - 6
// The three bottle shapes rotate in this fixed order over the ten ingredients
const BOTTLE_TEXTURES = ['bottle_round', 'bottle_dropper', 'bottle_square']

// Buttons on the dark front face, bottom right
const SMELL = { x: 950, y: 680, width: 200, height: 44 } // "Deliver" takes its place when out of smells
const DELIVER = SMELL
const EMPTY_BUTTON = { x: 1170, y: 680, width: 190, height: 44 } // right edge as before; wide for its longer text
// Pouring: the tilted bottle stops with its MOUTH this far above (gap) and beside (shiftX) the
// flask's rim; clearRaise lifts it a little more so the bottle's body clears the flask
const POUR = { gap: 10, shiftX: 0, clearRaise: 20, flyMs: 300, returnMs: 250, minStreamLength: 30 }
const NO_SMELLS_NOTE = { x: 700, y: 680, width: 280, height: 28 } // small line just left of that button

type Callbacks = {
  onSmell: () => void
  onDeliver: () => void
  onSound: (event: SoundEvent) => void
  isSceneBusy: () => boolean // true during a phase change or other sequence of the scene
}

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
  private emptyButton: Button
  private smellButton: Button
  private deliverButton: Button
  private noSmellsNote: Phaser.GameObjects.Container
  private active = false
  // The mix as it was when the mix animation last played; null for a new customer. Delivering a
  // mix that has not changed since skips the final stir. Kept here, not in GameState: it is only
  // a visual detail.
  private lastStirredMix: string | null = null
  private busy = false // true while a pour or the mix animation plays: input is ignored
  private tooltip: Tooltip
  private onSound: (event: SoundEvent) => void
  private notebook: Notebook

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
        height: row.height * row.scale,
        tooltipY: TOOLTIP_BOTTOM,
      }
      const textureKey = BOTTLE_TEXTURES[i % BOTTLE_TEXTURES.length]
      const bottle = new Bottle(scene, layout, textureKey, ingredient, tooltip, () => this.pick(ingredient.id, bottle))
      this.bottles.push(bottle)
      this.root.add([bottle.shadow, bottle]) // the shadow goes right under its bottle
    })

    this.flask = new Flask(scene)
    this.slots = new DropSlots(scene, tooltip)
    this.emptyButton = new Button(scene, EMPTY_BUTTON.x, EMPTY_BUTTON.y, EMPTY_BUTTON.width, EMPTY_BUTTON.height, 'Empty the flask', () =>
      this.emptyFlask(),
    )
    this.smellButton = new Button(scene, SMELL.x, SMELL.y, SMELL.width, SMELL.height, 'Let them smell', () => {
      if (this.active && !this.busy && this.state.canSmell()) this.stir(callbacks.onSmell)
    })
    this.deliverButton = new Button(scene, DELIVER.x, DELIVER.y, DELIVER.width, DELIVER.height, 'Deliver', () => {
      if (!this.active || this.busy || !this.state.canDeliver()) return
      // Final stir before the score, unless it is switched off
      if (FINAL_MIX_ENABLED && !this.isStirred()) this.stir(callbacks.onDeliver)
      else callbacks.onDeliver()
    })
    // The notebook only opens while this view is idle: no pour, no stir, no phase change
    this.notebook = new Notebook(scene, tooltip, {
      canOpen: () => this.active && !this.busy && !callbacks.isSceneBusy(),
      onOpen: () => this.tooltip.hide(),
      onSound: (event) => this.onSound(event),
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
    // The notebook comes before the flask: the waste pot of the emptying animation is drawn just below
    // the flask, and it must be in front of the notebook, too
    this.root.add([this.notebook.book, this.flask, this.slots, this.emptyButton, this.smellButton, this.deliverButton, this.noSmellsNote, tooltip])
    this.root.setVisible(false)
  }

  // Draws everything from the state, so coming back via "Adjust" shows the slots as they were
  // `evening` warms the bottles and the flask, matching the evening look of the background
  show(order: Order, evening: boolean) {
    this.active = true
    this.busy = false
    this.bottles.forEach((bottle) => bottle.setEvening(evening))
    this.flask.setEvening(evening)
    this.notebook.setEvening(evening)
    this.reminderText.setText(`${order.customerName}: ${order.orderText}`)
    this.refresh(false)
    this.root.setVisible(true)
  }

  hide() {
    this.active = false
    this.notebook.closeNow()
    this.root.setVisible(false)
  }

  // The state changes right here, at click time. The pour that follows is only a picture of it.
  // The filled slots' ingredient ids, sorted and joined: the same drops give the same text
  // whatever slots they sit in
  private mixSignature(): string {
    return [...this.state.drops].sort().join(',')
  }

  // True if the mix is the same as the last one that was stirred
  isStirred(): boolean {
    return this.lastStirredMix === this.mixSignature()
  }

  // A new customer starts with nothing stirred
  resetStirred() {
    this.lastStirredMix = null
  }

  private pick(id: string, bottle: Bottle) {
    if (!this.active || this.busy) return // one pour at a time, extra clicks are dropped
    const index = this.state.addDrop(id)
    if (index === -1) {
      bottle.shake() // full: no pour, just a "no"
      return
    }
    this.busy = true
    this.tooltip.setLocked(true) // no tooltips until the bottle is home again
    // 1) Stop all hover tweens and put the bottle in its resting pose before anything moves
    bottle.beginPour()
    this.onSound('bottle')

    // The bottle must be drawn above the flask while it pours; its old place in the list is
    // remembered so it goes back there (the front row has to stay in front of the back row).
    const place = this.root.getIndex(bottle)
    this.root.bringToTop(bottle)
    this.root.bringToTop(this.tooltip)

    // The stream's x, and where the bottle's MOUTH must stop. flyToMouth solves the bottle's x
    // for exactly this mouth x at the final tilt, so nothing is estimated.
    const mouthX = this.flask.mouth.x + POUR.shiftX
    const target = { x: mouthX, y: this.flask.mouth.y - POUR.gap - POUR.clearRaise }
    // 2) fly and tilt; 3) only when that has ended, the stream starts
    bottle.flyToMouth(target, POUR.flyMs, () => {
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
      const top = target.y // the bottle has stopped, so its mouth is exactly here
      const bottom = Math.max(top + POUR.minStreamLength, this.flask.surfaceYAt(level))
      playPourStream(this.scene, this.root, mouthX, top, bottom, INGREDIENT_COLORS[id] ?? FALLBACK_COLOR, () => {
        // 4) the stream is over: the bottle goes home
        bottle.flyHome(POUR.returnMs, () => {
          this.root.moveTo(bottle, place)
          bottle.endPour()
          this.tooltip.setLocked(false)
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
    this.lastStirredMix = this.mixSignature()
    this.tooltip.hide()
    this.onSound('mix')
    playMixAnimation(this.scene, this.flask, () => {
      this.busy = false
      if (this.active) onDone()
    })
  }

  // The only way to take drops out: empty the whole flask. The state is cleared when the
  // animation ends; until then input is ignored. smellsUsed and lastStirredMix are not touched.
  private emptyFlask() {
    if (!this.active || this.busy || this.state.drops.length === 0) return
    this.busy = true
    this.tooltip.setLocked(true)
    this.onSound('click')
    // The slots empty when the flask tilts back
    this.flask.playEmpty({
      onPour: () => this.onSound('pour'),
      onBack: () => this.slots.fadeOut(() => {}), // the slots empty when the flask tilts back
      onDone: () => {
        this.tooltip.setLocked(false)
        this.busy = false
        if (!this.active) return
        this.state.clear()
        this.refresh(false)
      },
    })
  }

  // Redraws everything from the state (no pour: used for show, clear and emptying a slot)
  private refresh(animate: boolean) {
    const ids = this.state.drops
    this.slots.setSlots(this.state.slots)
    this.flask.setTarget(ids.length / MAX_DROPS, ids.length > 0 ? liquidColor(ids) : null, animate)
    this.refreshButtons()
  }

  private refreshButtons() {
    this.emptyButton.setEnabled(this.state.drops.length > 0)
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
