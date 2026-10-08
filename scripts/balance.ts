// Read-only balance analysis. Changes nothing: it only imports the real scoring, economy and data.
// Run with `npx tsx scripts/balance.ts`.
import { INGREDIENTS } from '../src/data/ingredients'
import { ORDERS } from '../src/data/customers'
import { DIFFICULTIES, DIFFICULTY_IDS } from '../src/game/difficulty'
import { formatCoins, goldCoins, payoutFor } from '../src/game/economy'
import { MAX_DROPS, MIN_DROPS, scoreMix } from '../src/game/scoring'
import type { Stars } from '../src/game/scoring'

const EXAMPLES = 3

// Every multiset of ingredient ids with exactly `size` drops (the drops of a recipe, sorted by ingredient).
// scoring.ts adds the scents up and only looks at the sum, so the order of the drops cannot matter.
function mixes(size: number, start = 0, current: string[] = []): string[][] {
  if (current.length === size) return [current]
  const all: string[][] = []
  for (let i = start; i < INGREDIENTS.length; i++) all.push(...mixes(size, i, [...current, INGREDIENTS[i].id]))
  return all
}

const allMixes: string[][] = []
for (let size = MIN_DROPS; size <= MAX_DROPS; size++) allMixes.push(...mixes(size))

// ["rose","rose","oud"] -> "Rose x2, Oud x1"
function describe(drops: string[]): string {
  const counts = new Map<string, number>()
  for (const id of drops) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()].map(([id, n]) => `${INGREDIENTS.find((i) => i.id === id)!.name} x${n}`).join(', ')
}

const pct = (n: number, total: number) => `${((100 * n) / total).toFixed(1)}%`
const pad = (text: string, width: number) => text.padEnd(width)

type Row = { id: string; name: string; counts: Record<Stars, number>; threeStarShare: number }
const rows: Row[] = []

console.log(`Mixes per order: ${allMixes.length} (multisets of ${INGREDIENTS.length} ingredients, ${MIN_DROPS}..${MAX_DROPS} drops)`)
console.log('Drop order: scoring.ts sums the scents of the drops and compares proportions, so the order does not matter.\n')

for (const order of ORDERS) {
  const counts: Record<Stars, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  const threeStar: { drops: string[]; distance: number }[] = []
  for (const drops of allMixes) {
    const score = scoreMix(drops, order)
    counts[score.stars]++
    if (score.stars === 3) threeStar.push({ drops, distance: score.distance })
  }
  rows.push({ id: order.id, name: order.customerName, counts, threeStarShare: counts[3] / allMixes.length })

  // Examples: fewest drops first, then closest to the target
  threeStar.sort((a, b) => a.drops.length - b.drops.length || a.distance - b.distance)
  console.log(`${order.id} (${order.customerName}): "${order.orderText}"`)
  console.log(
    `  3★ ${counts[3]} (${pct(counts[3], allMixes.length)}) | 2★ ${counts[2]} (${pct(counts[2], allMixes.length)}) | ` +
      `1★ ${counts[1]} (${pct(counts[1], allMixes.length)}) | 0★ ${counts[0]} (${pct(counts[0], allMixes.length)})`,
  )
  for (const example of threeStar.slice(0, EXAMPLES)) {
    console.log(`  e.g. ${describe(example.drops)}  (${example.drops.length} drops, distance ${example.distance.toFixed(3)})`)
  }
  if (threeStar.length === 0) console.log('  (no 3-star mix exists)')
  console.log('')
}

console.log('Table')
console.log(`${pad('order', 10)}${pad('customer', 14)}${pad('mixes', 7)}${pad('3★', 16)}${pad('2★', 16)}${pad('1★', 16)}0★`)
for (const row of rows) {
  const cell = (stars: Stars) => pad(`${row.counts[stars]} (${pct(row.counts[stars], allMixes.length)})`, 16)
  console.log(`${pad(row.id, 10)}${pad(row.name, 14)}${pad(String(allMixes.length), 7)}${cell(3)}${cell(2)}${cell(1)}${row.counts[0]} (${pct(row.counts[0], allMixes.length)})`)
}

// ---- Summary ----
const customers = ORDERS.length
const three = payoutFor(3)
const two = payoutFor(2)
const one = payoutFor(1)
console.log(`\nPayout (src/game/economy.ts): 0★ ${goldCoins(payoutFor(0))} (refused), 1★ ${goldCoins(one)} (haggled), 2★ ${goldCoins(two)}, 3★ ${goldCoins(three)} (price + tip)`)
console.log(`Max possible money (3★ on all ${customers} orders): ${goldCoins(customers * three)}. All 2★: ${goldCoins(customers * two)}; all 1★: ${goldCoins(customers * one)}`)

for (const id of DIFFICULTY_IDS) {
  const { label, debt, smells, greatWin } = DIFFICULTIES[id]
  console.log(`\n${label}: target ${goldCoins(debt)}, ${smells} smells per order, "customers lining up" from ${goldCoins(greatWin)}`)
  console.log('  3★ on X orders, 2★ on the rest:')
  for (let x = 0; x <= customers; x++) {
    const money = x * three + (customers - x) * two
    console.log(`    X=${String(x).padStart(2)}: ${formatCoins(money).padStart(3)} coins  ${money >= debt ? 'reaches the target' : `short by ${goldCoins(debt - money)}`}`)
  }
  const needed = Array.from({ length: customers + 1 }, (_, x) => x).find((x) => x * three + (customers - x) * two >= debt)
  console.log(`  Minimum 3★ orders needed (2★ on the rest): ${needed ?? 'not reachable'}`)
  // Without any 3★: how many 2★ (and the rest 1★) are needed?
  const twoNeeded = Array.from({ length: customers + 1 }, (_, y) => y).find((y) => y * two + (customers - y) * one >= debt)
  console.log(twoNeeded === undefined ? '  With only 2★ and 1★ orders the target is not reachable' : `  Or with only 2★ and 1★: at least ${twoNeeded} orders at 2★ (the rest at 1★)`)
}

const sorted = [...rows].sort((a, b) => a.threeStarShare - b.threeStarShare)
console.log('\nHardest orders (lowest 3★ share):')
for (const row of sorted.slice(0, 3)) console.log(`  ${row.id} (${row.name}): ${pct(row.counts[3], allMixes.length)}`)
console.log('Easiest orders (highest 3★ share):')
for (const row of sorted.slice(-3).reverse()) console.log(`  ${row.id} (${row.name}): ${pct(row.counts[3], allMixes.length)}`)
