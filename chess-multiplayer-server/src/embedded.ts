import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { AddressInfo } from 'node:net';
import httpProxy from 'http-proxy';
import WebSocket from 'ws';
import { defineServer } from 'colyseus';
import { createChessServerConfig } from './app.config.js';

/** Run chess in the main app process; only the main app's port is public. */
export async function createChessGateway({
  accountApiUrl,
  gracefullyShutdown = true,
  allowOrigin = (_origin: string | undefined) => true
}: {
  accountApiUrl: string;
  gracefullyShutdown?: boolean;
  allowOrigin?: (origin: string | undefined) => boolean;
}) {
  const accountUrl = new URL(accountApiUrl);
  if (accountUrl.protocol !== 'http:' || accountUrl.hostname !== '127.0.0.1') {
    throw new Error('Embedded chess must authenticate against the local account API');
  }
  process.env.ACCOUNT_API_URL = accountUrl.origin;
  process.env.AUTH_REQUIRED = 'true';
  // Both modules read this process-local secret. Keep any existing configured
  // value, but no second service or shared-secret setup is needed for new installs.
  process.env.MATCHMAKING_SERVICE_SECRET ||= randomBytes(32).toString('hex');
  if (!globalThis.WebSocket) Object.assign(globalThis, { WebSocket });

  const server = defineServer({
    // One process owns these rooms. Do not accidentally share the bot's Redis
    // namespace with the retiring standalone matchmaking service.
    ...createChessServerConfig({ redisUrl: '' }),
    gracefullyShutdown,
    greet: false
  });
  await server.listen(0, '127.0.0.1');
  const address = server.transport.server!.address() as AddressInfo;
  const proxy = httpProxy.createProxyServer({
    target: `http://127.0.0.1:${address.port}`,
    ws: true,
    xfwd: true
  });
  // Never return connection details or account credentials to clients.
  proxy.on('error', (_error, _req, response) => {
    if ('writeHead' in response) {
      const res = response as ServerResponse;
      if (!res.headersSent) {
        res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '3' });
      }
      res.end(JSON.stringify({ error: 'matchmaking_unavailable' }));
    } else {
      response.destroy();
    }
  });

  return {
    // Express removes /colyseus before this handler. Mount before body parsers
    // so join options, private invitation codes and auth reach Colyseus intact.
    handleRequest(req: IncomingMessage, res: ServerResponse) {
      proxy.web(req, res, { proxyTimeout: 30_000 });
    },
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
      if (!/^\/colyseus(?:\/|\?|$)/.test(req.url || '')) return false;
      if (!allowOrigin(req.headers.origin)) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return true;
      }
      req.url = req.url!.slice('/colyseus'.length) || '/';
      proxy.ws(req, socket, head);
      return true;
    },
    async close() {
      proxy.close();
      await server.gracefullyShutdown(false);
    }
  };
}
