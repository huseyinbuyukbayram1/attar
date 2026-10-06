import Phaser from 'phaser'
import { PlatePanel } from './PlateButton'
import { FONT, TEXT_COLOR } from './theme'

// The story text box: a plate with text that is typed out letter by letter, and a small blinking
// arrow when the page is complete. Used by the intro and the endings. The click / Space handling is
// the scene's: ask isTyping(), then finishTyping() or go to the next page.
export type StoryPanelOptions = {
  x: number // center
  y: number
  width: number
  height: number
  fontSize: number
  padding: { x: number; y: number; left?: number } // between the text and the plate's border and corner ornaments; left may be bigger (room for something pinned to the corner)
  plateAlpha?: number // the plate may be a little see-through (the text is not)
  style?: 'plate' | 'band' // a parchment plate (default), or a subtitle band: dark, faded edges, cream text, centered
}

const CHARS_PER_SECOND = 35
const PAGE_FADE_MS = 160 // a new page's text fades in
// The subtitle band: a black band with faded edges (made once as a texture), cream text with a thin dark shadow
const BAND = { key: 'story_band', alpha: 0.55, textColor: '#f3e6c8', shadow: { x: 1, y: 2, blur: 3 }, fadeShare: { vertical: 0.28, horizontal: 0.06 } }
const ARROW = { text: '▼', size: 20, blinkMs: 500, inset: { x: 44, y: 32 } } // inset: from the bottom right corner

// The band texture: black, 55 percent at most, fading to nothing at the top and bottom (28 percent of
// the height each) and at the left and right (6 percent each). Stretched to any size.
function ensureBandTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(BAND.key)) return
  const size = 256
  const texture = scene.textures.createCanvas(BAND.key, size, size)
  const context = texture?.getContext()
  if (!texture || !context) return
  const vertical = context.createLinearGradient(0, 0, 0, size)
  vertical.addColorStop(0, 'rgba(0,0,0,0)')
  vertical.addColorStop(BAND.fadeShare.vertical, `rgba(0,0,0,${BAND.alpha})`)
  vertical.addColorStop(1 - BAND.fadeShare.vertical, `rgba(0,0,0,${BAND.alpha})`)
  vertical.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = vertical
  context.fillRect(0, 0, size, size)
  const horizontal = context.createLinearGradient(0, 0, size, 0)
  horizontal.addColorStop(0, 'rgba(0,0,0,0)')
  horizontal.addColorStop(BAND.fadeShare.horizontal, 'rgba(0,0,0,1)')
  horizontal.addColorStop(1 - BAND.fadeShare.horizontal, 'rgba(0,0,0,1)')
  horizontal.addColorStop(1, 'rgba(0,0,0,0)')
  context.globalCompositeOperation = 'destination-in'
  context.fillStyle = horizontal
  context.fillRect(0, 0, size, size)
  texture.refresh()
}

export class StoryPanel {
  readonly root: Phaser.GameObjects.Container
  private scene: Phaser.Scene
  private plate?: PlatePanel
  private band?: Phaser.GameObjects.Image
  private bandStyle: boolean
  private innerWidth: number
  private left: number // x of the left end of the text, from the box's center (plate style)
  private style: Phaser.Types.GameObjects.Text.TextStyle
  private lineLayer: Phaser.GameObjects.Container // the lines of the page, one Text each
  private lines: { text: Phaser.GameObjects.Text; full: string }[] = []
  private ruler: Phaser.GameObjects.Text // invisible: measures how the page wraps and how tall it is
  private arrow: Phaser.GameObjects.Text
  private typing?: Phaser.Tweens.Tween
  private typingNow = false

  constructor(scene: Phaser.Scene, options: StoryPanelOptions) {
    this.scene = scene
    const { width, height, fontSize, padding } = options
    this.left = -width / 2 + (padding.left ?? padding.x)
    this.bandStyle = options.style === 'band'
    this.innerWidth = width - (padding.left ?? padding.x) - padding.x
    this.style = { fontFamily: FONT, fontSize: `${fontSize}px`, color: this.bandStyle ? BAND.textColor : TEXT_COLOR, lineSpacing: 4 }

    if (this.bandStyle) {
      ensureBandTexture(scene)
      this.band = scene.add.image(0, 0, BAND.key).setDisplaySize(width, height)
    } else {
      this.plate = new PlatePanel(scene, 0, 0, width, height)
      if (options.plateAlpha !== undefined) this.plate.setAlpha(options.plateAlpha)
    }
    this.lineLayer = scene.add.container(0, 0)
    this.ruler = scene.add.text(0, 0, '', { ...this.style, wordWrap: { width: this.innerWidth } }).setVisible(false)
    this.arrow = scene.add
      .text(width / 2 - ARROW.inset.x, height / 2 - ARROW.inset.y, ARROW.text, { fontFamily: FONT, fontSize: `${ARROW.size}px`, color: this.bandStyle ? BAND.textColor : TEXT_COLOR })
      .setOrigin(0.5)
      .setVisible(false)
    scene.tweens.add({ targets: this.arrow, alpha: 0.2, duration: ARROW.blinkMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.root = scene.add.container(options.x, options.y, [(this.band ?? this.plate)!, this.lineLayer, this.ruler, this.arrow])
  }

  isTyping(): boolean {
    return this.typingNow
  }

  setPosition(x: number, y: number) {
    this.root.setPosition(x, y)
  }

  // Moves and resizes the box (the endings move it from place to place); the next page uses the new size
  setLayout(options: StoryPanelOptions) {
    const { x, y, width, height, fontSize, padding } = options
    this.root.setPosition(x, y)
    this.plate?.resize(width, height)
    if (options.plateAlpha !== undefined) this.plate?.setAlpha(options.plateAlpha)
    this.band?.setDisplaySize(width, height)
    this.left = -width / 2 + (padding.left ?? padding.x)
    this.innerWidth = width - (padding.left ?? padding.x) - padding.x
    this.style = { ...this.style, fontSize: `${fontSize}px` }
    this.ruler.setFontSize(fontSize).setWordWrapWidth(this.innerWidth)
    this.arrow.setPosition(width / 2 - ARROW.inset.x, height / 2 - ARROW.inset.y)
  }

  // Starts a new page: its text fades in and is typed out. The page is wrapped into lines ONCE, here, and
  // every line gets its final place at once (a centered line is centered by its full width). Typing only
  // changes how much of each line is shown, so nothing ever moves.
  show(page: string) {
    this.stopTyping()
    this.arrow.setVisible(false)
    this.lineLayer.removeAll(true)
    this.lines = []

    const wrapped = this.ruler.getWrappedText(page)
    const blockHeight = this.ruler.setText(wrapped.join('\n')).height
    const lineHeight = this.ruler.setText('Ag').height
    // The step from one line to the next, including the line spacing (a one-line page has no step)
    const step = wrapped.length > 1 ? (blockHeight - lineHeight) / (wrapped.length - 1) : 0
    wrapped.forEach((line, i) => {
      const text = this.scene.add.text(0, 0, line, this.style).setOrigin(0, 0).setResolution(2)
      if (this.bandStyle) text.setShadow(BAND.shadow.x, BAND.shadow.y, '#000000', BAND.shadow.blur, true, true)
      // Centered lines (band) start at minus half of their full width; plate lines start at the left edge
      text.setPosition(this.bandStyle ? -text.width / 2 : this.left, -blockHeight / 2 + i * step)
      text.setText('')
      this.lineLayer.add(text)
      this.lines.push({ text, full: line })
    })

    this.lineLayer.setAlpha(0)
    this.scene.tweens.add({ targets: this.lineLayer, alpha: 1, duration: PAGE_FADE_MS })
    this.typingNow = true
    const total = this.lines.reduce((sum, line) => sum + line.full.length, 0)
    this.typing = this.scene.tweens.addCounter({
      from: 0,
      to: total,
      duration: (total / CHARS_PER_SECOND) * 1000,
      onUpdate: (tween) => this.reveal(Math.round(tween.getValue() ?? 0)),
      onComplete: () => this.done(),
    })
  }

  // Shows the first `count` characters of the page, filling the lines one after the other
  private reveal(count: number) {
    let left = count
    for (const line of this.lines) {
      line.text.setText(line.full.slice(0, Math.max(0, Math.min(left, line.full.length))))
      left -= line.full.length
    }
  }

  // A click while typing: the whole page at once
  finishTyping() {
    if (!this.typingNow) return
    this.stopTyping()
    this.reveal(Number.MAX_SAFE_INTEGER)
    this.done()
  }

  // The page stays; only the blinking arrow goes (the endings show their money line and buttons after it)
  hideArrow() {
    this.arrow.setVisible(false)
  }

  // Replaces the page with other content of the caller (the endings' final money line and buttons)
  clear() {
    this.stopTyping()
    this.lineLayer.removeAll(true)
    this.lines = []
    this.arrow.setVisible(false)
  }

  private stopTyping() {
    this.typing?.stop()
    this.typing = undefined
    this.typingNow = false
  }

  private done() {
    this.typingNow = false
    this.arrow.setVisible(true)
  }
}
