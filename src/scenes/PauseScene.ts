import Phaser from 'phaser'
import { pauseEffects, resumeEffects, stopPausedEffects } from '../game/audio'
import { setMusicDuck } from '../game/settings'
import { PlateButton, PlatePanel } from './ui/PlateButton'
import { SettingsPanel } from './ui/SettingsPanel'
import { FONT, LOGO_FONT, LOGO_LETTER_SPACING } from './ui/theme'

// ---- The pause menu: tuning constants (screen px) ----
const PANEL = { x: 640, y: 360, width: 440, height: 400 }
const OVERLAY = { color: 0x000000, alpha: 0.55 }
const FADE_IN_MS = 160
const PAUSE_MUSIC_DUCK = 0.4 // music and ambience are this loud (of their current volume) while paused
const ESC_GUARD_MS = 200 // the Esc that opened the menu must not close it again at once
const LEAVE_FADE_MS = 400 // the fade to black when restarting or going to the main menu
const INK_CSS = '#3b2412'
const TITLE = { text: 'Paused', size: 40, y: -PANEL.height / 2 + 52 }
const BUTTONS = { width: 260, height: 54, fontSize: 24, firstY: -70, pitch: 65 }
const CONFIRM = { textY: -40, textWidth: 340, fontSize: 22, buttonsY: 70, buttonWidth: 170, buttonGap: 100 } // buttonGap: x of each button from the middle
const MESSAGES = {
  restart: 'Start over from Day 1? Your progress will be lost.',
  menu: 'Return to the main menu? Your progress will be lost.',
}

type Target = 'restart' | 'menu'

// The pause menu is its own scene, launched on top of the game scene (ShopScene or IntroScene), which
// is PAUSED while this runs: Phaser then stops its update, so its tweens, timers and animations stand
// still (and go on from the same point when it is resumed), and it gets no input. The scene
// underneath is still drawn, so the dark overlay shows the frozen game.
export class PauseScene extends Phaser.Scene {
  private from = 'ShopScene'
  private openedAt = 0
  private leaving = false
  private confirm?: Target
  private root!: Phaser.GameObjects.Container
  private mainView!: Phaser.GameObjects.Container
  private confirmView!: Phaser.GameObjects.Container
  private confirmText!: Phaser.GameObjects.Text
  private confirmYes!: PlateButton
  private settings!: SettingsPanel
  private blackout!: Phaser.GameObjects.Rectangle

  constructor() {
    super('PauseScene')
  }

  // Phaser hands over whatever the game scene passed to scene.launch
  init(data: { from: string }) {
    this.from = data.from
  }

  create() {
    // The scene object is reused, so reset its fields here
    this.leaving = false
    this.confirm = undefined
    this.openedAt = this.time.now
    const { width, height } = this.scale

    // Effects that are playing (a pour, a mix ...) are paused with the game and resumed with it; only
    // music and ambience are turned down
    pauseEffects()
    setMusicDuck(PAUSE_MUSIC_DUCK) // music and ambience are turned down while paused ...
    this.events.once('shutdown', () => setMusicDuck(1)) // ... and back to normal however the pause ends

    // The overlay dims the game and takes every click (the paused scene gets none anyway)
    const dim = this.add.rectangle(width / 2, height / 2, width, height, OVERLAY.color, OVERLAY.alpha).setInteractive()

    this.mainView = this.buildMainView()
    this.confirmView = this.buildConfirmView().setVisible(false)
    this.root = this.add.container(PANEL.x, PANEL.y, [
      new PlatePanel(this, 0, 0, PANEL.width, PANEL.height),
      this.add.zone(0, 0, PANEL.width, PANEL.height).setInteractive(),
      this.add.text(0, TITLE.y, TITLE.text, { fontFamily: LOGO_FONT, letterSpacing: LOGO_LETTER_SPACING, fontStyle: 'bold', fontSize: `${TITLE.size}px`, color: INK_CSS }).setOrigin(0.5).setResolution(2),
      this.mainView,
      this.confirmView,
    ])

    // Esc: the settings panel and the confirmation come first. This handler is added BEFORE the
    // settings panel's own Esc handler, so it still sees the panel open when Esc closes it.
    const onEsc = () => {
      if (this.time.now - this.openedAt < ESC_GUARD_MS || this.leaving) return
      if (this.settings.isOpen()) return // the panel closes itself
      if (this.confirm) this.showMain()
      else this.resume()
    }
    this.input.keyboard?.on('keydown-ESC', onEsc)
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', onEsc))

    this.settings = new SettingsPanel(this)
    // Drawn above everything, for the fade to black when leaving
    this.blackout = this.add.rectangle(width / 2, height / 2, width, height, 0x000000).setAlpha(0).setDepth(5000)

    dim.setAlpha(0)
    this.root.setAlpha(0)
    this.tweens.add({ targets: dim, alpha: 1, duration: FADE_IN_MS }) // the rectangle's fill alpha is the overlay alpha; this is the fade
    this.tweens.add({ targets: this.root, alpha: 1, duration: FADE_IN_MS })
  }

  private buildMainView(): Phaser.GameObjects.Container {
    const button = (index: number, label: string, onClick: () => void) =>
      new PlateButton(this, 0, BUTTONS.firstY + index * BUTTONS.pitch, { label, width: BUTTONS.width, height: BUTTONS.height, fontSize: BUTTONS.fontSize, onClick })
    return this.add.container(0, 0, [
      button(0, 'Resume', () => this.resume()),
      button(1, 'Settings', () => this.settings.open()),
      button(2, 'Restart', () => this.askToConfirm('restart')),
      button(3, 'Main menu', () => this.askToConfirm('menu')),
    ])
  }

  private buildConfirmView(): Phaser.GameObjects.Container {
    this.confirmText = this.add
      .text(0, CONFIRM.textY, '', { fontFamily: FONT, fontSize: `${CONFIRM.fontSize}px`, color: INK_CSS, align: 'center', wordWrap: { width: CONFIRM.textWidth } })
      .setOrigin(0.5)
      .setResolution(2)
    this.confirmYes = new PlateButton(this, -CONFIRM.buttonGap, CONFIRM.buttonsY, {
      label: 'Restart',
      width: CONFIRM.buttonWidth,
      height: BUTTONS.height,
      fontSize: BUTTONS.fontSize,
      onClick: () => this.leave(),
    })
    const cancel = new PlateButton(this, CONFIRM.buttonGap, CONFIRM.buttonsY, {
      label: 'Cancel',
      width: CONFIRM.buttonWidth,
      height: BUTTONS.height,
      fontSize: BUTTONS.fontSize,
      onClick: () => this.showMain(),
    })
    return this.add.container(0, 0, [this.confirmText, this.confirmYes, cancel])
  }

  private askToConfirm(target: Target) {
    this.confirm = target
    this.confirmText.setText(MESSAGES[target])
    this.confirmYes.setLabel(target === 'restart' ? 'Restart' : 'Main menu')
    this.mainView.setVisible(false)
    this.confirmView.setVisible(true)
  }

  private showMain() {
    this.confirm = undefined
    this.confirmView.setVisible(false)
    this.mainView.setVisible(true)
  }

  // Back to the game: the game scene goes on exactly where it stopped
  private resume() {
    if (this.leaving) return
    this.leaving = true
    resumeEffects()
    this.scene.resume(this.from)
    this.scene.stop()
  }

  // Restart (to the story, which then starts a fresh game, like "Try again" does) or the main menu:
  // fade to black, stop the paused game scene and start the new one
  private leave() {
    if (this.leaving || !this.confirm) return
    this.leaving = true
    const target = this.confirm === 'restart' ? 'IntroScene' : 'TitleScene'
    stopPausedEffects() // what was paused must not come back in the next scene
    this.tweens.add({
      targets: this.blackout,
      alpha: 1,
      duration: LEAVE_FADE_MS,
      onComplete: () => {
        this.scene.stop(this.from)
        this.scene.start(target) // also ends this pause scene
      },
    })
  }
}
