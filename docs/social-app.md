# TonPlayGram Social

TonPlayGram Social is a separately installable progressive web app at `/social-app/`. It provides the existing Social Hub chats, friends, alerts, calls, and ranks with its own portrait-oriented home-screen experience.

## Routes

| Social route | Feature |
| --- | --- |
| `/social-app/hub` | Chats, friends, alerts, calls, and ranks |
| `/social-app/me` | Link to account settings in the main app |
| `/social-app/install` | Installation and browser guidance |

Unknown routes offer a link back to the main app.

## Installation and caching

The Social app has a distinct manifest identity, icon, scope, and service worker. Its worker precaches only the Social entry dependency graph and does not cache private API responses. The main worker bypasses Social navigation so the main application shell cannot replace it.

## Verification

```sh
npm --prefix webapp run test:social -- --maxWorkers=2
node --test test/socialAppWorker.node.mjs
npm --prefix webapp run build
node webapp/scripts/verify-social-app-build.mjs webapp/dist
```
