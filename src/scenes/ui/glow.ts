import Phaser from 'phaser'

const GLOW_TEXTURE = 'glow'
const GLOW_TEXTURE_SIZE = 256

// A white radial gradient (opaque center, transparent edge), made once in code. It is
// colored with setTint, so one texture serves every glow.
export function ensureGlowTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(GLOW_TEXTURE)) return
  const texture = scene.textures.createCanvas(GLOW_TEXTURE, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE)
  const context = texture?.getContext()
  if (!texture || !context) return
  const half = GLOW_TEXTURE_SIZE / 2
  const gradient = context.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE)
  texture.refresh()
}

// ADD blending adds the glow's color to what is underneath, so it reads as light
export function addGlow(scene: Phaser.Scene, x: number, y: number, radius: number, color: number) {
  return scene.add
    .image(x, y, GLOW_TEXTURE)
    .setDisplaySize(radius * 2, radius * 2)
    .setTint(color)
    .setBlendMode(Phaser.BlendModes.ADD)
}
