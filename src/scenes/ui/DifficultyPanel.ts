import Phaser from 'phaser'
import { DIFFICULTIES, DIFFICULTY_IDS, getDifficulty, setDifficulty } from '../../game/difficulty'
import type { DifficultyId } from '../../game/difficulty'
import { describeDifficulty } from '../../game/economy'
import { PlateButton, PlatePanel } from './PlateButton'
import { FONT, LOGO_FONT, LOGO_LETTER_SPACING } from './theme'

// ---- The difficulty picker: tuning constants (screen px) ----
const PANEL = { x: 640, y: 360, width: 560, height: 480 }
const OVERLAY = { color: 0x000000, alpha: 0.55 } // a click on it (outside the panel) closes the panel
const DEPTH = 2000
const FADE_MS = 180
const SCALE_FROM = 0.95
const INK_CSS = '#3b2412'
const TITLE = { text: 'Choose your path', size: 34, y: -PANEL.height / 2 + 50 }
const ROWS = { firstY: -100, pitch: 105 } // y of each difficulty button
const BUTTON = { width: 300, height: 54, fontSize: 26 }
const DESCRIPTION = { gap: 40, size: 17 } // gap: from the center of the button to the description
const BACK = { y: PANEL.height / 2 - 45, width: 140, height: 44, fontSize: 20 }

// The panel that opens when Play is pressed: Easy / Normal / Hard, each with its debt and smells.
// The last choice is shown pressed in (it was saved by difficulty.ts). Picking one saves it, closes the panel
// and calls onPick; Esc, Back and a click outside close it without picking.
export class DifficultyPanel {
  private scene: Phaser.Scene
  private layer: Phaser.GameObjects.Container
  private blocker: Phaser.GameObjects.Zone
  private dim: Phaser.GameObjects.Rectangle
  private root: Phaser.GameObjects.Container
  private buttons = new Map<DifficultyId, PlateButton>()
  private fade = { t: 0 } // 0 = closed, 1 = open
  private open_ = false

  constructor(scene: Phaser.Scene, onPick: (id: DifficultyId) => void) {
    this.scene = scene
    const { width, height } = scene.scale
    this.blocker = scene.add.zone(width / 2, height / 2, width, height).setInteractive()
    this.blocker.on('pointerdown', () => this.close())
    this.dim = scene.add.rectangle(width / 2, height / 2, width, height, OVERLAY.color).setAlpha(0)
    this.root = this.build(onPick)
    this.layer = scene.add.container(0, 0, [this.blocker, this.dim, this.root]).setDepth(DEPTH).setVisible(false)
    this.blocker.disableInteractive()
    this.applyFade()

    const onEsc = () => this.close()
    scene.input.keyboard?.on('keydown-ESC', onEsc)
    scene.events.once('shutdown', () => scene.input.keyboard?.off('keydown-ESC', onEsc))
  }

  isOpen(): boolean {
    return this.open_
  }

  open() {
    if (this.open_) return
    this.open_ = true
    this.markLastChoice()
    this.blocker.setInteractive()
    this.layer.setVisible(true)
    this.fadeTo(1, () => {})
  }

  close() {
    if (!this.open_) return
    this.open_ = false
    this.blocker.disableInteractive() // stop blocking at once; the fade is only a picture
    this.fadeTo(0, () => this.layer.setVisible(false))
  }

  private fadeTo(target: number, then: () => void) {
    this.scene.tweens.killTweensOf(this.fade)
    this.scene.tweens.add({ targets: this.fade, t: target, duration: FADE_MS, ease: 'Sine.easeOut', onUpdate: () => this.applyFade(), onComplete: then })
  }

  private applyFade() {
    this.dim.setAlpha(OVERLAY.alpha * this.fade.t)
    this.root.setAlpha(this.fade.t).setScale(Phaser.Math.Linear(SCALE_FROM, 1, this.fade.t))
  }

  private build(onPick: (id: DifficultyId) => void): Phaser.GameObjects.Container {
    const { scene } = this
    const items: Phaser.GameObjects.GameObject[] = []
    items.push(new PlatePanel(scene, 0, 0, PANEL.width, PANEL.height))
    items.push(scene.add.zone(0, 0, PANEL.width, PANEL.height).setInteractive()) // a click inside the panel does nothing
    items.push(
      scene.add
        .text(0, TITLE.y, TITLE.text, { fontFamily: LOGO_FONT, letterSpacing: LOGO_LETTER_SPACING, fontStyle: 'bold', fontSize: `${TITLE.size}px`, color: INK_CSS })
        .setOrigin(0.5)
        .setResolution(2),
    )
    DIFFICULTY_IDS.forEach((id, i) => {
      const y = ROWS.firstY + i * ROWS.pitch
      const difficulty = DIFFICULTIES[id]
      const button = new PlateButton(scene, 0, y, {
        label: difficulty.label,
        width: BUTTON.width,
        height: BUTTON.height,
        fontSize: BUTTON.fontSize,
        onClick: () => {
          setDifficulty(id) // remembered for the next time
          this.close()
          onPick(id)
        },
      })
      this.buttons.set(id, button)
      items.push(
        button,
        scene.add
          .text(0, y + DESCRIPTION.gap, describeDifficulty(difficulty), { fontFamily: FONT, fontSize: `${DESCRIPTION.size}px`, color: INK_CSS })
          .setOrigin(0.5)
          .setResolution(2),
      )
    })

    items.push(new PlateButton(scene, 0, BACK.y, { label: 'Back', width: BACK.width, height: BACK.height, fontSize: BACK.fontSize, onClick: () => this.close() }))
    return scene.add.container(PANEL.x, PANEL.y, items)
  }

  // The button of the current (last chosen) difficulty is shown pressed in
  private markLastChoice() {
    const current = getDifficulty().id
    this.buttons.forEach((button, id) => button.setSelected(id === current))
  }
}
