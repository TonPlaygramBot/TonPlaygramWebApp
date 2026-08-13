export const APP_THEMES = [
  { id: 'royal-navy', name: 'Royal Navy', colors: ['#06182c', '#12395f', '#e7b934'], free: true },
  { id: 'emerald-classic', name: 'Emerald Classic', colors: ['#f8f0d9', '#075f3d', '#d7a51f'], free: true },
  { id: 'vintage-brown', name: 'Vintage Brown', colors: ['#291207', '#6f3613', '#d69b2d'], free: true },
  { id: 'classic-marble', name: 'Classic Marble', colors: ['#fffaf0', '#171717', '#c78d24'], free: true },
  { id: 'midnight-purple', name: 'Midnight Purple', colors: ['#140b25', '#5b1268', '#f0c22b'], free: true },
  { id: 'ocean-wave', name: 'Ocean Wave', colors: ['#e9f2df', '#087d83', '#d59c22'], price: 250 },
  { id: 'golden-age', name: 'Golden Age', colors: ['#fff4d3', '#d58c1c', '#714008'], price: 250 },
  { id: 'steel-blue', name: 'Steel Blue', colors: ['#101b27', '#365a73', '#d6d9d8'], price: 250 },
  { id: 'sunset-haze', name: 'Sunset Haze', colors: ['#fcbd73', '#bb3e34', '#f2cb64'], price: 250 },
  { id: 'ivory-black', name: 'Ivory Black', colors: ['#090a0a', '#27231d', '#d8a92f'], price: 250 }
]

const STORAGE_KEY = 'tpg-app-theme'
const OWNED_KEY = 'tpg-owned-app-themes'

export function getOwnedThemes () {
  try {
    const saved = JSON.parse(localStorage.getItem(OWNED_KEY) || '[]')
    return new Set([...APP_THEMES.filter((theme) => theme.free).map((theme) => theme.id), ...saved])
  } catch {
    return new Set(APP_THEMES.filter((theme) => theme.free).map((theme) => theme.id))
  }
}

export function unlockAppTheme (themeId) {
  const theme = APP_THEMES.find(({ id }) => id === themeId)
  if (!theme) return getOwnedThemes()
  const owned = getOwnedThemes()
  owned.add(themeId)
  try { localStorage.setItem(OWNED_KEY, JSON.stringify([...owned])) } catch {}
  window.dispatchEvent(new CustomEvent('appThemeInventoryUpdated', { detail: { themeId } }))
  return owned
}

export function getStoredTheme () {
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY)
    return APP_THEMES.some(({ id }) => id === savedTheme) && getOwnedThemes().has(savedTheme) ? savedTheme : 'royal-navy'
  } catch { return 'royal-navy' }
}

export function applyAppTheme (theme) {
  const nextTheme = APP_THEMES.some(({ id }) => id === theme) && getOwnedThemes().has(theme) ? theme : 'royal-navy'
  document.documentElement.dataset.appTheme = nextTheme
  try { localStorage.setItem(STORAGE_KEY, nextTheme) } catch {}
  return nextTheme
}
