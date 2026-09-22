import { joinRoyalLobby } from '../../utils/royalMatchmaking.js'

export const DOMINO_ROYAL_MATCH_TIMEOUT_MS = 120000
const DEFAULT_CONNECT_TIMEOUT_MS = 15000
const DEFAULT_ACK_TIMEOUT_MS = 6000

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
  return joinRoyalLobby({ socket, accountId, criteria, connectTimeoutMs, ackTimeoutMs })
}
