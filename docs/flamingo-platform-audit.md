# Flamingo Revolution — audit i platformës

Audit i kodit më 7 gusht 2026. Prioritetet: **P0** siguri, privatësi dhe flows të prishura; **P1** koordinim mobile; **P2** funksione operative me backend; **P3** polish.

## Çfarë ekziston

- Entry point-i kryesor është `src/App.jsx`; `/flamingo/*` ngarkon lazy `FlamingoApp.tsx` brenda shell-it ekzistues TonPlaygram.
- Flamingo është një feature React/TypeScript me React Router, Zustand, mock data lokale dhe CSS të izoluar. Ka Kreun, protesta/listë/detaj, live timeline, grupe/channels, detyra, hartë OpenStreetMap, raportim, dokumente, Media Wall, profil, Telegram, Video Wall dhe panele stafi.
- PWA/service worker ekziston në platformën prind. Harta përdor pika publike; nuk ka tracking individual.
- Media Wall dhe ngarkimi i videove kanë API reale (`/api/protest-videos`). Pjesa tjetër e të dhënave Flamingo (protesta, updates, groups, tasks, markers, documents) vjen nga `mock.ts`.

## Çfarë është demo ose jo-operative

- Numrat e pjesëmarrësve, statusi “LIVE”, programi, grupet, detyrat, dokumentet, ekipi dhe dashboard metrics janë statike.
- Join protest/group/task ishte vetëm state në memorie; tani preferencat jo-sensitive ruhen lokalisht, por nuk sinkronizohen me serverin.
- Raporti shfaq konfirmim dhe ridrejton, por nuk ka endpoint/queue reale. Upload-i i provës nuk transmetohet. Për këtë arsye nuk duhet konsideruar kanal operativ derisa të lidhet me backend të enkriptuar.
- Butonat e quick actions në admin vetëm shfaqin toast. Document download nuk ka skedar. Compose në group channel nuk dërgon mesazh. “Propozo një burim” nuk ka handler.
- Roli i stafit lexohet nga localStorage dhe nuk është autorizim. Default-i i pasigurt ADMIN u hoq, por çdo endpoint i ardhshëm duhet të verifikojë token dhe rol në server.

## Probleme dhe rreziqe

### P0

- Paneli admin hapej si ADMIN për çdo vizitor për shkak të rolit default në localStorage.
- Route me ID proteste/grupi të gabuar shfaqte objektin e parë, duke dhënë informacion të gabuar në vend të Not Found.
- UI pretendon pranimin e raportit pa transport/ruajtje reale; kjo krijon pritshmëri të rrezikshme.
- Nuk ka backend Flamingo për autorizim, moderation queue, audit log, njoftime, task capacity ose konfliktet e assignment-it.

### P1

- Bottom nav kishte Media/Tasks/Protests në vend të loop-it operacional Kreu/Live/Grupet/Harta/Profili.
- Source roles nuk dalloheshin mjaftueshëm; metadata e verification mungonte në model.
- Task nuk mund të lihej dhe state humbiste pas refresh-it.
- Nuk kishte offline status ose notification preferences.
- Map nuk ka ende category filters; iframe kërkon internet dhe service worker nuk garanton cache të tile-ve.

### P2/P3

- `FlamingoApp.tsx` është shumë monolitik dhe duhet ndarë gradualisht sipas domain-it, jo rishkruar.
- Nuk ka tests të dedikuara për Flamingo. Typecheck global ka borxh ekzistues TS/JS në feature të tjera dhe dy gabime ekzistuese në MediaWall.
- Disa tekste dhe touch targets përdorin font shumë të vogël; admin quick actions janë dummy UI; nuk ka loading/error/empty states sepse të dhënat janë lokale.

## Rekomandimi i fazës tjetër

1. Krijo API dhe modele për events, schedule, official updates, groups, tasks/assignments, reports dhe moderation audit log.
2. Përdor auth ekzistues të serverit dhe middleware RBAC server-side për USER, VOLUNTEER, MODERATOR, ORGANIZER, ADMIN; mos prano rol nga localStorage.
3. Bëj raportimin transaksional: upload me metadata stripping, encryption at rest, retention policy, receipt jo-identifikues dhe queue private për moderatorët.
4. Zëvendëso datat/metrics hard-coded me përgjigje API, cache të versionuar dhe `lastSyncedAt`; mos cache të dhëna private.
5. Shto integration tests për route rendering, join, capacity-safe task assignment, report submission dhe moderator permissions përpara se UI të deklarohet operative.
