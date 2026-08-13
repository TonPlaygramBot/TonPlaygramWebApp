export const APP_THEMES = [
  { id: 'neon', name: 'Neon Lights', colors: ['#071426', '#00f7ff', '#f72585'], free: true },
  { id: 'emerald', name: 'Emerald', colors: ['#041712', '#34d399', '#f4d35e'], free: true },
  { id: 'obsidian', name: 'Obsidian', colors: ['#05060a', '#64748b', '#f8fafc'], free: true },
  { id: 'golden-hour', name: 'Golden Hour', colors: ['#281706', '#f59e0b', '#fff1b8'], free: true },
  { id: 'arctic-ice', name: 'Arctic Ice', colors: ['#071d2b', '#67e8f9', '#e0f2fe'], free: true },
  { id: 'royal-navy', name: 'Royal Navy', colors: ['#06162d', '#123a67', '#f5c84c'], price: 450 },
  { id: 'emerald-classic', name: 'Emerald Classic', colors: ['#f4ecd8', '#075c3b', '#d4a72c'], price: 475 },
  { id: 'vintage-brown', name: 'Vintage Brown', colors: ['#241006', '#6b3514', '#e9b949'], price: 500 },
  { id: 'classic-marble', name: 'Classic Marble', colors: ['#f7f2e8', '#20252b', '#c9912b'], price: 525 },
  { id: 'midnight-purple', name: 'Midnight Purple', colors: ['#12051f', '#51205f', '#e4b635'], price: 550 },
  { id: 'ocean-wave', name: 'Ocean Wave', colors: ['#eaf1df', '#16859a', '#d6a72c'], price: 575 },
  { id: 'golden-age', name: 'Golden Age', colors: ['#fff3cf', '#bd7416', '#6e3e08'], price: 600 },
  { id: 'steel-blue', name: 'Steel Blue', colors: ['#08131f', '#31516a', '#c2c8cc'], price: 625 },
  { id: 'sunset-haze', name: 'Sunset Haze', colors: ['#722d39', '#e5663d', '#f7d7a7'], price: 650 },
  { id: 'ivory-black', name: 'Ivory Black', colors: ['#070807', '#28241d', '#e2b33b'], price: 675 }
]

export const FREE_APP_THEME_IDS = APP_THEMES.filter(({ free }) => free).map(({ id }) => id)
export const PREMIUM_APP_THEMES = APP_THEMES.filter(({ free }) => !free)
export const APP_THEME_STORE_ITEMS = PREMIUM_APP_THEMES.map((theme) => ({
  id: `home-theme-${theme.id}`,
  type: 'appTheme',
  optionId: theme.id,
  name: theme.name,
  description: `${theme.name} premium palette for the TonPlaygram home page.`,
  price: theme.price,
  swatches: theme.colors
}))

const STORAGE_KEY = 'tpg-app-theme'
const OWNED_KEY = 'tpg-owned-app-themes'

export function getOwnedAppThemes () {
  try {
    const owned = JSON.parse(localStorage.getItem(OWNED_KEY) || '[]')
    return [...new Set([...FREE_APP_THEME_IDS, ...(Array.isArray(owned) ? owned : [])])]
  } catch {
    return [...FREE_APP_THEME_IDS]
  }
}

export function isAppThemeOwned (themeId) {
  return getOwnedAppThemes().includes(themeId)
}

export function addAppThemeUnlock (_type, themeId) {
  const owned = [...new Set([...getOwnedAppThemes(), themeId])]
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(owned.filter((id) => !FREE_APP_THEME_IDS.includes(id))))
    window.dispatchEvent(new CustomEvent('appThemeInventoryUpdate', { detail: { owned } }))
  } catch {
    // Keep checkout usable when persistent browser storage is unavailable.
  }
  return owned
}

export function getStoredTheme () {
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY)
    return APP_THEMES.some(({ id }) => id === savedTheme) && isAppThemeOwned(savedTheme) ? savedTheme : 'neon'
  } catch {
    return 'neon'
  }
}

export function applyAppTheme (theme) {
  const nextTheme = APP_THEMES.some(({ id }) => id === theme) && isAppThemeOwned(theme) ? theme : 'neon'
  document.documentElement.dataset.appTheme = nextTheme
  try {
    localStorage.setItem(STORAGE_KEY, nextTheme)
  } catch {
    // The visual selection still works when storage is unavailable.
  }
  return nextTheme
}
