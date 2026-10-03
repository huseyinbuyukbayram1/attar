import Phaser from 'phaser'
import { BORDER, CREAM, FONT, TEXT_COLOR } from './theme'

const HOVER_FILL = 0xfff3d1
const DISABLED_ALPHA = 0.6 // dimmed but the dark text stays readable

// A rounded cream button. It is a Container so views can hide or move it as one object.
// The clickable area is a Zone: simple and reliable, unlike hit-testing a Graphics.
export class Button extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics
  private label: Phaser.GameObjects.Text
  private enabled = true
  private boxWidth: number
  private boxHeight: number

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    onClick: () => void,
  ) {
    super(scene, x, y)
    scene.add.existing(this)
    this.boxWidth = width
    this.boxHeight = height

    this.background = scene.add.graphics()
    this.label = scene.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: '22px', color: TEXT_COLOR })
      .setOrigin(0.5)
    const hitArea = scene.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true })
    this.add([this.background, this.label, hitArea])
    this.draw(CREAM)

    // Checked on click so a disabled button simply does nothing
    hitArea.on('pointerdown', () => {
      if (this.enabled) onClick()
    })
    hitArea.on('pointerover', () => this.enabled && this.draw(HOVER_FILL))
    hitArea.on('pointerout', () => this.draw(CREAM))
  }

  setLabel(text: string) {
    this.label.setText(text)
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    this.setAlpha(enabled ? 1 : DISABLED_ALPHA)
  }

  private draw(fill: number) {
    const w = this.boxWidth
    const h = this.boxHeight
    this.background.clear()
    this.background.fillStyle(fill, 1)
    this.background.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2.5)
    this.background.lineStyle(2, BORDER, 1)
    this.background.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2.5)
  }
}
