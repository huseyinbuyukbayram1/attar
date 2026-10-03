import { ORDERS } from '../data/customers'
import type { Order } from '../data/customers'
import { MAX_DROPS, MIN_DROPS } from './scoring'

export type TimeOfDay = 'morning' | 'evening'

export const CUSTOMERS_PER_DAY = 2
export const TOTAL_DAYS = ORDERS.length / CUSTOMERS_PER_DAY
export const MAX_STARS = ORDERS.length * 3
export const MAX_SMELLS = 2

// Everything that changes while playing, kept in one place with no Phaser code,
// so the scene only has to draw it and the rules stay easy to read.
export class GameState {
  orderIndex = 0
  totalStars = 0
  drops: string[] = []
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

  addDrop(id: string) {
    if (this.drops.length < MAX_DROPS) this.drops.push(id)
  }

  undo() {
    this.drops.pop()
  }

  clear() {
    this.drops = []
  }

  canSmell(): boolean {
    return this.drops.length >= MIN_DROPS && this.smellsUsed < MAX_SMELLS
  }

  // Delivering needs a smell first, and still enough drops if the player cleared after smelling
  canDeliver(): boolean {
    return this.smellsUsed >= 1 && this.drops.length >= MIN_DROPS
  }

  useSmell() {
    this.smellsUsed++
  }

  addStars(stars: number) {
    this.totalStars += stars
  }

  // Moves to the next customer with an empty vial and fresh smells
  nextCustomer() {
    this.orderIndex++
    this.drops = []
    this.smellsUsed = 0
  }
}
