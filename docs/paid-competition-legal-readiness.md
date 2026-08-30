# Paid competition legal-readiness memo

**Prepared:** 30 August 2026

**Status:** Product and counsel checklist; not legal advice or a legal opinion.

## Executive conclusion

Documentation cannot, by itself, exclude TonPlaygram from gambling regulation. Regulators and courts classify the product that is actually offered—not the label used for it. The current model has three features commonly examined together: players provide an entry (called a stake), the combined entries fund a winner's prize, and TonPlaygram keeps a percentage. Skill and the absence of a house-selected winner are helpful facts in some places, but they do not create a worldwide exemption.

Accordingly, TonPlaygram should describe its intended role accurately as a gaming, matchmaking, hosting, and settlement provider, but should **not** publish an unconditional statement that it “is not gambling.” Paid play must remain disabled per game and per location until local counsel has classified the exact format and confirmed licensing, consumer, tax, AML/KYC, sanctions, payments, advertising, and app-distribution requirements.

## Why a single global disclaimer is insufficient

The legal tests differ by country and, in the United States, often by state. They commonly examine some combination of:

1. **Consideration:** whether a player gives money or something of value to participate.
2. **Prize:** whether money or something of value can be won.
3. **Chance:** whether chance is present and how material or dominant it is under the local test.
4. **Stake-funded prize:** some regimes distinguish a genuine prize competition from a pool made from participants' payments.
5. **Value and convertibility:** a token described as “in-service” may still be treated as value if it can be purchased, transferred, traded, redeemed, withdrawn, or reliably exchanged.
6. **Operator conduct:** custody, settlement, a percentage fee, marketing, game control, and dispute authority may affect classification and licensing obligations.

The United Kingdom illustrates the nuance. Section 6 of the Gambling Act 2005 defines “gaming” as playing a game of chance for a prize and expressly says a game combining chance and skill can be a game of chance. Section 14 excludes a prize competition from betting only when success depends on skill, judgment, or knowledge and the statutory test is genuinely met. These provisions do not establish a general “player versus player” or “we only charge the winner” exemption.

United States federal law is also not a complete safe harbour. The UIGEA definitions exclude certain participation in fantasy or simulation contests and certain games where participants do not stake value, but the statute does not change other federal or state gambling law. Each state and each exact competition therefore needs separate analysis.

App stores are an additional, independent gate. Apple and Google impose restrictions on real-money gaming, contests, and apps that facilitate wagering, including licensing and location controls in permitted cases. Passing a legal test does not automatically satisfy distribution policy.

## Required operating controls before paid launch

### 1. Classify every format, not only every game title

Maintain a signed legal matrix for each combination of game rules, entry asset, prize, fee, player count, location, age, platform, and payment/withdrawal method. A free AI mode, a two-player skill mode, and a tournament version are separate products for this purpose.

Card, dice, random-reward, loot, shuffled-deck, random-spawn, or materially chance-influenced formats must default to free-only unless counsel approves the exact paid format or the required gambling licence is held. Do not rely on a generic statement that the platform has no winner-selection algorithm: randomness inside the game is a separate issue.

### 2. Gate eligibility on the server

- Verify age to the locally required standard before entry.
- Determine and retain defensible location evidence; block VPN/proxy and location-control evasion where required.
- Apply jurisdiction rules to entry, matchmaking, gameplay, and settlement—not only the user interface.
- Prevent paid opponents in incompatible or unapproved jurisdictions from being matched.
- Apply sanctions, AML/KYC, source-of-funds, transaction monitoring, limits, self-exclusion, and reporting controls where counsel says they apply.
- Keep paid functionality off by default when location or eligibility cannot be established.

### 3. Prove fair player-versus-player operation

- Never seat an AI agent, house account, employee, or undisclosed bot in a paid human competition.
- Match only on documented neutral criteria; never handicap, seed, or select a player to produce a preferred winner.
- Version and retain rules, server code/configuration, match state, inputs/moves, random seeds where any approved randomness exists, connection events, integrity flags, and settlement records.
- Use the same authoritative rules and functional conditions for all competitors.
- Independently test game engines, anti-cheat controls, result validation, and fee calculations.
- Publish clear cancellation, disconnect, draw, void, refund, cheating, and appeal rules, including review times and contact details.

### 4. Obtain informed confirmation before every entry

The final confirmation screen should show, in plain language:

- human opponents and competition format;
- each player's entry and its fiat-equivalent value, if any;
- combined entries, exact prize, and exact fee (amount and percentage);
- who pays the fee and when it is taken;
- material skill and chance mechanics;
- win, tie, disconnect, cancellation, refund, and dispute rules;
- token purchase, transfer, redemption, withdrawal, volatility, network-fee, and irreversibility terms;
- age/location eligibility and a link to the Competition & Fair Play Policy;
- an unchecked confirmation recorded with the rules version.

“Winner takes the pot” must never appear without the fee on the same screen. Marketing must not promise easy money, guaranteed returns, recovery of losses, or investment appreciation.

### 5. Separate the service fee from legal conclusions

TonPlaygram may explain that the standard 10% fee funds operation, security, support, and ecosystem maintenance. It should not claim that charging only the winner, or calling the charge a service/developer fee, makes the activity non-gambling. Counsel should also review whether deducting the fee from combined entries is accurately described as a fee “from the winner.”

### 6. Complete entity and consumer disclosures

Before paid launch, the Terms and confirmation flow need the operator's full legal name, registration number, registered and contact addresses, governing law and venue, complaint/escalation process, licence details where applicable, tax treatment, payment/custody providers, responsible-play tools, and locally required cancellation and consumer notices. These facts cannot be completed from the repository and must not be invented.

## Launch decision record

No paid format should be enabled until the owner records all of the following:

- [ ] Exact rules and economic flow documented end to end.
- [ ] Written opinion from qualified counsel in every permitted player location.
- [ ] Required gaming, payments, custody, money-transmission, AML, tax, and consumer approvals obtained.
- [ ] Apple/Google/Telegram and payment-provider acceptance confirmed for the channel.
- [ ] Server-side age, identity, location, sanctions, and product gates tested.
- [ ] Independent fairness, security, anti-cheat, and settlement audit passed.
- [ ] Operator identity, licence, fee, prize, refund, dispute, privacy, and responsible-play disclosures published.
- [ ] Monitoring, incident response, record retention, complaints, self-exclusion, and regulatory reporting are staffed.

## Primary sources reviewed

- UK Gambling Act 2005, [section 6 (gaming and games of chance)](https://www.legislation.gov.uk/ukpga/2005/19/section/6) and [section 14 (prize competitions)](https://www.legislation.gov.uk/ukpga/2005/19/section/14).
- United States Code, [31 U.S.C. § 5362 (UIGEA definitions and rule of construction)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title31-section5362).
- Apple, [App Review Guidelines § 5.3, Gaming, Gambling, and Lotteries](https://developer.apple.com/app-store/review/guidelines/#gaming-gambling-and-lotteries).
- Google Play, [Real-Money Gambling, Games, and Contests policy](https://support.google.com/googleplay/android-developer/answer/9877032).

These sources are starting points, not a jurisdictional opinion. The legal matrix must be refreshed whenever laws, platform rules, token functionality, fees, prizes, game mechanics, or served locations change.
