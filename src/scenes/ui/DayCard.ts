import Phaser from 'phaser'
import { FONT } from './theme'

const FADE_IN_MS = 400
const HOLD_MS = 400
const FADE_OUT_MS = 400 // together about 1.2 s
const DEPTH = 1500 // above the phase fade (1000), below the dev contact sheet (2000)
const BACKGROUND_COLOR = 0x1a1210

// The "Day X" title card at the start of each day. It covers the whole screen and swallows
// clicks while visible; a click skips it. While it is fully opaque it calls onCovered, so the
// scene can switch to the new customer behind it without the player seeing the change.
export class DayCard {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private title: Phaser.GameObjects.Text
  private timer?: Phaser.Time.TimerEvent
  private open = false
  private covered = false
  private onCovered: () => void = () => {}
  private onDone: () => void = () => {}

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const { width, height } = scene.scale
    this.root = scene.add.container(0, 0).setDepth(DEPTH).setVisible(false)

    // Interactive, so clicks never reach the scene underneath; clicking it skips the card
    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, BACKGROUND_COLOR).setInteractive()
    backdrop.on('pointerdown', () => this.close())
    this.title = scene.add
      .text(width / 2, height / 2, '', { fontFamily: FONT, fontSize: '72px', color: '#f6e7c1' })
      .setOrigin(0.5)
    this.root.add([backdrop, this.title])
  }

  // startOpaque skips the fade-in, for the very first card when there is nothing to fade from
  show(day: number, onCovered: () => void, onDone: () => void, startOpaque = false) {
    this.title.setText(`Day ${day}`)
    this.onCovered = onCovered
    this.onDone = onDone
    this.open = true
    this.covered = false
    this.root.setVisible(true).setAlpha(startOpaque ? 1 : 0)

    if (startOpaque) {
      this.cover()
      this.hold()
      return
    }
    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      duration: FADE_IN_MS,
      onComplete: () => {
        this.cover()
        this.hold()
      },
    })
  }

  private hold() {
    this.timer = this.scene.time.delayedCall(HOLD_MS, () => {
      this.scene.tweens.add({ targets: this.root, alpha: 0, duration: FADE_OUT_MS, onComplete: () => this.close() })
    })
  }

  // Runs onCovered once, whichever way the card ends (also when it is skipped early)
  private cover() {
    if (this.covered) return
    this.covered = true
    this.onCovered()
  }

  private close() {
    if (!this.open) return
    this.open = false
    this.scene.tweens.killTweensOf(this.root)
    this.timer?.remove(false)
    this.cover()
    this.root.setVisible(false)
    this.onDone()
  }
}
