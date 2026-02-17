# NVIDIA PersonaPlex Voice Commentary Integration

This project now includes a reusable voice layer for:

- real-time game commentary across core games
- multilingual voice catalog selection
- spoken customer support responses

## Environment variables

Configure the API server (`packages/api/src/server.ts`) with:

- `PERSONAPLEX_API_URL` - PersonaPlex API base URL
- `PERSONAPLEX_API_KEY` - Bearer token for synthesis requests

If these values are not set, voice endpoints return **preview mode** (`ssml`) so you can validate scripts without spending API credits.

## Endpoints

### `GET /v1/voice/catalog`
Returns supported languages and voice profiles.

### `POST /v1/voice/commentary`
Builds commentary text for game events and optionally synthesizes speech.

Payload example:

```json
{
  "game": "pool_royale",
  "eventType": "match_start",
  "playerName": "Arben",
  "score": "5-3",
  "locale": "sq-AL",
  "voiceId": "anisa_sq_al_f"
}
```

### `POST /v1/voice/support`
Builds customer-support voice messages and optionally synthesizes speech.

Payload example:

```json
{
  "ticketContext": "Nuk po më hapet loja",
  "locale": "sq-AL",
  "voiceId": "anisa_sq_al_f"
}
```

## Included game keys

- `pool_royale`
- `snooker_royal`
- `snake_multiplayer`
- `texas_holdem`
- `domino_royal`
- `chess_battle_royal`
- `air_hockey`
- `goal_rush`
- `ludo_battle_royal`
- `table_tennis_royal`
- `murlan_royale`
- `dice_duel`
- `snake_and_ladder`

## Notes

- Voice IDs in the catalog are provider-facing identifiers used by this app.
- Keep commentary generation modular (`buildCommentaryText`, `buildSupportSpeech`) so game systems can call it from UI, server events, or bot flows.
