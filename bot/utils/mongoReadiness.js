// MongoDB can spend a few seconds reconnecting after Atlas changes hosts or a
// mobile request wakes a sleeping deployment. Media elements do not reliably
// retry a 503 response, so wall reads should briefly follow the in-flight
// connection instead of failing the first video range request immediately.
const pendingConnections = new WeakMap();

export const waitForMongoReady = (connection, timeoutMs = 5000) => {
  if (connection?.readyState === 1 && connection.db) return Promise.resolve(true);
  if (!connection?.on || !connection?.removeListener || timeoutMs <= 0) return Promise.resolve(false);
  const pending = pendingConnections.get(connection);
  if (pending) return pending;

  const readiness = new Promise(resolve => {
    let settled = false;
    const finish = ready => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      connection.removeListener('connected', onConnected);
      connection.removeListener('open', onConnected);
      connection.removeListener('error', onError);
      resolve(ready);
    };
    const onConnected = () => finish(connection.readyState === 1 && Boolean(connection.db));
    // The driver can emit `error` while it is still selecting another Atlas
    // host. Treating that event as final makes waiting media requests return a
    // 503 at exactly the moment the connection is recovering. Keep the
    // request attached until Mongo connects or the bounded timeout expires.
    const onError = () => {
      if (connection.readyState === 1 && connection.db) finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);

    connection.on('connected', onConnected);
    connection.on('open', onConnected);
    connection.on('error', onError);

    // Close the race where Mongo connected between the initial state check and
    // listener registration.
    if (connection.readyState === 1 && connection.db) finish(true);
  });
  pendingConnections.set(connection, readiness);
  readiness.finally(() => {
    if (pendingConnections.get(connection) === readiness) pendingConnections.delete(connection);
  });
  return readiness;
};
