import Phaser from 'phaser'
import { playEffect, toggleMute } from '../../game/audio'
import { previewMoney } from '../../game/endingPreview'
import type { PreviewEnding } from '../../game/endingPreview'
import { getDifficulty } from '../../game/difficulty'
import { getSettings, onSettingsChange, updateSettings } from '../../game/settings'
import { resetTutorial } from '../../game/tutorial'
import { PlateButton, PlatePanel } from './PlateButton'
import { Slider } from './Slider'
import { FONT, LOGO_FONT, LOGO_LETTER_SPACING } from './theme'

// ---- The settings panel: tuning constants (screen px) ----
// Reusable: create it in any scene with `new SettingsPanel(scene)` and call open().
// The panel is as tall as its content: LAYOUT lists where each thing is, in px from the panel's top edge, and
// the height follows from the Close button. fromTop() turns such a distance into a y inside the panel (whose
// origin is its center).
const CLOSE_BUTTON = { width: 180, height: 46, fontSize: 20 }
const BOTTOM_PADDING = 38 // between the Close button and the panel's bottom edge
const LAYOUT = {
  title: 50,
  // Section "Sound": heading, then three slider rows
  soundHeading: 104,
  firstSlider: 142,
  sliderPitch: 40,
  // Section "Controls": heading, then the key list
  controlsHeading: 266,
  firstControl: 300,
  controlPitch: 20,
  // Section "Extras": heading, then one row with two buttons and the note that may appear under them
  extrasHeading: 424,
  extrasButtons: 464,
  extrasNote: 496,
  close: 540,
}
const PANEL = { x: 640, y: 360, width: 620, height: LAYOUT.close + CLOSE_BUTTON.height / 2 + BOTTOM_PADDING }
const fromTop = (offset: number) => offset - PANEL.height / 2
const OVERLAY = { color: 0x000000, alpha: 0.55 } // dims the scene; a click on it closes the panel
const DEPTH = 2000 // above everything in the scene (the title screen's fade is the camera, not an object)
const FADE_MS = 180
const SCALE_FROM = 0.95 // the panel grows from this to 1 while it fades in

const INK_CSS = '#3b2412'
const FONT_SIZE = { title: 38, label: 18, percent: 16, header: 18, controlKey: 15, controlText: 15 }
const TITLE_Y = fromTop(LAYOUT.title)
// A thin rule under each section heading
const RULE = { gap: 15, color: 0x3b2412, alpha: 0.3, left: -270, right: 270 }

// The three audio rows, one under the other. The columns are x positions inside the panel.
const ROWS = { firstY: fromTop(LAYOUT.firstSlider), pitch: LAYOUT.sliderPitch }
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
// Extras: two equal buttons side by side, centered. After "Replay tutorial" a note says when it runs.
const EXTRAS = { buttonWidth: 220, buttonHeight: 36, gap: 20, fontSize: 17 }
const REPLAY_NOTE = { fontSize: 13, text: 'The tutorial runs on your next new game.' }
// The sub-panel of "View endings": a compact plate of its own, centered on the screen like the panel
const ENDINGS = {
  width: 580,
  title: { offset: 50, size: 34 },
  note: { offset: 92, fontSize: 17, width: 510 },
  firstButton: 162, // center of the first button, from the top edge
  button: { width: 280, height: 46, fontSize: 20, pitch: 82 }, // pitch: from one button to the next, caption included
  caption: { size: 13, gap: 4, height: 17, color: '#6b4a32' }, // the small italic line under a button (2/3 of its font size, muted ink)
  backGap: 26, // the gap between the last caption and Back
  list: [
    { label: 'The door closes', caption: 'Not every story has a happy ending.', ending: 'lose' },
    { label: 'The debt is paid', caption: 'The door stays open.', ending: 'win' },
    { label: 'A line at the door', caption: 'The whole street knows your name.', ending: 'great' },
  ] as { label: string; caption: string; ending: PreviewEnding }[],
  text: "Rıza Efendi's shop can end three ways. Which one will be yours?",
}
const ENDINGS_BACK = ENDINGS.firstButton + (ENDINGS.list.length - 1) * ENDINGS.button.pitch + ENDINGS.button.height + ENDINGS.caption.gap + ENDINGS.caption.height + ENDINGS.backGap // center of Back
const ENDINGS_HEIGHT = ENDINGS_BACK + ENDINGS.button.height / 2 + BOTTOM_PADDING

// A panel with sliders for master, music & ambience and effects volume, a mute box, a list of the
// controls and a Close button. Changes are applied at once through the settings (src/game/settings.ts)
// and the audio helper, and saved by it.
export class SettingsPanel {
  private scene: Phaser.Scene
  private layer: Phaser.GameObjects.Container
  private blocker: Phaser.GameObjects.Zone
  private dim: Phaser.GameObjects.Rectangle
  private root: Phaser.GameObjects.Container
  private endings: Phaser.GameObjects.Container // the sub-panel "View endings", shown instead of the root
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
    this.endings = this.buildEndings().setVisible(false)
    this.layer = scene.add.container(0, 0, [this.blocker, this.dim, this.root, this.endings]).setDepth(DEPTH).setVisible(false)
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
    this.showEndings(false)
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
    const scale = Phaser.Math.Linear(SCALE_FROM, 1, this.fade.t)
    this.root.setAlpha(this.fade.t).setScale(scale)
    this.endings.setAlpha(this.fade.t).setScale(scale)
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
    // A section heading: small and bold, with a thin rule under it
    const heading = (label: string, offset: number) => {
      const y = fromTop(offset)
      const rule = scene.add.graphics()
      rule.lineStyle(1, RULE.color, RULE.alpha)
      rule.lineBetween(RULE.left, y + RULE.gap, RULE.right, y + RULE.gap)
      items.push(text(COLUMNS.label, y, label, FONT_SIZE.header, 0, true), rule)
    }

    items.push(new PlatePanel(scene, 0, 0, PANEL.width, PANEL.height))
    // Added right after the plate, below the sliders and buttons: a click inside the panel does nothing
    items.push(scene.add.zone(0, 0, PANEL.width, PANEL.height).setInteractive())
    items.push(
      scene.add
        .text(0, TITLE_Y, 'Settings', { fontFamily: LOGO_FONT, letterSpacing: LOGO_LETTER_SPACING, fontStyle: 'bold', fontSize: `${FONT_SIZE.title}px`, color: INK_CSS })
        .setOrigin(0.5)
        .setResolution(2),
    )

    // Section "Sound": the three volume rows
    heading('Sound', LAYOUT.soundHeading)
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

    // Section "Controls"
    heading('Controls', LAYOUT.controlsHeading)
    CONTROLS.lines.forEach(([key, what], i) => {
      const y = fromTop(LAYOUT.firstControl + i * LAYOUT.controlPitch)
      items.push(text(CONTROLS.keyX, y, key, FONT_SIZE.controlKey, 0, true), text(CONTROLS.textX, y, what, FONT_SIZE.controlText))
    })

    // Section "Extras": two equal buttons side by side, centered. Replay tutorial resets the "seen" flag
    // (the next new game shows it) and says so in a note under the buttons.
    heading('Extras', LAYOUT.extrasHeading)
    const note = scene.add
      .text(0, fromTop(LAYOUT.extrasNote), REPLAY_NOTE.text, { fontFamily: FONT, fontSize: `${REPLAY_NOTE.fontSize}px`, color: INK_CSS })
      .setOrigin(0.5)
      .setResolution(2)
      .setVisible(false)
    const extraButton = (side: -1 | 1, label: string, onClick: () => void) =>
      new PlateButton(scene, side * (EXTRAS.buttonWidth + EXTRAS.gap) / 2, fromTop(LAYOUT.extrasButtons), {
        label,
        width: EXTRAS.buttonWidth,
        height: EXTRAS.buttonHeight,
        fontSize: EXTRAS.fontSize,
        onClick,
      })
    items.push(
      note,
      extraButton(-1, 'Replay tutorial', () => {
        resetTutorial()
        note.setVisible(true)
      }),
      extraButton(1, 'View endings', () => this.showEndings(true)),
    )

    items.push(
      new PlateButton(scene, 0, fromTop(LAYOUT.close), {
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

  private showEndings(visible: boolean) {
    this.root.setVisible(!visible)
    this.endings.setVisible(visible)
  }

  // The sub-panel: a note, one button per ending and Back, on a compact plate
  private buildEndings(): Phaser.GameObjects.Container {
    const { scene } = this
    const y = (offset: number) => offset - ENDINGS_HEIGHT / 2 // from the top edge to a y inside the panel
    const items: Phaser.GameObjects.GameObject[] = [
      new PlatePanel(scene, 0, 0, ENDINGS.width, ENDINGS_HEIGHT),
      scene.add.zone(0, 0, ENDINGS.width, ENDINGS_HEIGHT).setInteractive(), // a click inside does nothing
      scene.add
        .text(0, y(ENDINGS.title.offset), 'Endings', { fontFamily: LOGO_FONT, letterSpacing: LOGO_LETTER_SPACING, fontStyle: 'bold', fontSize: `${ENDINGS.title.size}px`, color: INK_CSS })
        .setOrigin(0.5)
        .setResolution(2),
      scene.add
        .text(0, y(ENDINGS.note.offset), ENDINGS.text, { fontFamily: FONT, fontSize: `${ENDINGS.note.fontSize}px`, color: INK_CSS, align: 'center', wordWrap: { width: ENDINGS.note.width } })
        .setOrigin(0.5, 0)
        .setResolution(2),
    ]
    const button = (offset: number, label: string, onClick: () => void) =>
      new PlateButton(scene, 0, y(offset), { label, width: ENDINGS.button.width, height: ENDINGS.button.height, fontSize: ENDINGS.button.fontSize, onClick })
    ENDINGS.list.forEach(({ label, caption, ending }, i) => {
      const offset = ENDINGS.firstButton + i * ENDINGS.button.pitch
      const captionY = offset + ENDINGS.button.height / 2 + ENDINGS.caption.gap + ENDINGS.caption.height / 2
      items.push(
        button(offset, label, () => this.preview(ending)),
        scene.add
          .text(0, y(captionY), caption, { fontFamily: FONT, fontSize: `${ENDINGS.caption.size}px`, fontStyle: 'italic', color: ENDINGS.caption.color })
          .setOrigin(0.5)
          .setResolution(2),
      )
    })
    items.push(button(ENDINGS_BACK, 'Back', () => this.showEndings(false)))
    return scene.add.container(PANEL.x, PANEL.y, items)
  }

  // Shows an ending on top of this scene, with sample money for the difficulty chosen. This scene (the title
  // screen or the pause menu, with the paused game below it) stands still meanwhile; nothing of the run changes.
  private preview(ending: PreviewEnding) {
    const from = this.scene.scene.key
    this.scene.scene.launch('EndingScene', { money: previewMoney(ending, getDifficulty()), preview: { from } })
    this.scene.scene.pause()
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
