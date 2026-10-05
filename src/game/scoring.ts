import { AXES, INGREDIENTS } from '../data/ingredients'
import type { Scent } from '../data/ingredients'
import type { Order } from '../data/customers'

// Tuning knobs live here so balancing never means hunting through the code
export const MIN_DROPS = 3
export const MAX_DROPS = 6
export const STAR_THRESHOLDS = { three: 0.12, two: 0.25, one: 0.4 } // distance must be BELOW these
const HINT_TIE_MARGIN = 0.01 // two axes this close in how far off they are count as equally off

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

// How the hint changes with the distance (the stars themselves do not depend on these)
const HINT_NEAR_MISS = 0.2 // from the 3-star line up to here: "So close!", one axis
const HINT_FAR = 0.4 // from here on: stronger wording
const HINT_MIN_AXIS_DIFF = 0.05 // in the two-axis hints, an axis that is off by less than this is left out

// Tells the player what to change. A mix that earns 3 stars is always "exactly it": the hint must
// never contradict the stars. The further off the mix is, the more the hint says:
//  - near miss (below HINT_NEAR_MISS): the single axis that is most off, "a touch more/less"
//  - further (below HINT_FAR): the axis that is most too strong AND the axis that is most missing
//  - far (HINT_FAR or more): the same, with stronger wording
// An axis that is off by less than HINT_MIN_AXIS_DIFF is not named in the two-axis hints.
export function hintFor(mix: Scent, target: Scent): string {
  const dist = distance(mix, target)
  if (dist < STAR_THRESHOLDS.three) return 'That is exactly it.'

  const a = proportions(mix)
  const b = proportions(target)

  // Axes from most off to least off (ties keep the AXES order)
  const diffs = AXES.map((axis) => ({ axis, diff: a[axis] - b[axis] })).sort(
    (x, y) => Math.abs(y.diff) - Math.abs(x.diff),
  )

  // Near miss: one axis. The tie rule is kept here: two axes about equally off, the worst is
  // "too much" and the runner-up "too little": asking for something that is missing is more
  // useful than asking for less of something, so prefer the one the mix has too little of.
  if (dist < HINT_NEAR_MISS) {
    let worst = diffs[0]
    const runnerUp = diffs[1]
    if (worst.diff > 0 && runnerUp.diff < 0 && Math.abs(worst.diff) - Math.abs(runnerUp.diff) <= HINT_TIE_MARGIN) {
      worst = runnerUp
    }
    return worst.diff > 0 ? `So close! Just a touch less ${worst.axis}.` : `So close! Just a touch more ${worst.axis}.`
  }

  // Further off: the axis with the largest excess and the axis with the largest shortfall. They are
  // two different axes, so there is nothing to tie-break. Small differences are left out.
  const far = dist >= HINT_FAR
  const over = diffs.find((d) => d.diff > 0 && d.diff >= HINT_MIN_AXIS_DIFF) // diffs is sorted, so this is the largest
  const under = diffs.find((d) => d.diff < 0 && -d.diff >= HINT_MIN_AXIS_DIFF)
  if (over && under) {
    return far
      ? `Hmm, far too ${over.axis}. It really needs something ${under.axis}.`
      : `Lovely, but too ${over.axis}, and it needs something ${under.axis}.`
  }
  if (over) return far ? `Hmm, far too ${over.axis}.` : `Lovely, but too ${over.axis}.`
  if (under) return far ? `It really needs something ${under.axis}.` : `It needs something ${under.axis}.`

  // Not reachable when the distance is 0.2 or more (some axis is always off by at least 0.05);
  // kept so a hint is never empty
  const worst = diffs[0]
  return worst.diff > 0 ? `Lovely, but too ${worst.axis}.` : `It needs something ${worst.axis}.`
}

export function scoreMix(drops: string[], order: Order): Score {
  if (drops.length < MIN_DROPS) {
    return { stars: 0, distance: 1, hint: `Add a few more drops, at least ${MIN_DROPS}.` }
  }
  const mix = mixScent(drops)
  const dist = distance(mix, order.target)
  return { stars: starsFor(dist), distance: dist, hint: hintFor(mix, order.target) }
}
