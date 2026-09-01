import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { socket } from '../utils/socket.js'

export default function useArcadeRace (gameType, score) {
  const [params] = useSearchParams()
  const tableId = params.get('tableId') || ''
  const accountId = params.get('accountId') || ''
  const online = params.get('mode') === 'online' && Boolean(tableId && accountId)
  const [state, setState] = useState(null)

  useEffect(() => {
    if (!online) return undefined
    const handleState = (next = {}) => {
      if (String(next.tableId) === tableId && next.gameType === gameType) setState(next)
    }
    socket.emit('register', { tpcAccountNumber: accountId, accountId, playerId: accountId })
    socket.on('arcadeRaceState', handleState)
    socket.emit('joinArcadeRace', { tableId, accountId, gameType })
    socket.emit('arcadeRaceSyncRequest', { tableId, accountId })
    const syncTimer = window.setInterval(() => {
      socket.emit('arcadeRaceSyncRequest', { tableId, accountId })
    }, 1000)
    return () => {
      window.clearInterval(syncTimer)
      socket.off('arcadeRaceState', handleState)
      socket.emit('leaveLobby', { tableId, accountId })
    }
  }, [accountId, gameType, online, tableId])

  useEffect(() => {
    if (!online) return undefined
    const timer = window.setTimeout(() => socket.emit('arcadeRaceScore', { tableId, accountId, score }), 120)
    return () => window.clearTimeout(timer)
  }, [accountId, online, score, tableId])

  const finish = useCallback((finalScore = score) => {
    if (online) socket.emit('arcadeRaceFinish', { tableId, accountId, score: finalScore })
  }, [accountId, online, score, tableId])

  const opponent = useMemo(() => state?.players?.find((id) => String(id) !== String(accountId)) || '', [accountId, state?.players])
  return {
    online,
    accountId,
    state,
    opponentScore: Number(state?.scores?.[opponent] || 0),
    myServerScore: Number(state?.scores?.[accountId] || 0),
    startsAt: Number(state?.startsAt || 0),
    endsAt: Number(state?.endsAt || 0),
    winner: state?.winner || null,
    finish
  }
}
