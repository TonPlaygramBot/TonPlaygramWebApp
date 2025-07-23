# Dynamic Lobby Example

This folder contains a simple Socket.IO lobby server and client.

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
