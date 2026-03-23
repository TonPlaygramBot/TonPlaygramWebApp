export function extractSocketUser(socket) {
    const token = socket.handshake.auth.token;
    if (!token) {
        return null;
    }
    const [id, username] = token.split(':');
    if (!id || !username) {
        return null;
    }
    return { id, username };
}
