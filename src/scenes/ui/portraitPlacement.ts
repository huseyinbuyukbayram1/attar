import { CUSTOMER_LAYOUT, DEFAULT_LAYOUT } from '../../data/customerLayout'

// Tune the default portrait here. x is the center and y the bottom edge (the feet) of the
// portrait: the counter overlay (COUNTER_TOP_Y in ShopScene) hides everything below the counter line.
export const PORTRAIT = { x: 640, y: 640, height: 440 }

export type PortraitPlacement = { x: number; y: number; height: number }

// The ONE place that decides where a customer's portrait is drawn, in 1280x720 canvas
// pixels: x = horizontal center, y = bottom edge, height = displayed height. It combines the
// default PORTRAIT with the per-customer tweak from customerLayout.ts. The real scene
// (CustomerArt) and the dev contact sheet both call it, so they can never disagree.
export function portraitPlacement(orderId: string): PortraitPlacement {
  const layout = CUSTOMER_LAYOUT[orderId] ?? DEFAULT_LAYOUT
  return {
    x: PORTRAIT.x,
    y: PORTRAIT.y + layout.offsetY, // positive offset = lower
    height: PORTRAIT.height * layout.scale,
  }
}
