# Social Hub private messaging security

This change encrypts new direct-message text, attachment contents and attachment metadata in the browser before they reach the Social Hub API. It adds authenticated key registration, signed envelopes, key-change controls and disappearing-message enforcement. Existing plaintext messages remain explicitly marked as legacy records; reading them does not retroactively encrypt past copies.

This is a new application protocol built on browser Web Crypto primitives. It has automated implementation tests, but **has not had an independent cryptographic audit**. It must not be described as Signal Protocol, Double Ratchet, post-quantum security, perfect forward secrecy, or protection from a compromised browser/server delivering malicious JavaScript.

## Credentials and identity

Private routes require fresh, verified Telegram init data or a Google ID token validated against the configured Google audience. Public account IDs, Google subject IDs and the application's compatibility bearer token do not establish a private conversation identity. The server resolves the authenticated account from its user record. Public key publication, reading messages, deleting messages, attachment downloads and friend-call signaling use that verified identity.

Open the Social Hub once on a supported HTTPS browser to enroll the account key. Enrollment is automatic only if the account has no published key. New encrypted sends require the recipient to have opened the hub and enrolled too; there is no plaintext fallback. Sending also requires mutual friendship.

## Wire format v1

The shared canonicalization contract is `shared/secureMessagingProtocol.js`. Object keys are recursively sorted and encoded as UTF-8 JSON. All binary fields use unpadded canonical base64url.

| Component | Construction |
| --- | --- |
| Device agreement identity | P-256 ECDH key pair |
| Device signing identity | Separate P-256 ECDSA key pair, SHA-256 signatures |
| Public fingerprint | SHA-256 over the canonical version, agreement public JWK and signing public JWK |
| Content key | Fresh 256-bit random key per message |
| Message encryption | AES-256-GCM with a fresh 96-bit random IV and 128-bit authentication tag |
| Key wrapping | Fresh ephemeral P-256 ECDH per message; HKDF-SHA-256 with fresh 256-bit salt produces separate sender and recipient AES-256-GCM wrapping keys |
| Signature | ECDSA-SHA-256 over the complete canonical envelope except `signature`; raw 64-byte P1363 signature |

The signed envelope contains the protocol version, algorithm, random message UUID, canonical sender and recipient account IDs, sent timestamp, retention duration, both identity fingerprints, sender public key bundle, ephemeral public key, salt, content IV/ciphertext, both wrapped content keys and signature.

Message authenticated additional data binds the protocol, algorithm, IDs, timestamp, retention, fingerprints, ephemeral public key, salt and IV. Key-wrapper additional data also binds the sender/recipient role. HKDF info includes the protocol-specific domain, message ID, account IDs and wrapper role. Each participant can therefore decrypt their own history without storing a plaintext server copy.

Reply payloads contain only the original message ID and author ID. The UI obtains a quote from the currently loaded, available original; it does not embed a second persistent copy of disappearing/deleted message text.

The server validates exact envelope fields, supported timers, public curve points, canonical encodings, signature, authenticated sender, current sender/recipient fingerprints, mutual friendship and size. The signed timestamp must be within five minutes of server time. Duplicate message UUIDs are idempotent only for the identical ciphertext. Encryption failures, missing keys and changed keys block sending.

## Device storage and verification

Private Web Crypto keys are generated as nonextractable and stored as `CryptoKey` objects in IndexedDB. Concurrent tabs select one identity in a serialized database transaction. Message text and decrypted attachment bytes are not persisted by this client. Decrypted attachment previews use temporary object URLs that are revoked when messages are replaced or removed.

A friend's first observed fingerprint is pinned locally. Later changes block sending until the user explicitly compares and trusts the replacement key. The first observation is trust on first use: compare the displayed fingerprints through a separate trusted channel to detect a substituted initial key. Old explicitly trusted fingerprints remain available to verify historical message signatures. Pins belong to the signed-in account and browser; they are not shared across devices.

This release supports **one active published identity per account**, not synchronized multi-device private keys. A new browser without the matching private key cannot read history encrypted to the missing key. An explicit device-key reset publishes a replacement using compare-and-set against the previous fingerprint. The new private key is saved before the network request so an interrupted response can be recovered. Any old private identity already present in the same browser is retained for reading its old messages. Lost or cleared browser keys cannot be recovered from the server. Other browsers must not silently replace the account key, and friends must reverify changed keys.

## Retention and deletion

Timers are off, 5 minutes, 1 hour, 24 hours or 7 days, measured from the signed send timestamp. The server computes the expiry. Read, unread-count and legacy attachment authorization exclude expired records immediately; a MongoDB TTL index physically removes expired records asynchronously. The client also excludes expired payloads and removes them from the visible thread. Changing a timer affects subsequent messages only.

“Delete for me” hides the record for the authenticated account. “Delete for everyone” is restricted to the original sender and removes the live message content/ciphertext and attachment descriptor. A content-free tombstone remains for 24 hours to prevent duplicate sends from resurrecting the deleted record. Deleting a legacy attachment for everyone also removes its stored file. “Clear conversation” removes the account's existing copy through a server-time cutoff; it does not erase the other participant's copy.

These controls cannot erase screenshots, recipient exports, previously downloaded files, old public attachment caches or backups outside the running application. Mongo TTL timing is not a claim of immediate physical disk erasure. Configure backup and log retention separately. The server still knows account IDs, communication relationships, timestamps, retention settings, public keys and ciphertext size.

## Attachments and calls

New encrypted files are limited to 2 MiB. File names, MIME types and contents are inside the encrypted payload. Untrusted HTML, SVG and other active types are forced to `application/octet-stream` for downloads; only an explicit inert raster/audio/video MIME allowlist can render as a preview. Legacy downloads require participant authorization and no-store responses. Automatic legacy previews are capped at 2 MiB, including streamed responses, to avoid buffering the older upload path's potential 1 GB files on phones.

Friend calls continue to use the existing WebRTC media transport with authenticated signaling and server-enforced room membership. This message envelope is not applied to WebRTC media and does not establish an audited media E2EE protocol. The UI's call history is local metadata and can be cleared. The application does not record call audio/video in this flow. Ending or timing out a call clears live signaling state; deletion controls do not promise removal of telecom, network, TURN or infrastructure logs.

## Threat boundaries and follow-up

The design protects stored and relayed new message contents from a passive database/API observer who does not possess a participant's device key, provided the clients and delivered application code are trusted. It detects ciphertext/header tampering and prevents unsigned account-ID impersonation at the private routes.

It does not provide forward secrecy or post-compromise recovery: possession/use of a static agreement private key can decrypt retained ciphertext addressed to that key, including sender history. Nonextractable is a Web Crypto export restriction, not hardware-backed storage or an XSS defense; code running in the same origin can use keys and read decrypted content. A browser-distributed app also trusts the JavaScript served by its origin. Both account credentials and device storage still require normal web-platform hardening.

For higher-assurance messaging, plan an independently reviewed protocol/library integration with ratcheting, device verification/linking, protected backups and key transparency, with a migration plan for this version. Do not layer improvised ratchets onto this implementation and call it Signal-compatible.

## Repeatable verification

- `node --test test/secureMessagingCrypto.node.mjs`: sender/recipient round trips, nonextractable keys, fresh randomness, body/header/signature/wrapper tampering, wrong recipients, untrusted/changed identities, expiry, attachment/reply confidentiality, malformed input, concurrent IndexedDB creation and explicit pin replacement.
- `npm run test:navigation --prefix webapp -- src/utils/secureMessages.navigation.test.js`: real Web Crypto plus IndexedDB behind mocked HTTP, no plaintext fallback, directory-key changes, explicit device reset, unavailable historical keys, deletion calls and inert attachment blobs.
- Backend route/protocol/auth/call tests are listed in the upgrade review document. These unit/integration checks do not replace two-device live delivery/call testing or an external security review.

## Primary references

- [W3C Web Cryptography API](https://www.w3.org/TR/webcrypto/) defines the primitive operations and `CryptoKey` behavior used here; it does not certify this application protocol.
- [Signal Double Ratchet specification](https://signal.org/docs/specifications/doubleratchet/) documents ratcheting security properties that this release does **not** implement.
