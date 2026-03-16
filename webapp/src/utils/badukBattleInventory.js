import { BADUK_BATTLE_DEFAULT_LOADOUT } from '../config/badukBattleInventoryConfig.js'

const STORAGE_KEY = 'badukBattleInventoryByAccount'
const memoryCache = new Map()

export const badukBattleAccountId = (value) => {
  const normalized = `${value || 'guest'}`.trim()
  return normalized || 'guest'
}

const readStore = () => {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

export const getBadukBattleInventory = (accountId = 'guest') => {
  const id = badukBattleAccountId(accountId)
  if (memoryCache.has(id)) return memoryCache.get(id)
  const db = readStore()
  const resolved = { ...BADUK_BATTLE_DEFAULT_LOADOUT, ...(db[id] || {}) }
  memoryCache.set(id, resolved)
  return resolved
}
