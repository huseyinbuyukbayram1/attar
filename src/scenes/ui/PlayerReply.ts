import Phaser from 'phaser'
import type { Expression } from '../../game/playerLines'
import { PlatePanel } from './PlateButton'
import { FONT, TEXT_COLOR } from './theme'

// The player character on the REACT screen, visual-novel style: a portrait at the bottom left and a small
// reply bubble to its right. Presentation only; the lines come from game/playerLines.ts.
const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'sad']
const PORTRAIT = { height: 202, left: 16, bottomCut: 22 } // bottomCut: how far the bottom edge is below the screen edge
const SLIDE = { distance: 60, ms: 250 } // slides in from the left while fading in
const FACE_FADE_MS = 150 // the crossfade when the expression changes
const HIDE_MS = 150
// The bubble sits right of the portrait on the counter's front face, its bottom on the same line as the
// Adjust and Deliver buttons (see ReactView), and grows upwards to fit the text
const BUBBLE = { left: 226, bottom: 720 - 24, minWidth: 190, maxWidth: 380, minHeight: 66 }
const PADDING = { x: 34, y: 16 }
const NAME = { text: 'You', size: 16, color: '#9a5a32', gap: 2 } // the small copper name label
const TEXT = { size: 20, charsPerSecond: 35 }

export class PlayerReply {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private faces = new Map<Expression, Phaser.GameObjects.Image>()
  private face?: Expression
  private bubble: Phaser.GameObjects.Container
  private background: PlatePanel
  private nameText: Phaser.GameObjects.Text
  private lines: { text: Phaser.GameObjects.Text; full: string }[] = []
  private clickZone: Phaser.GameObjects.Zone
  private typing?: Phaser.Tweens.Tween
  private appear?: Phaser.Tweens.Tween
  private delay?: Phaser.Time.TimerEvent
  private up = false // the portrait is on the screen (or on its way)

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setAlpha(0).setVisible(false)
    for (const expression of EXPRESSIONS) {
      const key = `player_${expression}`
      if (!scene.textures.exists(key)) continue // a missing picture is skipped, the bubble still works
      const image = scene.add.image(PORTRAIT.left, 720 + PORTRAIT.bottomCut, key).setOrigin(0, 1).setAlpha(0)
      image.setScale(PORTRAIT.height / image.height) // from the file's own height, so the file may be any size
      this.faces.set(expression, image)
      this.root.add(image)
    }
    this.bubble = scene.add.container(BUBBLE.left, BUBBLE.bottom)
    this.background = new PlatePanel(scene, 0, 0, BUBBLE.minWidth, BUBBLE.minHeight)
    this.nameText = scene.add
      .text(0, 0, NAME.text, { fontFamily: FONT, fontSize: `${NAME.size}px`, fontStyle: 'bold', color: NAME.color })
      .setOrigin(0.5, 0)
      .setResolution(2)
    // Only interactive while typing: a click on the bubble completes the text. It never covers a button.
    this.clickZone = scene.add.zone(0, 0, 1, 1)
    this.clickZone.on('pointerdown', () => this.finishTyping())
    this.bubble.add([this.background, this.nameText, this.clickZone])
    this.root.add(this.bubble)
  }

  // Shows the reply after `delayMs`: the portrait slides in (if it is not there yet), the face changes, the text is typed
  show(expression: Expression, text: string, delayMs = 0) {
    this.cancelPending()
    this.delay = this.scene.time.delayedCall(delayMs, () => this.start(expression, text))
  }

  // Fades everything out; `instant` for when the screen changes in the dark
  hide(instant = false) {
    this.cancelPending()
    this.stopTyping()
    this.up = false
    if (instant || !this.root.visible) {
      this.root.setAlpha(0).setVisible(false)
      return
    }
    this.appear = this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: HIDE_MS,
      onComplete: () => this.root.setVisible(false),
    })
  }

  private start(expression: Expression, text: string) {
    this.appear?.stop()
    this.stopTyping()
    this.setFace(expression)
    this.layoutBubble(text)
    if (this.up && this.root.alpha >= 1) {
      this.startTyping()
      return
    }
    // First time (or it was fading out): slide in from the left
    this.up = true
    this.root.setVisible(true).setAlpha(0).setX(-SLIDE.distance)
    this.appear = this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      x: 0,
      duration: SLIDE.ms,
      ease: 'Sine.easeOut',
      onComplete: () => this.startTyping(),
    })
  }

  // A quick crossfade between two faces; the first face just appears
  private setFace(expression: Expression) {
    if (expression === this.face) return
    const next = this.faces.get(expression)
    const previous = this.face ? this.faces.get(this.face) : undefined
    this.face = expression
    if (previous) this.scene.tweens.add({ targets: previous, alpha: 0, duration: FACE_FADE_MS })
    if (next) this.scene.tweens.add({ targets: next, alpha: 1, duration: FACE_FADE_MS })
  }

  // Sizes the bubble to the FULL text and places every line, so nothing moves while typing (as in SpeechBox)
  private layoutBubble(text: string) {
    this.clearLines()
    const style = { fontFamily: FONT, fontSize: `${TEXT.size}px`, fontStyle: 'italic', color: TEXT_COLOR }
    const measure = this.scene.add.text(0, 0, text, { ...style, wordWrap: { width: BUBBLE.maxWidth - PADDING.x * 2 } })
    const wrapped = measure.getWrappedText(text)
    measure.destroy()
    const pieces = wrapped.map((line) => this.scene.add.text(0, 0, line, style).setOrigin(0, 0))
    const lineHeight = pieces[0].height
    const textWidth = Math.max(...pieces.map((piece) => piece.width))
    const textHeight = lineHeight * pieces.length
    const width = Phaser.Math.Clamp(textWidth + PADDING.x * 2, BUBBLE.minWidth, BUBBLE.maxWidth)
    const contentHeight = this.nameText.height + NAME.gap + textHeight
    const height = Math.max(BUBBLE.minHeight, contentHeight + PADDING.y * 2)
    const top = -height / 2 + (height - contentHeight) / 2 // the name and the text are one block, centered in the panel
    this.bubble.setY(BUBBLE.bottom - height / 2) // the bottom edge stays on the buttons' line

    // The bubble's left edge stays at BUBBLE.left, so the panel is centered half its width to the right
    this.background.setPosition(width / 2, 0)
    this.background.resize(width, height)
    this.nameText.setPosition(width / 2, top)
    pieces.forEach((piece, i) => {
      piece.setPosition(width / 2 - textWidth / 2, top + this.nameText.height + NAME.gap + i * lineHeight)
      piece.setText('')
      this.bubble.add(piece)
    })
    this.lines = pieces.map((piece, i) => ({ text: piece, full: wrapped[i] }))
    this.clickZone.setPosition(width / 2, 0).setSize(width, height)
  }

  private startTyping() {
    const total = this.lines.reduce((sum, line) => sum + line.full.length, 0)
    if (total === 0) return
    this.clickZone.setInteractive()
    this.typing = this.scene.tweens.addCounter({
      from: 0,
      to: total,
      duration: (total / TEXT.charsPerSecond) * 1000,
      onUpdate: (tween) => this.reveal(Math.round(tween.getValue() ?? 0)),
      onComplete: () => this.stopTyping(),
    })
  }

  private finishTyping() {
    if (!this.typing) return
    this.reveal(Number.MAX_SAFE_INTEGER)
    this.stopTyping()
  }

  private reveal(count: number) {
    let left = count
    for (const line of this.lines) {
      line.text.setText(line.full.slice(0, Math.max(0, Math.min(left, line.full.length))))
      left -= line.full.length
    }
  }

  private stopTyping() {
    this.typing?.stop()
    this.typing = undefined
    if (this.clickZone.input) this.clickZone.disableInteractive()
  }

  private clearLines() {
    this.lines.forEach((line) => line.text.destroy())
    this.lines = []
  }

  private cancelPending() {
    this.delay?.remove()
    this.delay = undefined
    this.appear?.stop()
    this.appear = undefined
  }
}
