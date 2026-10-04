// Diagnostic: shows what hintFor says for deliberately flawed mixes. Changes nothing.
// Run with `npm run hint-demo`.
import { AXES, INGREDIENTS } from '../src/data/ingredients'
import type { Axis, Scent } from '../src/data/ingredients'
import { ORDERS } from '../src/data/customers'
import { MIN_DROPS, MAX_DROPS, mixScent, distance, starsFor, hintFor } from '../src/game/scoring'

const SEED = 42
const RANDOM_MIX_SIZE = 3
const NEAR_TARGET = 0.05 // an axis this close to the target should not be the one the hint complains about

const nameOf = (id: string) => INGREDIENTS.find((i) => i.id === id)!.name

// scoring.ts does not export its proportions helper, so the same arithmetic is repeated here
function shares(scent: Scent): Scent {
  const total = AXES.reduce((sum, axis) => sum + scent[axis], 0)
  const out = { floral: 0, woody: 0, citrus: 0, sweet: 0, spicy: 0 }
  if (total === 0) return out
  for (const axis of AXES) out[axis] = scent[axis] / total
  return out
}
const fmt = (scent: Scent) => AXES.map((axis) => `${axis} ${scent[axis].toFixed(2)}`).join(', ')

// Small seeded random generator (mulberry32), so the "random" mixes are the same every run
function seededRandom(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = seededRandom(SEED)

function recipes(size: number, start = 0, current: string[] = []): string[][] {
  if (current.length === size) return [current]
  const all: string[][] = []
  for (let i = start; i < INGREDIENTS.length; i++) all.push(...recipes(size, i, [...current, INGREDIENTS[i].id]))
  return all
}
const allRecipes: string[][] = []
for (let size = MIN_DROPS; size <= MAX_DROPS; size++) allRecipes.push(...recipes(size))

// Replaces one drop with `id`: the last drop that is not already `id`
function replaceOne(drops: string[], id: string): string[] {
  const copy = [...drops]
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i] !== id) {
      copy[i] = id
      return copy
    }
  }
  return copy
}

const hintCounts = new Map<string, number>()
let flawedCount = 0
let hintOnNearAxis = 0
let exactButNotThree = 0
let flawedStillThree = 0
let threeStarNotExact = 0
const examples: string[] = []

for (const order of ORDERS) {
  // The good recipe: 3 stars with the fewest drops, and of those the closest to the target
  let good = allRecipes[0]
  let goodKey = [Infinity, Infinity]
  for (const recipe of allRecipes) {
    const d = distance(mixScent(recipe), order.target)
    if (starsFor(d) !== 3) continue
    if (recipe.length < goodKey[0] || (recipe.length === goodKey[0] && d < goodKey[1])) {
      good = recipe
      goodKey = [recipe.length, d]
    }
  }

  console.log(`\n=== ${order.id} (${order.customerName}): "${order.orderText}"`)
  console.log(`Target: ${fmt(shares(order.target))}`)

  // The most dominant ingredient = the one used most often in the good recipe
  const counts = new Map<string, number>()
  good.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1))
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]

  const randomMix = Array.from({ length: RANDOM_MIX_SIZE }, () => INGREDIENTS[Math.floor(random() * INGREDIENTS.length)].id)
  const mixes: [string, string[]][] = [
    ['GOOD  known good recipe', good],
    ['(a) remove one drop', good.slice(0, -1)],
    [`(b) extra ${nameOf(dominant)}`, [...good, dominant]],
    ['(c) one drop -> Vanilla', replaceOne(good, 'vanilla')],
    ['(d) one drop -> Bergamot', replaceOne(good, 'bergamot')],
    ['(e) one drop -> Cedar', replaceOne(good, 'cedar')],
    ['(f) 3 random drops', randomMix],
  ]

  for (const [label, drops] of mixes) {
    const mix = mixScent(drops)
    const d = distance(mix, order.target)
    const stars = starsFor(d)
    const hint = hintFor(mix, order.target)
    console.log(`  ${label}`)
    console.log(`    drops:  ${drops.map(nameOf).join(', ')}`)
    console.log(`    mix:    ${fmt(shares(mix))}`)
    console.log(`    distance ${d.toFixed(3)}, stars ${stars}, hint: "${hint}"`)

    if (label.startsWith('GOOD')) continue
    flawedCount++
    hintCounts.set(hint, (hintCounts.get(hint) ?? 0) + 1)
    if (stars === 3) {
      flawedStillThree++
      if (hint !== 'That is exactly it.') threeStarNotExact++
    }
    if (hint === 'That is exactly it.') {
      if (stars < 3) exactButNotThree++
      continue
    }
    const named = AXES.find((axis) => hint.endsWith(` ${axis}.`)) as Axis
    const diff = Math.abs(shares(mix)[named] - shares(order.target)[named])
    if (diff < NEAR_TARGET) {
      hintOnNearAxis++
      examples.push(`${order.id} ${label}: "${hint}" (diff ${diff.toFixed(3)})`)
    }
  }
}

console.log('\n=== SUMMARY (flawed mixes only)')
console.log(`Flawed mixes: ${flawedCount}`)
console.log('Hint sentence counts:')
for (const [hint, n] of [...hintCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)} x ${hint}`)
console.log(`Hint named an axis within ${NEAR_TARGET} of the target (likely wrong hint): ${hintOnNearAxis}`)
examples.forEach((e) => console.log(`  ${e}`))
console.log(`Extra: flawed mixes that still scored 3 stars: ${flawedStillThree}`)
console.log(`Extra: flawed mixes with 3 stars but a hint other than "That is exactly it.": ${threeStarNotExact}`)
console.log(`Extra: "That is exactly it." given to a mix with fewer than 3 stars: ${exactButNotThree}`)
