import Phaser from 'phaser'
import { AXES, INGREDIENTS } from '../../data/ingredients'
import type { Axis, Scent } from '../../data/ingredients'
import type { SoundEvent } from '../../game/audio'
import { BASE_FRACTION, baseY, createShadow, SHADOW } from './counterBand'
import { measureBody } from './glassBox'
import { lerpColor } from './liquidColor'
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
// ---- The open notebook panel: tuning constants ----
// Coordinates and sizes marked "image px" are in the 1100x703 space of notebook_open.png; the whole
// book is drawn inside one container that is scaled to BOOK_SCALE and centered on BOOK_CENTER.
const NOTEBOOK_OPEN_KEY = 'notebook_open'
const BOOK_IMAGE = { width: 1100, height: 703 } // image px; also the size of the plain fallback page
const BOOK_CENTER = { x: 640, y: 360 } // screen px
const BOOK_SCALE = 0.95
const BOOK_SCALE_START = 0.9 // the book grows from this to BOOK_SCALE while it fades in
const OVERLAY = { color: 0x000000, alpha: 0.55 } // dims the whole scene
const DEPTH = 900 // above the MIX view, below the phase fade (1000)
const FADE_MS = 200 // opening and closing
// The writable areas of the two pages (image px). The red ribbon hangs at about x 545..640,
// y 35..390 between them: nothing is drawn there.
const LEFT_PAGE = { x: 90, y: 60, width: 430, height: 580 }
const RIGHT_PAGE = { x: 650, y: 60, width: 355, height: 580 }
const INK = 0x3b2412
const INK_CSS = '#3b2412'
const TEXT_RESOLUTION = Math.max(2, window.devicePixelRatio) // text is drawn this much sharper
// Font sizes in image px (about 5 percent smaller on screen); row = the captions, legend = the colour legend
const FONT_SIZE = { title: 26, name: 20, row: 13, legend: 13, hint: 15 }
const TITLE = { text: "Master's Notebook", y: 84 } // centered on the left page; y = center line (image px)
const HINT = { text: 'Tab to close', y: 624 } // centered on the right page
// Five ingredient blocks per page, evenly spaced: block i starts at firstY + i * pitch. Each block
// has three lines; the numbers are the y of each line's center, counted from the top of the block.
const BLOCK = { firstY: 112, pitch: 92, nameY: 10, barY: 37, captionY: 62 }
// The stacked bar: spans the page rect minus `margin` on each side, one segment per non-zero axis
const BAR = { height: 14, margin: 8, segmentAlpha: 0.85, outlineWidth: 1.5, dividerWidth: 1, inkAlpha: 0.85 }
const CAPTION_TEXT_DARKEN = 0.45 // axis colors for the caption text are mixed this far towards ink, to be readable
const CAPTION_SEPARATOR = ' · '
// The colour legend, once, centered on the left page near its bottom
const LEGEND = { y: 612, swatch: 12, swatchGap: 5, itemGap: 16 }
const INGREDIENTS_PER_PAGE = 5
const PARCHMENT = 0xf3e2b8 // only used if the picture is missing

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

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

// The non-zero axes of an ingredient with their percents (from sharePercent), in the fixed axis
// order. Rounding can make the sum 99 or 101; the largest part takes the difference, so the
// percents shown always add up to 100.
function shares(scent: Scent): { axis: Axis; percent: number }[] {
  const total = AXES.reduce((sum, axis) => sum + scent[axis], 0)
  const parts = AXES.map((axis) => ({ axis, percent: sharePercent(scent[axis], total) })).filter((part) => part.percent > 0)
  if (parts.length === 0) return parts
  const largest = parts.reduce((best, part) => (part.percent > best.percent ? part : best))
  largest.percent += 100 - parts.reduce((sum, part) => sum + part.percent, 0)
  return parts
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
  private dim: Phaser.GameObjects.Rectangle
  private bookRoot: Phaser.GameObjects.Container
  private fade = { t: 0 } // 0 = closed, 1 = open: drives the dimming, the book's alpha and its scale
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
    // dark rectangle is only the dimming. A click on the zone is a click outside the book.
    this.blocker = scene.add.zone(width / 2, height / 2, width, height).setInteractive()
    this.blocker.on('pointerdown', () => this.close())
    this.dim = scene.add.rectangle(width / 2, height / 2, width, height, OVERLAY.color).setAlpha(0)

    this.bookRoot = this.buildOpenBook()
    this.layer = scene.add.container(0, 0, [this.blocker, this.dim, this.bookRoot])
    this.layer.setDepth(DEPTH).setVisible(false)
    this.applyFade()
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
    this.scene.tweens.killTweensOf(this.fade)
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
    this.fadeTo(1, () => {})
  }

  private close() {
    if (!this.open) return
    this.callbacks.onSound('click')
    this.open = false
    this.blocker.disableInteractive() // stop blocking right away, the fade is only a picture
    this.fadeTo(0, () => this.hideLayer())
  }

  private hideLayer() {
    this.open = false
    this.blocker.disableInteractive()
    this.fade.t = 0
    this.applyFade()
    this.layer.setVisible(false)
  }

  // Opening and closing: the dimming and the book fade together, and the book grows / shrinks
  private fadeTo(target: number, then: () => void) {
    this.scene.tweens.killTweensOf(this.fade)
    this.scene.tweens.add({
      targets: this.fade,
      t: target,
      duration: FADE_MS,
      ease: 'Sine.easeOut',
      onUpdate: () => this.applyFade(),
      onComplete: then,
    })
  }

  private applyFade() {
    this.dim.setAlpha(OVERLAY.alpha * this.fade.t)
    this.bookRoot.setAlpha(this.fade.t).setScale(Phaser.Math.Linear(BOOK_SCALE_START, BOOK_SCALE, this.fade.t))
  }

  // The open book: the picture (or a plain page if it is missing) with the title, the ten
  // ingredients and the hint written on it. The container's origin is the center of the picture, so
  // a point (x, y) in image px is at (x - width / 2, y - height / 2) inside it.
  private buildOpenBook(): Phaser.GameObjects.Container {
    const { scene } = this
    const { width, height } = BOOK_IMAGE
    const items: Phaser.GameObjects.GameObject[] = []
    const at = (x: number, y: number) => ({ x: x - width / 2, y: y - height / 2 })

    if (scene.textures.exists(NOTEBOOK_OPEN_KEY)) {
      items.push(scene.add.image(0, 0, NOTEBOOK_OPEN_KEY))
    } else {
      console.warn(`Texture "${NOTEBOOK_OPEN_KEY}" missing, drawing a plain page`)
      const page = scene.add.graphics()
      page.fillStyle(PARCHMENT, 1)
      page.fillRoundedRect(-width / 2, -height / 2, width, height, 24)
      page.lineStyle(3, BORDER, 1)
      page.strokeRoundedRect(-width / 2, -height / 2, width, height, 24)
      items.push(page)
    }
    // Added after the picture, so it is on top: clicks inside the book do nothing (outside closes it)
    items.push(scene.add.zone(0, 0, width, height).setInteractive())

    const text = (x: number, y: number, str: string, size: number, originX = 0.5, alpha = 1) => {
      const p = at(x, y)
      return scene.add
        .text(p.x, p.y, str, { fontFamily: FONT, fontSize: `${size}px`, color: INK_CSS })
        .setOrigin(originX, 0.5)
        .setAlpha(alpha)
        .setResolution(TEXT_RESOLUTION)
    }

    items.push(text(LEFT_PAGE.x + LEFT_PAGE.width / 2, TITLE.y, TITLE.text, FONT_SIZE.title))
    items.push(text(RIGHT_PAGE.x + RIGHT_PAGE.width / 2, HINT.y, HINT.text, FONT_SIZE.hint))

    // The percentages are computed from the data, exactly as before (sharePercent)
    INGREDIENTS.forEach((ingredient, index) => {
      const page = index < INGREDIENTS_PER_PAGE ? LEFT_PAGE : RIGHT_PAGE
      const top = BLOCK.firstY + (index % INGREDIENTS_PER_PAGE) * BLOCK.pitch

      // Line 1: the name
      items.push(text(page.x, top + BLOCK.nameY, ingredient.name, FONT_SIZE.name, 0))

      // Only the axes that are in this ingredient, in the fixed axis order
      const parts = shares(ingredient.scent)

      // Line 2: one stacked bar over the page width, a segment per axis, with an ink outline and dividers
      const barX = page.x + BAR.margin
      const barWidth = page.width - BAR.margin * 2
      const barY = top + BLOCK.barY
      let segmentX = barX
      parts.forEach((part, i) => {
        const w = (barWidth * part.percent) / 100
        const at0 = at(segmentX, barY)
        items.push(scene.add.rectangle(at0.x, at0.y, w, BAR.height, AXIS_COLORS[part.axis]).setOrigin(0, 0.5).setAlpha(BAR.segmentAlpha))
        if (i > 0) items.push(scene.add.rectangle(at0.x, at0.y, BAR.dividerWidth, BAR.height, INK).setAlpha(BAR.inkAlpha))
        segmentX += w
      })
      const outline = at(barX, barY)
      items.push(scene.add.rectangle(outline.x, outline.y, barWidth, BAR.height).setOrigin(0, 0.5).setStrokeStyle(BAR.outlineWidth, INK, BAR.inkAlpha))

      // Line 3: "Floral 75% · Sweet 25%", each part in its (darkened) axis colour
      let captionX = page.x
      const captionY = top + BLOCK.captionY
      const piece = (str: string, color: string) => {
        const t = text(captionX, captionY, str, FONT_SIZE.row, 0).setColor(color)
        items.push(t)
        captionX += t.width
      }
      parts.forEach((part, i) => {
        if (i > 0) piece(CAPTION_SEPARATOR, INK_CSS)
        piece(`${capitalize(part.axis)} ${part.percent}%`, cssColor(lerpColor(AXIS_COLORS[part.axis], INK, CAPTION_TEXT_DARKEN)))
      })
    })

    // The legend: a swatch and the name of each axis, in a row, centered on the left page
    const legend = AXES.map((axis) => ({ axis, label: text(0, LEGEND.y, capitalize(axis), FONT_SIZE.legend, 0) }))
    const legendWidth = legend.reduce((sum, item) => sum + LEGEND.swatch + LEGEND.swatchGap + item.label.width, 0) + LEGEND.itemGap * (AXES.length - 1)
    let legendX = LEFT_PAGE.x + (LEFT_PAGE.width - legendWidth) / 2
    legend.forEach((item) => {
      const swatch = at(legendX + LEGEND.swatch / 2, LEGEND.y)
      items.push(scene.add.rectangle(swatch.x, swatch.y, LEGEND.swatch, LEGEND.swatch, AXIS_COLORS[item.axis]).setAlpha(BAR.segmentAlpha).setStrokeStyle(1, INK, BAR.inkAlpha))
      item.label.setPosition(at(legendX + LEGEND.swatch + LEGEND.swatchGap, LEGEND.y).x, item.label.y)
      items.push(item.label)
      legendX += LEGEND.swatch + LEGEND.swatchGap + item.label.width + LEGEND.itemGap
    })

    return scene.add.container(BOOK_CENTER.x, BOOK_CENTER.y, items)
  }
}
