const DEFAULT_CONNECT_TIMEOUT_MS = 15000
const DEFAULT_ACK_TIMEOUT_MS = 6000

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

/** Register the authoritative TPG identity before requesting a Royal seat. */
export async function joinRoyalLobby ({
  socket,
  accountId,
  criteria,
  connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
  ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS
}) {
  if (!socket || !accountId) return { success: false, error: 'missing_identity' }
  if (!(await waitForSocketConnection(socket, connectTimeoutMs))) {
    return { success: false, error: 'socket_unavailable' }
  }

  const identity = String(accountId)
  const registration = await emitWithAck(
    socket,
    'register',
    { tpcAccountNumber: identity },
    ackTimeoutMs
  )
  if (!registration?.success) {
    return { success: false, error: registration?.error || 'register_failed' }
  }

  return emitWithAck(socket, 'seatTable', {
    ...criteria,
    tpcAccountNumber: identity,
    accountId: criteria?.accountId,
    ready: true
  }, ackTimeoutMs)
}
