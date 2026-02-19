# Platform Help AI Agent (User-Facing, Public-Only)

## File tree

```text
packages/
  agent-core/
    src/
      agent.ts
      index.ts
      knowledgeBase.ts
      lexicon.ts
      nlu.ts
      providers.ts
      retrieval.ts
      safety.ts
      types.ts
  ingestion-public/
    src/
      cli.ts
      indexer.ts
      parser.ts
  api/
    src/
      server.ts
  web-widget/
    src/
      HelpWidget.tsx
      index.ts
public_docs/
help_articles/
rules/
policies/
docs/platform-help-agent.md
test/platformHelpAgent/
```

## Local run

1. Install deps
   - `npm install`
2. Build index
   - `npm run help:ingest`
3. Start API
   - `npm run help:api`
   - Voice endpoints now support a local development fallback when PersonaPlex credentials are missing.
   - Optional strict mode: set `PERSONAPLEX_LOCAL_FALLBACK=0` to force real PersonaPlex credentials.
   - NVIDIA endpoint mode is configurable with `PERSONAPLEX_API_MODE`:
     - `openai_audio` for OpenAI-compatible audio speech endpoints (e.g. NVIDIA integrate API `/v1/audio/speech`).
     - `personaplex` for PersonaPlex-style synth endpoints (default path `/v1/speech/synthesize`).
     - `auto` to try both formats in order.
4. Run tests
   - `npm run help:test`

## Security model
- Hard-gated refusal for sensitive/private/abusive requests.
- Public-only retrieval from curated directories.
- Privacy-safe logging (metadata + hashed prompt ID only).
- Every answer returns citations or states insufficient public information.
