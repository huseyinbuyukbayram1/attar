import type { Stars } from './scoring'

export const DEBT = 2000
export const GREAT_WIN_MONEY = 2600 // from here the ending adds a line about customers lining up

// Money paid per delivery, index = stars 0..3. There are ten customers, so about 2 stars on
// average (with a few 3s) pays the debt. Tune these numbers after playtesting.
export const PAYOUT_BY_STARS = [0, 90, 190, 300]

export function payoutFor(stars: Stars): number {
  return PAYOUT_BY_STARS[stars]
}

// 1240 -> "$1,240"
export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`
}
