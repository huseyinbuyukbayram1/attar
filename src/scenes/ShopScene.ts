import Phaser from 'phaser'
import { ORDERS } from '../data/customers'
import { SoundManager } from '../game/audio'
import { GameState } from '../game/gameState'
import type { TimeOfDay } from '../game/gameState'
import { DEV_KEYS, devEndingMoney } from '../game/dev'
import { deliveryFor, formatMoney } from '../game/economy'
import type { Delivery } from '../game/economy'
import { hintFor, mixScent, scoreMix } from '../game/scoring'
import type { Stars } from '../game/scoring'
import { CustomerArt } from './ui/CustomerArt'
import { addCounterCrop } from './ui/counterCrop'
import { addCounterDarken } from './ui/counterBand'
import { ContactSheet } from './ui/ContactSheet'
import { DayCard } from './ui/DayCard'
import { EVENING_FADE_MS, EveningOverlay } from './ui/EveningOverlay'
import { MixEvening } from './ui/MixEvening'
import { MixLights } from './ui/MixLights'
import { FINAL_MIX_ENABLED } from './ui/mixAnimation'
import { MixView } from './ui/MixView'
import { OrderView } from './ui/OrderView'
import { ReactView } from './ui/ReactView'
import { SpeechBox } from './ui/SpeechBox'
import { addPlateLabel } from './ui/PlateButton'

export const TRANSITION_MS = 350 // total time of a fade between phases (half out, half in)
// Timing of the pause between customers (the leave, enter and evening times live with their art)
const PAYMENT_COUNT_MS = 400 // each money line (payment, tip) counts up from 0 in this time
const PAUSE_MS = 300 // a beat of empty shop before the next customer walks in
const SPEECH_FADE_MS = 250 // the speech box fades in once the customer has arrived
const BUTTON_FADE_MS = 250 // then the "Make perfume" button
const COUNTER_TOP_Y = 578 // in canvas pixels: the counter's top edge; everything from here down is drawn in front of the customer
// TEMP: remove before release (also the marked code in create() and showCustomerAtOnce())
const DEV_SKIP_KEYS = DEV_KEYS // N = next customer, B = previous (no scoring), G = contact sheet, E = evening in it

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
  mixCounterDarken: -45, // darkens the light-orange counter top; above the picture, below the evening look
  mixEvening: -40, // evening look over the mix backdrop, behind the bottles and flask
  mixLights: -30, // lantern and bulb glows, above the evening look
}
const MIX_FALLBACK_COLOR = 0x2a1a10 // plain warm brown if counter_view.jpg is missing
const FADE_COLOR = 0x1a1210
const FADE_DEPTH = 1000 // above everything, so the transition covers the whole screen

// Small always-on labels in the top corners (16 px from the canvas edges)
const HUD = { x: 1144, y: 38, width: 240, height: 44 } // one line: money / debt

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
  private mixEvening!: MixEvening
  private mixLights!: MixLights
  private sounds!: SoundManager
  private reactView!: ReactView
  private hud!: Phaser.GameObjects.Text
  private dayCard!: DayCard
  private fade!: Phaser.GameObjects.Rectangle
  private phase: Phase = 'order'
  private pausing = false // the pause menu is open (or opening)
  private payTween?: Phaser.Tweens.Tween // the counting of the payment lines
  private finishPayment: () => void = () => {} // shows the final lines and the HUD at once (when Next is pressed early)
  private leavingToEnding = false
  private devLabel?: Phaser.GameObjects.Text // TEMP: remove before release
  private sheet?: ContactSheet // TEMP: remove before release

  constructor() {
    super('ShopScene')
  }

  create() {
    this.state = new GameState()
    this.busy = false
    this.pausing = false
    this.leavingToEnding = false
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
    this.mixEvening = new MixEvening(this, 'counter_view', DEPTH.mixEvening)
    this.mixLights = new MixLights(this, DEPTH.mixLights)

    this.hud = addPlateLabel(this, HUD.x, HUD.y, HUD.width, HUD.height, '', 18)

    this.speech = new SpeechBox(this)
    this.orderView = new OrderView(this, () => {
      if (!this.busy) this.sounds.play('click')
      this.goTo('mix')
    })
    // Esc pauses the game. This handler is added BEFORE the views (the notebook has its own Esc
    // handler): it runs first, and leaves Esc to an open notebook.
    const onEsc = () => {
      if (!this.mixView.isNotebookOpen()) this.openPause()
    }
    this.input.keyboard?.on('keydown-ESC', onEsc)
    const onResume = () => (this.pausing = false)
    this.events.on('resume', onResume)
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-ESC', onEsc)
      this.events.off('resume', onResume)
    })
    this.mixView = new MixView(this, this.state, {
      onSmell: () => this.goTo('react', () => this.enterReact()),
      // Out of smells: deliver straight from the counter, into the same result view
      onDeliver: () => this.goTo('react', () => this.deliver()),
      onSound: (event) => this.sounds.play(event),
      isSceneBusy: () => this.busy,
    })
    this.reactView = new ReactView(this, {
      onAdjust: () => {
        if (!this.busy) this.sounds.play('click')
        this.goTo('mix')
      },
      onDeliver: () => this.deliverFromReact(),
      onNext: () => this.next(),
    })

    this.fade = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, FADE_COLOR)
      .setAlpha(0)
      .setDepth(FADE_DEPTH)

    this.dayCard = new DayCard(this)

    // Sound: ambience starts after the first click (the browser decides when sound is allowed)
    this.sounds = new SoundManager(this)
    this.sounds.startAmbience(this.state.timeOfDay)
    this.events.once('shutdown', () => this.sounds.destroy())

    // TEMP: remove before release
    if (DEV_SKIP_KEYS) this.addDevKeys()

    this.beginCustomer(true)
  }

  // The state decides the time of day; the overlay plays the 1500 ms crossfade, or jumps when
  // `instant` (a card covers the screen). The ambience sound follows the same light.
  setTimeOfDay(time: TimeOfDay, instant = false) {
    this.evening.setTime(time, instant)
    this.customer.setTint(time === 'evening' ? EVENING_CUSTOMER_TINT : null, instant)
    this.sounds.setTime(time, instant)
  }

  // Brings in the customer now in the state, as one sequence with clicks blocked until it ends.
  // The evening crossfade and a customer's entrance never overlap: the shop changes while it is
  // empty, then a pause, then the customer walks in, then the speech box, then the button.
  //  - first customer of a day: "Day X" card, the shop switches to morning under it
  //  - second customer: the shop crossfades to evening
  private beginCustomer(firstOfGame = false) {
    this.busy = true
    if (this.state.customerOfDay === 1) {
      this.dayCard.show(
        this.state.day,
        () => this.prepareCustomer(true),
        () => this.time.delayedCall(PAUSE_MS, () => this.enterCustomer()),
        firstOfGame,
      )
    } else {
      this.prepareCustomer(false)
      this.time.delayedCall(EVENING_FADE_MS + PAUSE_MS, () => this.enterCustomer())
    }
  }

  private updateHud() {
    const { state } = this
    this.hud.setText(`${formatMoney(state.money)} / ${formatMoney(state.debt)}`)
  }

  // Resets the screen for the customer in the state, without showing the customer yet: the
  // light changes, the ORDER phase is set up, and the speech box and button are invisible.
  private prepareCustomer(instantLight: boolean) {
    const { state } = this
    this.setTimeOfDay(state.timeOfDay, instantLight)
    this.updateHud()
    this.speech.setSpeaker(state.order.customerName)
    this.speech.setText(state.order.orderText)
    this.devLabel?.setText(`dev: ${state.order.id}`) // TEMP: remove before release
    this.mixView.resetStirred()
    this.applyPhase('order')
    this.speech.setAlpha(0)
    this.orderView.setAlpha(0)
  }

  // The customer walks in; when they have arrived the speech box fades in, then the button
  private enterCustomer() {
    this.customer.show(this.state.order, () =>
      this.speech.fadeIn(SPEECH_FADE_MS, () =>
        this.orderView.fadeIn(BUTTON_FADE_MS, () => {
          this.busy = false
        }),
      ),
    )
  }

  // TEMP: remove before release. Dev keys show a customer at once, with no sequence.
  private showCustomerAtOnce() {
    this.prepareCustomer(true)
    this.speech.setAlpha(1)
    this.orderView.setAlpha(1)
    this.customer.show(this.state.order)
  }

  // Fade to dark, switch what is visible, fade back in. onSwitch runs at the dark moment,
  // right after the switch, so text and buttons change without being seen.
  private goTo(phase: Phase, onSwitch?: () => void) {
    if (this.busy) return
    this.busy = true
    this.fadeSwitch(phase, onSwitch, () => {
      this.busy = false
    })
  }

  // The fade itself; the caller owns the `busy` flag, so several steps can be chained
  private fadeSwitch(phase: Phase, onSwitch: (() => void) | undefined, onDone: () => void) {
    this.tweens.add({
      targets: this.fade,
      alpha: 1,
      duration: TRANSITION_MS / 2,
      onComplete: () => {
        this.applyPhase(phase)
        onSwitch?.()
        this.tweens.add({ targets: this.fade, alpha: 0, duration: TRANSITION_MS / 2, onComplete: onDone })
      },
    })
  }

  // Deliver in the REACT phase: back to the counter for a last stir with the slots as they are,
  // then back to the customer for the result. Clicks are blocked all along.
  private deliverFromReact() {
    if (this.busy) return
    this.sounds.play('click')
    // Same mix as the last stir (or the final stir is off): score at once
    if (!FINAL_MIX_ENABLED || this.mixView.isStirred()) {
      this.deliver()
      return
    }
    this.busy = true
    this.reactView.hideButtons()
    this.fadeSwitch('mix', undefined, () =>
      this.mixView.stir(() =>
        this.fadeSwitch('react', () => this.deliver(), () => {
          this.busy = false
        }),
      ),
    )
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
    if (phase === 'mix') {
      const evening = this.state.timeOfDay === 'evening'
      this.mixView.show(this.state.order, evening)
      this.mixEvening.show(evening)
      this.mixLights.show(evening)
    } else {
      this.mixView.hide()
      this.mixEvening.hide()
      this.mixLights.hide()
    }
  }

  // Entering REACT from MIX: the customer smells (this uses up one smell) and comments
  private enterReact() {
    const { state } = this
    this.sounds.play('smell')
    state.useSmell()
    const hint = hintFor(mixScent(state.drops), state.order.target)
    this.speech.setText(hint)
    this.mixView.setHint(hint) // so the counter screen can show it too
    this.reactView.showChoices()
  }

  private deliver() {
    const { state } = this
    const score = scoreMix(state.drops, state.order)
    const delivery = deliveryFor(score.stars)
    state.addStars(score.stars)
    state.addMoney(delivery.payment + delivery.tip)
    this.mixView.clearGhosts()
    if (delivery.payment + delivery.tip > 0) this.sounds.play('deliver') // no money, no happy sound
    const stars = '★'.repeat(score.stars) + '☆'.repeat(3 - score.stars)
    this.showPayment(`${stars}\n${REACTIONS[score.stars]}`, delivery)
    this.reactView.showNext(state.isLastOrder)
  }

  // The result text: the stars and the reaction, then the money as separate lines that count up one
  // after the other ("Payment +$200", then "Tip +$100"). The HUD total changes when the counting ends.
  private showPayment(head: string, delivery: Delivery) {
    const text = (payment: number, tip: number | null) => {
      if (delivery.kind === 'refused') return `${head}\nNo sale`
      const haggled = delivery.kind === 'haggled' ? ' (haggled)' : ''
      return `${head}\nPayment +${formatMoney(payment)}${haggled}${tip === null ? '' : `\nTip +${formatMoney(tip)}`}`
    }
    const finish = () => {
      this.speech.setText(text(delivery.payment, delivery.tip > 0 ? delivery.tip : null))
      this.updateHud()
      this.finishPayment = () => {}
    }
    this.finishPayment = () => {
      this.payTween?.stop()
      finish()
    }
    if (delivery.kind === 'refused') {
      finish()
      return
    }
    this.speech.setText(text(0, null))
    this.countUp(delivery.payment, (value) => this.speech.setText(text(value, null)), () => {
      if (delivery.tip === 0) {
        finish()
        return
      }
      this.speech.setText(text(delivery.payment, 0))
      this.countUp(delivery.tip, (value) => this.speech.setText(text(delivery.payment, value)), finish)
    })
  }

  private countUp(to: number, onValue: (value: number) => void, onDone: () => void) {
    this.payTween = this.tweens.addCounter({
      from: 0,
      to,
      duration: PAYMENT_COUNT_MS,
      onUpdate: (tween) => onValue(Math.round(tween.getValue() ?? 0)),
      onComplete: onDone,
    })
  }

  // Esc pauses the whole scene (its tweens, timers and animations stand still) and opens the pause
  // menu on top. Not while a fade, the day card or the end of the game is going on.
  private openPause() {
    const covered = this.fade.alpha > 0.01 || this.dayCard.isOpen() || this.leavingToEnding
    if (this.pausing || covered) return
    this.pausing = true
    this.scene.launch('PauseScene', { from: 'ShopScene' })
    this.scene.pause()
  }

  private next() {
    this.finishPayment() // if the money is still counting up, show it at once
    // Hide the buttons and block clicks so a double click can't advance twice during the fade
    this.busy = true
    this.sounds.play('click')
    this.reactView.hideButtons()
    this.speech.setVisible(false) // the result text goes away as the customer leaves
    this.customer.leave(() => {
      if (this.state.isLastOrder) {
        this.leavingToEnding = true
        this.scene.start('EndingScene', { money: this.state.money })
        return
      }
      this.state.nextCustomer()
      this.beginCustomer()
    })
  }

  // Backdrop for the MIX phase: the counter_view picture, full screen. If it failed to load,
  // a plain brown rectangle, so the cream UI on top stays readable.
  private addMixBackdrop() {
    const { width, height } = this.scale
    if (this.textures.exists('counter_view')) {
      this.mixBackdrop.push(
        this.add.image(width / 2, height / 2, 'counter_view').setDisplaySize(width, height).setDepth(DEPTH.mixBackdrop),
        addCounterDarken(this).setDepth(DEPTH.mixCounterDarken),
      )
    } else {
      console.warn('Texture "counter_view" missing, using a colored rectangle')
      this.mixBackdrop.push(
        this.add.rectangle(width / 2, height / 2, width, height, MIX_FALLBACK_COLOR).setDepth(DEPTH.mixBackdrop),
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
  // portraits in morning and evening. It only moves orderIndex: money and stars are never touched.
  // G opens a contact sheet of all ten customers, E toggles evening in it.
  // All of it is ignored while a phase transition runs.
  private addDevKeys() {
    // Plain small text in the bottom-left corner, clear of the buttons
    this.devLabel = this.add.text(16, 700, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#f6e7c1',
      stroke: '#1a1210',
      strokeThickness: 3,
    })
    this.sheet = new ContactSheet(this, {
      backgroundKey: 'shop_morning',
      counterTopY: COUNTER_TOP_Y,
      eveningCustomerTint: EVENING_CUSTOMER_TINT,
    })
    const skip = (step: number) => {
      if (this.phase !== 'order' || this.busy || this.sheet?.isOpen) return
      const { state } = this
      state.orderIndex = (state.orderIndex + step + ORDERS.length) % ORDERS.length
      state.clear()
      state.smellsUsed = 0
      this.showCustomerAtOnce()
    }
    const next = () => skip(1)
    const previous = () => skip(-1)
    const toggleSheet = () => {
      if (!this.busy) this.sheet?.toggle()
    }
    const toggleEvening = () => {
      if (!this.busy) this.sheet?.toggleEvening()
    }
    // 1 / 2 / 3: jump to the lose / win / great win ending (the money is made up, see game/dev.ts)
    const endWith = (money: number) => () => {
      if (this.leavingToEnding) return
      this.leavingToEnding = true
      this.scene.start('EndingScene', { money })
    }
    const loseEnding = endWith(devEndingMoney('lose', this.state.debt, this.state.greatWin))
    const winEnding = endWith(devEndingMoney('win', this.state.debt, this.state.greatWin))
    const greatEnding = endWith(devEndingMoney('great', this.state.debt, this.state.greatWin))
    const keyboard = this.input.keyboard
    keyboard?.on('keydown-ONE', loseEnding)
    keyboard?.on('keydown-TWO', winEnding)
    keyboard?.on('keydown-THREE', greatEnding)
    keyboard?.on('keydown-N', next)
    keyboard?.on('keydown-B', previous)
    keyboard?.on('keydown-G', toggleSheet)
    keyboard?.on('keydown-E', toggleEvening)
    // Phaser reuses this scene on restart, so remove the listeners when it shuts down
    this.events.once('shutdown', () => {
      keyboard?.off('keydown-ONE', loseEnding)
      keyboard?.off('keydown-TWO', winEnding)
      keyboard?.off('keydown-THREE', greatEnding)
      keyboard?.off('keydown-N', next)
      keyboard?.off('keydown-B', previous)
      keyboard?.off('keydown-G', toggleSheet)
      keyboard?.off('keydown-E', toggleEvening)
    })
  }
}
