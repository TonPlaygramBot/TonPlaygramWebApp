import 'dotenv/config';
import WebSocket from 'ws';
import { defineServer } from 'colyseus';
import { chessServerConfig } from './app.config.js';

// Colyseus 0.17 uses the browser-compatible WebSocket constants while restoring
// a seat. Node 20 has no global WebSocket, so provide the server transport's
// implementation instead of letting reconnection fail after authentication.
if (!globalThis.WebSocket) Object.assign(globalThis, { WebSocket });

const server = defineServer(chessServerConfig);

server.listen(Number(process.env.PORT) || 2567);
