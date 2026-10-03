// The five scent dimensions every ingredient and every order is described with
export type Axis = 'floral' | 'woody' | 'citrus' | 'sweet' | 'spicy'
export type Scent = Record<Axis, number>

export const AXES: Axis[] = ['floral', 'woody', 'citrus', 'sweet', 'spicy']

export type Ingredient = {
  id: string
  name: string
  scent: Scent
}

// Helper so the table below only lists the non-zero axes
function scent(parts: Partial<Scent>): Scent {
  return { floral: 0, woody: 0, citrus: 0, sweet: 0, spicy: 0, ...parts }
}

export const INGREDIENTS: Ingredient[] = [
  { id: 'rose', name: 'Rose', scent: scent({ floral: 3, sweet: 1 }) },
  { id: 'jasmine', name: 'Jasmine', scent: scent({ floral: 2, sweet: 2 }) },
  { id: 'bergamot', name: 'Bergamot', scent: scent({ citrus: 3 }) },
  { id: 'neroli', name: 'Neroli', scent: scent({ citrus: 2, floral: 1 }) },
  { id: 'cedar', name: 'Cedar', scent: scent({ woody: 3 }) },
  { id: 'oud', name: 'Oud', scent: scent({ woody: 2, spicy: 2 }) },
  { id: 'vanilla', name: 'Vanilla', scent: scent({ sweet: 3 }) },
  { id: 'amber', name: 'Amber', scent: scent({ sweet: 2, woody: 1 }) },
  { id: 'saffron', name: 'Saffron', scent: scent({ spicy: 3 }) },
  { id: 'seaSalt', name: 'Sea salt', scent: scent({ citrus: 2, woody: 1 }) },
]
