import Phaser from 'phaser'
import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'
import { AXES, INGREDIENTS } from '../../data/ingredients'
import type { Axis } from '../../data/ingredients'
import type { SoundEvent } from '../../game/audio'
import { BASE_FRACTION, baseY, createShadow, SHADOW } from './counterBand'
import { BORDER, CREAM, FONT, TEXT_COLOR } from './theme'
import type { Tooltip } from './Tooltip'

// Layout numbers for the 1280x720 screen
// The closed book lying on the counter between the alembic (ends at x ~273) and the flask (starts
// at x ~383). x is its center, base is the line it lies on, the ribbon hangs a little below it.
const BOOK = { x: 332, base: baseY(BASE_FRACTION.flask), width: 84, height: 56, radius: 6, lift: 6, liftMs: 120 }
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

  // A small closed book drawn with shapes: leather cover, gold edge, cream label, ribbon
  private buildBook(): [Phaser.GameObjects.Container, Phaser.GameObjects.Container] {
    const { scene } = this
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
      scene.tweens.add({ targets: art, y: lifted ? -BOOK.lift : 0, duration: BOOK.liftMs })
      if (lifted) this.tooltip.show(BOOK_TOOLTIP.text, BOOK.x, BOOK.base - height - BOOK.lift - BOOK_TOOLTIP.gap)
      else this.tooltip.hide()
    }
    hit.on('pointerover', () => hover(true))
    hit.on('pointerout', () => hover(false))
    hit.on('pointerdown', () => this.toggle())
    return [book, art]
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
