import Phaser from 'phaser'
import { playEffect, toggleMute } from '../../game/audio'
import { getSettings, onSettingsChange, updateSettings } from '../../game/settings'
import { resetTutorial } from '../../game/tutorial'
import { PlateButton, PlatePanel } from './PlateButton'
import { Slider } from './Slider'
import { FONT, LOGO_FONT, LOGO_LETTER_SPACING } from './theme'

// ---- The settings panel: tuning constants (screen px) ----
// Reusable: create it in any scene with `new SettingsPanel(scene)` and call open().
const PANEL = { x: 640, y: 360, width: 620, height: 460 }
const OVERLAY = { color: 0x000000, alpha: 0.55 } // dims the scene; a click on it closes the panel
const DEPTH = 2000 // above everything in the scene (the title screen's fade is the camera, not an object)
const FADE_MS = 180
const SCALE_FROM = 0.95 // the panel grows from this to 1 while it fades in

const INK_CSS = '#3b2412'
const FONT_SIZE = { title: 38, label: 18, percent: 16, header: 18, controlKey: 15, controlText: 15 }
const TITLE_Y = -PANEL.height / 2 + 52 // all y values below are inside the panel, from its center

// The three audio rows, one under the other. The columns are x positions inside the panel.
const ROWS = { firstY: -100, pitch: 48 }
const COLUMNS = { label: -270, track: -120, trackWidth: 220, percent: 120, mute: 195 }
const SLIDERS = [
  { key: 'master', label: 'Master' },
  { key: 'music', label: 'Music & ambience' },
  { key: 'effects', label: 'Effects' },
] as const

// The mute check box (next to the master slider), drawn with shapes in the same style as the slider
const CHECK = { size: 22, ink: 0x3b2412, fill: 0xf2e8d8, mark: 0xb0643c, markWidth: 3, labelGap: 10, hitWidth: 80, hitHeight: 30 }

// The player-facing controls, read from the code (Tab and Esc: Notebook.ts, Enter / Space: TitleScene
// and IntroScene, M: audio.ts). The temporary developer keys (N, B, G, E) are not listed.
const CONTROLS = {
  headerY: 36,
  firstY: 64,
  pitch: 20,
  keyX: COLUMNS.label,
  textX: -120,
  lines: [
    ['Mouse', 'Pick bottles, press buttons'],
    ['Tab', "Open or close the Master's Notebook"],
    ['Esc', 'Pause, or close an open panel'],
    ['Enter / Space', 'Confirm, continue the story'],
    ['M', 'Mute or unmute the sound'],
  ],
}
// "Replay tutorial": a small button on the Controls header row; after a click a note says when it runs
const REPLAY = { x: 195, y: 36, width: 170, height: 34, fontSize: 17 }
const REPLAY_NOTE = { x: -300, y: 190, width: 200, fontSize: 13, text: 'The tutorial runs on your next new game.' }
const CLOSE_BUTTON = { y: PANEL.height / 2 - 40, width: 180, height: 46, fontSize: 20 }

// A panel with sliders for master, music & ambience and effects volume, a mute box, a list of the
// controls and a Close button. Changes are applied at once through the settings (src/game/settings.ts)
// and the audio helper, and saved by it.
export class SettingsPanel {
  private scene: Phaser.Scene
  private layer: Phaser.GameObjects.Container
  private blocker: Phaser.GameObjects.Zone
  private dim: Phaser.GameObjects.Rectangle
  private root: Phaser.GameObjects.Container
  private sliders: { key: (typeof SLIDERS)[number]['key']; slider: Slider; percent: Phaser.GameObjects.Text }[] = []
  private checkBox!: Phaser.GameObjects.Graphics
  private fade = { t: 0 } // 0 = closed, 1 = open
  private open_ = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const { width, height } = scene.scale
    // The blocker catches every click, so nothing underneath can be pressed while the panel is open;
    // a click on it (outside the panel) closes the panel
    this.blocker = scene.add.zone(width / 2, height / 2, width, height).setInteractive()
    this.blocker.on('pointerdown', () => this.close())
    this.dim = scene.add.rectangle(width / 2, height / 2, width, height, OVERLAY.color).setAlpha(0)
    this.root = this.build()
    this.layer = scene.add.container(0, 0, [this.blocker, this.dim, this.root]).setDepth(DEPTH).setVisible(false)
    this.blocker.disableInteractive()
    this.applyFade()

    const onEsc = () => this.close()
    scene.input.keyboard?.on('keydown-ESC', onEsc)
    // The sliders and the mute box follow changes made elsewhere (the M key)
    const stopListening = onSettingsChange(() => this.showSettings())
    scene.events.once('shutdown', () => {
      scene.input.keyboard?.off('keydown-ESC', onEsc)
      stopListening()
    })
  }

  isOpen(): boolean {
    return this.open_
  }

  open() {
    if (this.open_) return
    this.open_ = true
    this.showSettings()
    this.blocker.setInteractive()
    this.layer.setVisible(true)
    this.fadeTo(1, () => {})
  }

  close() {
    if (!this.open_) return
    this.open_ = false
    this.blocker.disableInteractive() // stop blocking right away; the fade is only a picture
    this.fadeTo(0, () => this.layer.setVisible(false))
  }

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
    this.root.setAlpha(this.fade.t).setScale(Phaser.Math.Linear(SCALE_FROM, 1, this.fade.t))
  }

  // Puts the saved values on the sliders, the percentages and the check box
  private showSettings() {
    // A change can arrive while the scene is shutting down (the pause menu turns the music back up
    // then), when its texts are already gone
    if (!this.scene.sys.isActive()) return
    const settings = getSettings()
    for (const { key, slider, percent } of this.sliders) {
      slider.setValue(settings[key])
      percent.setText(`${Math.round(settings[key] * 100)}%`)
    }
    this.drawCheck(settings.muted)
  }

  private build(): Phaser.GameObjects.Container {
    const { scene } = this
    const items: Phaser.GameObjects.GameObject[] = []
    const text = (x: number, y: number, str: string, size: number, originX = 0, bold = false) =>
      scene.add
        .text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color: INK_CSS })
        .setOrigin(originX, 0.5)
        .setResolution(2)

    items.push(new PlatePanel(scene, 0, 0, PANEL.width, PANEL.height))
    // Added right after the plate, below the sliders and buttons: a click inside the panel does nothing
    items.push(scene.add.zone(0, 0, PANEL.width, PANEL.height).setInteractive())
    items.push(
      scene.add
        .text(0, TITLE_Y, 'Settings', { fontFamily: LOGO_FONT, letterSpacing: LOGO_LETTER_SPACING, fontStyle: 'bold', fontSize: `${FONT_SIZE.title}px`, color: INK_CSS })
        .setOrigin(0.5)
        .setResolution(2),
    )

    // The three volume rows
    SLIDERS.forEach(({ key, label }, i) => {
      const y = ROWS.firstY + i * ROWS.pitch
      items.push(text(COLUMNS.label, y, label, FONT_SIZE.label))
      const percent = text(COLUMNS.percent, y, '', FONT_SIZE.percent)
      const slider = new Slider(scene, COLUMNS.track, y, {
        width: COLUMNS.trackWidth,
        value: getSettings()[key],
        onChange: (value) => {
          updateSettings({ [key]: value })
          percent.setText(`${Math.round(value * 100)}%`)
        },
        // After setting the effects volume, one click sound lets the player hear the level
        onRelease: key === 'effects' ? () => playEffect(scene, 'click') : undefined,
      })
      this.sliders.push({ key, slider, percent })
      items.push(slider, percent)
    })

    // The mute check box, next to the master slider
    const muteY = ROWS.firstY
    this.checkBox = scene.add.graphics()
    items.push(this.checkBox)
    items.push(text(COLUMNS.mute + CHECK.size / 2 + CHECK.labelGap, muteY, 'Mute', FONT_SIZE.label))
    const checkHit = scene.add
      .zone(COLUMNS.mute + CHECK.hitWidth / 2 - CHECK.size / 2, muteY, CHECK.hitWidth, CHECK.hitHeight)
      .setInteractive({ useHandCursor: true })
    checkHit.on('pointerdown', () => toggleMute(scene))
    items.push(checkHit)

    // The controls
    items.push(text(COLUMNS.label, CONTROLS.headerY, 'Controls', FONT_SIZE.header, 0, true))
    CONTROLS.lines.forEach(([key, what], i) => {
      const y = CONTROLS.firstY + i * CONTROLS.pitch
      items.push(text(CONTROLS.keyX, y, key, FONT_SIZE.controlKey, 0, true), text(CONTROLS.textX, y, what, FONT_SIZE.controlText))
    })

    // Replay tutorial: resets the "seen" flag (the next new game shows it) and says so
    const note = scene.add
      .text(REPLAY_NOTE.x, REPLAY_NOTE.y, REPLAY_NOTE.text, { fontFamily: FONT, fontSize: `${REPLAY_NOTE.fontSize}px`, color: INK_CSS, wordWrap: { width: REPLAY_NOTE.width } })
      .setOrigin(0, 0.5)
      .setResolution(2)
      .setVisible(false)
    items.push(
      note,
      new PlateButton(scene, REPLAY.x, REPLAY.y, {
        label: 'Replay tutorial',
        width: REPLAY.width,
        height: REPLAY.height,
        fontSize: REPLAY.fontSize,
        onClick: () => {
          resetTutorial()
          note.setVisible(true)
        },
      }),
    )

    items.push(
      new PlateButton(scene, 0, CLOSE_BUTTON.y, {
        label: 'Close',
        width: CLOSE_BUTTON.width,
        height: CLOSE_BUTTON.height,
        fontSize: CLOSE_BUTTON.fontSize,
        onClick: () => this.close(),
      }),
    )
    const root = scene.add.container(PANEL.x, PANEL.y, items)
    return root
  }

  // The check box: a small ink-outlined square, with a copper tick when the sound is muted
  private drawCheck(checked: boolean) {
    const g = this.checkBox
    const x = COLUMNS.mute - CHECK.size / 2
    const y = ROWS.firstY - CHECK.size / 2
    g.clear()
    g.fillStyle(CHECK.fill, 1)
    g.fillRoundedRect(x, y, CHECK.size, CHECK.size, 4)
    g.lineStyle(2, CHECK.ink, 1)
    g.strokeRoundedRect(x, y, CHECK.size, CHECK.size, 4)
    if (checked) {
      g.lineStyle(CHECK.markWidth, CHECK.mark, 1)
      g.beginPath()
      g.moveTo(x + 5, y + CHECK.size * 0.55)
      g.lineTo(x + CHECK.size * 0.42, y + CHECK.size - 6)
      g.lineTo(x + CHECK.size - 5, y + 6)
      g.strokePath()
    }
  }
}
