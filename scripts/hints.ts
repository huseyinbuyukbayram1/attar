// Read-only hint analysis. Changes nothing: it only imports and calls the real scoring and data.
// Run with `npx tsx scripts/hints.ts`.
//
// A "hint follower" starts from every 3-drop mix, smells it, and does exactly what the hint says.
// The hint names an axis that is too strong ("too X", "touch less X", "far too X") and/or one that
// is missing ("needs something X", "touch more X"):
//   too strong only  -> remove one drop of the ingredient that adds most of that axis (Empty + re-pour)
//   missing only     -> add one drop of the ingredient with the highest SHARE of that axis
//                       (flask full? first remove the drop that fits the target least)
//   both             -> do both in one step: remove one drop of the top over-contributor, add one drop of
//                       the best ingredient for the missing axis
// The ingredient removed in a step is never added back in the same step. If a removal leaves fewer than
// 3 drops (a mix cannot be smelled), one drop is added of the ingredient that best fills the largest
// shortfall compared with the target (again never the one just removed).
import { AXES, INGREDIENTS } from '../src/data/ingredients'
import type { Axis, Scent } from '../src/data/ingredients'
import { ORDERS } from '../src/data/customers'
import type { Order } from '../src/data/customers'
import { MAX_DROPS, MIN_DROPS, scoreMix } from '../src/game/scoring'
import type { Score } from '../src/game/scoring'

const MAX_STEPS = 6
const REAL_STEPS = 2 // MAX_SMELLS: a real player can adjust twice (the second adjustment is delivered without a smell)
const EXAMPLE_ORDERS = process.env.EXAMPLES ? process.env.EXAMPLES.split(',') : ['spring', 'lobby', 'school'] // or EXAMPLES=harbour,kitchen
const EXAMPLES = 3

const byId = new Map(INGREDIENTS.map((i) => [i.id, i]))
const nameOf = (id: string) => byId.get(id)!.name
const describe = (drops: string[]) => {
  const counts = new Map<string, number>()
  for (const id of [...drops].sort()) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()].map(([id, n]) => `${nameOf(id)} x${n}`).join(', ')
}
const key = (drops: string[]) => [...drops].sort().join(',')
const total = (scent: Scent) => AXES.reduce((sum, axis) => sum + scent[axis], 0)
const share = (id: string, axis: Axis) => byId.get(id)!.scent[axis] / total(byId.get(id)!.scent)

// The ingredient with the highest share of an axis (ties: the larger amount, then list order)
function bestFor(axis: Axis, exclude?: string): string {
  return [...INGREDIENTS]
    .filter((i) => i.id !== exclude)
    .sort((a, b) => share(b.id, axis) - share(a.id, axis) || b.scent[axis] - a.scent[axis])[0].id
}

// The ingredient in the mix that contributes most of an axis (drops of it x its amount)
function biggestContributor(drops: string[], axis: Axis): string {
  const sums = new Map<string, number>()
  for (const id of drops) sums.set(id, (sums.get(id) ?? 0) + byId.get(id)!.scent[axis])
  return [...sums.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

// scent . target: how much a drop of this ingredient points at what the customer wants
const fit = (id: string, target: Scent) => AXES.reduce((sum, axis) => sum + byId.get(id)!.scent[axis] * target[axis], 0)

function removeOne(drops: string[], id: string): string[] {
  const copy = [...drops]
  copy.splice(copy.indexOf(id), 1)
  return copy
}

// The axis the mix lacks most compared with the target (both as shares)
function mostMissingAxis(drops: string[], target: Scent): Axis {
  const mix = AXES.map((a) => drops.reduce((sum, id) => sum + byId.get(id)!.scent[a], 0))
  const mixTotal = mix.reduce((s, v) => s + v, 0) || 1
  const targetTotal = total(target)
  return AXES.map((axis, i) => ({ axis, gap: target[axis] / targetTotal - mix[i] / mixTotal })).sort((a, b) => b.gap - a.gap)[0].axis
}

type Move = { drops: string[]; rule: string }

// What the player does after reading `hint`
// `dilute` is the alternative rule for near-miss hints ("So close! Just a touch less X"): instead of
// removing a drop of X, add one drop of the ingredient that best fills the largest shortfall, if the
// flask has room (otherwise the normal rule applies)
function follow(drops: string[], hint: string, order: Order, dilute = false): Move {
  // Which axes does the hint name? (too strong / missing)
  const overMatch = /touch less (\w+)|too (\w+)/.exec(hint)
  const underMatch = /touch more (\w+)|something (\w+)/.exec(hint)
  const overAxis = (overMatch ? overMatch[1] ?? overMatch[2] : undefined) as Axis | undefined
  const underAxis = (underMatch ? underMatch[1] ?? underMatch[2] : undefined) as Axis | undefined

  if (dilute && /touch less/.test(hint) && drops.length < MAX_DROPS) {
    const axis = mostMissingAxis(drops, order.target)
    const add = bestFor(axis)
    return { drops: [...drops, add], rule: `touch less ${overAxis}: dilute, add one ${nameOf(add)} (largest shortfall: ${axis})` }
  }

  let next = [...drops]
  const parts: string[] = []
  let removed: string | undefined

  // Missing only and the flask is full: make room first, by removing the drop that fits the target least
  // VARIANT=add-only (an extra experiment): a two-axis hint is followed by adding only, like "missing only"
  const addOnly = process.env.VARIANT === 'add-only' && overAxis && underAxis
  if (underAxis && (!overAxis || addOnly) && next.length >= MAX_DROPS) {
    removed = [...new Set(next)].sort((a, b) => fit(a, order.target) - fit(b, order.target))[0]
    next = removeOne(next, removed)
    parts.push(`flask full: remove one ${nameOf(removed)}`)
  }
  if (overAxis && !addOnly) {
    removed = biggestContributor(drops, overAxis)
    next = removeOne(next, removed)
    parts.push(`too ${overAxis}: remove one ${nameOf(removed)}`)
  }
  if (underAxis) {
    const add = bestFor(underAxis, removed)
    next.push(add)
    parts.push(`needs ${underAxis}: add one ${nameOf(add)}`)
  }
  if (!overAxis && !underAxis) {
    // "Add a few more drops": add what the target lacks most
    const add = bestFor(mostMissingAxis(next, order.target))
    next.push(add)
    parts.push(`few drops: add one ${nameOf(add)}`)
  }
  if (next.length < MIN_DROPS) {
    const axis = mostMissingAxis(next, order.target)
    const add = bestFor(axis, removed)
    next.push(add)
    parts.push(`under ${MIN_DROPS} drops: refill with ${nameOf(add)}`)
  }
  return { drops: next, rule: parts.join(', ') }
}

function threeDropMixes(start = 0, current: string[] = []): string[][] {
  if (current.length === MIN_DROPS) return [current]
  const all: string[][] = []
  for (let i = start; i < INGREDIENTS.length; i++) all.push(...threeDropMixes(i, [...current, INGREDIENTS[i].id]))
  return all
}
const starts = threeDropMixes()

type Step = { drops: string[]; score: Score; rule: string }
type Run = { path: Step[]; success: boolean; steps: number; loop: boolean; worseDistance: number; worseStars: number }

function run(startDrops: string[], order: Order, dilute = false): Run {
  let drops = startDrops
  let score = scoreMix(drops, order)
  const path: Step[] = [{ drops, score, rule: 'start' }]
  const seen = new Set([key(drops)])
  let loop = false
  let worseDistance = 0
  let worseStars = 0
  for (let step = 1; score.stars < 3 && step <= MAX_STEPS; step++) {
    const move = follow(drops, score.hint, order, dilute)
    const nextScore = scoreMix(move.drops, order)
    if (nextScore.distance > score.distance) worseDistance++
    if (nextScore.stars < score.stars) worseStars++
    drops = move.drops
    score = nextScore
    path.push({ drops, score, rule: move.rule })
    if (seen.has(key(drops))) {
      loop = true
      break
    }
    seen.add(key(drops))
  }
  return { path, success: score.stars === 3, steps: path.length - 1, loop, worseDistance, worseStars }
}

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`
const pad = (v: string, w: number) => v.padEnd(w)

// Summary of one rule for one order
function summarize(runs: Run[]) {
  const within = (n: number) => runs.filter((r) => r.success && r.steps <= n).length
  const wins = runs.filter((r) => r.success)
  return {
    already: runs.filter((r) => r.success && r.steps === 0).length,
    within,
    avg: wins.length ? wins.reduce((s, r) => s + r.steps, 0) / wins.length : 0,
    loops: runs.filter((r) => r.loop).length,
    worseDistance: runs.reduce((s, r) => s + r.worseDistance, 0),
    worseStars: runs.reduce((s, r) => s + r.worseStars, 0),
  }
}

console.log(`Hint follower: ${starts.length} three-drop starts per order, up to ${MAX_STEPS} steps; a real player has ${REAL_STEPS}.`)
console.log('Rule A (current): every hint is followed by removing / adding as described at the top of the script.')
console.log('Rule B (dilute): like A, but "So close! Just a touch less X" adds one drop of the ingredient that best fills the largest shortfall (if the flask has room).\n')

const runsA = new Map<string, Run[]>()
const runsB = new Map<string, Run[]>()
for (const order of ORDERS) {
  runsA.set(order.id, starts.map((s) => run(s, order)))
  runsB.set(order.id, starts.map((s) => run(s, order, true)))
}

console.log('Rule A (current rule), per order')
console.log(
  pad('order', 10) + pad('already 3★', 12) + pad('ok <=2 steps', 14) + pad('ok <=3', 12) + pad('ok <=6 steps', 14) + pad('avg steps', 11) + pad('loops', 7) + pad('worse dist', 12) + 'worse stars',
)
for (const order of ORDERS) {
  const runs = runsA.get(order.id)!
  const sum = summarize(runs)
  console.log(
    pad(order.id, 10) + pad(String(sum.already), 12) + pad(`${sum.within(REAL_STEPS)} (${pct(sum.within(REAL_STEPS), runs.length)})`, 14) + pad(`${sum.within(3)} (${pct(sum.within(3), runs.length)})`, 12) + pad(`${sum.within(MAX_STEPS)} (${pct(sum.within(MAX_STEPS), runs.length)})`, 14) +
      pad(sum.avg.toFixed(2), 11) + pad(String(sum.loops), 7) + pad(String(sum.worseDistance), 12) + String(sum.worseStars),
  )
}

console.log('\nSide by side: A = current rule, B = dilute rule for "touch less" (success within 2 / 3 / 6 steps, in % of 220 starts; loops; steps that LOWERED the stars)')
console.log(pad('order', 10) + pad('<=2  A / B', 16) + pad('<=3  A / B', 16) + pad('<=6  A / B', 16) + pad('loops A / B', 14) + 'stars lowered A / B')
const pc = (n: number) => `${((100 * n) / starts.length).toFixed(1)}%`
for (const order of ORDERS) {
  const a = summarize(runsA.get(order.id)!)
  const b = summarize(runsB.get(order.id)!)
  console.log(
    pad(order.id, 10) + pad(`${pc(a.within(2))} / ${pc(b.within(2))}`, 16) + pad(`${pc(a.within(3))} / ${pc(b.within(3))}`, 16) + pad(`${pc(a.within(6))} / ${pc(b.within(6))}`, 16) +
      pad(`${a.loops} / ${b.loops}`, 14) + `${a.worseStars} / ${b.worseStars}`,
  )
}

// Examples (rule A): spread over the failing starts; one path where the stars went DOWN is included if there is one
for (const id of EXAMPLE_ORDERS) {
  const order = ORDERS.find((o) => o.id === id)!
  const failed = (runsA.get(id) ?? []).filter((r) => !r.success)
  console.log(`\n=== ${id} (${order.customerName}): "${order.orderText}" ===  failing starts (rule A): ${failed.length}`)
  const lowered = failed.find((r) => r.worseStars > 0)
  const spread = [0, 1, 2].map((i) => failed[Math.floor((i * failed.length) / EXAMPLES)]).filter(Boolean)
  const pick = lowered ? [lowered, ...spread.filter((r) => r !== lowered)].slice(0, EXAMPLES) : spread
  pick.forEach((r, n) => {
    console.log(`  Path ${n + 1}${r.loop ? ' (ends in a loop)' : ''}${r.worseStars > 0 ? ' (the stars went DOWN in this path)' : ''}:`)
    r.path.forEach((step, i) => {
      console.log(`    ${i}. ${describe(step.drops)} | ${step.score.stars}★ d=${step.score.distance.toFixed(3)} | "${step.score.hint}"${i > 0 ? `   <- ${step.rule}` : ''}`)
    })
  })
}
