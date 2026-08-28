# Mobile store release scope

Last reviewed: 2026-08-28

## First store build policy

The Android and iOS store builds must be treated as a free-play release until
written legal and store-policy approval exists for every enabled territory.
TPG is described as an in-service game feature with no guaranteed cash value.
Real-value deposits, withdrawals, purchases, prizes, and staking must remain
server-disabled in store builds unless counsel and both store policies approve
the exact flow.

This document is an engineering release gate, not legal advice. Approval must
identify the legal entity, territories, minimum age, currency classification,
skill/chance analysis, consumer disclosures, tax treatment, sanctions/AML
obligations, and required licences.

## Required server gates

- `WITHDRAW_ENABLED=false` for the first review build.
- No external purchase or wallet link may unlock digital app functionality.
- Unapproved online Beta games remain disabled in their portrait lobbies and in
  the readiness API.
- Social providers remain `disabled` until real provider credentials, deletion,
  moderation, and privacy review are complete.
- Reviewers receive accurate notes and a test account; functionality must never
  be hidden from review.

## Approval record

Before enabling any real-value feature, attach a dated decision from qualified
counsel and the product owner to the release ticket. Record approved countries,
blocked countries, age limits, feature flags, reviewer disclosure, and rollback
owner. Absence of that record means the feature stays disabled.

## Remaining external gates

Apple/Google accounts, signing identities, Firebase/APNs credentials, domain
association files, closed-track/TestFlight device tests, final screenshots, and
store-console declarations require account owners or external services and
cannot be completed from source code alone.
