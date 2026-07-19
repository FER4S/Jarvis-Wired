/**
 * Tracks which release the boss has already been shown, so "What's new" appears
 * exactly once after an update and never nags again.
 *
 * Same module-level try/catch accessor shape as theme.ts — components never
 * touch localStorage directly.
 */

const STORAGE_KEY = 'jarvis_seen_version'

/** The running app's version. Injected by the preload from app.getVersion(). */
export function getAppVersion(): string {
  return window.jarvis?.version ?? '0.0.0'
}

export function getSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function markVersionSeen(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version)
  } catch {
    // ignore storage failures
  }
}

/**
 * Whether to pop the What's New dialog.
 *
 * A brand-new install has no stored version, but there's no "before" to compare
 * against — showing release notes to someone who has never used the app is
 * noise. App.tsx marks the version seen silently in that case (right after
 * first-run setup completes) so this only ever fires for a genuine update.
 */
export function shouldShowWhatsNew(currentVersion: string): boolean {
  const seen = getSeenVersion()
  return seen !== null && seen !== currentVersion
}
