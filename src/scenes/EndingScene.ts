import Phaser from 'phaser'
import { DEBT, formatMoney, GREAT_WIN_MONEY } from '../game/economy'
import { PlateButton, PlatePanel } from './ui/PlateButton'
import { addFullImage } from './ui/fullImage'
import { FONT, TEXT_COLOR } from './ui/theme'

// Fallback backgrounds (the shop with an overlay) when no ending art exists
const WIN_LOOK = { tint: 0xffffff, overlay: 0x4a2e14, overlayAlpha: 0.3 } // warm, a bit lighter
const LOSE_LOOK = { tint: 0x8d97a6, overlay: 0x0c1118, overlayAlpha: 0.7 } // cool, desaturated, darker
const SOLID_FALLBACK = 0x1a1210 // if even the shop background is missing

const PANEL = { x: 640, y: 290, width: 900, height: 340 }
const TITLE_Y = 180
const FIRST_LINE_Y = 255
const LINE_SPACING = 36
const MONEY_Y = 405
const BUTTON = { x: 640, y: 560, width: 200, height: 56 }

// Shown after the last customer: the shop is saved or sold, depending on the money earned
export class EndingScene extends Phaser.Scene {
  private money = 0

  constructor() {
    super('EndingScene')
  }

  // Phaser hands over whatever ShopScene passed to scene.start
  init(data: { money: number }) {
    this.money = data.money
  }

  create() {
    const won = this.money >= DEBT
    this.addBackground(won)

    const lines = won
      ? ['The debt is paid. The shelves are full again.', 'The master would be proud.']
      : [`You were ${formatMoney(DEBT - this.money)} short.`, "The bank closed the master's door for the last time."]
    if (won && this.money >= GREAT_WIN_MONEY) lines.push('Customers are lining up outside.')

    new PlatePanel(this, PANEL.x, PANEL.y, PANEL.width, PANEL.height)
    this.addText(TITLE_Y, won ? 'The shop is saved' : 'The shop is sold', 52)
    lines.forEach((line, i) => this.addText(FIRST_LINE_Y + i * LINE_SPACING, line, 26))
    this.addText(MONEY_Y, `${formatMoney(this.money)} / ${formatMoney(DEBT)}`, 34)

    // Starting ShopScene again runs its create() with a fresh GameState, straight to day 1 (no intro)
    new PlateButton(this, BUTTON.x, BUTTON.y, {
      label: 'Try again',
      width: BUTTON.width,
      height: BUTTON.height,
      onClick: () => this.scene.start('ShopScene'),
    })
  }

  // Ending art if it was added, otherwise the shop background with a mood overlay
  private addBackground(won: boolean) {
    const { width, height } = this.scale
    if (addFullImage(this, won ? 'ending_win' : 'ending_lose')) return

    const look = won ? WIN_LOOK : LOSE_LOOK
    const shop = addFullImage(this, 'shop_morning')
    if (!shop) {
      this.add.rectangle(width / 2, height / 2, width, height, SOLID_FALLBACK)
      return
    }
    shop.setTint(look.tint)
    this.add.rectangle(width / 2, height / 2, width, height, look.overlay, look.overlayAlpha)
  }

  private addText(y: number, text: string, size: number) {
    return this.add
      .text(PANEL.x, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: PANEL.width - 80 },
      })
      .setOrigin(0.5)
  }
}
