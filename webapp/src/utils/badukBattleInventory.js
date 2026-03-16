import {
  BADUK_BATTLE_DEFAULT_LOADOUT,
  BADUK_BATTLE_OPTION_LABELS
} from '../config/badukBattleInventoryConfig.js'

const STORAGE_KEY = 'badukBattleInventoryByAccount'
const memoryCache = new Map()

export const badukBattleAccountId = (value) => {
  const normalized = `${value || 'guest'}`.trim()
  return normalized || 'guest'
}

const copyDefaults = () =>
  Object.entries(BADUK_BATTLE_DEFAULT_LOADOUT).reduce((acc, [key, values]) => {
    acc[key] = Array.isArray(values) ? [...values].filter(Boolean) : []
    return acc
  }, {})

const readStore = () => {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

const writeStore = (payload) => {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload || {}))
  } catch {
    // ignore localStorage write issues
  }
}

const normalizeInventory = (rawInventory) => {
  const base = copyDefaults()
  if (!rawInventory || typeof rawInventory !== 'object') return base
  const merged = { ...base }
  Object.entries(rawInventory).forEach(([key, value]) => {
    if (!Array.isArray(value)) return
    merged[key] = Array.from(new Set([...(merged[key] || []), ...value]))
  })
  return merged
}

export const getBadukBattleInventory = (accountId = 'guest') => {
  const id = badukBattleAccountId(accountId)
  if (memoryCache.has(id)) return memoryCache.get(id)
  const db = readStore()
  const resolved = normalizeInventory(db[id])
  memoryCache.set(id, resolved)
  return resolved
}

export const isBadukOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  if (!type || !optionId) return false
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getBadukBattleInventory(inventoryOrAccountId)
      : inventoryOrAccountId
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId)
}

export const addBadukBattleUnlock = (type, optionId, accountId = 'guest') => {
  const id = badukBattleAccountId(accountId)
  const db = readStore()
  const current = normalizeInventory(db[id])
  const nextInventory = {
    ...current,
    [type]: Array.from(new Set([...(current[type] || []), optionId]))
  }
  const nextDb = { ...db, [id]: nextInventory }
  writeStore(nextDb)
  memoryCache.set(id, nextInventory)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('badukBattleInventoryUpdate', {
        detail: { accountId: id, inventory: nextInventory }
      })
    )
  }
  return nextInventory
}

export const listOwnedBadukOptions = (accountId) => {
  const inventory = getBadukBattleInventory(accountId)
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return []
    const labels = BADUK_BATTLE_OPTION_LABELS[type] || {}
    return values.map((optionId) => ({
      type,
      optionId,
      label: labels[optionId] || optionId
    }))
  })
}
