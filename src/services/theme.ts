export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'jarvis_theme'

export function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode)
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore storage failures
  }
}

export function initTheme(): ThemeMode {
  const mode = getStoredTheme()
  applyTheme(mode)
  return mode
}
