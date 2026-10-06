import { BASE_PRICE, HAGGLE_SHARE, TIP } from './difficulty'
import type { Difficulty } from './difficulty'
import type { Stars } from './scoring'

// What one delivery pays, split in the lines the player sees:
//  0 stars: the customer refuses (no sale)       1 star: haggles and pays half the price
//  2 stars: the full price                       3 stars: the full price plus a tip
// The numbers (BASE_PRICE, HAGGLE_SHARE, TIP) are in difficulty.ts.
export type Delivery = { payment: number; tip: number; kind: 'refused' | 'haggled' | 'full' }

export function deliveryFor(stars: Stars): Delivery {
  if (stars === 0) return { payment: 0, tip: 0, kind: 'refused' }
  if (stars === 1) return { payment: BASE_PRICE * HAGGLE_SHARE, tip: 0, kind: 'haggled' }
  return { payment: BASE_PRICE, tip: stars === 3 ? TIP : 0, kind: 'full' }
}

// Payment and tip together
export function payoutFor(stars: Stars): number {
  const delivery = deliveryFor(stars)
  return delivery.payment + delivery.tip
}

// "Debt $1,800 · 3 smells per customer", for the difficulty picker
export function describeDifficulty(difficulty: Difficulty): string {
  return `Debt ${formatMoney(difficulty.debt)} · ${difficulty.smells} smells per customer`
}

// 1240 -> "$1,240"
export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`
}
