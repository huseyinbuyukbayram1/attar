import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import { AXES, INGREDIENTS } from '../../data/ingredients'
import type { Axis } from '../../data/ingredients'
import type { SoundEvent } from '../../game/audio'
import { BASE_FRACTION, baseY, createShadow, SHADOW } from './counterBand'
import { measureBody } from './glassBox'
import { BORDER, CREAM, FONT, TEXT_COLOR } from './theme'
import type { Tooltip } from './Tooltip'

// Layout numbers for the 1280x720 screen
// The closed book lying at the far left end of the counter top. NOTEBOOK_X is its center, base the
// line the BODY of the book stands on (the ribbon hangs below it), the same depth on the counter as
// the flask. At 150 px wide the body is about 139 px wide: it spans x 106..244 at x 175, so it is
// 106 px from the screen edge (20 px needed) and about 140 px from the flask (30 px needed). The
// counter's back edge slopes from y 543 at the left border to y 497 at x 160, always above the
// base line (y 559), so the whole footprint is on the counter top.
const NOTEBOOK_X = 175
const NOTEBOOK_DISPLAY_WIDTH = 150
const NOTEBOOK_SINK_PX = 3 // the body sinks this far into the surface, so it rests on the wood
// Two contact shadows under the body (dark brown): a tight dark one and a thinner soft one below it.
// `y` is the ellipse center relative to the base line; the book covers the upper part of them.
const NOTEBOOK_SHADOWS = [
  { share: 0.92, height: 12, alpha: 0.5, y: 2 },
  { share: 1, height: 6, alpha: 0.25, y: 7 },
]
const NOTEBOOK_SHADOW_COLOR = 0x2a1810
const NOTEBOOK_SHADOW_HOVER = 0.75 // the shadows get this much of their alpha while the book is lifted
const NOTEBOOK_EVENING_TINT = 0xffd9b0 // the same warm multiply as the bottles
// The cream plate on the cover, measured in the 480x330 picture: center (245, 119.5), size 199x72
const NOTEBOOK_PLATE = { x: 245, y: 119.5, width: 199 }
const NOTEBOOK_LABEL_TEXT = 'NOTES'
const NOTEBOOK_LABEL_SIZE = 13 // px on screen; made smaller if the text does not fit the plate
const NOTEBOOK_LABEL_SPACING = 2 // px on screen
const NOTEBOOK_LABEL_MARGIN = 4 // px of free plate on each side of the text
const NOTEBOOK_LABEL_RESOLUTION = Math.max(3, window.devicePixelRatio) // text is drawn this much sharper
// Used only when notebook_closed.png is missing: a book drawn with shapes
const BOOK = { x: NOTEBOOK_X, base: baseY(BASE_FRACTION.flask), width: 84, height: 56, radius: 6, lift: 6, liftMs: 120 }
const BOOK_COLORS = { cover: 0x4a2c1c, edge: 0xc9a24a, label: CREAM, ribbon: 0x9c2f2f }
const BOOK_LABEL = { width: 44, height: 16, y: -34 } // cream strip; y = its center, relative to the base
const BOOK_RIBBON = { x: 14, width: 8, hang: 12 } // hangs below the base
const BOOK_TOOLTIP = { text: 'Notebook (Tab)', gap: 6 } // gap above the top of the lifted book
const PANEL = { x: 640, y: 360, width: 940, height: 560, radius: 18, alpha: 0.97 }
const PARCHMENT = 0xf3e2b8
const OVERLAY = { color: 0x000000, alpha: 0.45 }
const DEPTH = 900 // above the MIX view, below the phase fade (1000)
const FADE_MS = 150

// The table: title, subtitle and column headers on top, then one row per ingredient
const TITLE_Y = PANEL.y - PANEL.height / 2 + 34
const SUBTITLE_Y = TITLE_Y + 32
const HEADER_Y = SUBTITLE_Y + 38
const ROW = { firstY: HEADER_Y + 36, height: 38 }
const HINT_Y = PANEL.y + PANEL.height / 2 - 26
const COLUMNS = {
  swatchX: PANEL.x - PANEL.width / 2 + 42,
  nameX: PANEL.x - PANEL.width / 2 + 66,
  firstAxisX: PANEL.x - PANEL.width / 2 + 190, // left edge of the first axis column
  axisWidth: 148,
}
const SWATCH_RADIUS = 11
const BAR = { maxLength: 100, height: 16, textGap: 6 } // a 100% share would be maxLength wide
const FONT_SIZE = { title: 28, subtitle: 16, header: 16, cell: 15, hint: 15 } // px, none below 14

// One soft color per axis, used for the bars
const AXIS_COLORS: Record<Axis, number> = {
  floral: 0xe58fae,
  woody: 0xa8764a,
  citrus: 0xb9cc45,
  sweet: 0xe8a93a,
  spicy: 0xd6513a,
}

type Callbacks = {
  canOpen: () => boolean // true only while the MIX phase is idle
  onOpen: () => void // lets the MIX view hide things that must not stay (the tooltip)
  onSound: (event: SoundEvent) => void
}

// A share of an ingredient's total scent as a whole percent. Computed from the data on purpose,
// so a change in ingredients.ts shows up here without touching this file.
function sharePercent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

// The ingredient notebook: a button on the counter and a full-screen panel that explains what
// each essence is made of. It only draws; it never changes any game state.
export class Notebook {
  // The book belongs to the MIX view's root container, so it hides together with it
  readonly book: Phaser.GameObjects.Container
  private bookArt: Phaser.GameObjects.Container // the part that lifts on hover
  private bookSprite?: Phaser.GameObjects.Image // the picture, tinted in the evening
  private tooltip: Tooltip
  private layer: Phaser.GameObjects.Container
  private blocker: Phaser.GameObjects.Zone
  private scene: Phaser.Scene
  private callbacks: Callbacks
  private open = false

  constructor(scene: Phaser.Scene, tooltip: Tooltip, callbacks: Callbacks) {
    this.scene = scene
    this.tooltip = tooltip
    this.callbacks = callbacks
    ;[this.book, this.bookArt] = this.buildBook()

    const { width, height } = scene.scale
    // The zone is what catches the mouse (so nothing underneath gets clicks or hovers); the
    // dark rectangle is only the dimming. A click on the zone is a click outside the panel.
    this.blocker = scene.add.zone(width / 2, height / 2, width, height).setInteractive()
    this.blocker.on('pointerdown', () => this.close())
    const dim = scene.add.rectangle(width / 2, height / 2, width, height, OVERLAY.color, OVERLAY.alpha)

    const panel = scene.add.graphics()
    panel.fillStyle(PARCHMENT, PANEL.alpha)
    panel.fillRoundedRect(PANEL.x - PANEL.width / 2, PANEL.y - PANEL.height / 2, PANEL.width, PANEL.height, PANEL.radius)
    panel.lineStyle(2, BORDER, 1)
    panel.strokeRoundedRect(PANEL.x - PANEL.width / 2, PANEL.y - PANEL.height / 2, PANEL.width, PANEL.height, PANEL.radius)
    // Added after the blocker, so it is on top: clicks inside the panel do nothing
    const panelZone = scene.add.zone(PANEL.x, PANEL.y, PANEL.width, PANEL.height).setInteractive()

    this.layer = scene.add.container(0, 0, [this.blocker, dim, panel, panelZone])
    this.layer.add(this.buildTable())
    this.layer.setDepth(DEPTH).setAlpha(0).setVisible(false)
    this.blocker.disableInteractive()

    // Tab toggles; preventDefault stops the browser from moving focus away from the game
    const keyboard = scene.input.keyboard
    const onTab = (event: KeyboardEvent) => {
      event.preventDefault()
      this.toggle()
    }
    const onEsc = () => this.close()
    keyboard?.on('keydown-TAB', onTab)
    keyboard?.on('keydown-ESC', onEsc)
    // Phaser reuses this scene on restart, so remove the listeners when it shuts down
    scene.events.once('shutdown', () => {
      keyboard?.off('keydown-TAB', onTab)
      keyboard?.off('keydown-ESC', onEsc)
    })
  }

  isOpen(): boolean {
    return this.open
  }

  // Closes at once, with no fade. Used when the phase changes.
  closeNow() {
    this.scene.tweens.killTweensOf(this.layer)
    this.hideLayer()
  }

  // The fallback book, drawn with shapes: leather cover, gold edge, cream label, ribbon
  private buildBook(): [Phaser.GameObjects.Container, Phaser.GameObjects.Container] {
    const { scene } = this
    if (scene.textures.exists('notebook_closed')) return this.buildBookSprite()
    console.warn('Texture "notebook_closed" missing, drawing the notebook with shapes')
    const { width, height, radius } = BOOK
    const cover = scene.add.graphics()
    cover.fillStyle(BOOK_COLORS.cover, 1)
    cover.fillRoundedRect(-width / 2, -height, width, height, radius)
    cover.lineStyle(1.5, BOOK_COLORS.edge, 1)
    cover.strokeRoundedRect(-width / 2 + 3, -height + 3, width - 6, height - 6, radius - 2)
    cover.fillStyle(BOOK_COLORS.label, 1)
    cover.fillRoundedRect(-BOOK_LABEL.width / 2, BOOK_LABEL.y - BOOK_LABEL.height / 2, BOOK_LABEL.width, BOOK_LABEL.height, 3)
    cover.fillStyle(BOOK_COLORS.ribbon, 1)
    cover.fillRect(BOOK_RIBBON.x, -4, BOOK_RIBBON.width, 4 + BOOK_RIBBON.hang)
    const art = scene.add.container(0, 0, [cover])

    // The hit zone is on the outer container, so the lift does not make the hover flicker
    const hit = scene.add.zone(0, -height / 2, width, height + BOOK_RIBBON.hang).setInteractive({ useHandCursor: true })
    const shadow = createShadow(scene, 0, 0, width, SHADOW.bottleShare)
    const book = scene.add.container(BOOK.x, BOOK.base, [shadow, art, hit])

    const hover = (lifted: boolean) => {
      if (lifted && !this.callbacks.canOpen()) return // no hover effects during a pour, mix or emptying
      scene.tweens.add({ targets: art, y: lifted ? -BOOK.lift : 0, duration: BOOK.liftMs })
      if (lifted) this.tooltip.show(BOOK_TOOLTIP.text, BOOK.x, BOOK.base - height - BOOK.lift - BOOK_TOOLTIP.gap)
      else this.tooltip.hide()
    }
    hit.on('pointerover', () => hover(true))
    hit.on('pointerout', () => hover(false))
    hit.on('pointerdown', () => this.toggle())
    return [book, art]
  }

  // The notebook picture, placed so the BODY of the book (not the ribbon hanging below it) stands
  // on the base line, with a contact shadow under the body and the label on the cover's plate.
  // Sprite, label and hover lift all live in one container scaled to the picture, so the label
  // keeps its place on the cover.
  private buildBookSprite(): [Phaser.GameObjects.Container, Phaser.GameObjects.Container] {
    const { scene } = this
    const body = measureBody(scene, 'notebook_closed')
    const image = scene.add.image(0, 0, 'notebook_closed').setOrigin(0.5, 1)
    const scale = NOTEBOOK_DISPLAY_WIDTH / image.width
    // Inside the scaled container (picture pixels): the picture hangs `gapBelow` below the line,
    // plus the sink, so the body dips into the wood a little
    const sink = NOTEBOOK_SINK_PX / scale
    image.setY(body.gapBelow + sink)
    this.bookSprite = image
    const plateX = NOTEBOOK_PLATE.x - image.width / 2
    const plateY = NOTEBOOK_PLATE.y - image.height + body.gapBelow + sink
    // The container is scaled, so sizes in screen px are divided by the scale. Resolution makes the
    // letters sharp even though they are drawn small.
    const label = scene.add
      .text(plateX, plateY, NOTEBOOK_LABEL_TEXT, {
        fontFamily: FONT,
        fontSize: `${NOTEBOOK_LABEL_SIZE / scale}px`,
        fontStyle: 'bold',
        color: TEXT_COLOR,
        letterSpacing: NOTEBOOK_LABEL_SPACING / scale,
      })
      .setOrigin(0.5)
      .setResolution(NOTEBOOK_LABEL_RESOLUTION)
    // Too wide for the plate (with its margins)? Use the largest size that fits.
    const room = NOTEBOOK_PLATE.width * scale - NOTEBOOK_LABEL_MARGIN * 2
    const wide = label.width * scale
    if (wide > room) {
      const size = (NOTEBOOK_LABEL_SIZE * room) / wide
      label.setFontSize(size / scale).setLetterSpacing((NOTEBOOK_LABEL_SPACING * room) / wide / scale)
    }
    const art = scene.add.container(0, 0, [image, label]).setScale(scale)
    // The container's y is in screen pixels (its parent is not scaled); the scale only applies to its children

    // Body size on screen. The hit zone stays put (the lift would make hover flicker) and is an
    // octagon around the body, so the transparent corners do not count.
    const bodyWidth = (body.right - body.left + 1) * scale
    const bodyHeight = (body.bottom - body.top + 1) * scale
    const cut = Math.min(bodyHeight, bodyWidth) * 0.08 // corner chamfer
    const octagon = new Phaser.Geom.Polygon([
      cut, 0, bodyWidth - cut, 0, bodyWidth, cut, bodyWidth, bodyHeight - cut,
      bodyWidth - cut, bodyHeight, cut, bodyHeight, 0, bodyHeight - cut, 0, cut,
    ])
    const hit = scene.add
      .zone(0, -bodyHeight / 2, bodyWidth, bodyHeight)
      .setInteractive({ hitArea: octagon, hitAreaCallback: Phaser.Geom.Polygon.Contains, useHandCursor: true })
    const shadows = NOTEBOOK_SHADOWS.map((s) =>
      scene.add.ellipse(0, s.y, bodyWidth * s.share, s.height, NOTEBOOK_SHADOW_COLOR).setAlpha(s.alpha),
    )
    const book = scene.add.container(NOTEBOOK_X, BOOK.base, [...shadows, art, hit])

    const hover = (lifted: boolean) => {
      if (lifted && !this.callbacks.canOpen()) return // no hover effects during a pour, mix or emptying
      scene.tweens.add({ targets: art, y: lifted ? -BOOK.lift : 0, duration: BOOK.liftMs })
      shadows.forEach((shadow, i) =>
        scene.tweens.add({
          targets: shadow,
          alpha: NOTEBOOK_SHADOWS[i].alpha * (lifted ? NOTEBOOK_SHADOW_HOVER : 1), // fades a little
          duration: BOOK.liftMs,
        }),
      )
      if (lifted) this.tooltip.show(BOOK_TOOLTIP.text, NOTEBOOK_X, BOOK.base - bodyHeight - BOOK.lift - BOOK_TOOLTIP.gap)
      else this.tooltip.hide()
    }
    hit.on('pointerover', () => hover(true))
    hit.on('pointerout', () => hover(false))
    hit.on('pointerdown', () => this.toggle())
    return [book, art]
  }

  // Evening: the same warm multiply as the bottles. (The shape-drawn fallback is not tinted.)
  setEvening(evening: boolean) {
    if (!this.bookSprite) return
    if (evening) this.bookSprite.setTint(NOTEBOOK_EVENING_TINT)
    else this.bookSprite.clearTint()
  }

  private toggle() {
    if (this.open) this.close()
    else this.openNotebook()
  }

  private openNotebook() {
    if (this.open || !this.callbacks.canOpen()) return
    this.open = true
    this.callbacks.onOpen()
    this.scene.tweens.killTweensOf(this.bookArt)
    this.bookArt.y = 0 // the pointer is blocked now, so the hover would never end by itself
    this.callbacks.onSound('click')
    this.blocker.setInteractive()
    this.layer.setVisible(true)
    this.scene.tweens.killTweensOf(this.layer)
    this.scene.tweens.add({ targets: this.layer, alpha: 1, duration: FADE_MS })
  }

  private close() {
    if (!this.open) return
    this.callbacks.onSound('click')
    this.open = false
    this.blocker.disableInteractive() // stop blocking right away, the fade is only a picture
    this.scene.tweens.killTweensOf(this.layer)
    this.scene.tweens.add({
      targets: this.layer,
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => this.hideLayer(),
    })
  }

  private hideLayer() {
    this.open = false
    this.blocker.disableInteractive()
    this.layer.setAlpha(0).setVisible(false)
  }

  // Title, headers, one row per ingredient and the close hint
  private buildTable(): Phaser.GameObjects.GameObject[] {
    const { scene } = this
    const items: Phaser.GameObjects.GameObject[] = []
    const text = (x: number, y: number, str: string, size: number, originX = 0.5) =>
      scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color: TEXT_COLOR }).setOrigin(originX, 0.5)

    items.push(text(PANEL.x, TITLE_Y, "The Master's Notebook", FONT_SIZE.title))
    items.push(text(PANEL.x, SUBTITLE_Y, 'What each essence is made of.', FONT_SIZE.subtitle))

    // Column headers, with a thin line under them
    AXES.forEach((axis, i) => {
      const centerX = COLUMNS.firstAxisX + i * COLUMNS.axisWidth + COLUMNS.axisWidth / 2
      items.push(text(centerX, HEADER_Y, axis.charAt(0).toUpperCase() + axis.slice(1), FONT_SIZE.header))
    })
    items.push(scene.add.rectangle(PANEL.x, HEADER_Y + 18, PANEL.width - 60, 1, BORDER, 0.6))

    INGREDIENTS.forEach((ingredient, row) => {
      const y = ROW.firstY + row * ROW.height
      const color = INGREDIENT_COLORS[ingredient.id] ?? FALLBACK_COLOR
      items.push(scene.add.circle(COLUMNS.swatchX, y, SWATCH_RADIUS, color).setStrokeStyle(2, BORDER))
      items.push(text(COLUMNS.nameX, y, ingredient.name, FONT_SIZE.cell, 0))

      const total = AXES.reduce((sum, axis) => sum + ingredient.scent[axis], 0)
      AXES.forEach((axis, i) => {
        const percent = sharePercent(ingredient.scent[axis], total)
        if (percent === 0) return // empty cell: no bar, no text
        const x = COLUMNS.firstAxisX + i * COLUMNS.axisWidth + 8
        const length = (percent / 100) * BAR.maxLength
        items.push(scene.add.rectangle(x, y, length, BAR.height, AXIS_COLORS[axis]).setOrigin(0, 0.5).setStrokeStyle(1, BORDER, 0.6))
        items.push(text(x + length + BAR.textGap, y, `${percent}%`, FONT_SIZE.cell, 0))
      })
    })

    items.push(text(PANEL.x, HINT_Y, 'Tab or Esc to close', FONT_SIZE.hint))
    return items
  }
}
