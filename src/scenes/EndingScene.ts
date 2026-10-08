import Phaser from 'phaser'
import { getDifficulty } from '../game/difficulty'
import { formatCoins } from '../game/economy'
import { CoinAmount } from './ui/CoinAmount'
import { fillStory, GREAT_WIN_PAGE, LOSE_PAGE, WIN_PAGE } from '../game/story'
import { PlateButton } from './ui/PlateButton'
import { StoryPanel } from './ui/StoryPanel'
import { addFullImage } from './ui/fullImage'
import { LOGO_FONT, LOGO_LETTER_SPACING } from './ui/theme'

// Fallback backgrounds (the shop with an overlay) when an ending picture is missing
const WIN_LOOK = { tint: 0xffffff, overlay: 0x4a2e14, overlayAlpha: 0.3 } // warm, a bit lighter
const LOSE_LOOK = { tint: 0x8d97a6, overlay: 0x0c1118, overlayAlpha: 0.7 } // cool, desaturated, darker
const SOLID_FALLBACK = 0x1a1210 // if even the shop background is missing

const FADE_IN_MS = 1000 // from black
const KEN_BURNS = { to: 1.05, ms: 12000 } // a slow zoom of the picture

// All three endings look the same: the story text is in a subtitle band at the TOP (a dark band, about 55
// percent, with faded edges and no border, cream text, about 80 percent of the screen wide), and after the
// text the money line and the two buttons come in a row on a band like it at the BOTTOM, money on the left.
// The top is the calm part of every picture (sky, shelves): the lose person's head starts at y 190, the great
// win crowd's heads at y 320. Sizes, fonts, positions and timing are the same on all three (1280x720 screen px).
const BAND = { width: 1024, height: 160, y: 100, fontSize: 24, padding: { x: 40, y: 20 } }
const BOTTOM_ROW = {
  y: 682, // center line of the money line and the buttons
  band: { height: 110, y: 676 },
  buttonWidth: 200,
  buttonHeight: 46,
  fontSize: 22,
  moneySize: 32,
  moneyColor: '#f3e6c8',
  // The row is centered on all three screens (on the lose picture it may cover part of Misk; the band is see-through)
  row: { bandX: 640, bandWidth: 1024, moneyX: 400, buttonXs: [700, 920] },
}
const LEAVE_FADE_MS = 400

// The small "Attar" on the blank wooden sign of the lose picture. Measured on ending_lose.jpg (1920x1080):
// the board's corners are about (1161, 405), (1273, 401), (1273, 462) and (1161, 463), so its center is
// (1217, 432.5), it is 112.5 px wide, and its top edge rises 2.1 degrees to the right (the bottom edge
// 0.4), about -1.3 degrees on average. Converted to screen px from the center of the picture (x 2/3).
const PICTURE_TO_SCREEN = 1280 / 1920
const LOSE_SIGN = {
  x: (1217 - 960) * PICTURE_TO_SCREEN,
  y: (432.5 - 540) * PICTURE_TO_SCREEN,
  boardWidth: 112.5 * PICTURE_TO_SCREEN,
  degrees: -1.3,
  widthShare: 0.7, // of the board's width
  color: '#f3dfb0',
  stroke: '#3b2412',
  strokeThickness: 1.5,
  alpha: 0.9, // a little see-through, so it looks painted on
}

type Ending = 'lose' | 'win' | 'great'
const PICTURES: Record<Ending, string> = { lose: 'ending_lose', win: 'ending_win', great: 'ending_greatwin' }

// Shown after the last customer: the story ends one way or the other (src/game/story.ts), depending on
// the money earned and the difficulty chosen: lose, win, or great win (a single page of its own). The
// text is typed out like in the intro.
export class EndingScene extends Phaser.Scene {
  private money = 0
  private ending: Ending = 'win'
  private page = ''
  private finalShown = false
  private leaving = false
  private panel!: StoryPanel
  // Set when the ending is only looked at (Settings > Extras > View endings): it runs on top of the paused
  // scene it came from (`from`), changes nothing of the run, and its only button goes back there
  private preview?: { from: string }

  constructor() {
    super('EndingScene')
  }

  // Phaser hands over whatever ShopScene passed to scene.start
  init(data: { money: number; preview?: { from: string } }) {
    this.money = data.money
    this.preview = data.preview
  }

  create() {
    const { debt, greatWin } = getDifficulty() // the difficulty of this game
    this.ending = this.money < debt ? 'lose' : this.money >= greatWin ? 'great' : 'win'
    const text = this.ending === 'lose' ? LOSE_PAGE : this.ending === 'great' ? GREAT_WIN_PAGE : WIN_PAGE
    this.page = fillStory(text, debt, this.money)
    this.finalShown = false
    this.leaving = false

    if (this.preview) this.scene.bringToTop() // the pause menu is registered after this scene, so it would be drawn above
    this.addArt()
    this.panel = new StoryPanel(this, {
      x: this.scale.width / 2,
      y: BAND.y,
      width: BAND.width,
      height: BAND.height,
      fontSize: BAND.fontSize,
      padding: BAND.padding,
      style: 'band',
    })
    this.cameras.main.fadeIn(FADE_IN_MS, 0, 0, 0)
    this.panel.show(this.page)

    this.input.on('pointerdown', () => this.advance())
    const keyboard = this.input.keyboard
    const onSpace = () => this.advance()
    keyboard?.on('keydown-SPACE', onSpace)
    // In the preview Esc goes back, too
    const onEsc = () => this.preview && this.back()
    keyboard?.on('keydown-ESC', onEsc)
    this.events.once('shutdown', () => {
      keyboard?.off('keydown-SPACE', onSpace)
      keyboard?.off('keydown-ESC', onEsc)
    })
  }

  // The picture in a container that zooms slowly; on the lose picture the container also holds the sign text
  private addArt() {
    const { width, height } = this.scale
    const art = this.add.container(width / 2, height / 2)
    art.add(this.makePicture(PICTURES[this.ending], this.ending !== 'lose'))
    if (this.ending === 'lose') art.add(this.makeLoseSign())
    this.tweens.add({ targets: art, scale: KEN_BURNS.to, duration: KEN_BURNS.ms, ease: 'Linear' })
  }

  // The ending picture; if it is missing, the shop with a mood overlay instead
  private makePicture(key: string, won: boolean): Phaser.GameObjects.Image {
    const { width, height } = this.scale
    if (this.textures.exists(key)) return this.add.image(0, 0, key).setDisplaySize(width, height)
    const look = won ? WIN_LOOK : LOSE_LOOK
    const shop = addFullImage(this, 'shop_morning')
    if (!shop) return this.add.image(0, 0, '__WHITE').setDisplaySize(width, height).setTint(SOLID_FALLBACK)
    shop.setPosition(0, 0).setTint(look.tint)
    this.add.rectangle(0, 0, width, height, look.overlay, look.overlayAlpha)
    return shop
  }

  // "Attar" on the blank sign, in the logo font, tilted like the board. It is in the picture's container,
  // so it zooms with the picture.
  private makeLoseSign(): Phaser.GameObjects.Text {
    const sign = this.add
      .text(LOSE_SIGN.x, LOSE_SIGN.y, 'Attar', {
        fontFamily: LOGO_FONT,
        letterSpacing: LOGO_LETTER_SPACING,
        fontStyle: 'bold',
        fontSize: '40px',
        color: LOSE_SIGN.color,
        stroke: LOSE_SIGN.stroke,
        strokeThickness: LOSE_SIGN.strokeThickness,
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setRotation(Phaser.Math.DegToRad(LOSE_SIGN.degrees))
      .setAlpha(LOSE_SIGN.alpha)
    sign.setFontSize((40 * LOSE_SIGN.boardWidth * LOSE_SIGN.widthShare) / sign.width)
    return sign
  }

  // A click or SPACE: finish the page that is being typed, or go on to the final screen
  private advance() {
    if (this.leaving || this.finalShown) return
    if (this.panel.isTyping()) {
      this.panel.finishTyping()
      return
    }
    this.showFinal()
  }

  // After the page (which stays at the top): the money earned against the debt and Play again / Main menu,
  // in a row on a band at the bottom
  private showFinal() {
    this.finalShown = true
    this.panel.hideArrow()
    const { debt } = getDifficulty()
    const row = BOTTOM_ROW.row
    this.add.image(row.bandX, BOTTOM_ROW.band.y, 'story_band').setDisplaySize(row.bandWidth, BOTTOM_ROW.band.height)
    if (this.preview) {
      // The preview has no money line and no Play again: just the way back
      new PlateButton(this, row.bandX, BOTTOM_ROW.y, { label: 'Back', width: BOTTOM_ROW.buttonWidth, height: BOTTOM_ROW.buttonHeight, fontSize: BOTTOM_ROW.fontSize, onClick: () => this.back() })
      return
    }
    new CoinAmount(this, row.moneyX, BOTTOM_ROW.y, { fontSize: BOTTOM_ROW.moneySize, color: BOTTOM_ROW.moneyColor, shadow: true }).setAmount(`${formatCoins(this.money)} / ${formatCoins(debt)}`)
    const button = (x: number, label: string, onClick: () => void) =>
      new PlateButton(this, x, BOTTOM_ROW.y, { label, width: BOTTOM_ROW.buttonWidth, height: BOTTOM_ROW.buttonHeight, fontSize: BOTTOM_ROW.fontSize, onClick })
    // "Play again" starts a fresh game at Day 1 with the same difficulty, without the story (like Restart in the pause menu)
    button(row.buttonXs[0], 'Play again', () => this.go('ShopScene'))
    button(row.buttonXs[1], 'Main menu', () => this.go('TitleScene'))
  }

  // Preview only: fade out, close this scene and let the scene below go on exactly where it was
  private back() {
    if (this.leaving || !this.preview) return
    this.leaving = true
    const { from } = this.preview
    this.cameras.main.fadeOut(LEAVE_FADE_MS, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.resume(from)
      this.scene.stop()
    })
  }

  private go(target: 'ShopScene' | 'TitleScene') {
    if (this.leaving) return
    this.leaving = true
    this.cameras.main.fadeOut(LEAVE_FADE_MS, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(target))
  }
}
