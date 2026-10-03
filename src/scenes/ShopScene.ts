import Phaser from 'phaser'

// The main shop view. For now: a placeholder background and a title.
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene')
  }

  create() {
    const { width, height } = this.scale

    // Placeholder background (replace with real art later)
    this.add.rectangle(width / 2, height / 2, width, height, 0x5b3a29)

    this.add
      .text(width / 2, height / 2, 'Attar', {
        fontFamily: 'Georgia, serif',
        fontSize: '96px',
        color: '#f3e2b3',
      })
      .setOrigin(0.5)
  }
}
