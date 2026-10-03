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

// Array order is play order: days 1-2 use the first 4 orders, days 3-5 use the rest
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
  {
    id: 'harbour',
    customerName: 'Captain Nuri',
    orderText: 'Wet rope and salt on a harbour wall, early in the morning.',
    target: t({ citrus: 3, woody: 2 }),
  },
  {
    id: 'wedding',
    customerName: 'Ece',
    orderText: 'A garden wedding, one minute before the music starts.',
    target: t({ floral: 3, sweet: 2, citrus: 1 }),
  },
  {
    id: 'market',
    customerName: 'Berk',
    orderText: 'A winter market: roasted chestnuts and a warm cinnamon bun.',
    target: t({ sweet: 2, spicy: 2, woody: 1 }),
  },
  {
    id: 'lobby',
    customerName: 'Madame Aliye',
    orderText: 'The lobby of an old grand hotel, after midnight.',
    target: t({ woody: 2, floral: 1, spicy: 1, sweet: 1 }),
  },
  {
    id: 'school',
    customerName: 'Zeynep',
    orderText: 'Pencil shavings and orange peel, the last day of school.',
    target: t({ woody: 2, citrus: 2, sweet: 1 }),
  },
  {
    id: 'master',
    customerName: 'Old Kemal',
    orderText: 'The scent your master used to wear. You know it better than you think.',
    target: t({ woody: 3, spicy: 2, sweet: 2, floral: 1 }),
  },
]
