const DEFAULT_CONNECT_TIMEOUT_MS = 15000
const DEFAULT_ACK_TIMEOUT_MS = 6000

function buildSeatPayload (accountId, criteria = {}) {
  const tpcAccountNumber = String(accountId || '').trim()
  return {
    ...criteria,
    // Keep accountId for older servers, while making the canonical lobby
    // identity explicit for current servers and reconnects.
    accountId: tpcAccountNumber,
    tpcAccountNumber
  }
}

function waitForSocketConnection (socket, timeoutMs = DEFAULT_CONNECT_TIMEOUT_MS) {
  if (socket?.connected) return Promise.resolve(true)
  if (!socket) return Promise.resolve(false)

  return new Promise((resolve) => {
    let settled = false
    const finish = (connected) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.off?.('connect', onConnect)
      resolve(connected)
    }
    const onConnect = () => finish(true)
    const timer = setTimeout(() => finish(Boolean(socket.connected)), timeoutMs)

    socket.once?.('connect', onConnect)
    socket.connect?.()
  })
}

function emitWithAck (socket, event, payload, timeoutMs = DEFAULT_ACK_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ success: false, error: `${event}_timeout` })
    }, timeoutMs)

    socket.emit(event, payload, (response = {}) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(response)
    })
  })
}

/**
 * Completes the Socket.IO lobby handshake in order. Waiting for the register
 * acknowledgement prevents seatTable from racing the server's async identity
 * registration on mobile or high-latency connections.
 */
export async function joinDominoRoyalLobby ({
  socket,
  accountId,
  criteria,
  connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
  ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS
}) {
  if (!socket || !accountId) {
    return { success: false, error: 'missing_identity' }
  }

  const connected = await waitForSocketConnection(socket, connectTimeoutMs)
  if (!connected) return { success: false, error: 'socket_unavailable' }

  const identity = String(accountId)
  const registration = await emitWithAck(
    socket,
    'register',
    { accountId: identity, tpcAccountNumber: identity },
    ackTimeoutMs
  )
  if (!registration?.success) {
    return { success: false, error: registration?.error || 'register_failed' }
  }

  return emitWithAck(
    socket,
    'seatTable',
    buildSeatPayload(identity, criteria),
    ackTimeoutMs
  )
}

/**
 * Refreshes a queued seat and asks the server to search all compatible open
 * tables again. This also keeps the online seat alive during long searches.
 */
export async function searchDominoRoyalLobby ({
  socket,
  accountId,
  criteria,
  ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS
}) {
  if (!socket?.connected || !accountId) {
    return { success: false, error: 'socket_unavailable' }
  }
  return emitWithAck(
    socket,
    'seatTable',
    buildSeatPayload(accountId, criteria),
    ackTimeoutMs
  )
}
