# TON validation foundation (offline only)

This package compiles the repository's existing FunC Jetton contracts and runs
local TON Sandbox tests against the existing TypeScript wrappers. It does not
connect to an RPC endpoint, load credentials, deploy to a blockchain, or mint
real tokens. Sandbox fixture amounts are arbitrary base units, not tokenomics.

## Reproduce

Use Node.js 22 or 24:

```sh
cd tools/ton
npm ci --ignore-scripts
npm run compile
npm test
```

Dependencies are isolated from the application runtime and version-locked.
The bundle step only brings the repository wrappers into this package's module
resolution scope; generated output is ignored. Compilation reads the target lists
from `wrappers/JettonMinter.compile.ts` and `JettonWallet.compile.ts`.

Only the discoverable minter and normal wallet wrapper targets are tested. The
legacy ICO and claim-wallet variants are outside this baseline.

## What is covered

- Actual minter/wallet compilation and a zero-supply local deployment.
- Authorized mint and rejection of unauthorized mint.
- Owner transfer, receiver wallet balance, rejection of unauthorized debit.
- Burn accounting and rejection of forged burn notifications.
- Admin/metadata permissions and authority transfer.

These are baseline regression tests, not a security audit or proof of readiness
for funds. Gas boundaries, bounced messages, malformed payloads, fuzzing,
metadata compatibility and game settlement contracts require further work.

## Existing contract findings and launch gates

The current minter permits the admin to mint without a supply cap, transfer
admin authority and change metadata. Its getter reports mintable=true. Do not
interpret repository metadata or an example environment address as evidence of
a deployed/verified TPG token. Network, deployed address, code hash, admin and
actual supply still require independent verification.

**Do not use the legacy `scripts/deploy_tpc_jetton.js` for a launch.** It combines
deployment with a hard-coded billion-token mint, accepts an arbitrary RPC URL,
and uses the metadata image URL where the Jetton content should reference the
JSON metadata document. This package intentionally neither imports nor runs it.

Before any testnet deployment, replace that flow with explicit testnet-only
network checks, JSON metadata validation, a zero-supply deployment phase, and
recorded contract code hashes/address. Use a dedicated testnet wallet with test
funds, never production credentials. Verify explorer state after deployment.

Before mainnet, explicitly approve supply/decimals/allocation, mint policy and
admin custody, complete independent contract review, and test all issuance,
transfer/burn and application integration paths. No mainnet deployment or mint
is authorized or performed by this package.

References: [TON Sandbox](https://github.com/ton-blockchain/sandbox),
[FunC JS compiler](https://github.com/ton-community/func-js),
[TON testing guide](https://docs.ton.org/v3/guidelines/smart-contracts/testing/writing-test-examples/).
