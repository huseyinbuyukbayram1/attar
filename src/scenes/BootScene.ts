import Phaser from 'phaser'
import { ORDERS } from '../data/customers'
import { applyMute, loadSounds } from '../game/audio'
import { loadDifficulty } from '../game/difficulty'
import { loadSettings } from '../game/settings'
import { makeClearFlaskTexture } from './ui/clearFlaskTexture'

// Loads all assets up front so later scenes can use them instantly, then shows the intro.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  preload() {
    // Saved volumes and mute, read before any sound can play
    loadSettings()
    loadDifficulty()
    applyMute(this)
    this.showLoadingBar()

    // A missing file must not crash the game: warn and let ShopScene use a fallback
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`Could not load asset "${file.key}" (${file.url}), using fallback`)
    })

    // Real art is loaded by file name from public/assets/, so swapping art needs no code change
    this.load.image('shop_morning', 'assets/backgrounds/shop_morning.jpg')
    // Background of the MIX phase
    this.load.image('counter_view', 'assets/backgrounds/counter_view.jpg')
    // Bottle sprites for the MIX phase (a missing file falls back to plain shapes)
    this.load.image('bottle_round', 'assets/bottles/bottle_round.png')
    this.load.image('bottle_dropper', 'assets/bottles/bottle_dropper.png')
    this.load.image('bottle_square', 'assets/bottles/bottle_square.png')
    this.load.image('mixing_flask', 'assets/bottles/mixing_flask.png')
    // The closed notebook on the counter; without it the MIX view draws a simple book in code
    this.load.image('notebook_closed', 'assets/props/notebook_closed.png')
    // Title screen: the shop exterior (1920x1080) and the hanging sign (700x570)
    this.load.image('title_exterior', 'assets/title/title_exterior.jpg')
    this.load.image('title_sign', 'assets/title/title_sign.png')
    // Sabiha, the practice customer of the tutorial (she is not one of the ORDERS, so she is loaded here)
    this.load.image('customer_practice', 'assets/characters/customer_practice.png')
    // The player character's three expressions on the REACT screen (same size and framing, so they swap cleanly)
    for (const expression of ['neutral', 'happy', 'sad']) {
      this.load.image(`player_${expression}`, `assets/characters/player_${expression}.png`)
    }
    // Painted button plates (long and short, for buttons and labels)
    this.load.image('button_long', 'assets/ui/button_long.png')
    this.load.image('button_short', 'assets/ui/button_short.png')
    // The open notebook (1100x703), the background of the ingredient notebook panel
    this.load.image('notebook_open', 'assets/props/notebook_open.png')
    // The delivery: the gift bottle (165x220), the cash box (240x223) and a coin (64x44); without them the
    // animation skips the bottle and the box, and the coins are plain circles
    this.load.image('gift_bottle', 'assets/props/gift_bottle.png')
    this.load.image('cashbox', 'assets/props/cashbox.png')
    this.load.image('coin', 'assets/props/coin.png')
    // The waste pot that rises behind the flask when it is emptied; without it the animation has no pot
    this.load.image('waste_pot', 'assets/props/waste_pot.png')
    // The story: the grandfather's portrait for the intro and the three ending pictures (a missing
    // ending picture falls back to the shop with an overlay)
    this.load.image('master_portrait', 'assets/story/master_portrait.png')
    this.load.image('ending_win', 'assets/story/ending_win.jpg')
    this.load.image('ending_greatwin', 'assets/story/ending_greatwin.jpg')
    this.load.image('ending_lose', 'assets/story/ending_lose.jpg')

    loadSounds(this) // only the sounds that have a file name in SOUND_FILES

    // One portrait per order, found by order id. Portraits are made one at a time, so
    // many will be missing for a while. A missing or invalid file fires 'loaderror' (warned
    // above) and registers no texture; ShopScene checks textures.exists and uses a placeholder.
    for (const order of ORDERS) {
      this.load.image(`customer_${order.id}`, `assets/characters/customer_${order.id}.png`)
    }
  }

  create() {
    makeClearFlaskTexture(this) // see-through version of the flask picture, used by the MIX view
    this.scene.start('TitleScene') // the title screen leads on to IntroScene
  }

  // Simple bar: an outline plus a fill that grows with load progress
  private showLoadingBar() {
    const { width, height } = this.scale
    const barWidth = 400
    const barHeight = 24
    const x = (width - barWidth) / 2
    const y = height / 2

    this.add.rectangle(width / 2, y, barWidth + 4, barHeight + 4).setStrokeStyle(2, 0xf3e2b3)
    const fill = this.add.rectangle(x, y, 0, barHeight, 0xf3e2b3).setOrigin(0, 0.5)

    this.load.on('progress', (value: number) => {
      fill.width = barWidth * value
    })
  }
}
