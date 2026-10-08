import Phaser from 'phaser'
import { PlateButton, PlatePanel } from './PlateButton'
import { LOGO_FONT, LOGO_LETTER_SPACING } from './theme'

// ---- The "Start on Normal?" panel: tuning constants (screen px) ----
const PANEL = { x: 640, y: 360, width: 460, height: 270 }
const OVERLAY = { color: 0x000000, alpha: 0.55 } // a click on it (outside the panel) closes the panel
const DEPTH = 2000
const FADE_MS = 180
const SCALE_FROM = 0.95
const INK_CSS = '#3b2412'
const TITLE = { size: 32, y: -PANEL.height / 2 + 52 }
const BUTTONS = { width: 300, height: 50, fontSize: 22, firstY: -10, pitch: 70 }

// Shown when Play is pressed and the player has never chosen a difficulty: a quick way to start on the default one.
// "Yes" and "Choose difficulty" call their callbacks (the panel closes itself first); Esc and a click outside close it.
export class StartConfirmPanel {
  private scene: Phaser.Scene
  private layer: Phaser.GameObjects.Container
  private blocker: Phaser.GameObjects.Zone
  private dim: Phaser.GameObjects.Rectangle
  private root: Phaser.GameObjects.Container
  private fade = { t: 0 } // 0 = closed, 1 = open
  private open_ = false

  constructor(scene: Phaser.Scene, title: string, callbacks: { onYes: () => void; onChoose: () => void }) {
    this.scene = scene
    const { width, height } = scene.scale
    this.blocker = scene.add.zone(width / 2, height / 2, width, height).setInteractive()
    this.blocker.on('pointerdown', () => this.close())
    this.dim = scene.add.rectangle(width / 2, height / 2, width, height, OVERLAY.color).setAlpha(0)
    const button = (y: number, label: string, onClick: () => void) =>
      new PlateButton(scene, 0, y, { label, width: BUTTONS.width, height: BUTTONS.height, fontSize: BUTTONS.fontSize, onClick })
    this.root = scene.add.container(PANEL.x, PANEL.y, [
      new PlatePanel(scene, 0, 0, PANEL.width, PANEL.height),
      scene.add.zone(0, 0, PANEL.width, PANEL.height).setInteractive(), // a click inside the panel does nothing
      scene.add
        .text(0, TITLE.y, title, { fontFamily: LOGO_FONT, letterSpacing: LOGO_LETTER_SPACING, fontStyle: 'bold', fontSize: `${TITLE.size}px`, color: INK_CSS })
        .setOrigin(0.5)
        .setResolution(2),
      button(BUTTONS.firstY, 'Yes', () => {
        this.close()
        callbacks.onYes()
      }),
      button(BUTTONS.firstY + BUTTONS.pitch, 'Choose difficulty', () => {
        this.close()
        callbacks.onChoose()
      }),
    ])
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
}
