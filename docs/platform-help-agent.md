# Platform Help AI Agent (User-Facing Only)

## Security boundary
- The agent is restricted to approved public content only.
- It refuses requests for secrets, internal systems, admin data, exploit guidance, or PII.
- Responses include public citations or explicitly state low confidence.

## Public knowledge sources
- `public_docs/`
- `help_articles/`
- `rules/`
- `policies/`

## Authoring format
Every markdown file must include frontmatter:

```md
---
title: Article title
slug: url-slug
locale: en
version: 1.0.0
---
## Section heading
Content...
```

## Ingestion + index
1. Add/update public markdown files.
2. Run ingestion CLI to regenerate `packages/ingestion-public/public-index.json`.
3. Restart API service.

## API contract
- `POST /v1/user-chat`
- `GET /v1/help-articles`
- `POST /v1/feedback`

## Privacy-safe telemetry
Only metadata is logged:
- intent
- article IDs
- confidence
- hashed prompt identifier
