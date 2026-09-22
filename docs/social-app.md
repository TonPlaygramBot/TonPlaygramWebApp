# TonPlayGram Social

TonPlayGram Social is a separately installable progressive web app at
`/social-app/`. The main homepage and social wall link to
`/social-app/install`, which offers the browser install prompt and manual
iOS/Android instructions. It uses a distinct manifest ID, name, icon and
start URL. This change delivers a browser-installed app; app-store distribution
and a separate signed native package are separate release work.

## Shared platform

The social entry uses the existing React components and backend, not a second
copy of the product:

| Social route | Shared feature |
| --- | --- |
| `/social-app/wall` | Community wall, composer, resumable transfers and exclusive video playback |
| `/social-app/hub` | Existing Social Hub: chats, friends, alerts, calls and ranks |
| `/social-app/creator-studio` | Existing publishing, account connections and live studio |
| `/social-app/me` | Current user's community profile |
| `/social-app/wall/profile/:accountId` | Public profile and post layouts |
| `/social-app/install` | Social installation and browser guidance |

React Router's basename keeps wall/profile/Studio links in the social app.
Explicit links open the main app for games, wallet and account settings. The
Social Hub's game invitations continue pointing to the main game routes.
Studio stays mounted after its first visit, preserving its draft, current upload
and live session while switching between social pages. Inactive camera previews
are released by the existing LiveStudio behavior.

Wall account identity, browser storage, upload jobs and the existing Studio
session cookie remain on the same origin. A browser that has the user's existing
account can reuse it. Telegram WebViews, Safari, Chrome and some installed-app
containers can have separate storage; users must sign in with their existing
account when moving between them. This does not bypass or replace Studio's
server-verified sign-in.

Studio OAuth saves an allowlisted return path inside the browser-bound, one-time
OAuth state record. Successful or cancelled connections return to the app that
started them; invalid or expired state returns to the main Studio. Provider
callback URLs do not change. Credentials are never put in installation URLs.

## Profiles

Four compact icon buttons select one, two, three or four columns. Three columns
is the default; the browser remembers the preference. One column shows the full
post with its existing actions and video player. Denser layouts use portrait
tiles, load video metadata only near the viewport, and never autoplay. Opening
a tile navigates to the full post. Photos, articles and polls remain accessible;
filters and pagination use the same feed. Offline profile fallback filters saved
posts by the requested author.

## Installation, caching and updates

Vite builds both HTML entrypoints together. The Express SPA fallback selects the
social entry for `/social-app/*`. Static manifests, HTML, service workers and
shared wall worker scripts revalidate on deployment.

The social worker controls only `/social-app/` and precaches the social entry's
dependency graph, including lazy social pages. It imports the shared upload and
push workers. It does not fetch game packs or cache API responses, OAuth state,
private conversations or video files. Worker updates wait for old windows to
close; there is no forced reload during an upload. Its cache cleanup preserves
the main app's caches. The main worker bypasses social navigation so a downloaded
game shell cannot replace the social entry.

Uploads and browser push subscriptions select the worker for the current page.
Social notification clicks open the social wall without replacing an existing
main-app window. The upload repository/leases are shared so workers and windows
coordinate rather than sending duplicate chunks.

The existing main app has scope `/`, enclosing Social's scope. Some browsers
suppress the automatic install prompt when that main app is already installed.
The install page therefore always includes browser-menu/Home Screen instructions
and never treats an arbitrary standalone main-app window as a confirmed Social
install. Both apps share origin storage and permissions; clearing site data for
one can clear the other's local data. For fully independent browser installation
promotion/storage, a dedicated origin plus authenticated account handoff would
be a later infrastructure change. See the [web.dev multiple-PWA guidance](https://web.dev/articles/building-multiple-pwas-on-the-same-domain).

Installing a PWA does not grant native OS background-upload guarantees. The
existing wall queue saves files/checkpoints, uses background work where supported
and resumes on return. Studio preserves an upload during in-app navigation;
its existing file-reselection behavior still applies after a full app closure.

## Verification and rollout

Run:

```sh
npm --prefix webapp run test:wall -- --maxWorkers=2
npm --prefix webapp run test:social -- --maxWorkers=2
node --test test/socialAppWorker.node.mjs test/wallPushServiceWorker.node.mjs
node --test bot/tests/creatorSocialReturn.test.js
cd webapp
node --max-old-space-size=3072 node_modules/vite/bin/vite.js build
node scripts/verify-social-app-build.mjs dist
```

The Social app workflow runs frontend, worker and production-build checks. The
Creator Studio workflow runs the real OAuth callback/one-time-state integration
test against its MongoDB service. The standard deployment still uses the
repository's full `npm run build` asset pipeline.

After deploying, verify on Android Chrome and iOS Safari: install Social both
with and without the main app already installed; launch each shortcut; reopen a
profile deep link; switch all four layouts at 320–430px; open a video; navigate
to the hub while a wall upload is running; reconnect after being offline; and
complete/cancel a Studio connection. Test phone background suspension separately
from in-app navigation. No provider publishing or live stream is needed to test
installation and layouts.
