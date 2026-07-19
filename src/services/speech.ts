/**
 * Whether Jarvis should answer out loud.
 *
 * The backend is the source of truth at runtime, but it's a fresh process every
 * launch and always starts unmuted — so the *preference* lives here and gets
 * re-applied whenever the dashboard connects. Same module-level try/catch
 * accessor shape as theme.ts; components never touch localStorage directly.
 */

const STORAGE_KEY = 'jarvis_speech_muted'

export function getStoredMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setStoredMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'true' : 'false')
  } catch {
    // ignore storage failures
  }
}
