import {
  FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT,
  FOUR_IN_ROW_BATTLE_DEFAULT_UNLOCKS,
  FOUR_IN_ROW_BATTLE_OPTION_LABELS
} from '../config/fourInRowInventoryConfig.js'
import { getChessBattleInventory } from './chessBattleInventory.js'

const STORAGE_KEY = 'fourInRowInventoryByAccount'
let memoryInventories = {}
let storageHealthy = true

const copyDefaults = () =>
  Object.entries(FOUR_IN_ROW_BATTLE_DEFAULT_UNLOCKS).reduce((acc, [key, values]) => {
    acc[key] = Array.isArray(values) ? [...values].filter(Boolean) : []
    return acc
  }, {})

export const fourInRowAccountId = (value) => {
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

export const getFourInRowInventory = (accountId = 'guest') => {
  const id = fourInRowAccountId(accountId)
  const db = readStore()
  const resolved = normalizeInventory(db[id])
  const chessInventory = getChessBattleInventory(id)
  ;['chairColor', 'tables', 'tableFinish'].forEach((sharedKey) => {
    const merged = new Set([...(resolved[sharedKey] || []), ...(chessInventory?.[sharedKey] || [])])
    resolved[sharedKey] = Array.from(merged)
  })
  if (typeof window !== 'undefined') {
    writeStore({ ...db, [id]: resolved })
  }
  return resolved
}

export const isFourInRowOptionUnlocked = (type, optionId, inventoryOrAccountId) => {
  if (!type || !optionId) return false
  const inventory =
    typeof inventoryOrAccountId === 'string' || !inventoryOrAccountId
      ? getFourInRowInventory(inventoryOrAccountId)
      : inventoryOrAccountId
  return Array.isArray(inventory?.[type]) && inventory[type].includes(optionId)
}

export const addFourInRowUnlock = (type, optionId, accountId = 'guest') => {
  const id = fourInRowAccountId(accountId)
  const db = readStore()
  const current = normalizeInventory(db[id])
  const nextValues = new Set(current[type] || [])
  nextValues.add(optionId)
  const nextInventory = { ...current, [type]: Array.from(nextValues) }
  writeStore({ ...db, [id]: nextInventory })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fourInRowInventoryUpdate', { detail: { accountId: id, inventory: nextInventory } }))
  }
  return nextInventory
}

export const listOwnedFourInRowOptions = (accountId) => {
  const inventory = getFourInRowInventory(accountId)
  return Object.entries(inventory).flatMap(([type, values]) => {
    if (!Array.isArray(values)) return []
    const labels = FOUR_IN_ROW_BATTLE_OPTION_LABELS[type] || {}
    return values.map((optionId) => ({ type, optionId, label: labels[optionId] || optionId }))
  })
}

export const getDefaultFourInRowLoadout = () => ({ ...FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT })
