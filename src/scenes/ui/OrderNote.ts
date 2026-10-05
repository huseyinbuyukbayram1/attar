import Phaser from 'phaser'
import type { Order } from '../../data/customers'
import { INGREDIENTS } from '../../data/ingredients'
import { FONT } from './theme'

// The order note on the MIX screen: a small parchment card that reminds the player of the order and
// the latest hint, so nothing has to be remembered. It only shows values it is given; it changes no
// game state and has no interactive objects, so clicks go straight through it.
// Position (top-right, below the money HUD, above the bottles' tooltips): x = center, y = top edge.
const NOTE = { x: 1147, y: 74, width: 224, padding: 12, radius: 10 }
const PARCHMENT = 0xf3e2b8
const INK = 0x3b2412
const INK_CSS = '#3b2412'
const BORDER_WIDTH = 1.5
const FONT_SIZE = { name: 15, order: 14, hintLabel: 13, hint: 14, smelled: 13, smells: 13 } // px
const GAP = { afterName: 4, afterOrder: 10, afterDivider: 8, afterHintLabel: 2, afterHint: 6, afterSmelled: 10 } // px between the parts
const DIVIDER_ALPHA = 0.5
const FLASH = { color: 0xffe27a, alpha: 0.65, ms: 600 } // soft yellow flash on a new hint

export class OrderNote {
  readonly root: Phaser.GameObjects.Container
  private scene: Phaser.Scene
  private order?: Order
  private smellsLeft = 0
  private hint: string | null = null
  private smelled: string | null = null // the mix the customer smelled, as text: "Oud, Rose ×2, Vanilla"
  private hintIsNew = false // set when a hint arrives, used (and cleared) the next time the note is shown

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0)
  }

  // A new hint arrived (in the REACT phase) for the mix `drops` that was smelled; the hint will
  // flash when the MIX screen shows again. The mix is written as names with counts, in the order
  // of first appearance.
  setHint(hint: string, drops: string[]) {
    this.hint = hint
    const counts = new Map<string, number>()
    for (const id of drops) counts.set(id, (counts.get(id) ?? 0) + 1)
    this.smelled = [...counts.entries()]
      .map(([id, n]) => `${INGREDIENTS.find((i) => i.id === id)?.name ?? id}${n > 1 ? ` ×${n}` : ''}`)
      .join(', ')
    this.hintIsNew = true
  }

  // A new customer: forget the hint
  reset() {
    this.hint = null
    this.smelled = null
    this.hintIsNew = false
  }

  // Draws the note for this order. Flashes the hint line if it is new.
  show(order: Order, smellsLeft: number) {
    this.order = order
    this.smellsLeft = smellsLeft
    this.render()
  }

  // Rebuilt from scratch on every show: the note is small, and this keeps it simple
  private render() {
    const { scene } = this
    this.root.removeAll(true)
    if (!this.order) return
    const inner = NOTE.width - NOTE.padding * 2
    const left = NOTE.x - NOTE.width / 2 + NOTE.padding
    let y = NOTE.y + NOTE.padding

    const text = (str: string, size: number, bold = false) => {
      const t = scene.add
        .text(left, y, str, {
          fontFamily: FONT,
          fontSize: `${size}px`,
          fontStyle: bold ? 'bold' : 'normal',
          color: INK_CSS,
          wordWrap: { width: inner },
        })
        .setOrigin(0, 0)
      y += t.height
      return t
    }

    const texts: Phaser.GameObjects.GameObject[] = []
    texts.push(text(this.order.customerName, FONT_SIZE.name, true))
    y += GAP.afterName
    texts.push(text(`“${this.order.orderText}”`, FONT_SIZE.order))
    y += GAP.afterOrder

    // The hint block (only if there is a hint): a divider, "Last hint:" and the hint
    let flash: Phaser.GameObjects.Rectangle | undefined
    if (this.hint) {
      const dividerY = y
      texts.push(scene.add.rectangle(NOTE.x, dividerY, inner, 1, INK).setAlpha(DIVIDER_ALPHA))
      y += GAP.afterDivider
      const blockTop = y
      texts.push(text('Last hint:', FONT_SIZE.hintLabel, true))
      y += GAP.afterHintLabel
      texts.push(text(this.hint, FONT_SIZE.hint))
      // The flash goes behind the hint text, a little larger than it
      flash = scene.add
        .rectangle(NOTE.x, (blockTop + y) / 2, NOTE.width - NOTE.padding, y - blockTop + 6, FLASH.color)
        .setAlpha(0)
      y += GAP.afterHint
      if (this.smelled) {
        texts.push(text(`Smelled: ${this.smelled}`, FONT_SIZE.smelled))
        y += GAP.afterSmelled
      }
    }
    texts.push(text(`Smells left: ${this.smellsLeft}`, FONT_SIZE.smells))

    // The card itself, sized to what was written, drawn first (behind everything)
    const height = y + NOTE.padding - NOTE.y
    const card = scene.add.graphics()
    card.fillStyle(PARCHMENT, 0.97)
    card.fillRoundedRect(NOTE.x - NOTE.width / 2, NOTE.y, NOTE.width, height, NOTE.radius)
    card.lineStyle(BORDER_WIDTH, INK, 1)
    card.strokeRoundedRect(NOTE.x - NOTE.width / 2, NOTE.y, NOTE.width, height, NOTE.radius)
    this.root.add([card, ...(flash ? [flash] : []), ...texts])

    if (flash && this.hintIsNew) {
      this.hintIsNew = false
      flash.setAlpha(FLASH.alpha)
      scene.tweens.add({ targets: flash, alpha: 0, duration: FLASH.ms, ease: 'Sine.easeOut' })
    }
  }
}
