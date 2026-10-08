import Phaser from 'phaser'
import { playEffect, playMusic } from '../game/audio'
import { getDifficulty, hasChosenDifficulty, setDifficulty } from '../game/difficulty'
import { PlateButton } from './ui/PlateButton'
import { DifficultyPanel } from './ui/DifficultyPanel'
import { SettingsPanel } from './ui/SettingsPanel'
import { StartConfirmPanel } from './ui/StartConfirmPanel'
import { addLabelPlate, LOGO_FONT, LOGO_LETTER_SPACING, TEXT_COLOR } from './ui/theme'

// ---- Title screen: tuning constants (positions in 1280x720 canvas px) ----
const BACKGROUND_KEY = 'title_exterior'
const SIGN_KEY = 'title_sign'
const FALLBACK_BACKGROUND = 0x1a1210

// The sign picture is 700x570; its board spans about 676 px, its board centre is at (350, 359) and
// the chains start at row 18 (picture px). A sign is scaled so its board is `boardWidth` wide.
const SIGN_PICTURE = { boardWidth: 676, boardCenterY: 359, firstRow: 18 }
const SIGN_PICTURE_CENTER_X = 350 // the sign's origin is the middle of the picture (700 px wide)
// The big sign, top left: its container origin is the top centre, where the chains are held.
// The door arch starts at x 470 (measured on the background); the sign's right edge, the board
// plus a few px of picture, is at x 386, an 84 px gap.
const SIGN = { x: 210, boardWidth: 340 } // x 210 is also the middle of the buttons
const SIGN_DROP_FROM_Y = -450 // it drops in from above the screen
// The small sign on the wall bracket: its chains hang from the underside of the arm. `x` is the
// middle between its chains, `armY` the underside of the arm (measured on the background:
// the arm spans x 835..925 at y about 225).
const SMALL_SIGN = { x: 878, armY: 226, boardWidth: 105, logoStroke: 3 }
const signScale = (boardWidth: number) => boardWidth / SIGN_PICTURE.boardWidth
const signRestY = (boardWidth: number) => -SIGN_PICTURE.firstRow * signScale(boardWidth) // chain tops at y 0
const boardCenterY = (boardWidth: number) => SIGN_PICTURE.boardCenterY * signScale(boardWidth) // from the sign's origin

const LOGO = {
  fontFamily: LOGO_FONT, // falls back to the game's serif if the font is not there
  text: 'Attar',
  color: '#f3dfb0', // warm cream / gold
  stroke: '#3b2412', // dark brown
  strokeThickness: 7,
  shadow: { x: 2, y: 4, color: '#000000', blur: 6 },
  widthShare: 0.8, // of the board width
  offsetY: -28, // from the board centre
}
const SIGN_REFERENCE_WIDTH = 420 // the board width the LOGO / TAGLINE offsets and sizes were made for
const TAGLINE = { text: "A perfumer's last five days", fontSize: 22, color: '#f3dfb0', maxWidthShare: 0.82, offsetY: 52 }
const FONT_WAIT_MS = 1500 // do not wait longer than this for the logo font

const FADE_IN_MS = 600
const SIGN_DELAY_MS = 400
const SIGN_DROP_MS = 900 // the entrance
const SIGN_DROP_EASE = 'Back.easeOut' // a bouncy landing
const SWING = { degrees: 4, ms: 2000, cycles: 3 } // damped: shrinks to 0
const IDLE_SWAY = { degrees: 0.6, ms: 5000 } // one full back and forth

// Left side, right under the big sign (its board ends at y 272), left of the plant pot (x 350..460, y 430..570): they span x 85..335
// Play, Difficulty, Settings
// (the Difficulty button's label shows the difficulty in force: "Difficulty: Normal")
const BUTTONS = { x: 210, firstY: 340, gap: 80, width: 270, height: 58, delayMs: 300, fadeMs: 400, slide: 20 }
// Play: "the sign falls". The buttons fade, the sign strains, the chains snap and it falls to the
// cobblestones, bounces a little, and after a pause the screen fades to black.
const PLAY_BUTTONS_FADE_MS = 150
const SIGN_STRAIN = { degrees: 1.5, shakes: 5, ms: 350 }
const SIGN_FALL = {
  degrees: 14, // positive = it lands leaning clockwise (the side that dropped first is lower); 8 to 15 degrees
  boardBottomY: 690, // where the bottom of the board ends up (the cobblestones)
  ms: 600,
  ease: 'Quad.easeIn', // accelerating, like gravity
}
// The chains snap one after the other. The sign picture is cut into three kinds of parts: the BODY (the brass rings and
// the board, from CHAIN_CUT.row down), and the two CHAINS above it (left and right, one image each). The cut is just above
// the rings, so the falling sign carries no chain pieces. Picture px (the picture is 700x570).
const CHAIN_CUT = { row: 122, leftX: 96, rightX: 603 } // where the cut crosses the left and the right chain
const CHAIN_TOP_ENDS = { row: 20, leftX: 157, rightX: 545 } // the upper end of each chain: a broken piece swings around it
const CHAIN_SWING = { degrees: 10, ms: 1500, cycles: 3 } // a broken chain piece: damped to 0, around its upper end
// After the right chain snaps the sign hangs on the left chain only, and swings around the left ring (the cut point)
const HANG = { degrees: 20, ms: 800, cycles: 1 } // degrees: where it would settle (clockwise: the right side drops); a damped swing around that
const TINK = { sound: 'bottle', volume: 0.35 } // a small metal sound for each snap (an existing sound, quiet)
// Broken chain links that pop out of each cut point and fall
const CHAIN_BITS = {
  count: { min: 3, max: 5 },
  color: 0x55555a, // dark grey
  size: { width: 5, height: 3 },
  speed: { min: 40, max: 120 }, // px per second, outwards
  gravity: 700, // px per second squared
  ms: 500,
}
const SIGN_PICTURE_BOARD_BOTTOM = 558 // the board's lowest row in the sign picture (picture px)
const SIGN_FALL_SEEK = 0.2 // the fall sound starts this many seconds into the file
const IMPACT_SHAKE = { ms: 150, intensity: 0.004 }
const IMPACT_BOUNCES = [{ px: 12, ms: 150 }, { px: 5, ms: 110 }] // the sign hops up and settles
const IMPACT_DUST = { count: { min: 6, max: 10 }, color: 0xd9c7a3, alpha: 0.5, radius: { min: 9, max: 16 }, spreadShare: 0.6, grow: 2.4, rise: 14, ms: 700 } // spreadShare: of the board width
// The sleeping cat, Misk, is a little interactive. CAT_HIT is the invisible hit area over the cat
// (measured on the background: head and body span about x 561..695, y 491..573); it is far from the buttons.
const CAT_HIT = { x: 561, y: 491, width: 134, height: 82 }
const CAT_TIP = {
  hover: 'Misk is asleep. Shh...',
  lines: [
    'Misk purrs without opening an eye.',
    'Misk has guarded this door for twelve years.',
    "Misk dreams of the master's amber.",
    'Misk flicks an ear. Still asleep.',
  ],
  ms: 2500, // how long a line stays after a click
  fontSize: 15,
  padding: { x: 14, y: 7 },
  gap: 8, // between the top of the hit area and the tip
  depth: 60,
}
const CAT_EXTRA_Z = 2 // a click makes this many letters rise right away
const HOLD_AFTER_IMPACT_MS = 600
const PLAY_FADE_MS = 600 // the fade to black at the very end
const MUSIC_FADE_OUT_MS = 1000 // the title music fades out while the sign falls

// The sleeping cat's "z z Z": the cat's head is at about x 561..617, y 492..540 (measured on the
// background); the letters start just above and right of it, on the lit doorway
const ZZZ = {
  origin: { x: 600, y: 488 },
  everyMs: 1200,
  max: 3, // on the screen at once
  letters: ['z', 'Z', 'z'], // and their sizes (px), repeated
  sizes: [18, 26, 20],
  color: '#3b2412', // dark ink
  alpha: 0.8,
  drift: { x: 50, y: -50 }, // floats up and to the right
  ms: 2000,
  scale: { from: 0.6, to: 1.2 },
  sway: { px: 6, swings: 1.5 }, // left and right while floating
  fadeInShare: 0.15, // of the life: the first part fades in, the last 40 percent fades out
  fadeOutFrom: 0.6,
}

// Dust motes drifting in the light of the open door (the door is at about x 520..660, y 270..530)
const DUST = {
  count: 10,
  area: { x: 520, y: 270, width: 150, height: 260 },
  radius: { min: 1, max: 2.5 },
  alpha: 0.4,
  color: 0xffe9c0,
  driftPx: { x: 14, y: -26 }, // slow, up and a little to the right
  ms: { min: 6000, max: 10000 },
}

// The title screen: the shop front, a sign that drops in and swings, and Play / Settings.
// Clicking or pressing a key during the intro jumps to the end of it; it never starts the game.
export class TitleScene extends Phaser.Scene {
  private ready = false // true when the intro is over and the buttons work
  private leaving = false
  private built = false
  private sign!: Phaser.GameObjects.Container
  private buttons!: Phaser.GameObjects.Container
  private chainLeft?: Phaser.GameObjects.Image // the upper parts of the two chains, split off the big sign
  private chainRight?: Phaser.GameObjects.Image
  private plateButtons: PlateButton[] = []
  private signMotion: Phaser.Tweens.Tween[] = [] // the swing and the idle sway, stopped when the sign falls
  private dust!: Phaser.GameObjects.Container
  private music?: { stop: (fadeMs?: number) => void }
  private zzzTimer?: Phaser.Time.TimerEvent
  private settingsPanel?: SettingsPanel
  private difficultyPanel?: DifficultyPanel
  private confirmPanel?: StartConfirmPanel
  private difficultyButton?: PlateButton // its label shows the difficulty in force
  private catZone?: Phaser.GameObjects.Zone
  private catTip?: Phaser.GameObjects.Container
  private catLineTimer?: Phaser.Time.TimerEvent // while a line from a click is showing
  private catHovered = false
  private catLastLine = -1 // so the same line does not come twice in a row
  private zLetters: Phaser.GameObjects.Text[] = [] // the letters on the screen now
  private zzzNext = 0 // which letter / size comes next

  constructor() {
    super('TitleScene')
  }

  create() {
    // The scene object is reused, so reset its fields here
    this.ready = false
    this.leaving = false
    this.built = false
    const { width, height } = this.scale

    if (this.textures.exists(BACKGROUND_KEY)) this.add.image(width / 2, height / 2, BACKGROUND_KEY).setDisplaySize(width, height)
    else this.add.rectangle(width / 2, height / 2, width, height, FALLBACK_BACKGROUND)
    this.cameras.main.fadeIn(FADE_IN_MS, 0, 0, 0)
    this.music = playMusic(this, 'music_title') // does nothing until a music file is set in audio.ts

    this.zzzTimer = undefined
    this.catLineTimer = undefined
    this.catHovered = false
    this.catLastLine = -1
    this.zLetters = []
    this.zzzNext = 0
    this.events.once('shutdown', () => {
      this.zzzTimer?.remove()
      this.zLetters.forEach((letter) => letter.destroy())
      this.zLetters = []
    })
    this.input.on('pointerdown', () => this.skipIntro())
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!this.built || this.settingsPanel?.isOpen() || this.difficultyPanel?.isOpen() || this.confirmPanel?.isOpen()) return // an open panel has the keys
      if (!this.ready) this.skipIntro()
      else if (event.code === 'Enter' || event.code === 'Space') this.onPlay()
    })

    // The logo font is loaded by the browser on demand: wait for it, so the text never shows in a
    // fallback font first. Give up after FONT_WAIT_MS and use the fallback.
    const fontReady = document.fonts.load(`700 80px ${LOGO.fontFamily}`).catch(() => undefined)
    const timeout = new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS))
    void Promise.race([fontReady, timeout]).then(() => {
      if (this.sys.isActive() && !this.built) this.build()
    })
  }

  // The sign, the buttons and the dust, then the intro animation
  private build() {
    this.built = true
    // The small sign belongs to the building: it is there from the start and does not move. It is created first, so
    // the big sign is drawn in front of it.
    this.makeSign(SMALL_SIGN.x, SMALL_SIGN.armY + signRestY(SMALL_SIGN.boardWidth), SMALL_SIGN.boardWidth, false, SMALL_SIGN.logoStroke)
    this.sign = this.makeSign(SIGN.x, signRestY(SIGN.boardWidth), SIGN.boardWidth, true, LOGO.strokeThickness, true)
    this.sign.setPosition(SIGN.x, SIGN_DROP_FROM_Y)
    this.buttons = this.makeButtons().setAlpha(0).setVisible(false)
    this.dust = this.add.container(0, 0)
    this.makeCat()
    this.settingsPanel = new SettingsPanel(this)
    // A pick in the difficulty panel only selects (and saves) it; Play starts the game
    this.difficultyPanel = new DifficultyPanel(this, () => this.showDifficulty())
    this.confirmPanel = new StartConfirmPanel(this, 'Start on Normal?', {
      onYes: () => {
        setDifficulty('normal')
        this.showDifficulty()
        this.play()
      },
      onChoose: () => this.difficultyPanel?.open(),
    })

    // 1) the background has started to fade in; 2) the big sign drops in from above, then swings
    // like a pendulum
    this.time.delayedCall(FADE_IN_MS, () => this.startZzz())
    this.time.delayedCall(SIGN_DELAY_MS, () => {
      if (this.ready) return
      this.tweens.add({
        targets: this.sign,
        y: signRestY(SIGN.boardWidth),
        duration: SIGN_DROP_MS,
        ease: SIGN_DROP_EASE,
        onComplete: () => {
          this.swing()
        },
      })
    })
  }

  // The sign picture with the logo and the tagline on its board, all in one container: it swings
  // around its origin, the top centre of the sign (where the chains are held)
  // splitChains: the picture is drawn as three parts (the body below CHAIN_CUT.row and the two chains above it) in the
  // same container, so it looks exactly like one picture; the chains are kept for the moment they snap
  private makeSign(x: number, y: number, boardWidth: number, withTagline: boolean, strokeThickness: number, splitChains = false): Phaser.GameObjects.Container {
    const scale = signScale(boardWidth)
    const centerY = boardCenterY(boardWidth)
    const items: Phaser.GameObjects.GameObject[] = []
    if (this.textures.exists(SIGN_KEY)) {
      if (splitChains) {
        // The parts are the whole picture, cropped; a crop keeps the position of the whole picture, so the parts
        // line up exactly. Left and right chains are cut at x 350 (the middle of the picture), where there is nothing.
        const body = this.add.image(0, 0, SIGN_KEY).setOrigin(0.5, 0).setScale(scale)
        body.setCrop(0, CHAIN_CUT.row, body.width, body.height - CHAIN_CUT.row)
        const left = this.add.image(0, 0, SIGN_KEY).setOrigin(0.5, 0).setScale(scale)
        left.setCrop(0, 0, SIGN_PICTURE_CENTER_X, CHAIN_CUT.row)
        const right = this.add.image(0, 0, SIGN_KEY).setOrigin(0.5, 0).setScale(scale)
        right.setCrop(SIGN_PICTURE_CENTER_X, 0, SIGN_PICTURE_CENTER_X, CHAIN_CUT.row)
        this.chainLeft = left
        this.chainRight = right
        items.push(body, left, right)
      } else {
        items.push(this.add.image(0, 0, SIGN_KEY).setOrigin(0.5, 0).setScale(scale))
      }
    } else {
      // Missing picture: a plain wooden board, so the text stays readable
      items.push(this.add.rectangle(0, centerY, boardWidth, boardWidth * 0.6, 0x6b4a32).setStrokeStyle(4, 0xb0643c))
    }

    // The logo is as big as LOGO.widthShare of the board; the small sign has no tagline, so its logo is centered
    const logo = this.add
      .text(0, centerY + (withTagline ? LOGO.offsetY * (boardWidth / SIGN_REFERENCE_WIDTH) : 0), LOGO.text, {
        fontFamily: LOGO.fontFamily,
        letterSpacing: LOGO_LETTER_SPACING,
        fontStyle: 'bold',
        fontSize: '100px',
        color: LOGO.color,
        stroke: LOGO.stroke,
        strokeThickness,
      })
      .setOrigin(0.5)
      .setShadow(LOGO.shadow.x, LOGO.shadow.y, LOGO.shadow.color, LOGO.shadow.blur, true, true)
      .setResolution(2)
    logo.setFontSize((100 * boardWidth * LOGO.widthShare) / logo.width)
    items.push(logo)

    if (withTagline) {
      const tagline = this.add
        .text(0, centerY + TAGLINE.offsetY * (boardWidth / SIGN_REFERENCE_WIDTH), TAGLINE.text, { fontFamily: 'Georgia, serif', fontSize: `${TAGLINE.fontSize}px`, color: TAGLINE.color })
        .setOrigin(0.5)
        .setShadow(1, 2, '#000000', 3, true, true)
        .setResolution(2)
      // The tagline's size follows the board; it must fit within TAGLINE.maxWidthShare of the board
      const room = boardWidth * TAGLINE.maxWidthShare
      const size = Math.min(TAGLINE.fontSize * (boardWidth / SIGN_REFERENCE_WIDTH), (TAGLINE.fontSize * room) / tagline.width) // tagline.width is at TAGLINE.fontSize
      tagline.setFontSize(size)
      items.push(tagline)
    }
    return this.add.container(x, y, items)
  }

  private makeButtons(): Phaser.GameObjects.Container {
    const button = (row: number, label: string, onClick: () => void) =>
      new PlateButton(this, BUTTONS.x, BUTTONS.firstY + row * BUTTONS.gap, { label, width: BUTTONS.width, height: BUTTONS.height, onClick })
    const play = button(0, 'Play', () => (this.ready ? this.onPlay() : this.skipIntro())) // a click during the intro only skips it
    const difficulty = button(1, 'Difficulty', () => {
      if (this.ready) this.difficultyPanel?.open()
    })
    const settings = button(2, 'Settings', () => {
      if (this.ready) this.settingsPanel?.open()
    })
    this.difficultyButton = difficulty
    this.showDifficulty()
    this.plateButtons = [play, difficulty, settings]
    return this.add.container(0, 0, [play, difficulty, settings])
  }

  // The Difficulty button says which difficulty Play will use
  private showDifficulty() {
    this.difficultyButton?.setLabel(`Difficulty: ${getDifficulty().label}`)
  }

  // The sign has landed: a damped pendulum swing, then the buttons appear, then the idle sway
  private swing() {
    if (this.ready) return
    const swing = { t: 0 }
    const swingTween = this.tweens.add({
      targets: swing,
      t: 1,
      duration: SWING.ms,
      onUpdate: () => {
        // sin makes the back and forth, (1 - t) makes it smaller and smaller
        this.sign.setRotation(Phaser.Math.DegToRad(SWING.degrees) * (1 - swing.t) * Math.sin(swing.t * Math.PI * 2 * SWING.cycles))
      },
      onComplete: () => this.startIdle(),
    })
    this.signMotion.push(swingTween)
    this.time.delayedCall(BUTTONS.delayMs, () => {
      if (this.ready) return
      this.buttons.setVisible(true).setY(BUTTONS.slide)
      this.tweens.add({
        targets: this.buttons,
        alpha: 1,
        y: 0,
        duration: BUTTONS.fadeMs,
        ease: 'Sine.easeOut',
        onComplete: () => (this.ready = true),
      })
    })
  }

  // Jumps to the end of the intro: everything where it would be when it is over
  private skipIntro() {
    if (!this.built || this.ready) return
    this.ready = true
    this.tweens.killAll()
    this.time.removeAllEvents()
    this.cameras.main.resetFX()
    this.sign.setPosition(SIGN.x, signRestY(SIGN.boardWidth)).setRotation(0)
    this.buttons.setVisible(true).setAlpha(1).setY(0)
    this.catLineTimer = undefined // removeAllEvents stopped it
    if (this.catHovered) this.showCatTip(CAT_TIP.hover)
    this.zzzTimer = undefined // removeAllEvents stopped it, and killAll froze the letters: start over
    this.zLetters.forEach((letter) => letter.destroy())
    this.zLetters = []
    this.startZzz()
    this.startIdle()
  }

  // Idle: the sign sways very slightly, and dust drifts in the light of the door
  private startIdle() {
    if (this.leaving) return // the sign is falling
    const sway = { t: 0 }
    const swayTween = this.tweens.add({
      targets: sway,
      t: 1,
      duration: IDLE_SWAY.ms,
      repeat: -1,
      onUpdate: () => this.sign.setRotation(Phaser.Math.DegToRad(IDLE_SWAY.degrees) * Math.sin(sway.t * Math.PI * 2)),
    })
    this.signMotion.push(swayTween)
    for (let i = 0; i < DUST.count; i++) this.spawnMote(Phaser.Math.Between(0, DUST.ms.min))
  }

  // One dust mote: appears somewhere in the light, drifts slowly, fades in and out, then starts again
  private spawnMote(delay: number) {
    if (this.leaving) return
    const { area } = DUST
    const x = Phaser.Math.Between(area.x, area.x + area.width)
    const y = Phaser.Math.Between(area.y, area.y + area.height)
    const mote = this.add
      .circle(x, y, Phaser.Math.FloatBetween(DUST.radius.min, DUST.radius.max), DUST.color)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.dust.add(mote)
    const ms = Phaser.Math.Between(DUST.ms.min, DUST.ms.max)
    const life = { t: 0 }
    this.tweens.add({
      targets: life,
      t: 1,
      delay,
      duration: ms,
      onUpdate: () => {
        mote.setPosition(x + DUST.driftPx.x * life.t, y + DUST.driftPx.y * life.t)
        mote.setAlpha(DUST.alpha * Math.sin(Math.PI * life.t)) // in, then out
      },
      onComplete: () => {
        mote.destroy()
        this.spawnMote(0)
      },
    })
  }

  // The invisible hit area over the cat, and its small tip (shown on hover, a random line after a click)
  private makeCat() {
    const { x, y, width, height } = CAT_HIT
    this.catZone = this.add.zone(x + width / 2, y + height / 2, width, height).setInteractive({ useHandCursor: true })
    this.catZone.on('pointerover', () => {
      this.catHovered = true
      if (!this.catLineTimer) this.showCatTip(CAT_TIP.hover)
    })
    this.catZone.on('pointerout', () => {
      this.catHovered = false
      this.catLineTimer?.remove()
      this.catLineTimer = undefined
      this.hideCatTip()
    })
    this.catZone.on('pointerdown', () => this.poke())
  }

  // A click on the cat: two extra letters at once, and one random line for a while
  private poke() {
    if (!this.ready || this.leaving) return // during the intro a click only skips it
    for (let i = 0; i < CAT_EXTRA_Z; i++) this.spawnZ(true)
    let line = Phaser.Math.Between(0, CAT_TIP.lines.length - 1)
    if (line === this.catLastLine) line = (line + 1 + Phaser.Math.Between(0, CAT_TIP.lines.length - 2)) % CAT_TIP.lines.length
    this.catLastLine = line
    this.showCatTip(CAT_TIP.lines[line])
    this.catLineTimer?.remove()
    this.catLineTimer = this.time.delayedCall(CAT_TIP.ms, () => {
      this.catLineTimer = undefined
      if (this.catHovered && !this.leaving) this.showCatTip(CAT_TIP.hover)
      else this.hideCatTip()
    })
  }

  // The tip: a small parchment label with a copper border (the same look as the bottle names), above the cat
  private showCatTip(text: string) {
    if (this.leaving) return
    this.hideCatTip()
    const label = this.add
      .text(0, 0, text, { fontFamily: 'Georgia, serif', fontSize: `${CAT_TIP.fontSize}px`, color: TEXT_COLOR })
      .setOrigin(0.5)
      .setResolution(2)
    const width = label.width + CAT_TIP.padding.x * 2
    const height = label.height + CAT_TIP.padding.y * 2
    const centerX = CAT_HIT.x + CAT_HIT.width / 2
    const bottom = CAT_HIT.y - CAT_TIP.gap
    this.catTip = this.add.container(centerX, bottom - height / 2, [addLabelPlate(this, 0, 0, width, height), label]).setDepth(CAT_TIP.depth)
  }

  private hideCatTip() {
    this.catTip?.destroy()
    this.catTip = undefined
  }

  // Every ZZZ.everyMs a letter floats up from the cat's head (at most ZZZ.max at once)
  private startZzz() {
    if (this.zzzTimer || this.leaving) return
    this.zzzTimer = this.time.addEvent({ delay: ZZZ.everyMs, loop: true, callback: () => this.spawnZ() })
    this.spawnZ()
  }

  // `force` ignores the limit of letters on the screen (used when the cat is clicked)
  private spawnZ(force = false) {
    if (this.leaving || (!force && this.zLetters.length >= ZZZ.max)) return
    const i = this.zzzNext++ % ZZZ.letters.length
    const letter = this.add
      .text(ZZZ.origin.x, ZZZ.origin.y, ZZZ.letters[i], { fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: `${ZZZ.sizes[i]}px`, color: ZZZ.color })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(ZZZ.scale.from)
      .setResolution(2)
    this.zLetters.push(letter)
    const life = { t: 0 }
    this.tweens.add({
      targets: life,
      t: 1,
      duration: ZZZ.ms,
      onUpdate: () => {
        const t = life.t
        letter.setPosition(
          ZZZ.origin.x + ZZZ.drift.x * t + Math.sin(t * Math.PI * 2 * ZZZ.sway.swings) * ZZZ.sway.px,
          ZZZ.origin.y + ZZZ.drift.y * t,
        )
        letter.setScale(Phaser.Math.Linear(ZZZ.scale.from, ZZZ.scale.to, t))
        const fadeIn = Math.min(1, t / ZZZ.fadeInShare)
        const fadeOut = 1 - Math.max(0, (t - ZZZ.fadeOutFrom) / (1 - ZZZ.fadeOutFrom))
        letter.setAlpha(ZZZ.alpha * fadeIn * fadeOut)
      },
      onComplete: () => {
        letter.destroy()
        this.zLetters = this.zLetters.filter((l) => l !== letter)
      },
    })
  }

  // Play (or Enter / Space): starts with the saved difficulty. On the very first visit nothing is saved yet, so a small
  // panel asks first: start on Normal, or choose.
  private onPlay() {
    if (this.leaving) return
    if (hasChosenDifficulty()) this.play()
    else this.confirmPanel?.open()
  }

  // The sign falls (see the constants), then the screen fades to black and the story starts.
  // From the first moment the buttons are off and keys and clicks do nothing more.
  private play() {
    if (this.leaving) return
    this.leaving = true
    this.zzzTimer?.remove()
    this.catZone?.disableInteractive()
    this.hideCatTip()
    this.plateButtons.forEach((button) => button.setEnabled(false))
    this.tweens.add({ targets: this.buttons, alpha: 0, duration: PLAY_BUTTONS_FADE_MS })
    this.signMotion.forEach((tween) => tween.remove()) // the sign must not swing while it falls
    this.signMotion = []

    // 1) the sign strains: a quick small jitter around its rest position
    this.time.delayedCall(PLAY_BUTTONS_FADE_MS, () => {
      const strain = { t: 0 }
      this.tweens.add({
        targets: strain,
        t: 1,
        duration: SIGN_STRAIN.ms,
        onUpdate: () => this.sign.setRotation(Phaser.Math.DegToRad(SIGN_STRAIN.degrees) * Math.sin(strain.t * Math.PI * 2 * SIGN_STRAIN.shakes)),
        onComplete: () => this.fall(),
      })
    })
  }

  // 2) the chains snap, one after the other: the right one first, and the sign swings on the left one; then the left
  // one, and the sign falls with gravity; 3) the impact; 4) hold, then fade out
  private fall() {
    this.music?.stop(MUSIC_FADE_OUT_MS)
    const sign = this.sign
    const scale = signScale(SIGN.boardWidth)
    // The ring the sign hangs on, in the sign's own coordinates, and where it is on the screen (it stays there while
    // the sign swings around it)
    const pivot = { x: (CHAIN_CUT.leftX - SIGN_PICTURE_CENTER_X) * scale, y: CHAIN_CUT.row * scale }
    sign.setRotation(0)
    const pivotOnScreen = { x: sign.x + pivot.x, y: sign.y + pivot.y }
    this.snapChain(1)

    const swing = { t: 0 }
    this.tweens.add({
      targets: swing,
      t: 1,
      duration: HANG.ms,
      onUpdate: () => {
        // A damped swing around the settling angle, starting upright: it drops, overshoots and comes back
        const angle = Phaser.Math.DegToRad(HANG.degrees) * (1 - Math.cos(swing.t * Math.PI * 2 * HANG.cycles) * (1 - 0.5 * swing.t))
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        sign.setRotation(angle)
        sign.setPosition(pivotOnScreen.x - (pivot.x * cos - pivot.y * sin), pivotOnScreen.y - (pivot.x * sin + pivot.y * cos))
      },
      onComplete: () => {
        this.snapChain(-1)
        this.drop()
      },
    })
  }

  // The sign falls from where it is: gravity, and a turn to the angle it lands at
  private drop() {
    const angle = Phaser.Math.DegToRad(SIGN_FALL.degrees)
    const scale = signScale(SIGN.boardWidth)
    const boardBottom = SIGN_PICTURE_BOARD_BOTTOM * scale // from the sign's origin (the top centre)
    // Turned around the origin, the bottom of the board is boardBottom * cos(angle) lower and
    // boardBottom * -sin(angle) to the right
    const restY = SIGN_FALL.boardBottomY - boardBottom * Math.cos(angle)
    this.tweens.add({
      targets: this.sign,
      x: SIGN.x,
      y: restY,
      rotation: angle,
      duration: SIGN_FALL.ms,
      ease: SIGN_FALL.ease,
      onComplete: () => this.impact(restY, SIGN.x - boardBottom * Math.sin(angle)),
    })
  }

  // One chain snaps (-1 left, 1 right): its upper piece leaves the sign, stays where it hangs and swings like a pendulum
  // around its upper end, a few broken links fly out of the cut, and there is a small metal sound.
  private snapChain(side: -1 | 1) {
    const piece = side < 0 ? this.chainLeft : this.chainRight
    if (!piece) return
    const sign = this.sign
    const scale = signScale(SIGN.boardWidth)
    const topX = side < 0 ? CHAIN_TOP_ENDS.leftX : CHAIN_TOP_ENDS.rightX
    // Take it out of the container, and make its upper end the point it turns around (origin), without moving it
    sign.remove(piece)
    this.add.existing(piece)
    piece.setOrigin(topX / piece.width, CHAIN_TOP_ENDS.row / piece.height)
    // (at the sign's resting place: by the second snap the sign has swung away from it)
    piece.setPosition(SIGN.x + (topX - SIGN_PICTURE_CENTER_X) * scale, signRestY(SIGN.boardWidth) + CHAIN_TOP_ENDS.row * scale)

    const swing = { t: 0 }
    this.tweens.add({
      targets: swing,
      t: 1,
      duration: CHAIN_SWING.ms,
      onUpdate: () => piece.setRotation(Phaser.Math.DegToRad(CHAIN_SWING.degrees) * side * (1 - swing.t) * Math.sin(swing.t * Math.PI * 2 * CHAIN_SWING.cycles)),
      onComplete: () => piece.setRotation(0),
    })

    // The cut point on the screen, turned with the sign
    const cos = Math.cos(sign.rotation)
    const sin = Math.sin(sign.rotation)
    const localX = ((side < 0 ? CHAIN_CUT.leftX : CHAIN_CUT.rightX) - SIGN_PICTURE_CENTER_X) * scale
    const localY = CHAIN_CUT.row * scale
    this.breakLinks(sign.x + localX * cos - localY * sin, sign.y + localX * sin + localY * cos, side)
    playEffect(this, TINK.sound as 'bottle', 0, TINK.volume)
  }

  // A few small dark-grey links that pop out of (x, y), away from the middle (`side`), and fall
  private breakLinks(x: number, y: number, side: -1 | 1) {
    const count = Phaser.Math.Between(CHAIN_BITS.count.min, CHAIN_BITS.count.max)
    for (let i = 0; i < count; i++) {
      const bit = this.add.rectangle(x, y, CHAIN_BITS.size.width, CHAIN_BITS.size.height, CHAIN_BITS.color).setRotation(Phaser.Math.FloatBetween(0, Math.PI))
      const angle = Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-70, 40)) // up and out, or a little down
      const speed = Phaser.Math.FloatBetween(CHAIN_BITS.speed.min, CHAIN_BITS.speed.max)
      const vx = side * Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed
      const spin = Phaser.Math.FloatBetween(-6, 6) // radians per second
      const life = { t: 0 }
      this.tweens.add({
        targets: life,
        t: 1,
        duration: CHAIN_BITS.ms,
        onUpdate: () => {
          const seconds = (life.t * CHAIN_BITS.ms) / 1000
          bit.setPosition(x + vx * seconds, y + vy * seconds + 0.5 * CHAIN_BITS.gravity * seconds * seconds)
          bit.setRotation(bit.rotation + spin * 0.016)
          bit.setAlpha(1 - life.t)
        },
        onComplete: () => bit.destroy(),
      })
    }
  }

  private impact(restY: number, bottomX: number) {
    playEffect(this, 'signFall', SIGN_FALL_SEEK) // skipped quietly if the file is missing
    this.cameras.main.shake(IMPACT_SHAKE.ms, IMPACT_SHAKE.intensity)
    this.puffOfDust(bottomX, SIGN_FALL.boardBottomY)

    // A tiny bounce: the sign hops up and settles, twice, each hop smaller
    const hop = (i: number) => {
      const bounce = IMPACT_BOUNCES[i]
      if (!bounce) return
      this.tweens.add({ targets: this.sign, y: restY - bounce.px, duration: bounce.ms, yoyo: true, ease: 'Quad.easeOut', onComplete: () => hop(i + 1) })
    }
    hop(0)

    // Hold for a moment, then fade to black and start the story (the scene that used to come first)
    this.time.delayedCall(HOLD_AFTER_IMPACT_MS, () => {
      this.music?.stop(PLAY_FADE_MS)
      this.cameras.main.fadeOut(PLAY_FADE_MS, 0, 0, 0)
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('IntroScene'))
    })
  }

  // Soft beige circles that spread along the bottom of the sign, grow and fade
  private puffOfDust(x: number, y: number) {
    const count = Phaser.Math.Between(IMPACT_DUST.count.min, IMPACT_DUST.count.max)
    const halfWidth = (SIGN.boardWidth * IMPACT_DUST.spreadShare) / 2
    for (let i = 0; i < count; i++) {
      const px = x + Phaser.Math.FloatBetween(-halfWidth, halfWidth)
      const puff = this.add.circle(px, y, Phaser.Math.FloatBetween(IMPACT_DUST.radius.min, IMPACT_DUST.radius.max), IMPACT_DUST.color).setAlpha(IMPACT_DUST.alpha)
      this.tweens.add({
        targets: puff,
        scale: IMPACT_DUST.grow,
        alpha: 0,
        y: y - IMPACT_DUST.rise,
        duration: IMPACT_DUST.ms,
        ease: 'Sine.easeOut',
        onComplete: () => puff.destroy(),
      })
    }
  }
}
