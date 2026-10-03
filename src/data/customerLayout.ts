// Per-customer display tweaks for the portrait. The portraits are not drawn at the same
// scale, so these are tuned by eye until the eyes of all customers land at about the same
// height. scale multiplies the default displayed height; offsetY is in pixels (positive = lower).
export type CustomerLayout = { scale: number; offsetY: number }

export const DEFAULT_LAYOUT: CustomerLayout = { scale: 1, offsetY: 0 }

// Keyed by order id; a customer without an entry uses DEFAULT_LAYOUT
export const CUSTOMER_LAYOUT: Record<string, CustomerLayout> = {
  asphalt: { scale: 1, offsetY: 0 },
  wardrobe: { scale: 1.12, offsetY: 12 },
  spring: { scale: 1.0, offsetY: 0 },
  kitchen: { scale: 1.0, offsetY: -10 },
}
