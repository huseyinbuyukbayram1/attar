import Phaser from 'phaser'
import { lerpColor } from './liquidColor'

// ---- The cash box on the counter: tuning constants (canvas px, ms) ----
export const CASHBOX_KEY = 'cashbox'
const COIN_KEY = 'coin'
// On the counter top on the right, just left of the dropper-bottle tray (x from 1103), clear of the Adjust /
// Deliver buttons (y from 652) and of the customer (x up to 770). x = center, bottom = the line it stands on.
const PLACE = { x: 1030, bottom: 634, width: 110, depth: -55 }
const BOUNCE = { squashX: 1.04, squashY: 0.93, ms: 70 }
const TINT_MS = 1500 // same as the morning/evening crossfade, so the box changes with the room
const NO_TINT = 0xffffff
const EVENING_TINT = 0xffd9b0

// The coin pile inside the box. Numbers in the picture's own pixels (the picture is 240x223), so they stay
// right if PLACE.width changes. The picture is drawn twice: whole, behind the coins, and its FRONT WALL (from
// FRONT_TOP down) again over them, so the pile sits inside the box: only what is above the front rim shows.
const PICTURE = { width: 240, height: 223 }
const FRONT_TOP = 131 // y of the front wall's top edge
const PILE = {
  coinScale: 0.38, // of coin.png (64x44), on the screen
  left: 44, // the inner opening, from x to x
  right: 168,
  bottomRowY: 127, // centre of the lowest row (its lower half is behind the front wall)
  rowStep: 10, // picture px from one row to the next
  rowSizes: [6, 5, 4, 3, 2], // coins in each row from the bottom; the last size repeats (a heap, narrower at the top)
  coinsAtFull: 20, // coins when the level is 1 (money = the target)
  jitter: { x: 6, y: 3, degrees: 28 }, // random offsets and spin, from a fixed seed so the pile is always the same
}
const MAX_LEVEL = 1.2 // the pile stops growing at 120 percent of the target

// How full the pile is: money against the target of the difficulty, 0 to 1.2
export const pileLevel = (money: number, target: number) => Phaser.Math.Clamp(target > 0 ? money / target : 0, 0, MAX_LEVEL)

// A repeatable "random" number from 0 to 1 for coin number `index` (so the pile never reshuffles)
const seeded = (index: number, salt: number) => {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// The open cash box that always stands on the counter in the ORDER and REACT screens. It holds a pile of coins
// that shows how much money this run has (it starts empty with each new game), and catches the coins of a
// payment. It is a part of the shop, so it is tinted with the light like the customer.
export class CashBox {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container // at the box's feet (bottom center): scaling it bounces the box on the counter
  private pile: Phaser.GameObjects.Container
  private frame: Phaser.GameObjects.Image[] = [] // the two copies of the box picture (they take the evening tint; so do the coins)
  private scale = PLACE.width / PICTURE.width // screen px per picture px
  private currentTint = NO_TINT
  private tintProgress = { t: 1 }
  private level = 0
  private hasPicture: boolean

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.hasPicture = scene.textures.exists(CASHBOX_KEY)
    this.root = scene.add.container(PLACE.x, PLACE.bottom).setDepth(PLACE.depth)
    this.pile = scene.add.container(0, 0)
    if (this.hasPicture) {
      const back = scene.add.image(0, 0, CASHBOX_KEY).setOrigin(0.5, 1).setScale(this.scale)
      // The same picture again, cut to the front wall, over the coins
      const front = scene.add.image(0, 0, CASHBOX_KEY).setOrigin(0.5, 1).setScale(this.scale)
      front.setCrop(0, FRONT_TOP, PICTURE.width, PICTURE.height - FRONT_TOP)
      this.root.add([back, this.pile, front])
      this.frame.push(back, front)
    } else {
      this.root.add(this.pile) // no picture, no box: the pile and the coins still work
    }
  }

  // A point of the picture (x, y in picture pixels) as a position inside the root container
  private local(x: number, y: number) {
    return { x: (x - PICTURE.width / 2) * this.scale, y: (y - PICTURE.height) * this.scale }
  }

  // Where a coin lands: on top of the pile (the middle of the opening when it is empty)
  get landing(): { x: number; y: number } {
    const topRow = Math.max(0, this.coinCount(this.level) > 0 ? this.rowOf(this.coinCount(this.level) - 1) : 0)
    const y = PILE.bottomRowY - topRow * PILE.rowStep - 8 // a little above the top row
    const point = this.local((PILE.left + PILE.right) / 2, Math.min(y, FRONT_TOP))
    return { x: PLACE.x + point.x, y: PLACE.bottom + point.y }
  }

  setVisible(visible: boolean) {
    this.root.setVisible(visible)
  }

  // The pile for this much money (money against the target of the difficulty). Used at the start of a game and
  // when the coins of a payment have all landed.
  setMoney(money: number, target: number) {
    this.level = pileLevel(money, target)
    this.buildPile()
  }

  private coinCount(level: number) {
    return Math.round(level * PILE.coinsAtFull)
  }

  // Which row (from the bottom, 0 first) coin number `index` is in
  private rowOf(index: number): number {
    let left = index
    for (let row = 0; ; row++) {
      const size = PILE.rowSizes[Math.min(row, PILE.rowSizes.length - 1)]
      if (left < size) return row
      left -= size
    }
  }

  // Draws the pile again: coin after coin, row after row from the bottom, each row a little narrower
  private buildPile() {
    this.pile.removeAll(true)
    const count = this.coinCount(this.level)
    let row = 0
    let inRow = 0
    for (let i = 0; i < count; i++) {
      const size = PILE.rowSizes[Math.min(row, PILE.rowSizes.length - 1)]
      const width = PILE.right - PILE.left
      const share = (inRow + 0.5) / size // 0..1 along the row, centred
      const p = this.local(
        PILE.left + share * width + (seeded(i, 1) - 0.5) * 2 * PILE.jitter.x,
        PILE.bottomRowY - row * PILE.rowStep + (seeded(i, 2) - 0.5) * 2 * PILE.jitter.y,
      )
      const coin = this.makeCoin(p.x, p.y)
      coin.setRotation(Phaser.Math.DegToRad((seeded(i, 3) - 0.5) * 2 * PILE.jitter.degrees))
      this.pile.add(coin)
      if (this.currentTint !== NO_TINT && coin instanceof Phaser.GameObjects.Image) coin.setTint(this.currentTint)
      inRow++
      if (inRow === size) {
        row++
        inRow = 0
      }
    }
  }

  private makeCoin(x: number, y: number): Phaser.GameObjects.Image | Phaser.GameObjects.Arc {
    if (this.scene.textures.exists(COIN_KEY)) return this.scene.add.image(x, y, COIN_KEY).setScale(PILE.coinScale)
    return this.scene.add.circle(x, y, (64 * PILE.coinScale) / 2, 0xe0b040) // no coin picture: plain circles
  }

  // Warm tint for the evening, none for the morning (fades, or jumps while a card hides the change)
  setEvening(evening: boolean, instant = false) {
    const from = this.currentTint
    const to = evening ? EVENING_TINT : NO_TINT
    this.scene.tweens.killTweensOf(this.tintProgress)
    if (instant) {
      this.tintProgress.t = 1
      this.applyTint(to)
      return
    }
    this.tintProgress.t = 0
    this.scene.tweens.add({ targets: this.tintProgress, t: 1, duration: TINT_MS, onUpdate: () => this.applyTint(lerpColor(from, to, this.tintProgress.t)) })
  }

  private applyTint(color: number) {
    this.currentTint = color
    for (const one of [...this.frame, ...this.pile.list]) {
      if (!(one instanceof Phaser.GameObjects.Image)) continue
      if (color === NO_TINT) one.clearTint()
      else one.setTint(color)
    }
  }

  // A tiny bounce when a coin lands
  bounce() {
    this.scene.tweens.killTweensOf(this.root)
    this.root.setScale(1)
    this.scene.tweens.add({
      targets: this.root,
      scaleX: BOUNCE.squashX,
      scaleY: BOUNCE.squashY,
      duration: BOUNCE.ms,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => this.root.setScale(1),
    })
  }
}
