export function extractSocketUser(socket) {
    const token = socket.handshake.auth.token;
    const authTPC = socket.handshake.auth.tpcAccountNumber;
    if (!token) {
        return null;
    }
    const [id, username, tokenTPC] = token.split(':');
    if (!id || !username) {
        return null;
    }
    const tpcAccountNumber = authTPC || tokenTPC;
    const canonicalUserId = tpcAccountNumber || id;
    return { id, canonicalUserId, username, tpcAccountNumber };
}
