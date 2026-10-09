import Phaser from 'phaser'
import { applyMute } from '../game/audio'
import { loadDifficulty } from '../game/difficulty'
import { loadSettings } from '../game/settings'

// The first scene loads almost nothing: the logo font (62 KB) and the dark background colour from the game
// config. It exists so the loading bar of PreloadScene can already be drawn in the game's own font.
const FONT_WAIT_MS = 3000 // never wait longer than this for the font: the bar falls back to a serif

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create() {
    // Saved volumes and mute, read before any sound can play
    loadSettings()
    loadDifficulty()
    applyMute(this)

    // The font is only fetched when something uses it, so ask for it now and go on when it is there
    let started = false
    const go = () => {
      if (started) return
      started = true
      document.getElementById('boot-loading')?.remove() // the plain "Loading…" of index.html, in the page before the game ran
      this.scene.start('PreloadScene')
    }
    document.fonts.load("700 32px 'Cinzel Decorative'").then(go, go)
    this.time.delayedCall(FONT_WAIT_MS, go)
  }
}
