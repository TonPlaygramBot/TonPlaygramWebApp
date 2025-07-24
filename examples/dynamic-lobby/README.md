# Dynamic Lobby Example

This folder contains a simple Socket.IO lobby server and client.

When a table fills up the server waits a short delay before emitting a
`gameStart` event so that the final player has time to connect. A fresh
Snakes & Ladders board is generated at that moment and included in the
event payload. If more players request the same table size and stake
while an existing table is already full, a new table with the same
conditions is created automatically.

Set the lobby server URL with the `SERVER_URL` environment variable or pass it when creating the client:

```bash
# using an environment variable
SERVER_URL=http://127.0.0.1:3000 node client.js
```

```javascript
// passing the URL explicitly
import { createLobbyClient } from './client.js';
const { joinLobby } = createLobbyClient('http://127.0.0.1:3000');
```
