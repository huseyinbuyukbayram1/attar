// Per-customer display tweaks for the portrait. The portraits are not drawn at the same
// scale, so these are tuned by eye until the eyes of all customers land at about the same
// height. scale multiplies the default displayed height; offsetY is in pixels (positive = lower).
export type CustomerLayout = { scale: number; offsetY: number }

export const DEFAULT_LAYOUT: CustomerLayout = { scale: 1, offsetY: 0 }

// Keyed by order id; a customer without an entry uses DEFAULT_LAYOUT
export const CUSTOMER_LAYOUT: Record<string, CustomerLayout> = {
  asphalt: { scale: 1.00, offsetY: 0 },
  wardrobe: { scale: 1.00, offsetY: 0 },
  spring: { scale: 1.00, offsetY: 40 },
  kitchen: { scale: 1.00, offsetY: 20 },
  harbour: { scale: 0.95, offsetY: 25 },
  wedding: { scale: 1.00, offsetY: 15 },
  market: { scale: 0.95, offsetY: -45 },
  lobby: { scale: 0.95, offsetY: -5 },
  school: { scale: 1.16, offsetY: 45 },
  master: { scale: 1.16, offsetY: 45 },
}
