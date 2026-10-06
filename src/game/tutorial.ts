// Whether the tutorial has been seen. Plain TypeScript, no Phaser. The "done" flag is saved in
// localStorage (every read and write wrapped: storage can be unavailable, then the tutorial simply
// shows again next time). The "started" flag lives only until the page is closed: Restart and Play
// again in the same session never show the tutorial a second time.
const STORAGE_KEY = 'attar_tutorial_done'
let startedThisSession = false

export function tutorialDone(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// The tutorial runs on a new game if it was neither completed or skipped before nor started in this session
export function shouldShowTutorial(): boolean {
  return !tutorialDone() && !startedThisSession
}

export function markTutorialStarted() {
  startedThisSession = true
}

export function markTutorialDone() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // not saved; it shows again next time the page is opened
  }
}

// "Replay tutorial" in the settings: it runs on the next new game
export function resetTutorial() {
  startedThisSession = false
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing saved to remove
  }
}
