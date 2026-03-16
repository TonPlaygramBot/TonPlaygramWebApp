import {
  BADUK_BATTLE_DEFAULT_LOADOUT,
  BADUK_BATTLE_DEFAULT_UNLOCKS,
  BADUK_BATTLE_OPTION_LABELS
} from '../config/badukBattleInventoryConfig.js'

const STORAGE_KEY = 'badukBattleInventoryByAccount'
let memoryInventories = {}
let storageHealthy = true

const copyDefaults = () =>
  Object.entries(BADUK_BATTLE_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
    acc[key] = Array.isArray(values) ? [...values].filter(Boolean) : []
    return acc
  }, {})

export const badukBattleAccountId = (value) => {
  const normalized = `${value || 'guest'}`.trim()
  return normalized || 'guest'
}

const readStore = () => {
  if (typeof window === 'undefined' || !storageHealthy) return memoryInventories
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY)
    memoryInventories = raw ? JSON.parse(raw) : {}
    storageHealthy = true
  } catch {
    storageHealthy = false
  }
  return memoryInventories
}

const writeStore = (payload) => {
  memoryInventories = payload || {}
  if (typeof window === 'undefined' || !storageHealthy) return
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(memoryInventories))
  } catch {
    storageHealthy = false
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
  const db = readStore()
  const resolved = normalizeInventory(db[id])
  if (typeof window !== 'undefined') {
    writeStore({ ...db, [id]: resolved })
  }
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
  const nextValues = new Set(current[type] || [])
  nextValues.add(optionId)
  const nextInventory = { ...current, [type]: Array.from(nextValues) }
  writeStore({ ...db, [id]: nextInventory })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('badukBattleInventoryUpdate', { detail: { accountId: id, inventory: nextInventory } }))
  }
  return nextInventory
}

export const listOwnedBadukOptions = (accountId) => {
  const inventory = getBadukBattleInventory(accountId)
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return []
    const labels = BADUK_BATTLE_OPTION_LABELS[type] || {}
    return values.map((optionId) => ({ type, optionId, label: labels[optionId] || optionId }))
  })
}

export const getDefaultBadukBattleLoadout = () => ({ ...BADUK_BATTLE_DEFAULT_LOADOUT })
