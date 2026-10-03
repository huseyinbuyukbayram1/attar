import { FALLBACK_COLOR, INGREDIENT_COLORS } from '../../data/ingredientColors'

function channels(color: number) {
  return { r: (color >> 16) & 255, g: (color >> 8) & 255, b: color & 255 }
}

function pack(r: number, g: number, b: number): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
}

// The color of a mix of drops: the plain average of their colors, channel by channel
export function averageColor(ids: string[]): number {
  if (ids.length === 0) return FALLBACK_COLOR
  let r = 0
  let g = 0
  let b = 0
  for (const id of ids) {
    const c = channels(INGREDIENT_COLORS[id] ?? FALLBACK_COLOR)
    r += c.r
    g += c.g
    b += c.b
  }
  return pack(r / ids.length, g / ids.length, b / ids.length)
}

// Blends two colors per channel. Tweening the number 0xRRGGBB directly would give
// wrong in-between colors, so animations blend through this instead.
export function lerpColor(from: number, to: number, t: number): number {
  const a = channels(from)
  const b = channels(to)
  return pack(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)
}
