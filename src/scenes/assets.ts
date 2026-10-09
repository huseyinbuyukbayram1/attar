import Phaser from 'phaser'
import { ORDERS } from '../data/customers'
import { loadSounds } from '../game/audio'

// Which files are loaded when. The page used to load all ~27 MB before showing anything; now there are
// three steps, so the title appears after a few MB and the rest arrives while the player looks at it:
//   1. title    (PreloadScene)        what the title screen shows and plays
//   2. game     (BackgroundLoadScene) everything the story and the shop need
//   3. endings  (BackgroundLoadScene) the ending pictures and music, the biggest files, needed last
// Real art is loaded by file name from public/assets/, so swapping art needs no code change.

// Plain flags plus game-wide events: scenes ask "is it there yet?" or wait for the event.
export const loadState = { gameReady: false, endingsReady: false }
export const GAME_PROGRESS = 'game-assets-progress' // emitted on game.events with a value from 0 to 1
export const ENDINGS_PROGRESS = 'ending-assets-progress'
export const GAME_READY = 'game-assets-ready'
export const ENDINGS_READY = 'ending-assets-ready'

// A missing file must not crash the game: warn, and the scenes use their fallbacks
export function warnOnMissing(load: Phaser.Loader.LoaderPlugin) {
  load.on('loaderror', (file: Phaser.Loader.File) => {
    console.warn(`Could not load asset "${file.key}" (${file.url}), using fallback`)
  })
}

// Step 1: the title shows the shop exterior and the sign, with painted buttons and the logo font
export function queueTitleAssets(scene: Phaser.Scene) {
  scene.load.image('title_exterior', 'assets/title/title_exterior.jpg')
  scene.load.image('title_sign', 'assets/title/title_sign.png')
  scene.load.image('button_long', 'assets/ui/button_long.png')
  scene.load.image('button_short', 'assets/ui/button_short.png')
  loadSounds(scene, 'title') // the title music, the click, the sign's fall and its tink
}

// Step 2: the shop, the story and every other sound
export function queueGameAssets(scene: Phaser.Scene) {
  scene.load.image('shop_morning', 'assets/backgrounds/shop_morning.jpg')
  scene.load.image('counter_view', 'assets/backgrounds/counter_view.jpg') // background of the MIX phase
  // Bottle sprites for the MIX phase (a missing file falls back to plain shapes)
  scene.load.image('bottle_round', 'assets/bottles/bottle_round.png')
  scene.load.image('bottle_dropper', 'assets/bottles/bottle_dropper.png')
  scene.load.image('bottle_square', 'assets/bottles/bottle_square.png')
  scene.load.image('mixing_flask', 'assets/bottles/mixing_flask.png')
  // The closed notebook on the counter; without it the MIX view draws a simple book in code
  scene.load.image('notebook_closed', 'assets/props/notebook_closed.png')
  // The open notebook (1100x703), the background of the ingredient notebook panel
  scene.load.image('notebook_open', 'assets/props/notebook_open.png')
  // The delivery: the gift bottle, the cash box and a coin; without them the animation skips the bottle and
  // the box, and the coins are plain circles
  scene.load.image('gift_bottle', 'assets/props/gift_bottle.png')
  scene.load.image('cashbox', 'assets/props/cashbox.png')
  scene.load.image('coin', 'assets/props/coin.png')
  // The waste pot that rises behind the flask when it is emptied; without it the animation has no pot
  scene.load.image('waste_pot', 'assets/props/waste_pot.png')
  // The grandfather's portrait for the intro
  scene.load.image('master_portrait', 'assets/story/master_portrait.png')
  // Sabiha, the practice customer of the tutorial (she is not one of the ORDERS, so she is loaded here)
  scene.load.image('customer_practice', 'assets/characters/customer_practice.png')
  // The player character's three expressions on the REACT screen (same size and framing, so they swap cleanly)
  for (const expression of ['neutral', 'happy', 'sad']) {
    scene.load.image(`player_${expression}`, `assets/characters/player_${expression}.png`)
  }
  // One portrait per order, found by order id. A missing or invalid file fires 'loaderror' (warned
  // above) and registers no texture; ShopScene checks textures.exists and uses a placeholder.
  for (const order of ORDERS) {
    scene.load.image(`customer_${order.id}`, `assets/characters/customer_${order.id}.png`)
  }
  loadSounds(scene, 'game')
}

// Step 3: the three ending pictures (a missing one falls back to the shop with an overlay) and their music
export function queueEndingAssets(scene: Phaser.Scene) {
  scene.load.image('ending_win', 'assets/story/ending_win.jpg')
  scene.load.image('ending_greatwin', 'assets/story/ending_greatwin.jpg')
  scene.load.image('ending_lose', 'assets/story/ending_lose.jpg')
  loadSounds(scene, 'endings')
}
