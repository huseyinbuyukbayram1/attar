import Phaser from 'phaser'
import { drawPanel, FONT, TEXT_COLOR } from './theme'

const MARGIN = 16 // the tooltip never gets closer than this to the canvas edge
const HEIGHT = 30
const PADDING_X = 14

// One shared tooltip pill. Bottles call show() on hover and hide() on pointer out.
export class Tooltip extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics
  private label: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0)
    scene.add.existing(this)
    this.background = scene.add.graphics()
    this.label = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color: TEXT_COLOR })
      .setOrigin(0.5)
    this.add([this.background, this.label])
    this.setVisible(false)
  }

  // Puts the pill centered above (anchorX, anchorY), nudged so it stays inside the canvas
  show(text: string, anchorX: number, anchorY: number) {
    this.label.setText(text)
    const width = this.label.width + PADDING_X * 2
    const x = Phaser.Math.Clamp(anchorX, MARGIN + width / 2, this.scene.scale.width - MARGIN - width / 2)
    const y = Math.max(MARGIN + HEIGHT / 2, anchorY - HEIGHT / 2)
    this.setPosition(x, y)
    this.background.clear()
    drawPanel(this.background, 0, 0, width, HEIGHT, HEIGHT / 2)
    this.setVisible(true)
  }

  hide() {
    this.setVisible(false)
  }
}
