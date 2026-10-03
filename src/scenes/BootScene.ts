import Phaser from 'phaser'

// Loads all assets up front so later scenes can use them instantly.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  preload() {
    // Real art goes in public/assets/ and is loaded by file name, e.g.:
    // this.load.image('shop-bg', 'assets/shop-bg.png')
    // Nothing to load yet: the game uses placeholder shapes.
  }

  create() {
    this.scene.start('ShopScene')
  }
}
