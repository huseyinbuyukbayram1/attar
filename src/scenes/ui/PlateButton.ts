import Phaser from 'phaser'
import { multiplyColor } from './liquidColor'
import { FONT } from './theme'

// The painted button plates (public/assets/ui/). A plate is stretched with a NineSlice: the four
// corners (with the brass ornaments) keep their shape, the edges and the middle stretch. The
// slice sizes are in picture pixels and must include the whole ornament; look at the picture and
// retune them if the art changes.
const PLATES = {
  long: { key: 'button_long', slice: { left: 44, right: 44, top: 40, bottom: 40 } }, // 480x126
  short: { key: 'button_short', slice: { left: 46, right: 46, top: 46, bottom: 46 } }, // 300x163
}
export type PlateVariant = keyof typeof PLATES

const LABEL_COLOR = '#3b2412' // dark ink
const LABEL_COLOR_SELECTED = '#6a5846' // a selected button has a lighter, less contrasty label
const DEFAULT_FONT_SIZE = 22
const LABEL_MARGIN_PX = 6 // free space between the label and the ornaments on each side
const FALLBACK = { fill: 0xf6e7c1, border: 0x8a5a3c } // plain look if a plate picture is missing

// Looks of the four states. A tint can only darken, so "brightened" is full white and the normal
// plate is a touch darker; the plate picture is multiplied by the tint.
// A selected button looks "pressed in": a darker, muted plate, a bit smaller, with a soft inner shadow.
// It is still clickable and brightens on hover like the others.
const TINT = { normal: 0xf0ece4, hover: 0xffffff, pressed: 0xc8c0b4, disabled: 0x8a8a8a, selected: 0xd8cbb8 }
const SCALE = { normal: 1, hover: 1.03, pressed: 0.97, selected: 0.97 }
const INNER_SHADOW = { color: 0x3b2412, alpha: 0.22, width: 3, inset: 5 } // a dark line just inside the border
const TWEEN_MS = 80
const DISABLED_ALPHA = 0.6

export type PlateButtonOptions = {
  label: string
  width: number
  height: number
  fontSize?: number
  variant?: PlateVariant
  accent?: number // multiplied into the plate's color in every state, e.g. 0xffe2a8 for a warm golden plate
  boldLabel?: boolean
  onClick: () => void
}

// Draws a plate of the wanted size, centered on (0, 0). The picture is scaled so its height is
// `height`; the nine-slice makes up the width. Returns undefined if the picture is missing.
function makePlate(scene: Phaser.Scene, variant: PlateVariant, width: number, height: number) {
  const plate = PLATES[variant]
  if (!scene.textures.exists(plate.key)) return undefined
  const frame = scene.textures.getFrame(plate.key)
  const scale = height / frame.height
  const { left, right, top, bottom } = plate.slice
  const image = scene.add.nineslice(0, 0, plate.key, undefined, width / scale, frame.height, left, right, top, bottom)
  image.setScale(scale)
  return { image, cornerPx: left * scale }
}

// A painted button. Same behaviour as the old cream button: the callback runs when the mouse goes
// down, a disabled button does nothing. The click sound is played by the callbacks, as before.
export class PlateButton extends Phaser.GameObjects.Container {
  private plate?: Phaser.GameObjects.NineSlice
  private fallback?: Phaser.GameObjects.Rectangle
  private label: Phaser.GameObjects.Text
  private innerShadow: Phaser.GameObjects.Graphics
  private selected = false
  private accent?: number
  private buttonWidth: number
  private fontSize: number
  private cornerPx: number
  private enabled = true
  private hovered = false

  constructor(scene: Phaser.Scene, x: number, y: number, options: PlateButtonOptions) {
    super(scene, x, y)
    scene.add.existing(this)
    const { width, height, onClick } = options
    this.buttonWidth = width
    this.fontSize = options.fontSize ?? DEFAULT_FONT_SIZE
    this.accent = options.accent

    const made = makePlate(scene, options.variant ?? 'long', width, height)
    this.cornerPx = made?.cornerPx ?? 0
    if (made) {
      this.plate = made.image
      this.add(made.image)
    } else {
      this.fallback = scene.add.rectangle(0, 0, width, height, FALLBACK.fill).setStrokeStyle(2, FALLBACK.border)
      this.add(this.fallback)
    }
    this.innerShadow = scene.add.graphics()
    this.innerShadow.lineStyle(INNER_SHADOW.width, INNER_SHADOW.color, INNER_SHADOW.alpha)
    this.innerShadow.strokeRoundedRect(-width / 2 + INNER_SHADOW.inset, -height / 2 + INNER_SHADOW.inset, width - INNER_SHADOW.inset * 2, height - INNER_SHADOW.inset * 2, 6)
    this.add(this.innerShadow)
    this.label = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: `${this.fontSize}px`, fontStyle: options.boldLabel ? 'bold' : 'normal', color: LABEL_COLOR })
      .setOrigin(0.5)
    this.add(this.label)
    this.setLabel(options.label)

    const hit = scene.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true })
    this.add(hit)
    hit.on('pointerover', () => {
      this.hovered = true
      this.show('hover')
    })
    hit.on('pointerout', () => {
      this.hovered = false
      this.show('normal')
    })
    hit.on('pointerdown', () => {
      if (!this.enabled) return
      this.show('pressed')
      onClick()
    })
    hit.on('pointerup', () => this.show(this.hovered ? 'hover' : 'normal'))
    this.show('normal')
  }

  // The label is made smaller if it would not fit between the corners
  setLabel(text: string) {
    this.label.setFontSize(this.fontSize)
    this.label.setText(text)
    const room = this.buttonWidth - (this.cornerPx + LABEL_MARGIN_PX) * 2
    if (this.label.width > room) this.label.setFontSize(Math.floor((this.fontSize * room) / this.label.width))
  }

  // A button that was pressed and then hidden (e.g. "Adjust") never gets its mouse-up, so it always
  // comes back in its normal look
  setVisible(value: boolean): this {
    super.setVisible(value)
    if (value) {
      this.hovered = false
      this.show('normal')
    }
    return this
  }

  // A selected button (e.g. the last chosen difficulty) looks pressed in, but works as usual
  setSelected(selected: boolean) {
    this.selected = selected
    this.show(this.hovered ? 'hover' : 'normal')
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    this.show('normal')
  }

  // One place for the looks of every state; disabled wins over everything
  private show(state: 'normal' | 'hover' | 'pressed') {
    // Selected only shows while the mouse is not on the button (hover and press look the same as always)
    const look = !this.enabled ? 'disabled' : state === 'normal' && this.selected ? 'selected' : state
    const tint = this.accent !== undefined && look !== 'disabled' ? multiplyColor(TINT[look], this.accent) : TINT[look]
    this.label.setColor(look === 'selected' ? LABEL_COLOR_SELECTED : LABEL_COLOR)
    this.innerShadow.setVisible(look === 'selected')
    this.plate?.setTint(tint)
    this.fallback?.setFillStyle(this.enabled ? FALLBACK.fill : 0xb8b0a0)
    this.setAlpha(this.enabled ? 1 : DISABLED_ALPHA)
    const scale = look === 'hover' ? SCALE.hover : look === 'pressed' ? SCALE.pressed : look === 'selected' ? SCALE.selected : SCALE.normal
    this.scene.tweens.killTweensOf(this)
    this.scene.tweens.add({ targets: this, scale, duration: TWEEN_MS })
  }
}

// Big panels (speech bubble, order note, story boxes) use the same plate. Their corners are drawn at
// this fraction of the picture's size (a full-size 44 px corner would be too heavy on a small
// panel), so a panel must be at least about 2 x slice x scale high (about 50 px at 0.6).
export const PANEL_CORNER_SCALE = 0.6
export const TAG_CORNER_SCALE = 0.3 // for small tabs, like the name tag of the speech bubble

// A plate panel, centered on (x, y), that can be resized: the corners keep their size and shape, the
// edges and the middle stretch. Not interactive. Text is placed by the caller, inside the border
// (leave a padding of about the corner size on each side).
export class PlatePanel extends Phaser.GameObjects.Container {
  private plate?: Phaser.GameObjects.NineSlice
  private fallback?: Phaser.GameObjects.Rectangle
  private cornerScale: number

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, cornerScale = PANEL_CORNER_SCALE, variant: PlateVariant = 'long') {
    super(scene, x, y)
    scene.add.existing(this)
    this.cornerScale = cornerScale
    const plate = PLATES[variant]
    if (scene.textures.exists(plate.key)) {
      const { left, right, top, bottom } = plate.slice
      this.plate = scene.add.nineslice(0, 0, plate.key, undefined, width / cornerScale, height / cornerScale, left, right, top, bottom)
      this.plate.setScale(cornerScale).setTint(TINT.normal)
      this.add(this.plate)
    } else {
      this.fallback = scene.add.rectangle(0, 0, width, height, FALLBACK.fill).setStrokeStyle(2, FALLBACK.border)
      this.add(this.fallback)
    }
  }

  resize(width: number, height: number) {
    this.plate?.setSize(width / this.cornerScale, height / this.cornerScale)
    this.fallback?.setSize(width, height)
  }
}

// A plate with a text on it that is not a button (the title, the money display, hints). Returns
// the Text so the caller can change it later.
export function addPlateLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  fontSize: number,
  variant: PlateVariant = 'long',
): Phaser.GameObjects.Text {
  const made = makePlate(scene, variant, width, height)
  if (made) made.image.setPosition(x, y).setTint(TINT.normal)
  else scene.add.rectangle(x, y, width, height, FALLBACK.fill).setStrokeStyle(2, FALLBACK.border)
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${fontSize}px`, color: LABEL_COLOR, align: 'center' }).setOrigin(0.5)
}
