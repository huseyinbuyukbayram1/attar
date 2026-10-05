# Asset log

## Rules
1. Keep the file name and the 16:9 aspect ratio of the background stable
   (shop_morning) so improved art can replace the file without any code change.
   The evening look is done in code on top of shop_morning (there is no
   shop_evening image any more).
2. Final art lives in public/assets/. Raw generations and references live in
   assets_raw/ and are never loaded by the game.
3. Every DreamLayer generation is logged below: file, prompt, command, credits left.
4. Ship working, acceptable art first. Improve art only after the game is playable
   end to end and credits remain.
5. API key stays in the DREAMLAYER_API_KEY environment variable. Never in code or git.

## Generation log
| File | Source | Credits left |
|---|---|---|
| assets_raw/shop_morning.jpg | DreamLayer web app: text-to-image, then a multi-step edit (simpler shelves, lattice window). Cost 3 app credits (separate from API credits). | API: 100 |
| assets_raw/shop_evening.png | CLI: `dreamlayer edit assets_raw/shop_morning.jpg` with prompt "Keep this exact shop... change only the time of day to evening: dusk sky in the window, warm lantern and candlelight. Do not add, remove or move any objects. No people, no text." | API: 99 |
| assets_raw/shop_door_morning_v1.png | DreamLayer CLI: `dreamlayer generate`, 16:9. Cost 1 credit. (Prompt not recorded in this log.) | not recorded |
| assets_raw/shop_door_evening_v1.png | DreamLayer CLI: `dreamlayer edit` of the door morning image, with `--aspect 16:9`. Came back 2048x2048 (square). (Prompt not recorded in this log.) | not recorded |
| assets_raw/shop_door_evening_v2.png | DreamLayer CLI: second `dreamlayer edit` attempt, with `--aspect 16:9`. Again 2048x2048 (square). The evening look is done in code instead. (Prompt not recorded in this log.) | API: 94 |
| public/assets/props/notebook_open.png (raw: assets_raw/notebook_open_raw.png, cutout: assets_raw/notebook_open.png) | DreamLayer CLI: `dreamlayer generate`, 16:9 2560x1440, then background cutout, then `sips` crop to 2190x1400 at offset 190,20, then resized to 1100 px wide (1100x703, transparent). Used as the page of the ingredient notebook panel (Tab). Prompt: "An open antique leather-bound notebook lying flat, seen from directly above, both pages fully visible and centered. Two blank aged parchment pages with soft cream tones, a few faint ink stains near the outer edges, worn dark brown leather cover visible around the pages, a thin ribbon bookmark. Stylized ink and watercolor illustration, warm Ottoman-era apothecary mood, matching a hand-painted game art style. Plain flat light background around the notebook. No text, no writing, no letters, no drawings on the pages, no props, no hands." | not recorded |

Findings for the devlog:
- Edit kept the composition almost exactly (lantern, shelves, bottles, scale, window, medallion in the same places).
- Despite "do not add objects", it added a hanging rope with a tassel and a lit candle on the counter.
- Painting style shifted from soft watercolor (morning) to a darker cinematic digital look (evening).
- Multi-step edits in the web app charge credits per step.
- One CLI edit costs exactly 1 credit.

## Improvement list (only if credits and time remain)
- [ ] Make shop_evening closer to the soft watercolor style of shop_morning.
- [ ] Remove the hanging rope/tassel and the lit candle from shop_evening.
- [ ] Optional: remove the blue tile medallion from shop_morning (web app edit step failed).
- [ ] Replace the realistic customer portraits (Leyla, Mr. Orhan, Selim) with stylized versions.
- [ ] Idea: finishing step on delivery, a short skippable 3 s animation (oil or alcohol poured into the flask, shake, pour into the round bottle, cork, "For <name>" label). Zero credits, only if time remains.

## Audio credits

All sound effects and ambience loops come from Pixabay (pixabay.com), used under the Pixabay Content License (commercial use, no attribution required). Per-file page links: TODO (optional).

| file | event |
| --- | --- |
| ambience_morning.mp3 | ambienceMorning (loop) |
| ambience_evening.mp3 | ambienceEvening (loop) |
| bottle.mp3 | bottle |
| pour.mp3 | pour |
| mix.mp3 | mix |
| smell.mp3 | smell |
| deliver.mp3 | deliver |
| click.mp3 | click |
- [ ] Pour stream must start exactly at the bottle mouth for round and square bottles (droppers are fine): compute the mouth point per texture and rotate it with the tilt.
- [ ] Idea: open the cork or lid of round and square bottles during a pour (separate stopper sprite cropped from the texture, lifts away and returns).
- [ ] Rework how the chosen drops are shown (the six slot circles): current look and position feel poor, decide later.
- [ ] Notebook: replace the code-drawn book on the counter with a generated image and polish the panel.
