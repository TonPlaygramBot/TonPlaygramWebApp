export const APP_THEMES = [
  { id: 'neon', name: 'Neon Lights', colors: ['#071426', '#00f7ff', '#f72585'], free: true },
  { id: 'forest', name: 'Emerald', colors: ['#041712', '#34d399', '#f4d35e'], free: true },
  { id: 'aurora', name: 'Aurora', colors: ['#11123b', '#22d3ee', '#c084fc'], free: true },
  { id: 'ocean', name: 'Ocean Blue', colors: ['#061a33', '#38bdf8', '#f8fafc'], free: true },
  { id: 'rose', name: 'Rose Quartz', colors: ['#351526', '#fb7185', '#fbcfe8'], free: true },
  { id: 'obsidian', name: 'Obsidian', colors: ['#05060a', '#64748b', '#f8fafc'], price: 450 },
  { id: 'gold', name: 'Golden Hour', colors: ['#281706', '#f59e0b', '#fff1b8'], price: 500 },
  { id: 'lavender', name: 'Lavender Dream', colors: ['#1e1239', '#a78bfa', '#f5d0fe'], price: 500 },
  { id: 'arctic', name: 'Arctic Ice', colors: ['#071d2b', '#67e8f9', '#e0f2fe'], price: 550 },
  { id: 'crimson', name: 'Crimson Night', colors: ['#25070d', '#ef4444', '#fda4af'], price: 550 }
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
