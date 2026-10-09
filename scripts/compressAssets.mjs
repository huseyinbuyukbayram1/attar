// Shrinks the game's files so the page loads fast on itch.io. Run it by hand: `node scripts/compressAssets.mjs`
// (audio needs ffmpeg: set FFMPEG=/path/to/ffmpeg if it is not on the PATH).
//
// WHY it is safe to run twice: the first run copies every original into
// assets_raw/originals_before_compress/ and every run compresses FROM that copy, never from an already
// compressed file (that would lose quality again and again).
import sharp from 'sharp'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, renameSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const ASSETS = 'public/assets'
const BACKUP = 'assets_raw/originals_before_compress'
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'

const PNG_QUALITY = 85 // palette quality: 85 keeps painted gradients smooth, and the alpha channel stays
const JPG_QUALITY = 80
const MAX_JPG = { width: 1920, height: 1080 }
const AUDIO_MIN_BYTES = 1_000_000 // shorter sounds are small already; leave them alone
const AUDIO_KBPS = 96 // music and ambience
const AUDIO_KBPS_ALREADY_LOW = 64 // a file that is already 96 kbps or less is cut to this, or it would not shrink

// Files whose picture is much bigger than it is ever drawn (more than 1.5x). The game scales these by
// their HEIGHT read from the texture, so a smaller file looks the same. Target height = 1.5x the largest
// size on screen (1280x720 canvas). Pictures the code measures in source pixels (notebook, flask, bottles,
// title sign, buttons, customers' crops) are NOT here: they only get the palette treatment, same size.
const DOWNSCALE_HEIGHT = {
  'characters/player_neutral.png': 303, // drawn 202 px high
  'characters/player_happy.png': 303,
  'characters/player_sad.png': 303,
  'story/master_portrait.png': 366, // drawn 230 px high, growing to 244 during the intro
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

const kb = (bytes) => (bytes / 1024).toFixed(0) + ' KB'
const rows = []

for (const file of walk(ASSETS)) {
  const rel = relative(ASSETS, file)
  const ext = rel.split('.').pop().toLowerCase()
  if (!['png', 'jpg', 'mp3'].includes(ext)) continue
  const backup = join(BACKUP, rel)
  if (!existsSync(backup)) {
    mkdirSync(dirname(backup), { recursive: true })
    copyFileSync(file, backup)
  }
  const before = statSync(backup).size

  if (ext === 'png') {
    let image = sharp(backup)
    const height = DOWNSCALE_HEIGHT[rel]
    if (height) image = image.resize({ height, kernel: 'lanczos3' })
    await image.png({ palette: true, quality: PNG_QUALITY, effort: 10, compressionLevel: 9 }).toFile(file + '.tmp')
    renameSync(file + '.tmp', file)
  } else if (ext === 'jpg') {
    await sharp(backup).resize({ ...MAX_JPG, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: JPG_QUALITY, mozjpeg: true }).toFile(file + '.tmp')
    renameSync(file + '.tmp', file)
  } else if (before > AUDIO_MIN_BYTES) {
    // ffmpeg prints the file's info on stderr (and "fails" because there is no output file): read the bitrate there
    const info = spawnSync(FFMPEG, ['-i', backup]).stderr.toString()
    const sourceKbps = Number(/bitrate: (\d+) kb\/s/.exec(info)?.[1] ?? 128)
    const kbps = sourceKbps > AUDIO_KBPS ? AUDIO_KBPS : AUDIO_KBPS_ALREADY_LOW
    const result = spawnSync(FFMPEG, ['-y', '-v', 'error', '-i', backup, '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', `${kbps}k`, file + '.tmp.mp3'])
    if (result.status !== 0) throw new Error(`ffmpeg failed on ${rel}: ${result.stderr}`)
    renameSync(file + '.tmp.mp3', file)
  }
  rows.push({ rel, before, after: statSync(file).size })
}

// Report: the biggest savings first
rows.sort((a, b) => b.before - b.after - (a.before - a.after))
let totalBefore = 0
let totalAfter = 0
for (const row of rows) {
  totalBefore += row.before
  totalAfter += row.after
}
for (const row of rows.slice(0, 15)) console.log(`${row.rel.padEnd(36)} ${kb(row.before).padStart(9)} -> ${kb(row.after).padStart(9)}`)
console.log(`TOTAL ${kb(totalBefore)} -> ${kb(totalAfter)}`)
