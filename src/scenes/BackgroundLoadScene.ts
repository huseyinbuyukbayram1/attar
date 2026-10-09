import Phaser from 'phaser'
import { ENDINGS_PROGRESS, ENDINGS_READY, GAME_PROGRESS, GAME_READY, loadState, queueEndingAssets, queueGameAssets } from './assets'
import { makeClearFlaskTexture } from './ui/clearFlaskTexture'

// Invisible scene that loads everything but the title's files while the title is on screen. It is its own
// scene (not part of the title) because a scene's loader stops when the scene does, and the player may press
// Play at any moment. Textures and sounds are shared by the whole game, so any scene can use them afterwards.
export class BackgroundLoadScene extends Phaser.Scene {
  constructor() {
    super('BackgroundLoadScene')
  }

  preload() {
    this.load.on('progress', (value: number) => this.game.events.emit(GAME_PROGRESS, value))
    queueGameAssets(this)
  }

  create() {
    makeClearFlaskTexture(this) // see-through version of the flask picture, used by the MIX view
    loadState.gameReady = true
    this.game.events.emit(GAME_READY)

    // Then the big ending files, so they never slow down the start of the story
    this.load.on('progress', (value: number) => this.game.events.emit(ENDINGS_PROGRESS, value))
    this.load.once('complete', () => {
      loadState.endingsReady = true
      this.game.events.emit(ENDINGS_READY)
      this.scene.stop()
    })
    queueEndingAssets(this)
    this.load.start() // the loader is not started automatically after preload
  }
}
