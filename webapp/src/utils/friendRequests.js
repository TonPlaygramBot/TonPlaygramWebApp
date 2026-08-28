function identityValues (...values) {
  return new Set(
    values
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map(String)
  )
}

export function isIncomingFriendRequest (request, ...currentUserIds) {
  const currentIdentities = identityValues(...currentUserIds)
  const recipientIdentities = identityValues(
    request?.to,
    request?.toId,
    request?.toTelegramId,
    request?.toAccountId
  )

  return [...recipientIdentities].some((identity) => currentIdentities.has(identity))
}

export function friendRequestId (request) {
  return request?.requestId || request?._id || ''
}
