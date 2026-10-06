import Phaser from 'phaser'
import { PlatePanel } from './PlateButton'
import { FONT, TEXT_COLOR } from './theme'

// Layout numbers for the 1280x720 screen. The top edge is fixed; the box grows downwards.
const BOX = { x: 640, top: 50, minWidth: 420, maxWidth: 760, minHeight: 100 }
// Room between the text and the plate's border and corner ornaments
const PADDING = { x: 40, y: 26 }
// The customer's name is the first line inside the bubble: bold, copper, a little smaller than the dialogue
const NAME = { size: 18, color: '#9a5a32', gap: 4 } // gap: between the name and the dialogue

// The customer's speech bubble: the name on the first line, the dialogue below it. Used for the order
// and for the reaction. The box is sized to its text, so short lines get a small bubble.
export class SpeechBox {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private background: PlatePanel
  private nameText: Phaser.GameObjects.Text
  private speechText: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    // Children use positions relative to the top-center of the box, so the whole thing moves as one
    this.root = scene.add.container(BOX.x, BOX.top)
    this.background = new PlatePanel(scene, 0, 0, BOX.minWidth, BOX.minHeight)
    this.nameText = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: `${NAME.size}px`, fontStyle: 'bold', color: NAME.color })
      .setOrigin(0.5)
      .setResolution(2)
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
    this.layout()
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

  // Sizes the box to the name and the wrapped text and redraws it
  private layout() {
    const nameHeight = this.nameText.text ? this.nameText.height : 0
    const gap = nameHeight > 0 ? NAME.gap : 0
    const contentHeight = nameHeight + gap + this.speechText.height
    const width = Phaser.Math.Clamp(Math.max(this.speechText.width, this.nameText.width) + PADDING.x * 2, BOX.minWidth, BOX.maxWidth)
    const height = Math.max(BOX.minHeight, contentHeight + PADDING.y * 2)
    const top = (height - contentHeight) / 2 // the name and the text are centered vertically as one block

    this.background.setPosition(0, height / 2)
    this.background.resize(width, height)
    this.nameText.setPosition(0, top + nameHeight / 2)
    this.speechText.setPosition(0, top + nameHeight + gap + this.speechText.height / 2)
  }
}
