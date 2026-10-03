import Phaser from 'phaser'
import { ORDERS } from '../data/customers'

// Loads all assets up front so later scenes can use them instantly.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  preload() {
    this.showLoadingBar()

    // A missing file must not crash the game: warn and let ShopScene use a fallback
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`Could not load asset "${file.key}" (${file.url}), using fallback`)
    })

    // Real art is loaded by file name from public/assets/, so swapping art needs no code change
    this.load.image('shop_morning', 'assets/backgrounds/shop_morning.jpg')
    this.load.image('shop_evening', 'assets/backgrounds/shop_evening.png')

    // One portrait per order, found by order id. Portraits are made one at a time, so
    // many will be missing for a while. A missing or invalid file fires 'loaderror' (warned
    // above) and registers no texture; ShopScene checks textures.exists and uses a placeholder.
    for (const order of ORDERS) {
      this.load.image(`customer_${order.id}`, `assets/characters/customer_${order.id}.png`)
    }
  }

  create() {
    this.scene.start('ShopScene')
  }

  // Simple bar: an outline plus a fill that grows with load progress
  private showLoadingBar() {
    const { width, height } = this.scale
    const barWidth = 400
    const barHeight = 24
    const x = (width - barWidth) / 2
    const y = height / 2

    this.add.rectangle(width / 2, y, barWidth + 4, barHeight + 4).setStrokeStyle(2, 0xf3e2b3)
    const fill = this.add.rectangle(x, y, 0, barHeight, 0xf3e2b3).setOrigin(0, 0.5)

    this.load.on('progress', (value: number) => {
      fill.width = barWidth * value
    })
  }
}
