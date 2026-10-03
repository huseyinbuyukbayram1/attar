import Phaser from 'phaser'
import { ORDERS } from '../data/customers'
import { CUSTOMERS_PER_DAY, GameState, TOTAL_DAYS } from '../game/gameState'
import type { TimeOfDay } from '../game/gameState'
import { hintFor, mixScent, scoreMix } from '../game/scoring'
import type { Stars } from '../game/scoring'
import { CustomerArt } from './ui/CustomerArt'
import { addCounterCrop } from './ui/counterCrop'
import { EveningOverlay } from './ui/EveningOverlay'
import { MixView } from './ui/MixView'
import { OrderView } from './ui/OrderView'
import { ReactView } from './ui/ReactView'
import { SpeechBox } from './ui/SpeechBox'
import { addPillLabel } from './ui/theme'

export const TRANSITION_MS = 350 // total time of a fade between phases (half out, half in)
const COUNTER_TOP_Y = 578 // in canvas pixels: the counter's top edge; everything from here down is drawn in front of the customer
// TEMP: remove before release (also the marked code in create() and startCustomer())
const DEV_SKIP_KEYS = true // N = next customer, B = previous, no scoring

const EVENING_CUSTOMER_TINT = 0xffd9b0 // warm tint so the portrait matches the evening light
// Depth of every scene layer, back to front. UI objects keep the default depth 0, so all the
// art layers are negative and the UI is always on top of them. The customer is above the
// evening effects that sit behind it, and only the counter crops are above the customer.
const DEPTH = {
  background: -100, // morning image
  eveningBehind: -90, // tint copy, violet, door glow, lantern glow
  customer: -80,
  counter: -70, // morning counter crop
  eveningCounter: -60, // evening-tinted counter crop
  mixBackdrop: -50, // only shown in the MIX phase
}
const DIM = { color: 0x2a1a10, alpha: 0.45 } // warm dark veil over the shop in the mix phase
const FADE_COLOR = 0x1a1210
const FADE_DEPTH = 1000 // above everything, so the transition covers the whole screen

// Small always-on labels in the top corners (16 px from the canvas edges)
const TITLE = { x: 76, y: 38, width: 120, height: 48 }
const DAY_LABEL = { x: 1129, y: 32, width: 270, height: 36 }

// What the customer says after delivery, by star count
const REACTIONS: Record<Stars, string> = {
  3: 'It is exactly what I remembered. Thank you!',
  2: 'Very close. I like it.',
  1: 'Hmm. Not quite what I had in mind.',
  0: 'This is not what I asked for.',
}

// The three screens of one customer: ORDER (they ask), MIX (you work at the counter),
// REACT (they smell it, you adjust or deliver)
type Phase = 'order' | 'mix' | 'react'
type Hideable = { setVisible(visible: boolean): unknown }

// The coordinator: owns the GameState and the background, and moves between phases.
// The drawing of each phase lives in src/scenes/ui/, the rules in src/game/.
export class ShopScene extends Phaser.Scene {
  private state!: GameState
  // Phaser reuses this scene object on restart, so these are reset in create(), not here
  private busy = false // true while a transition runs, so clicks can't start a second one
  private evening!: EveningOverlay
  private counterOverlays: Phaser.GameObjects.Image[] = []
  private mixBackdrop: Hideable[] = []

  private customer!: CustomerArt
  private speech!: SpeechBox
  private orderView!: OrderView
  private mixView!: MixView
  private reactView!: ReactView
  private dayText!: Phaser.GameObjects.Text
  private fade!: Phaser.GameObjects.Rectangle
  private phase: Phase = 'order'
  private devLabel?: Phaser.GameObjects.Text // TEMP: remove before release

  constructor() {
    super('ShopScene')
  }

  create() {
    this.state = new GameState()
    this.busy = false
    this.counterOverlays = []
    this.mixBackdrop = []

    // Layers are ordered by the DEPTH table above, not by creation order
    this.addBackground('shop_morning', 0x5b3a29).setDepth(DEPTH.background)
    this.customer = new CustomerArt(this, DEPTH.customer)
    // A copy of the background showing only the counter, drawn over the customer so
    // they appear to stand behind it
    const counter = addCounterCrop(this, 'shop_morning', COUNTER_TOP_Y)
    if (counter) {
      counter.setDepth(DEPTH.counter)
      this.counterOverlays.push(counter)
    }
    this.evening = new EveningOverlay(
      this,
      'shop_morning',
      { behind: DEPTH.eveningBehind, counter: DEPTH.eveningCounter },
      COUNTER_TOP_Y,
    )
    this.addMixBackdrop()

    addPillLabel(this, TITLE.x, TITLE.y, TITLE.width, TITLE.height, 'Attar', 32)
    this.dayText = addPillLabel(this, DAY_LABEL.x, DAY_LABEL.y, DAY_LABEL.width, DAY_LABEL.height, '', 20)

    this.speech = new SpeechBox(this)
    this.orderView = new OrderView(this, () => this.goTo('mix'))
    this.mixView = new MixView(this, this.state, {
      onSmell: () => this.goTo('react', () => this.enterReact()),
      // Out of smells: deliver straight from the counter, into the same result view
      onDeliver: () => this.goTo('react', () => this.deliver()),
    })
    this.reactView = new ReactView(this, {
      onAdjust: () => this.goTo('mix'),
      onDeliver: () => this.deliver(),
      onNext: () => this.next(),
    })

    this.fade = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, FADE_COLOR)
      .setAlpha(0)
      .setDepth(FADE_DEPTH)

    // TEMP: remove before release
    if (DEV_SKIP_KEYS) this.addDevSkipKeys()

    this.startCustomer()
  }

  // The state decides the time of day; the overlay plays the 1500 ms crossfade
  setTimeOfDay(time: TimeOfDay) {
    this.evening.setTime(time)
    this.customer.setTint(time === 'evening' ? EVENING_CUSTOMER_TINT : null)
  }

  // A new customer arrives: reset the screen and start in the ORDER phase
  private startCustomer() {
    const { state } = this
    this.busy = false
    this.setTimeOfDay(state.timeOfDay)
    this.dayText.setText(`Day ${state.day}/${TOTAL_DAYS} - Customer ${state.customerOfDay}/${CUSTOMERS_PER_DAY}`)
    this.speech.setSpeaker(state.order.customerName)
    this.speech.setText(state.order.orderText)
    this.customer.show(state.order)
    this.devLabel?.setText(`dev: ${state.order.id}`) // TEMP: remove before release
    this.applyPhase('order')
  }

  // Fade to dark, switch what is visible, fade back in. onSwitch runs at the dark moment,
  // right after the switch, so text and buttons change without being seen.
  private goTo(phase: Phase, onSwitch?: () => void) {
    if (this.busy) return
    this.busy = true
    this.tweens.add({
      targets: this.fade,
      alpha: 1,
      duration: TRANSITION_MS / 2,
      onComplete: () => {
        this.applyPhase(phase)
        onSwitch?.()
        this.tweens.add({
          targets: this.fade,
          alpha: 0,
          duration: TRANSITION_MS / 2,
          onComplete: () => {
            this.busy = false
          },
        })
      },
    })
  }

  // The one place that decides what is visible in each phase
  private applyPhase(phase: Phase) {
    this.phase = phase
    const showCustomer = phase !== 'mix'
    this.customer.setVisible(showCustomer)
    this.counterOverlays.forEach((overlay) => overlay.setVisible(showCustomer))
    this.evening.setCounterVisible(showCustomer)
    this.speech.setVisible(showCustomer)
    this.mixBackdrop.forEach((layer) => layer.setVisible(phase === 'mix'))
    this.orderView.setVisible(phase === 'order')
    this.reactView.setVisible(phase === 'react')
    if (phase === 'mix') this.mixView.show(this.state.order)
    else this.mixView.hide()
  }

  // Entering REACT from MIX: the customer smells (this uses up one smell) and comments
  private enterReact() {
    const { state } = this
    state.useSmell()
    this.speech.setText(hintFor(mixScent(state.drops), state.order.target))
    this.reactView.showChoices()
  }

  private deliver() {
    const { state } = this
    const score = scoreMix(state.drops, state.order)
    state.addStars(score.stars)
    const stars = '★'.repeat(score.stars) + '☆'.repeat(3 - score.stars)
    this.speech.setText(`${stars}\n${REACTIONS[score.stars]}`)
    this.reactView.showNext(state.isLastOrder)
  }

  private next() {
    // Hide the buttons and block clicks so a double click can't advance twice during the fade
    this.busy = true
    this.reactView.hideButtons()
    this.customer.leave(() => {
      if (this.state.isLastOrder) {
        this.scene.start('EndScene', { totalStars: this.state.totalStars })
        return
      }
      this.state.nextCustomer()
      this.startCustomer()
    })
  }

  // Backdrop for the MIX phase: the optional counter_view art if it loaded, otherwise a warm
  // dark veil over the shop background so the UI on top stays readable
  private addMixBackdrop() {
    const { width, height } = this.scale
    if (this.textures.exists('counter_view')) {
      this.mixBackdrop.push(
        this.add.image(width / 2, height / 2, 'counter_view').setDisplaySize(width, height).setDepth(DEPTH.mixBackdrop),
      )
    } else {
      this.mixBackdrop.push(
        this.add.rectangle(width / 2, height / 2, width, height, DIM.color, DIM.alpha).setDepth(DEPTH.mixBackdrop),
      )
    }
  }

  // Image stretched to fill the canvas; if the texture failed to load, a colored rectangle instead
  private addBackground(key: string, fallbackColor: number) {
    const { width, height } = this.scale
    if (this.textures.exists(key)) {
      return this.add.image(width / 2, height / 2, key).setDisplaySize(width, height)
    }
    console.warn(`Texture "${key}" missing, using a colored rectangle`)
    return this.add.rectangle(width / 2, height / 2, width, height, fallbackColor)
  }

  // TEMP: remove before release. N / B flip through all customers in the ORDER phase to check
  // portraits in morning and evening. It only moves orderIndex: totalStars is never touched.
  private addDevSkipKeys() {
    this.devLabel = addPillLabel(this, 91, this.scale.height - 26, 150, 20, '', 12)
    const skip = (step: number) => {
      if (this.phase !== 'order' || this.busy) return
      const { state } = this
      state.orderIndex = (state.orderIndex + step + ORDERS.length) % ORDERS.length
      state.clear()
      state.smellsUsed = 0
      this.startCustomer()
    }
    const next = () => skip(1)
    const previous = () => skip(-1)
    const keyboard = this.input.keyboard
    keyboard?.on('keydown-N', next)
    keyboard?.on('keydown-B', previous)
    // Phaser reuses this scene on restart, so remove the listeners when it shuts down
    this.events.once('shutdown', () => {
      keyboard?.off('keydown-N', next)
      keyboard?.off('keydown-B', previous)
    })
  }
}
