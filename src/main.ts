import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { ShopScene } from './scenes/ShopScene'

// Game config: fixed 1280x720 design resolution, scaled to fit any window
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1210',
  scale: {
    mode: Phaser.Scale.FIT, // shrink/grow canvas to fit window, keep aspect ratio
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, ShopScene], // first scene in the list starts automatically
})
