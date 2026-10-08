import Phaser from 'phaser'
import { FONT } from './theme'

// ---- A number of gold coins with a small coin picture: tuning constants ----
const COIN_KEY = 'coin'
const ICON = { heightShare: 0.9, gap: 5 } // the coin's height as a share of the text size; the gap between the parts (px)
const FALLBACK_COLOR = 0xe0b040 // a plain gold circle if coin.png is missing

export type CoinAmountStyle = {
  fontSize: number
  color: string
  bold?: boolean
  shadow?: boolean // a thin dark shadow, for text on a picture
}

// A line that shows an amount of gold coins: "prefix [coin] number suffix", for example "Payment +[coin]2" or
// "[coin]7 / 22". The coin picture is scaled to the text and centred on it vertically, and the whole line is centred on
// the container's position. It is used everywhere an amount is shown, so the money always looks the same.
export class CoinAmount extends Phaser.GameObjects.Container {
  private prefix: Phaser.GameObjects.Text
  private icon: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
  private number: Phaser.GameObjects.Text
  private suffix: Phaser.GameObjects.Text
  private iconWidth: number
  readonly lineHeight: number

  constructor(scene: Phaser.Scene, x: number, y: number, style: CoinAmountStyle) {
    super(scene, x, y)
    const text = () => {
      const made = scene.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: `${style.fontSize}px`, fontStyle: style.bold ? 'bold' : 'normal', color: style.color })
        .setOrigin(0, 0.5)
        .setResolution(2)
      if (style.shadow) made.setShadow(1, 2, '#000000', 3, true, true)
      return made
    }
    this.prefix = text()
    this.number = text()
    this.suffix = text()
    const iconHeight = style.fontSize * ICON.heightShare
    if (scene.textures.exists(COIN_KEY)) {
      const image = scene.add.image(0, 0, COIN_KEY).setOrigin(0, 0.5)
      image.setScale(iconHeight / image.height)
      this.icon = image
      this.iconWidth = image.displayWidth
    } else {
      this.icon = scene.add.circle(0, 0, iconHeight / 2, FALLBACK_COLOR).setOrigin(0, 0.5)
      this.iconWidth = iconHeight
    }
    this.lineHeight = this.number.height
    this.add([this.prefix, this.icon, this.number, this.suffix])
    scene.add.existing(this)
  }

  // Sets the three parts and centres the line: `amount` is what comes after the coin picture ("7 / 22")
  setAmount(amount: string, prefix = '', suffix = ''): this {
    this.prefix.setText(prefix)
    this.number.setText(amount)
    this.suffix.setText(suffix)
    const gap = ICON.gap
    const widths = [prefix ? this.prefix.width + gap : 0, this.iconWidth + gap, this.number.width, suffix ? this.suffix.width : 0]
    let x = -widths.reduce((sum, w) => sum + w, 0) / 2
    this.prefix.setX(x)
    x += widths[0]
    this.icon.setX(x)
    x += widths[1]
    this.number.setX(x)
    x += widths[2]
    this.suffix.setX(x)
    return this
  }
}
