import Phaser from 'phaser'

type TimeOfDay = 'morning' | 'evening'

const FADE_MS = 1500

// The main shop view: a morning background with an evening one fading in on top.
export class ShopScene extends Phaser.Scene {
  // Single source of truth for the time of day; day flow code will read/set it via setTimeOfDay
  private timeOfDay: TimeOfDay = 'morning'
  private evening!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle

  constructor() {
    super('ShopScene')
  }

  create() {
    this.addBackground('shop_morning', 0x5b3a29)
    // Evening sits on top, invisible; fading its alpha reveals it over the morning one
    this.evening = this.addBackground('shop_evening', 0x2a2040).setAlpha(0)

    this.add.text(16, 12, 'Attar', {
      fontFamily: 'Georgia, serif',
      fontSize: '32px',
      color: '#f3e2b3',
    })

    // TEMP: remove when the day flow exists
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.setTimeOfDay(this.timeOfDay === 'morning' ? 'evening' : 'morning')
    })
  }

  setTimeOfDay(time: TimeOfDay) {
    this.timeOfDay = time
    this.tweens.add({
      targets: this.evening,
      alpha: time === 'evening' ? 1 : 0,
      duration: FADE_MS,
    })
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
}
