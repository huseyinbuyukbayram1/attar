import Phaser from 'phaser'
import { GAME_PROGRESS, GAME_READY, loadState, queueTitleAssets } from './assets'
import { LoadingBar } from './ui/LoadingBar'

// Shows the loading bar in two situations:
//  - at the start: loads only what the title screen needs, then opens the title and starts the
//    background loading of everything else (BackgroundLoadScene)
//  - when Play was pressed before that background loading is done: waits for it (data.next = the scene to start)
export class PreloadScene extends Phaser.Scene {
  private next?: string
  private bar!: LoadingBar

  constructor() {
    super('PreloadScene')
  }

  init(data: { next?: string }) {
    this.next = data.next
  }

  preload() {
    this.bar = new LoadingBar(this)
    if (this.next) return // waiting for the background load: nothing to load here, see create()
    this.load.on('progress', (value: number) => this.bar.set(value))
    queueTitleAssets(this)
  }

  create() {
    if (this.next) return this.waitForGameAssets(this.next)
    this.scene.launch('BackgroundLoadScene') // keeps loading while the title is on screen
    this.scene.start('TitleScene')
  }

  private waitForGameAssets(next: string) {
    const go = () => this.scene.start(next)
    if (loadState.gameReady) return go()
    const onProgress = (value: number) => this.bar.set(value)
    this.game.events.on(GAME_PROGRESS, onProgress)
    this.game.events.once(GAME_READY, go)
    this.events.once('shutdown', () => {
      this.game.events.off(GAME_PROGRESS, onProgress)
      this.game.events.off(GAME_READY, go)
    })
  }
}
