import { AXES, INGREDIENTS } from '../data/ingredients'
import type { Axis, Scent } from '../data/ingredients'
import type { Order } from '../data/customers'

// Tuning knobs live here so balancing never means hunting through the code
export const MIN_DROPS = 3
export const MAX_DROPS = 6
export const STAR_THRESHOLDS = { three: 0.12, two: 0.25, one: 0.4 } // distance must be BELOW these
const HINT_TOLERANCE = 0.05 // below this difference on every axis, the mix counts as "exactly it"

export type Stars = 0 | 1 | 2 | 3
export type Score = { stars: Stars; distance: number; hint: string }

function emptyScent(): Scent {
  return { floral: 0, woody: 0, citrus: 0, sweet: 0, spicy: 0 }
}

// Adds up the scent of every drop. Unknown ids are ignored so a typo can't crash the game.
export function mixScent(drops: string[]): Scent {
  const mix = emptyScent()
  for (const id of drops) {
    const ingredient = INGREDIENTS.find((i) => i.id === id)
    if (!ingredient) continue
    for (const axis of AXES) mix[axis] += ingredient.scent[axis]
  }
  return mix
}

// Turns amounts into shares that add up to 1. Only the character of a scent matters,
// not how strong it is, so 6 drops of the right blend equals 3 drops of it.
function proportions(scent: Scent): Scent {
  const total = AXES.reduce((sum, axis) => sum + scent[axis], 0)
  if (total === 0) return emptyScent()
  const result = emptyScent()
  for (const axis of AXES) result[axis] = scent[axis] / total
  return result
}

// 0 = identical, 1 = completely different. Half the summed differences because
// every surplus on one axis is a shortage on another, which would count twice.
export function distance(mix: Scent, target: Scent): number {
  const a = proportions(mix)
  const b = proportions(target)
  const sum = AXES.reduce((s, axis) => s + Math.abs(a[axis] - b[axis]), 0)
  return 0.5 * sum
}

export function starsFor(dist: number): Stars {
  if (dist < STAR_THRESHOLDS.three) return 3
  if (dist < STAR_THRESHOLDS.two) return 2
  if (dist < STAR_THRESHOLDS.one) return 1
  return 0
}

// Points at the single axis that is most off, so the player gets one clear thing to fix
export function hintFor(mix: Scent, target: Scent): string {
  const a = proportions(mix)
  const b = proportions(target)

  let worstAxis: Axis = AXES[0]
  let worstDiff = 0
  for (const axis of AXES) {
    const diff = a[axis] - b[axis]
    if (Math.abs(diff) > Math.abs(worstDiff)) {
      worstAxis = axis
      worstDiff = diff
    }
  }

  if (Math.abs(worstDiff) < HINT_TOLERANCE) return 'That is exactly it.'
  if (worstDiff > 0) return `Lovely, but too ${worstAxis}.`
  return `It needs something ${worstAxis}.`
}

export function scoreMix(drops: string[], order: Order): Score {
  if (drops.length < MIN_DROPS) {
    return { stars: 0, distance: 1, hint: `Add a few more drops, at least ${MIN_DROPS}.` }
  }
  const mix = mixScent(drops)
  const dist = distance(mix, order.target)
  return { stars: starsFor(dist), distance: dist, hint: hintFor(mix, order.target) }
}
