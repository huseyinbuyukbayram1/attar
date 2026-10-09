import Phaser from 'phaser'
import { getDifficulty } from '../game/difficulty'
import { fillStory, INTRO_PAGES } from '../game/story'
import { addPlateLabel, PlateButton } from './ui/PlateButton'
import { addFullImage } from './ui/fullImage'
import { StoryPanel } from './ui/StoryPanel'

const DIM = { color: 0x2a1a10, alpha: 0.6 } // warm dark veil over the shop
// The text box is centered. The grandfather's portrait is pinned over its top-left corner like a photo:
// its center is the box's corner moved `inset` px inwards, it is straight, drawn above the box, with a
// subtle shadow (a dark copy of it, offset). The text starts to the right of the portrait
// (padding.left), so the first lines are never hidden.
const PANEL = { x: 640, y: 340, width: 760, height: 320, fontSize: 28, padding: { x: 56, y: 44, left: 140 } }
const PORTRAIT = {
  key: 'master_portrait',
  height: 230,
  inset: { x: 30, y: 30 }, // from the box's top-left corner
  shadow: { dx: 4, dy: 5, alpha: 0.18 }, // soft and subtle
  fadeInMs: 900,
  growTo: 1.06,
  growMs: 30000,
}
const SKIP = { x: 1130, y: 664, width: 150, height: 46 }
const HINT = { x: 640, y: 664, width: 300, height: 32 }

// The story before the first customer, one page at a time (src/game/story.ts). The text is typed
// out; a click or SPACE finishes the page, the next one goes to the next page.
export class IntroScene extends Phaser.Scene {
  private index = 0
  private pages: string[] = []
  private leaving = false
  private pausing = false
  private panel!: StoryPanel

  constructor() {
    super('IntroScene')
  }

  create() {
    // The scene object is reused, so reset its fields here
    this.index = 0
    this.pages = INTRO_PAGES.map((page) => fillStory(page, getDifficulty().debt))
    this.leaving = false
    this.pausing = false
    const { width, height } = this.scale

    addFullImage(this, 'shop_morning')
    // The veil is also the click target for "next"; the Skip button sits above it, so it wins
    const veil = this.add.rectangle(width / 2, height / 2, width, height, DIM.color, DIM.alpha).setInteractive()
    veil.on('pointerdown', () => this.advance())

    this.panel = new StoryPanel(this, { ...PANEL })
    this.addPortrait() // after the box, so it is drawn above it
    addPlateLabel(this, HINT.x, HINT.y, HINT.width, HINT.height, 'Click or press SPACE to continue', 16)
    new PlateButton(this, SKIP.x, SKIP.y, { label: 'Skip', width: SKIP.width, height: SKIP.height, variant: 'short', onClick: () => this.finish() })

    const keyboard = this.input.keyboard
    const onSpace = () => this.advance()
    keyboard?.on('keydown-SPACE', onSpace)
    // Esc pauses (the pause menu is its own scene; this scene stands still until it is resumed)
    const onEsc = () => this.openPause()
    keyboard?.on('keydown-ESC', onEsc)
    const onResume = () => (this.pausing = false)
    this.events.on('resume', onResume)
    this.events.once('shutdown', () => {
      keyboard?.off('keydown-SPACE', onSpace)
      keyboard?.off('keydown-ESC', onEsc)
      this.events.off('resume', onResume)
    })

    this.panel.show(this.pages[0])
  }

  // The framed portrait, pinned to the corner of the box. It fades in and, very slowly, grows a little.
  private addPortrait() {
    if (!this.textures.exists(PORTRAIT.key)) return
    const x = PANEL.x - PANEL.width / 2 + PORTRAIT.inset.x
    const y = PANEL.y - PANEL.height / 2 + PORTRAIT.inset.y
    const picture = this.add.image(0, 0, PORTRAIT.key)
    const scale = PORTRAIT.height / picture.height
    picture.setScale(scale)
    const shadow = this.add.image(PORTRAIT.shadow.dx, PORTRAIT.shadow.dy, PORTRAIT.key).setScale(scale).setTint(0x000000).setAlpha(PORTRAIT.shadow.alpha)
    const pinned = this.add.container(x, y, [shadow, picture]).setAlpha(0)
    this.tweens.add({ targets: pinned, alpha: 1, duration: PORTRAIT.fadeInMs })
    this.tweens.add({ targets: pinned, scale: PORTRAIT.growTo, duration: PORTRAIT.growMs, ease: 'Sine.easeOut' })
  }

  private openPause() {
    if (this.pausing || this.leaving) return
    this.pausing = true
    this.scene.launch('PauseScene', { from: 'IntroScene' })
    this.scene.pause()
  }

  // A click or SPACE: finish the page that is being typed, or go to the next page
  private advance() {
    if (this.leaving) return
    if (this.panel.isTyping()) {
      this.panel.finishTyping()
      return
    }
    this.index++
    if (this.index >= this.pages.length) this.finish()
    else this.panel.show(this.pages[this.index])
  }

  private finish() {
    if (this.leaving) return // a double click must not start the shop twice
    this.leaving = true
    this.scene.start('ShopScene')
  }
}
