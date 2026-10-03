import Phaser from 'phaser'
import type { Order } from '../../data/customers'
import { lerpColor } from './liquidColor'
import { PORTRAIT, portraitPlacement } from './portraitPlacement'
import { addPanel, FONT, TEXT_COLOR } from './theme'

const PLACEHOLDER = { y: 400, width: 180, height: 260 } // box shown when a portrait is missing
// The customer walks in from the door: smaller and a bit higher, then grows into place
const ENTER_MS = 500
const ENTER_FROM = { scale: 0.85, rise: 36 } // rise = how many pixels higher it starts
const LEAVE_MS = 250
const TINT_MS = 1500 // same as the morning/evening crossfade, so the customer changes with the room
const NO_TINT = 0xffffff

// The customer standing at the counter: a portrait if the texture loaded, otherwise a
// labelled box. One container, so a single tween moves and fades the whole customer.
export class CustomerArt {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private portrait?: Phaser.GameObjects.Image
  // Tint is tweened through plain colors: current is what is applied, target is where it is heading
  private currentTint = NO_TINT
  private targetTint = NO_TINT
  private tintProgress = { t: 1 }

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene
    // The container sits at the feet, so scaling it keeps the feet in place (like walking closer)
    this.root = scene.add.container(PORTRAIT.x, PORTRAIT.y).setDepth(depth)
  }

  // Rebuilt for every customer (simpler than swapping textures and re-scaling), then walks in
  show(order: Order) {
    this.root.removeAll(true)
    this.portrait = undefined

    const key = `customer_${order.id}`
    if (this.scene.textures.exists(key)) {
      // Origin at bottom-center, placed at the container's origin (the feet); scale from the wanted height
      // Where and how big comes from the shared placement function. The container sits at the
      // default feet position, so the portrait is placed relative to it.
      const place = portraitPlacement(order.id)
      const portrait = this.scene.add.image(place.x - PORTRAIT.x, place.y - PORTRAIT.y, key).setOrigin(0.5, 1)
      portrait.setScale(place.height / portrait.height)
      this.root.add(portrait)
      this.portrait = portrait
      // A customer who just arrived gets the current light at once, no fade
      this.scene.tweens.killTweensOf(this.tintProgress)
      this.applyTint(this.targetTint)
    } else {
      const boxY = PLACEHOLDER.y - PORTRAIT.y // PLACEHOLDER.y is a canvas position; the container is at the feet
      const label = this.scene.add
        .text(0, boxY, order.customerName, {
          fontFamily: FONT,
          fontSize: '24px',
          color: TEXT_COLOR,
        })
        .setOrigin(0.5)
      this.root.add([
        addPanel(this.scene, 0, boxY, PLACEHOLDER.width, PLACEHOLDER.height, 24, 0xd9b98a),
        label,
      ])
    }

    this.scene.tweens.killTweensOf(this.root)
    this.root.setAlpha(0).setScale(ENTER_FROM.scale).setY(PORTRAIT.y - ENTER_FROM.rise)
    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      scale: 1,
      y: PORTRAIT.y,
      duration: ENTER_MS,
      ease: 'Sine.easeOut',
      // Land exactly on fully opaque and full size, whatever the tween's last step was
      onComplete: () => this.root.setAlpha(1).setScale(1).setY(PORTRAIT.y),
    })
  }

  // Warm tint for evening, null for morning. If a portrait is visible it fades to the new
  // tint; a customer arriving later picks the current one up in show().
  setTint(tint: number | null) {
    this.targetTint = tint ?? NO_TINT
    const from = this.currentTint
    const to = this.targetTint
    this.scene.tweens.killTweensOf(this.tintProgress)
    this.tintProgress.t = 0
    this.scene.tweens.add({
      targets: this.tintProgress,
      t: 1,
      duration: TINT_MS,
      onUpdate: () => this.applyTint(lerpColor(from, to, this.tintProgress.t)),
    })
  }

  private applyTint(color: number) {
    this.currentTint = color
    if (!this.portrait) return
    if (color === NO_TINT) this.portrait.clearTint()
    else this.portrait.setTint(color)
  }

  leave(onDone: () => void) {
    this.scene.tweens.killTweensOf(this.root) // an unfinished entrance must not fight the fade-out
    this.scene.tweens.add({ targets: this.root, alpha: 0, duration: LEAVE_MS, onComplete: onDone })
  }

  setVisible(visible: boolean) {
    this.root.setVisible(visible)
  }
}
