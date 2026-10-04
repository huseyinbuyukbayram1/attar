import Phaser from 'phaser'
import { drawPanel, FONT, TEXT_COLOR } from './theme'

// Layout numbers for the 1280x720 screen. The top edge is fixed; the box grows downwards.
const BOX = { x: 640, top: 50, minWidth: 420, maxWidth: 760, minHeight: 100 }
const PADDING = { x: 24, y: 20 }
const TAG = { width: 170, height: 30, inset: 12, overlap: 6 } // name tag on the top-left corner
const RADIUS = 20

// The customer's speech bubble plus a name tag. Used for the order and for the reaction.
// The box is sized to its text, so short lines get a small bubble.
export class SpeechBox {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private background: Phaser.GameObjects.Graphics
  private nameText: Phaser.GameObjects.Text
  private speechText: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    // Children use positions relative to the top-center of the box, so the whole thing moves as one
    this.root = scene.add.container(BOX.x, BOX.top)
    this.background = scene.add.graphics()
    this.nameText = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '18px', color: TEXT_COLOR })
      .setOrigin(0.5)
    this.speechText = scene.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: TEXT_COLOR,
        align: 'center',
        // Wrap at the widest the box may be; the box then shrinks to the longest line
        wordWrap: { width: BOX.maxWidth - PADDING.x * 2 },
      })
      .setOrigin(0.5)
    this.root.add([this.background, this.nameText, this.speechText])
    this.layout()
  }

  setSpeaker(name: string) {
    this.nameText.setText(name)
  }

  setText(text: string) {
    this.speechText.setText(text)
    this.layout()
  }

  setAlpha(alpha: number) {
    this.root.setAlpha(alpha)
  }

  // Fades the box in from invisible, e.g. after the customer has arrived
  fadeIn(ms: number, onDone: () => void) {
    this.root.setAlpha(0)
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: ms, onComplete: onDone })
  }

  setVisible(visible: boolean) {
    this.root.setVisible(visible)
  }

  // Sizes the box to the wrapped text and redraws it, with the name tag on its top-left corner
  private layout() {
    const width = Phaser.Math.Clamp(this.speechText.width + PADDING.x * 2, BOX.minWidth, BOX.maxWidth)
    const height = Math.max(BOX.minHeight, this.speechText.height + PADDING.y * 2)
    const tagX = -width / 2 + TAG.inset + TAG.width / 2
    const tagY = -TAG.height / 2 + TAG.overlap

    this.background.clear()
    drawPanel(this.background, 0, height / 2, width, height, RADIUS)
    drawPanel(this.background, tagX, tagY, TAG.width, TAG.height, TAG.height / 2)
    this.nameText.setPosition(tagX, tagY)
    this.speechText.setPosition(0, height / 2)
  }
}
