import { defineConfig } from 'vite'

// base './' makes built file paths relative, which itch.io needs
// (it serves the game from a sub-folder, not the site root).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 }, // Phaser alone is ~1.3 MB; that's expected
})
