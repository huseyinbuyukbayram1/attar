import { ORDERS } from '../data/customers'
import type { Order } from '../data/customers'
import { MAX_DROPS, MIN_DROPS } from './scoring'

export type TimeOfDay = 'morning' | 'evening'

export const CUSTOMERS_PER_DAY = 2
export const TOTAL_DAYS = ORDERS.length / CUSTOMERS_PER_DAY
export const MAX_STARS = ORDERS.length * 3
export const MAX_SMELLS = 2 // tune after timing a full playthrough

// Everything that changes while playing, kept in one place with no Phaser code,
// so the scene only has to draw it and the rules stay easy to read.
export class GameState {
  orderIndex = 0
  totalStars = 0
  money = 0 // the main score: how much of the debt has been earned back
  // Fixed slots, not a list: emptying one slot must not move the others.
  // null = empty slot.
  slots: (string | null)[] = new Array<string | null>(MAX_DROPS).fill(null)
  smellsUsed = 0

  get order(): Order {
    return ORDERS[this.orderIndex]
  }

  get day(): number {
    return Math.floor(this.orderIndex / CUSTOMERS_PER_DAY) + 1
  }

  // 1 or 2: which customer of the day this is
  get customerOfDay(): number {
    return (this.orderIndex % CUSTOMERS_PER_DAY) + 1
  }

  // First customer of a day comes in the morning, the second in the evening
  get timeOfDay(): TimeOfDay {
    return this.orderIndex % 2 === 0 ? 'morning' : 'evening'
  }

  get isLastOrder(): boolean {
    return this.orderIndex === ORDERS.length - 1
  }

  // The filled slots as a plain list. Scoring ignores order, so slot positions don't matter.
  get drops(): string[] {
    return this.slots.filter((id): id is string => id !== null)
  }

  // Fills the first empty slot and returns its index, or -1 when all slots are full
  // so the UI can react. The index tells the UI which slot a drop is flying to.
  addDrop(id: string): number {
    const free = this.slots.indexOf(null)
    if (free !== -1) this.slots[free] = id
    return free
  }

  // The only way to take drops out: empty the whole flask
  clear() {
    this.slots.fill(null)
  }

  canSmell(): boolean {
    return this.drops.length >= MIN_DROPS && this.smellsUsed < MAX_SMELLS
  }

  // Delivering only needs enough drops; smelling first is no longer required
  canDeliver(): boolean {
    return this.drops.length >= MIN_DROPS
  }

  useSmell() {
    this.smellsUsed++
  }

  addStars(stars: number) {
    this.totalStars += stars
  }

  addMoney(amount: number) {
    this.money += amount
  }

  // Moves to the next customer with an empty vial and fresh smells
  nextCustomer() {
    this.orderIndex++
    this.clear()
    this.smellsUsed = 0
  }
}
