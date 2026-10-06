import Phaser from 'phaser'
import { PlatePanel } from './PlateButton'
import { FONT, TEXT_COLOR } from './theme'

// Layout numbers for the 1280x720 screen. The top edge is fixed; the box grows downwards.
const BOX = { x: 640, top: 50, minWidth: 420, maxWidth: 760, minHeight: 100 }
// Room between the text and the plate's border and corner ornaments
const PADDING = { x: 40, y: 26 }
// The customer's name is the first line inside the bubble: bold, copper, a little smaller than the dialogue
const NAME = { size: 18, color: '#9a5a32', gap: 4 } // gap: between the name and the dialogue
// Typed-out speech (same feel as the story, see StoryPanel): speed, and the blinking arrow when the text is complete
const TYPING = { charsPerSecond: 35 }
const ARROW = { text: '▼', size: 20, blinkMs: 500, inset: { x: 26, y: 24 } } // inset: from the bottom right corner

// The customer's speech bubble: the name on the first line, the dialogue below it. Used for the order
// and for the reaction. The box is sized to its text, so short lines get a small bubble.
export class SpeechBox {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private background: PlatePanel
  private nameText: Phaser.GameObjects.Text
  private speechText: Phaser.GameObjects.Text
  private boxSize = { width: BOX.minWidth, height: BOX.minHeight }
  private typedLines: { text: Phaser.GameObjects.Text; full: string }[] = [] // the lines of a typed-out text, one Text each
  private typing?: Phaser.Tweens.Tween
  private typingNow = false
  private arrow: Phaser.GameObjects.Text

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
    this.arrow = scene.add.text(0, 0, ARROW.text, { fontFamily: FONT, fontSize: `${ARROW.size}px`, color: TEXT_COLOR }).setOrigin(0.5).setVisible(false)
    scene.tweens.add({ targets: this.arrow, alpha: 0.2, duration: ARROW.blinkMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.root.add([this.background, this.nameText, this.speechText, this.arrow])
    this.layout()
  }

  // Where the bubble is on the screen (the tutorial lights it up)
  bounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.root.x - this.boxSize.width / 2, this.root.y, this.boxSize.width, this.boxSize.height)
  }

  setSpeaker(name: string) {
    this.nameText.setText(name)
    this.layout()
  }

  setText(text: string) {
    this.clearTyped()
    this.speechText.setText(text)
    this.layout()
  }

  // Types the text out letter by letter, then shows the blinking arrow. The box is sized to the FULL text
  // and every line gets its final place at once, so nothing moves while typing (as in StoryPanel).
  typeText(text: string, onDone: () => void) {
    this.setText(text) // sizes the box; the real text is hidden below while the lines are typed
    this.speechText.setVisible(false)
    const lines = this.speechText.getWrappedText(text)
    const step = this.speechText.height / lines.length
    const top = this.speechText.y - this.speechText.height / 2
    lines.forEach((line, i) => {
      const piece = this.scene.add.text(0, 0, line, { fontFamily: FONT, fontSize: '22px', color: TEXT_COLOR }).setOrigin(0, 0)
      piece.setPosition(-piece.width / 2, top + i * step)
      piece.setText('')
      this.root.add(piece)
      this.typedLines.push({ text: piece, full: line })
    })
    const total = lines.reduce((sum, line) => sum + line.length, 0)
    this.typingNow = true
    this.typing = this.scene.tweens.addCounter({
      from: 0,
      to: total,
      duration: (total / TYPING.charsPerSecond) * 1000,
      onUpdate: (tween) => this.reveal(Math.round(tween.getValue() ?? 0)),
      onComplete: () => this.typingDone(onDone),
    })
    this.onTypingDone = onDone
  }
  private onTypingDone: () => void = () => {}

  isTyping(): boolean {
    return this.typingNow
  }

  // A click while typing: the whole text at once
  finishTyping() {
    if (!this.typingNow) return
    this.typing?.stop()
    this.reveal(Number.MAX_SAFE_INTEGER)
    this.typingDone(this.onTypingDone)
  }

  // Shows the first `count` characters, filling the lines one after the other
  private reveal(count: number) {
    let left = count
    for (const line of this.typedLines) {
      line.text.setText(line.full.slice(0, Math.max(0, Math.min(left, line.full.length))))
      left -= line.full.length
    }
  }

  private typingDone(onDone: () => void) {
    this.typingNow = false
    this.arrow.setVisible(true)
    onDone()
  }

  // Back to the plain text (a typed text, its arrow and its timer go away)
  private clearTyped() {
    this.typing?.stop()
    this.typing = undefined
    this.typingNow = false
    this.typedLines.forEach((line) => line.text.destroy())
    this.typedLines = []
    this.arrow.setVisible(false)
    this.speechText.setVisible(true)
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

    this.boxSize = { width, height }
    this.background.setPosition(0, height / 2)
    this.background.resize(width, height)
    this.arrow.setPosition(width / 2 - ARROW.inset.x, height - ARROW.inset.y)
    this.nameText.setPosition(0, top + nameHeight / 2)
    this.speechText.setPosition(0, top + nameHeight + gap + this.speechText.height / 2)
  }
}
