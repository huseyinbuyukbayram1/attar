import Phaser from 'phaser'
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

// Multiplies two colors channel by channel, like a tint: used to warm a bottle for the evening
export function multiplyColor(a: number, b: number): number {
  const x = channels(a)
  const y = channels(b)
  return pack((x.r * y.r) / 255, (x.g * y.g) / 255, (x.b * y.b) / 255)
}

// The raw average of several colors looks muddy, so the flask liquid is made a bit more
// saturated, and its lightness is kept in a range where it is neither too dark nor washed out.
const SATURATION_BOOST = 1.18
const LIGHTNESS = { min: 0.35, max: 0.65 }

function toHsl(color: number) {
  const { r, g, b } = channels(color)
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
  else if (max === gn) h = ((bn - rn) / d + 2) * 60
  else h = ((rn - gn) / d + 4) * 60
  return { h, s, l }
}

function fromHsl(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255
  }
  return pack(channel(0), channel(8), channel(4))
}

// The color the flask liquid is drawn in for these drops
export function liquidColor(ids: string[]): number {
  const { h, s, l } = toHsl(averageColor(ids))
  return fromHsl(h, Math.min(1, s * SATURATION_BOOST), Phaser.Math.Clamp(l, LIGHTNESS.min, LIGHTNESS.max))
}
