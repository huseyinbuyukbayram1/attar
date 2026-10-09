import Phaser from 'phaser'
import { CashBox } from './CashBox'
import { GIFT_BOTTLE_KEY, GiftBottle } from './GiftBottle'

// ---- The delivery animation: tuning constants (canvas px, ms) ----
const START_DELAY_MS = 150 // a beat after the screen has come back from the fade
const COIN_KEY = 'coin'
const COIN = { width: 30, depth: -54, fallbackRadius: 10, fallbackColor: 0xe0b040 }
// The coins appear near the customer's hands (over the counter, a little right of the middle)
const COIN_START = { x: 690, y: 548, spread: 28 }
const COIN_FLIGHT = { ms: 520, arc: 90, spin: { min: 0.6, max: 2 }, shrinkFrom: 0.75, landSpread: 8 } // arc: how high above the straight line it flies; spin in radians
const COIN_STAGGER_MS = 90
const REFUSED_BEAT_MS = 500 // a refused delivery has no animation: the result is shown this long before it is over
const FAST = 4 // a click anywhere runs the rest of the animation this much faster

export type DeliveryOptions = {
  color: number // the liquid: the colour of the mix
  evening: boolean
  refused: boolean // 0 stars: no sale, so no bottle and no coins, only the result
  payout: number // payment + tip in gold coins: one flying coin for each (0 = none)
  onPour: () => void // the pour sound
  onCoinSound: () => void
  onResult: () => void // the bottle is gone: the stars and the payment lines can start
  onCoin: (landed: number, total: number) => void // a coin has landed in the box
  onDone: () => void // everything is over
}

// One coin sprite for every gold coin earned (3 stars = 3 coins)
export const coinsFor = (payout: number) => Math.max(0, Math.round(payout))

// The delivery as a picture: the gift bottle is filled, sealed and handed over, then the payment flies into
// the cash box as coins. It only shows what the game already decided: nothing here changes the state. Everything
// runs on the scene's tweens and timers, so a pause stops it too.
export class DeliveryAnimation {
  private scene: Phaser.Scene
  private cashBox: CashBox
  private bottle?: GiftBottle
  private playing = false
  private fast = false
  private coins: Phaser.GameObjects.GameObject[] = []

  constructor(scene: Phaser.Scene, cashBox: CashBox) {
    this.scene = scene
    this.cashBox = cashBox
    if (scene.textures.exists(GIFT_BOTTLE_KEY)) this.bottle = new GiftBottle(scene)
    scene.events.once('shutdown', () => this.setSpeed(false))
  }

  isPlaying(): boolean {
    return this.playing
  }

  play(o: DeliveryOptions) {
    this.playing = true
    this.coins = []
    const coinCount = coinsFor(o.payout)
    const finish = () => {
      this.playing = false
      this.setSpeed(false)
      o.onDone()
    }
    const afterBottle = () => {
      o.onResult()
      if (coinCount === 0 && o.refused) this.scene.time.delayedCall(REFUSED_BEAT_MS, finish) // a refused result stays a moment before Next
      else if (coinCount === 0) finish()
      else this.flyCoins(coinCount, o, finish)
    }
    const { bottle } = this
    if (o.refused || !bottle) {
      afterBottle() // a refused delivery, or no picture of the bottle: the bottle part is left out
      return
    }
    this.scene.time.delayedCall(START_DELAY_MS, () => {
      bottle.prepare(o.color, o.evening)
      bottle.pop(() => {
        o.onPour()
        bottle.fill(() => bottle.seal(() => bottle.handOver(afterBottle)))
      })
    })
  }

  // A click anywhere: the rest runs faster (tweens and timers of the scene)
  speedUp() {
    if (this.playing) this.setSpeed(true)
  }

  private setSpeed(fast: boolean) {
    if (this.fast === fast) return
    this.fast = fast
    this.scene.tweens.timeScale = fast ? FAST : 1
    this.scene.time.timeScale = fast ? FAST : 1
  }

  // `count` coins, one after the other, each flying in an arc from the customer's hands into the box
  private flyCoins(count: number, o: DeliveryOptions, onAllLanded: () => void) {
    let landed = 0
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * COIN_STAGGER_MS, () =>
        this.flyCoin(() => {
          landed++
          o.onCoinSound()
          this.cashBox.bounce()
          o.onCoin(landed, count)
          if (landed === count) onAllLanded()
        }),
      )
    }
  }

  private flyCoin(onLanded: () => void) {
    const { scene } = this
    const from = { x: COIN_START.x + Phaser.Math.Between(-COIN_START.spread, COIN_START.spread), y: COIN_START.y }
    const landing = this.cashBox.landing
    const to = { x: landing.x + Phaser.Math.Between(-COIN_FLIGHT.landSpread, COIN_FLIGHT.landSpread), y: landing.y }
    let coin: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
    let fullScale = 1
    if (scene.textures.exists(COIN_KEY)) {
      const image = scene.add.image(from.x, from.y, COIN_KEY)
      fullScale = COIN.width / image.width
      coin = image.setScale(fullScale)
    } else {
      coin = scene.add.circle(from.x, from.y, COIN.fallbackRadius, COIN.fallbackColor)
    }
    coin.setDepth(COIN.depth)
    this.coins.push(coin)
    const spin = Phaser.Math.FloatBetween(COIN_FLIGHT.spin.min, COIN_FLIGHT.spin.max) * (Math.random() < 0.5 ? -1 : 1)
    const progress = { t: 0 }
    scene.tweens.add({
      targets: progress,
      t: 1,
      duration: COIN_FLIGHT.ms,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const t = progress.t
        coin.setPosition(Phaser.Math.Linear(from.x, to.x, t), Phaser.Math.Linear(from.y, to.y, t) - COIN_FLIGHT.arc * 4 * t * (1 - t))
        coin.setRotation(spin * t)
        // Near the end the coin gets smaller: it drops into the box
        const shrink = t > COIN_FLIGHT.shrinkFrom ? 1 - ((t - COIN_FLIGHT.shrinkFrom) / (1 - COIN_FLIGHT.shrinkFrom)) * 0.5 : 1
        coin.setScale(fullScale * shrink)
      },
      onComplete: () => {
        coin.destroy()
        onLanded()
      },
    })
  }
}
