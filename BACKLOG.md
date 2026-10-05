# Backlog

## Plan until release (in order)
1. [x] Money balance playtest (is the target reachable? decides difficulty values). Done: scripts/balance.ts exists for exhaustive analysis.
2. Hint fix: kitchen hint confusing; harbour hint followed twice but stayed 2★ (from the playtest). scripts/hints.ts simulates a hint-following player: with 2 smells only 15-36% of starts reach 3★, and "too X" does not say whether to remove X or add the rest.
3. Economy rework + difficulty (one task, touches economy/scoring — needs explicit permission):
   - Perfume has a base price; stars decide payment and tip. Draft: 0★ customer refuses ($0), 1★ haggles and pays half ($100), 2★ full price ($200), 3★ full price + tip ($200 + $100).
   - Show payment and tip separately on delivery (ties in with the delivery juice item: stars fill, counter counts up, coin sound).
   - Difficulty: Easy / Normal / Hard targets, draft $1,800 / $2,200 / $2,600; the story text shows the selected debt. (Playtest on the old prices: 6×3★, 3×2★, 1×1★ = $2,460.)
   - After the change, re-run scripts/balance.ts with the new prices and confirm the targets.
4. Button plates via DreamLayer (blank plates, text drawn in code, Phaser NineSlice)
5. Title screen: shop exterior image, painted "Attar" sign with drop/swing animation, logo, background music, Play + Settings buttons
6. Settings: music and SFX volume, mute toggles, key bindings list; persist in localStorage
7. Proper interactive tutorial on the first order: step by step, highlight the relevant object (bottle, flask, Smell, notebook, Deliver), advance when the player does the action.
8. End-of-day summary screen (day earnings, total vs target)
9. Delivery juice: stars fill one by one, money counter counts up, coin sound
10. Esc pause menu: Resume / Settings / Main menu
11. Story intro/ending rewrite: framed portrait of the old master (the player's grandfather) via DreamLayer, longer story about the shop's history and the grandfather, typewriter text with click-to-continue and a Skip button; ending_win / ending_lose screens
12. Release cleanup: remove dev shortcuts (N, B, G, E), remove the 'dev: <order id>' debug label at bottom-left of the MIX screen, npm run build, itch.io HTML5 upload, page text (how DreamLayer was used, before/after images), DEVLOG "How DreamLayer was used" section, audio credits (per-file links TODO in ASSET_LOG)

## Not urgent / polish
- Notebook: citrus caption colour is hard to read on stains, darken slightly
- Drop slots redesign: ghost slots for dark ingredients (Oud) are nearly invisible on the dark band; ghost name labels are tiny and zigzag. Fix together with the slot redesign.
- Bottle cap opening animation
- Delivery finishing animation (alcohol/oil)
- Check remaining older realistic portraits for style consistency

## Cut first if time runs short
- Sign animation on title screen, story images, bottle cap animation

## If time remains
- AI voice-over for the story (check licence)
- GIFs of mixing and the waste pot for the itch.io page

## After the jam
- Language support (ES, RU, ...)
- Per-customer tip personality (e.g. Captain Nuri generous, Madame Aliye stingy).
