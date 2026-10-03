import type { Scent } from './ingredients'

export type Order = {
  id: string
  customerName: string
  orderText: string
  target: Scent // the scent the customer is secretly hoping for
}

// Targets only list the axes they use; the rest are 0
const t = (parts: Partial<Scent>): Scent => ({
  floral: 0, woody: 0, citrus: 0, sweet: 0, spicy: 0, ...parts,
})

export const ORDERS: Order[] = [
  {
    id: 'asphalt',
    customerName: 'Leyla',
    orderText: 'Something like warm asphalt right after the rain.',
    target: t({ woody: 3, citrus: 2, spicy: 1 }),
  },
  {
    id: 'wardrobe',
    customerName: 'Mr. Orhan',
    orderText: "My grandfather's wardrobe, but in a good way.",
    target: t({ woody: 3, spicy: 1, sweet: 1 }),
  },
  {
    id: 'spring',
    customerName: 'Defne',
    orderText: 'The first warm day of spring, window wide open.',
    target: t({ floral: 2, citrus: 2, sweet: 1 }),
  },
  {
    id: 'kitchen',
    customerName: 'Selim',
    orderText: "My grandmother's kitchen on a rainy Sunday.",
    target: t({ sweet: 3, spicy: 1, woody: 1 }),
  },
]
