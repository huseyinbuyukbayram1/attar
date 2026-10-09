import Phaser from 'phaser'
import { ORDERS } from '../data/customers'
import { DAY_ONE_CARD, PRACTICE_GOODBYE, PRACTICE_INTRO } from '../game/story'
import { SoundManager } from '../game/audio'
import { GameState } from '../game/gameState'
import type { TimeOfDay } from '../game/gameState'
import { DEV_KEYS, devEndingMoney } from '../game/dev'
import { shouldShowTutorial } from '../game/tutorial'
import { deliveryFor, formatCoins } from '../game/economy'
import type { Delivery } from '../game/economy'
import { hintCategory, pickReply, starsCategory } from '../game/playerLines'
import { hintFor, mixScent, scoreMix } from '../game/scoring'
import { liquidColor } from './ui/liquidColor'
import type { Stars } from '../game/scoring'
import { CashBox } from './ui/CashBox'
import { CoinAmount } from './ui/CoinAmount'
import { CustomerArt } from './ui/CustomerArt'
import { DeliveryAnimation } from './ui/DeliveryAnimation'
import { addCounterCrop } from './ui/counterCrop'
import { addCounterDarken } from './ui/counterBand'
import { ContactSheet } from './ui/ContactSheet'
import { DayCard } from './ui/DayCard'
import { EveningOverlay } from './ui/EveningOverlay'
import { MixEvening } from './ui/MixEvening'
import { MixLights } from './ui/MixLights'
import { FINAL_MIX_ENABLED } from './ui/mixAnimation'
import { MixView } from './ui/MixView'
import { OrderView } from './ui/OrderView'
import { PlayerReply } from './ui/PlayerReply'
import { ReactView } from './ui/ReactView'
import { Tutorial } from './ui/Tutorial'
import { SpeechBox } from './ui/SpeechBox'
import { addPlateLabel } from './ui/PlateButton'

export const TRANSITION_MS = 350 // total time of a fade between phases (half out, half in)
// Timing of the pause between customers (the leave, enter and evening times live with their art)
const PAYMENT_COUNT_MS = 400 // each money line (payment, tip) counts up from 0 in this time
const PAUSE_MS = 300 // a beat of empty shop before the next customer walks in
const SPEECH_FADE_MS = 250 // the speech box fades in once the customer has arrived
const REPLY_DELAY_MS = 400 // the player answers a moment after the customer's hint or the result line
const SPEEDUP_DELAY_MS = 300 // after Deliver, clicks do not speed up the delivery for this long
const BUTTON_FADE_MS = 250 // then the "Make perfume" button
const COIN_FALLBACK_VOLUME = 0.5 // without a coin sound the click plays, this much quieter
const COIN_RATE = { min: 0.95, max: 1.08 } // every coin sound is a little higher or lower
// The walk between the counter and the customer: a fade to dark, the footsteps (only the first part of the file, fading
// out at the end), and a fade back. A click skips the rest of it.
const FOOTSTEPS_SEEK = 1.1 // seconds: footsteps.mp3 begins with 1.13 s of silence (measured), the first step is right after
const FOOTSTEPS_DURATION_MS = 1500 // the way back to the customer
const FOOTSTEPS_SHORT_DURATION_MS = 700 // the way to the counter: shorter
type Walk = { fadeMs: number; durationMs: number; fadeOutMs: number } // fadeMs: to dark, and the same back; fadeOutMs: the sound at its end
const WALK_TO_CUSTOMER: Walk = { fadeMs: 250, durationMs: FOOTSTEPS_DURATION_MS, fadeOutMs: 300 }
const WALK_TO_COUNTER: Walk = { fadeMs: 150, durationMs: FOOTSTEPS_SHORT_DURATION_MS, fadeOutMs: 200 }
const PRACTICE_FADE_MS = 500 // the shop fades in from dark when the practice starts, and out when it is skipped
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
const HUD = { x: 1144, y: 38, width: 240, height: 44, fontSize: 18, color: '#3b2412' } // one line: [coin] money / debt

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
  private playerReply!: PlayerReply
  private hud!: CoinAmount
  private dayCard!: DayCard
  private cashBox!: CashBox
  private deliveryAnimation!: DeliveryAnimation
  private delivering = false // the delivery animation is playing
  private fade!: Phaser.GameObjects.Rectangle
  private phase: Phase = 'order'
  private pausing = false // the pause menu is open (or opening)
  private tutorial?: Tutorial // the practice customer's tutorial, if it is to be shown
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
    // The tutorial is a practice customer before Day 1 (see game/tutorial.ts for when it runs)
    const practice = shouldShowTutorial()
    if (practice) this.state.startPractice()
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
    this.cashBox = new CashBox(this) // on the counter in the ORDER and REACT screens
    this.cashBox.setMoney(this.state.money, this.state.debt) // a new run starts with an empty box
    this.deliveryAnimation = new DeliveryAnimation(this, this.cashBox)
    this.delivering = false
    this.evening = new EveningOverlay(
      this,
      'shop_morning',
      { behind: DEPTH.eveningBehind, counter: DEPTH.eveningCounter },
      COUNTER_TOP_Y,
    )
    this.addMixBackdrop()
    this.mixEvening = new MixEvening(this, 'counter_view', DEPTH.mixEvening)
    this.mixLights = new MixLights(this, DEPTH.mixLights)

    addPlateLabel(this, HUD.x, HUD.y, HUD.width, HUD.height, '', 18) // the plate; the numbers are drawn over it
    this.hud = new CoinAmount(this, HUD.x, HUD.y, { fontSize: HUD.fontSize, color: HUD.color })

    this.speech = new SpeechBox(this)
    this.orderView = new OrderView(this, () => {
      if (!this.busy) {
        this.sounds.play('click')
        this.tutorial?.notify({ type: 'makePerfume' })
      }
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
      // Nothing of the REACT screen starts until the screen has faded back in: the hint, the smell sound and the buttons come then
      onSmell: () => this.goTo('react', () => this.prepareReact(), () => this.enterReact()),
      // Out of smells: deliver straight from the counter, into the same result view
      onDeliver: () => this.goTo('react', () => this.reactView.hideButtons(), () => this.deliver()), // the delivery starts when the screen is back
      onSound: (event) => this.sounds.play(event),
      isSceneBusy: () => this.busy || (this.tutorial?.blocksNotebook() ?? false), // the tutorial lets the notebook open only in its notebook step
      onTutorial: (event) => this.tutorial?.notify(event),
    })
    this.reactView = new ReactView(this, {
      onAdjust: () => {
        if (!this.busy) {
          this.sounds.play('click')
          this.tutorial?.notify({ type: 'adjust' })
        }
        this.goTo('mix')
      },
      onDeliver: () => {
        if (!this.busy) this.tutorial?.notify({ type: 'deliver' })
        this.deliverFromReact()
      },
      onNext: () => this.next(),
    })

    this.playerReply = new PlayerReply(this)

    // It asks the views where things are
    this.tutorial = practice
      ? new Tutorial(this, {
          speechBubble: () => this.speech.bounds(),
          makePerfume: () => this.orderView.buttonBounds(),
          notebook: () => this.mixView.notebookBounds(),
          bottle: (id) => this.mixView.bottleBounds(id),
          smellButton: () => this.mixView.smellBounds(),
          adjustButton: () => this.reactView.adjustBounds(),
          deliverButton: () => this.reactView.deliverBounds(),
        }, () => this.skipPractice())
      : undefined

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

    if (practice) this.beginPractice()
    else this.beginCustomer(true)
  }

  // The state decides the time of day; the overlay plays the 1500 ms crossfade, or jumps when
  // `instant` (a card covers the screen). The ambience sound follows the same light.
  setTimeOfDay(time: TimeOfDay, instant = false) {
    this.evening.setTime(time, instant)
    this.customer.setTint(time === 'evening' ? EVENING_CUSTOMER_TINT : null, instant)
    this.cashBox.setEvening(time === 'evening', instant)
    this.sounds.setTime(time, instant)
  }

  // The practice customer: no "Day" card. The shop fades in from dark, Sabiha walks in and greets
  // the player, then says what she wants and the tutorial starts.
  private beginPractice() {
    this.busy = true
    this.fade.setAlpha(1)
    this.tweens.add({ targets: this.fade, alpha: 0, duration: PRACTICE_FADE_MS })
    this.prepareCustomer(true)
    this.speech.setText(PRACTICE_INTRO)
    this.enterCustomer()
  }

  // Types Sabiha's greeting and waits for the player: a click or Space finishes the typing first, the next one calls onNext
  private waitForGreeting(onNext: () => void) {
    const { width, height } = this.scale
    const click = this.add.zone(width / 2, height / 2, width, height).setInteractive().setDepth(FADE_DEPTH - 1) // swallows clicks, below the fade
    const keyboard = this.input.keyboard
    const advance = () => {
      if (this.speech.isTyping()) {
        this.speech.finishTyping()
        return
      }
      click.destroy()
      keyboard?.off('keydown-SPACE', advance)
      onNext()
    }
    click.on('pointerdown', advance)
    keyboard?.on('keydown-SPACE', advance)
    this.events.once('shutdown', () => keyboard?.off('keydown-SPACE', advance))
    this.speech.typeText(PRACTICE_INTRO, () => {})
  }

  // "Skip tutorial": straight to Day 1. The tutorial has saved its flag, so restarting the scene starts the real game.
  private skipPractice() {
    this.busy = true
    this.tweens.add({ targets: this.fade, alpha: 1, duration: PRACTICE_FADE_MS, onComplete: () => this.scene.restart() })
  }

  // Brings in the customer now in the state, as one sequence with clicks blocked until it ends.
  // The evening crossfade and a customer's entrance never overlap: the shop changes while it is
  // empty, then a pause, then the customer walks in, then the speech box, then the button.
  //  - first customer of a day: "Day X" card, the shop switches to morning under it
  //  - second customer: the shop crossfades to evening
  private beginCustomer(firstOfGame = false, cardTitle?: string) {
    this.busy = true
    if (this.state.customerOfDay === 1) {
      this.dayCard.show(
        this.state.day,
        () => this.prepareCustomer(true),
        () => {
          this.tutorial?.showToast() // after the practice: the last tip (nothing for a game without the tutorial)
          this.time.delayedCall(PAUSE_MS, () => this.enterCustomer())
        },
        firstOfGame,
        cardTitle,
      )
    } else {
      // The second customer of the day: the player walks over, the shop changes to evening in the dark
      this.walkTransition(
        WALK_TO_CUSTOMER,
        () => this.prepareCustomer(true),
        () => this.time.delayedCall(PAUSE_MS, () => this.enterCustomer()),
      )
    }
  }

  private updateHud() {
    this.showHudMoney(this.state.money)
  }

  private showHudMoney(money: number) {
    this.hud.setAmount(`${formatCoins(money)} / ${formatCoins(this.state.debt)}`)
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
    const showButton = () =>
      this.orderView.fadeIn(BUTTON_FADE_MS, () => {
        this.busy = false
        this.tutorial?.sync('order') // the practice customer is in: the tutorial can start
      })
    this.customer.show(this.state.order, () =>
      this.speech.fadeIn(SPEECH_FADE_MS, () => {
        if (!this.state.practice) {
          showButton()
          return
        }
        // Sabiha greets first, typed out like the story; a click or Space (no timer) moves on to her order
        this.waitForGreeting(() => {
          this.speech.setText(this.state.order.orderText)
          showButton()
        })
      }),
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
  private goTo(phase: Phase, onSwitch?: () => void, afterIn?: () => void) {
    if (this.busy) return
    this.busy = true
    this.tutorial?.suspend() // the tutorial waits out the fade
    const done = () => {
      this.busy = false
      afterIn?.() // the next phase starts only now, with the screen fully back
      this.tutorial?.sync(phase)
    }
    // Between the counter and the customer the player walks: footsteps, the dark stays while they go on
    // (and a shorter one on the way to the counter)
    const walk = this.phase === 'mix' && phase === 'react' ? WALK_TO_CUSTOMER : phase === 'mix' ? WALK_TO_COUNTER : undefined
    if (walk) {
      this.walkTransition(walk, () => {
        this.applyPhase(phase)
        onSwitch?.()
      }, done)
    } else {
      this.fadeSwitch(phase, onSwitch, done)
    }
  }

  // Fade to dark, the footsteps, fade back. onDark runs while the screen is dark (change what is visible there, nothing more),
  // onDone only when it is fully bright again: that is when the next phase may start sounds, animations and text. The
  // footsteps start with the fade. A click skips straight to the end: bright at once, then onDone.
  private walkTransition(walk: Walk, onDark: () => void, onDone: () => void) {
    const { width, height } = this.scale
    const clicks = this.add.zone(width / 2, height / 2, width, height).setInteractive().setDepth(FADE_DEPTH - 1)
    const stopSteps = this.sounds.playFor('footsteps', walk.durationMs, walk.fadeOutMs, FOOTSTEPS_SEEK)
    let finished = false
    let dark = false
    let hold: Phaser.Time.TimerEvent | undefined
    const goDark = () => {
      if (dark) return
      dark = true
      onDark()
    }
    const finish = () => {
      if (finished) return
      finished = true
      hold?.remove()
      this.tweens.killTweensOf(this.fade)
      this.fade.setAlpha(0)
      clicks.destroy()
      onDone()
    }
    clicks.on('pointerdown', () => {
      if (finished) return
      stopSteps()
      goDark() // the change still has to happen (it is just not seen)
      finish()
    })
    this.tweens.add({
      targets: this.fade,
      alpha: 1,
      duration: walk.fadeMs,
      onComplete: () => {
        goDark()
        hold = this.time.delayedCall(walk.durationMs - 2 * walk.fadeMs, () => { // dark, while the footsteps go on
          this.tweens.add({ targets: this.fade, alpha: 0, duration: walk.fadeMs, onComplete: finish })
        })
      },
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
    if (this.busy || this.delivering) return
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
    this.cashBox.setVisible(showCustomer)
    this.evening.setCounterVisible(showCustomer)
    this.speech.setVisible(showCustomer)
    this.mixBackdrop.forEach((layer) => layer.setVisible(phase === 'mix'))
    this.orderView.setVisible(phase === 'order')
    this.reactView.setVisible(phase === 'react')
    if (phase !== 'react') this.playerReply.hide(true) // the player only talks on the REACT screen
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

  // The REACT screen, still in the dark: only what is visible changes. No text, no buttons, no sound yet.
  private prepareReact() {
    this.speech.setAlpha(0)
    this.reactView.hideButtons()
  }

  // Entering REACT from MIX, once the screen is back: the customer smells (this uses up one smell) and comments
  private enterReact() {
    const { state } = this
    this.sounds.play('smell')
    state.useSmell()
    const hint = hintFor(mixScent(state.drops), state.order.target)
    this.speech.setText(hint)
    this.speech.fadeIn(SPEECH_FADE_MS, () => {
      const reply = pickReply(hintCategory(hint))
      this.playerReply.show(reply.expression, reply.text, REPLY_DELAY_MS)
    })
    this.mixView.setHint(hint) // so the counter screen can show it too
    this.reactView.showChoices()
  }

  // Deliver: the game decides at once (stars and money in the state), and the animation shows it: the gift
  // bottle is filled and handed over, then the result lines play and the payment flies into the cash box as
  // coins (DeliveryAnimation). The Next button comes when it is over. The practice customer pays nothing.
  private deliver() {
    const { state } = this
    const score = scoreMix(state.drops, state.order)
    const stars = '★'.repeat(score.stars) + '☆'.repeat(3 - score.stars)
    const practice = state.practice
    const delivery = deliveryFor(score.stars)
    const payout = practice ? 0 : delivery.payment + delivery.tip
    const moneyBefore = state.money // the HUD keeps this until the coins land
    if (!practice) {
      state.addStars(score.stars)
      state.addMoney(payout)
    }
    this.mixView.clearGhosts()
    this.reactView.hideButtons()
    this.playerReply.hide() // the smell comment goes; the player answers the result below
    this.delivering = true
    // While it plays, a click anywhere runs the rest faster (the zone also keeps clicks from reaching anything else)
    const { width, height } = this.scale
    const clicks = this.add.zone(width / 2, height / 2, width, height).setInteractive().setDepth(FADE_DEPTH - 1)
    const speedUpFrom = this.time.now + SPEEDUP_DELAY_MS // the second click of a double click on Deliver must not count
    clicks.on('pointerdown', () => {
      if (this.time.now >= speedUpFrom) this.deliveryAnimation.speedUp()
    })
    this.deliveryAnimation.play({
      color: liquidColor(state.drops),
      evening: state.timeOfDay === 'evening',
      refused: !practice && delivery.kind === 'refused',
      payout,
      onPour: () => this.sounds.play('pour'),
      onCoinSound: () => (this.sounds.has('coin') ? this.sounds.play('coin', 1, Phaser.Math.FloatBetween(COIN_RATE.min, COIN_RATE.max)) : this.sounds.play('click', COIN_FALLBACK_VOLUME)),
      onResult: () => {
        if (practice) {
          this.sounds.play('deliver')
          this.speech.setText(`${stars}\n${PRACTICE_GOODBYE}`)
          const reply = pickReply('practiceDone')
          this.playerReply.show(reply.expression, reply.text, REPLY_DELAY_MS)
          return
        }
        if (payout > 0) this.sounds.play('deliver') // no money, no happy sound
        this.showPayment(`${stars}\n${REACTIONS[score.stars]}`, delivery)
        const reply = pickReply(starsCategory(score.stars))
        this.playerReply.show(reply.expression, reply.text, REPLY_DELAY_MS)
      },
      onCoin: (landed, total) => {
        this.showHudMoney(moneyBefore + Math.round((payout * landed) / total))
        if (landed === total) this.cashBox.setMoney(state.money, state.debt) // the pile grows when the last coin has landed
      },
      onDone: () => {
        clicks.destroy()
        this.delivering = false
        this.updateHud() // the exact total, whatever the coins showed
        this.reactView.showNext(practice ? 'Open the shop' : state.isLastOrder ? 'See results' : 'Next customer')
      },
    })
  }

  // The result text: the stars and the reaction, then the money as separate lines that count up one
  // after the other ("+2 [coin]", then "+1 [coin] tip"). The HUD total follows the coins (see deliver).
  private showPayment(head: string, delivery: Delivery) {
    // The result line carries the coin picture (see SpeechBox.setResult); "No sale" is an italic note
    const show = (payment: number, tip: number | null) => {
      if (delivery.kind === 'refused') {
        this.speech.setResult(head, { note: 'No sale' })
        return
      }
      const haggled = delivery.kind === 'haggled'
      this.speech.setResult(head, { groups: [{ amount: payment, suffix: haggled ? '(haggled)' : undefined }, ...(tip === null ? [] : [{ amount: tip, suffix: 'tip' }])] })
    }
    const finish = () => {
      show(delivery.payment, delivery.tip > 0 ? delivery.tip : null)
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
    show(0, null)
    this.countUp(delivery.payment, (value) => show(value, null), () => {
      if (delivery.tip === 0) {
        finish()
        return
      }
      show(delivery.payment, 0)
      this.countUp(delivery.tip, (value) => show(delivery.payment, value), finish)
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
    if (this.delivering) return
    this.finishPayment() // if the money is still counting up, show it at once
    // Hide the buttons and block clicks so a double click can't advance twice during the fade
    this.busy = true
    this.sounds.play('click')
    this.reactView.hideButtons()
    this.playerReply.hide()
    this.speech.setVisible(false) // the result text goes away as the customer leaves
    this.customer.leave(() => {
      if (this.state.practice) {
        this.state.endPractice() // the first real customer is next, at Day 1
        this.beginCustomer(false, DAY_ONE_CARD)
        return
      }
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
      if (this.phase !== 'order' || this.busy || this.sheet?.isOpen || this.state.practice) return
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
