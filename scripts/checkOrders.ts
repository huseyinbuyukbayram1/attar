// Balance check: is every order winnable (3 stars) with 3-6 drops?
// Run with `npm run check-orders`. Brute force is fine: only a few thousand recipes.
import { INGREDIENTS } from '../src/data/ingredients'
import { ORDERS } from '../src/data/customers'
import { MIN_DROPS, MAX_DROPS, mixScent, distance, starsFor } from '../src/game/scoring'

// Every recipe of `size` drops, with repetition, as a list of ingredient ids.
// `start` keeps the order increasing so "rose+oud" and "oud+rose" aren't counted twice.
function recipes(size: number, start = 0, current: string[] = []): string[][] {
  if (current.length === size) return [current]
  const all: string[][] = []
  for (let i = start; i < INGREDIENTS.length; i++) {
    all.push(...recipes(size, i, [...current, INGREDIENTS[i].id]))
  }
  return all
}

const allRecipes: string[][] = []
for (let size = MIN_DROPS; size <= MAX_DROPS; size++) allRecipes.push(...recipes(size))
console.log(`Checking ${allRecipes.length} recipes against ${ORDERS.length} orders\n`)

let failed = false
for (const order of ORDERS) {
  let best = allRecipes[0]
  let bestDistance = Infinity
  for (const recipe of allRecipes) {
    const d = distance(mixScent(recipe), order.target)
    if (d < bestDistance) {
      bestDistance = d
      best = recipe
    }
  }
  const stars = starsFor(bestDistance)
  const names = best.map((id) => INGREDIENTS.find((i) => i.id === id)!.name)
  console.log(`${order.id}: best distance ${bestDistance.toFixed(3)}, best stars ${stars}`)
  console.log(`  example: ${names.join(', ')}`)
  if (stars < 3) {
    console.error(`  ERROR: "${order.id}" has no 3-star recipe`)
    failed = true
  }
}

if (failed) process.exit(1)
