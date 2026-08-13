export const APP_THEMES = [
  { id: 'neon', name: 'Neon Night', colors: ['#071426', '#00f7ff', '#facc15'] },
  { id: 'sunset', name: 'Sunset', colors: ['#26102f', '#ff6b6b', '#ffd166'] },
  { id: 'forest', name: 'Emerald', colors: ['#071d18', '#34d399', '#f4d35e'] },
  { id: 'royal', name: 'Royal', colors: ['#160d31', '#a78bfa', '#f9a8d4'] },
  { id: 'daylight', name: 'Daylight', colors: ['#e9f5ff', '#1677ff', '#102a43'] }
]

const STORAGE_KEY = 'tpg-app-theme'

export function getStoredTheme () {
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY)
    return APP_THEMES.some(({ id }) => id === savedTheme) ? savedTheme : 'neon'
  } catch {
    return 'neon'
  }
}

export function applyAppTheme (theme) {
  const nextTheme = APP_THEMES.some(({ id }) => id === theme) ? theme : 'neon'
  document.documentElement.dataset.appTheme = nextTheme
  try {
    localStorage.setItem(STORAGE_KEY, nextTheme)
  } catch {
    // The visual selection still works when storage is unavailable.
  }
  return nextTheme
}
