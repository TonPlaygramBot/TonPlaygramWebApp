# Snake & Ladder Multiplayer Example

This folder contains a small Socket.IO server and React client demonstrating
how to synchronize game state across multiple players.

## Running the server

```
node server.js
```

## Using the React client

Import `ReactClient` into your React application and render it with the same
`roomId` for all players that should share a board. Each user sees the exact
same state thanks to real‑time updates from the server.
