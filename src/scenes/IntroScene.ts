import Phaser from 'phaser'
import { DEBT, formatMoney } from '../game/economy'
import { addPlateLabel, PlateButton, PlatePanel } from './ui/PlateButton'
import { addFullImage } from './ui/fullImage'
import { FONT, TEXT_COLOR } from './ui/theme'

const LINES = [
  'The old master has passed away.',
  'He left you his little attar shop in Istanbul.',
  `He also left a debt of ${formatMoney(DEBT)}.`,
  'The bank gives you five days. Pay it in full, or the shop will be sold.',
  'Open the door.',
]

const DIM = { color: 0x2a1a10, alpha: 0.6 } // warm dark veil over the shop
const PANEL = { x: 640, y: 330, width: 900, height: 180 }
const SKIP = { x: 1130, y: 664, width: 150, height: 46 }
const HINT = { x: 640, y: 664, width: 300, height: 32 }
const LINE_FADE_MS = 300

// The story before the first customer: one line at a time, click or SPACE for the next
export class IntroScene extends Phaser.Scene {
  private index = 0
  private leaving = false
  private lineText!: Phaser.GameObjects.Text

  constructor() {
    super('IntroScene')
  }

  create() {
    // The scene object is reused, so reset its fields here
    this.index = 0
    this.leaving = false
    const { width, height } = this.scale

    addFullImage(this, 'shop_morning')
    // The veil is also the click target for "next"; the Skip button sits above it, so it wins
    const veil = this.add.rectangle(width / 2, height / 2, width, height, DIM.color, DIM.alpha).setInteractive()
    veil.on('pointerdown', () => this.advance())

    new PlatePanel(this, PANEL.x, PANEL.y, PANEL.width, PANEL.height)
    this.lineText = this.add
      .text(PANEL.x, PANEL.y, '', {
        fontFamily: FONT,
        fontSize: '32px',
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: PANEL.width - 80 },
      })
      .setOrigin(0.5)
    addPlateLabel(this, HINT.x, HINT.y, HINT.width, HINT.height, 'Click or press SPACE to continue', 16)
    new PlateButton(this, SKIP.x, SKIP.y, { label: 'Skip', width: SKIP.width, height: SKIP.height, variant: 'short', onClick: () => this.finish() })

    const keyboard = this.input.keyboard
    const onSpace = () => this.advance()
    keyboard?.on('keydown-SPACE', onSpace)
    this.events.once('shutdown', () => keyboard?.off('keydown-SPACE', onSpace))

    this.showLine()
  }

  private showLine() {
    this.lineText.setText(LINES[this.index]).setAlpha(0)
    this.tweens.add({ targets: this.lineText, alpha: 1, duration: LINE_FADE_MS })
  }

  private advance() {
    this.index++
    if (this.index >= LINES.length) this.finish()
    else this.showLine()
  }

  private finish() {
    if (this.leaving) return // a double click must not start the shop twice
    this.leaving = true
    this.scene.start('ShopScene')
  }
}
