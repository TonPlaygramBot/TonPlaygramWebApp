import { Link } from 'react-router-dom';

const sections = {
  privacy: {
    title: 'Privacy Policy', updated: 'August 28, 2026',
    items: [
      ['What we collect', 'We process account identifiers, profile details you provide, Telegram or Google account details when you connect them, wallet addresses, game activity, transactions, social interactions, push notification tokens, device/platform information, and security or diagnostic records. We do not ask for a wallet recovery phrase or private key.'],
      ['How we use data', 'We use data to create and secure accounts, operate games and matchmaking, maintain balances and transaction records, deliver messages and notifications, prevent abuse, provide support, and measure service reliability.'],
      ['Service providers', 'Hosting, database, notification, authentication, blockchain, and infrastructure providers process only the information needed to provide their services. Their own policies may also apply when you choose to connect an external service.'],
      ['Public and on-chain data', 'A display name, avatar, game activity, or public transaction details may be visible to other players where the feature clearly indicates this. Blockchain wallet addresses and transactions are public and cannot be erased by TonPlaygram.'],
      ['Retention and deletion', 'Account profile data is retained while your account is active. You can delete your account in the app or use the deletion page. We may retain minimal, anonymized transaction, fraud-prevention, dispute, or legal records when required, but remove direct profile identifiers where possible.'],
      ['Your choices', 'You may disconnect providers, disable notifications in device settings, correct profile information, request a copy of your data, or request account deletion.'],
      ['Children', 'TonPlaygram is not directed to children under 13. Real-value, wallet, or age-restricted features must not be used by anyone below the age required in their country.'],
      ['Contact', 'Privacy and deletion questions can be sent to privacy@tonplaygram.com. Support requests can be sent to support@tonplaygram.com.']
    ]
  },
  terms: {
    title: 'Terms of Service', updated: 'August 30, 2026',
    items: [
      ['Eligibility', 'You must be legally able to use the service in your country. Age-restricted, wallet, token, prize, or competitive features may be unavailable based on age, location, platform, or law.'],
      ['Games and fair play', 'TonPlaygram provides game hosting, matchmaking, rules enforcement, and settlement services. Do not cheat, automate play, exploit defects, harass players, impersonate others, manipulate matchmaking, or interfere with the service. We may suspend access and reverse clearly erroneous in-service entries when reasonably necessary to protect players.'],
      ['TPG and digital items', 'Unless a feature explicitly and lawfully states otherwise, TPG, rewards, and digital items are in-service game features, are not legal tender, do not represent ownership in TonPlaygram, and have no guaranteed cash value. Availability and functionality may change for security, legal, or platform-policy reasons.'],
      ['Wallets and blockchains', 'You control connected external wallets and are responsible for their security. Never share a recovery phrase or private key. Blockchain transactions may be irreversible and network fees or third-party wallet terms may apply.'],
      ['Competitive play', 'Where an approved player-versus-player competition is offered, the match screen must identify the participants, entry amount, rules, prize, and platform fee before confirmation. TonPlaygram does not bet against a player, choose a winner, or use matchmaking to predetermine a result. The players’ play under the published game rules determines the result.'],
      ['Fees and settlement', 'For an approved paid match, player entries are reserved for that match and the disclosed prize is settled under its rules. Unless a match screen states a different lawful amount before entry, the winner receives 90% of the combined entries and TonPlaygram retains 10% as a service fee to operate, secure, support, and improve the ecosystem. A draw, cancellation, disconnect, or dispute follows the refund and settlement rules displayed for that game.'],
      ['Restricted play', 'Calling a product a skill game or service does not determine its legal status. Laws differ by location and may treat entry-funded prizes as regulated gambling even when skill is important. TonPlaygram does not promise that paid, staked, prize, withdrawal, or real-value play is available. Such functionality remains disabled wherever it has not passed legal, store-policy, security, payment, age, and regional approval. Free play remains separate from paid competition.'],
      ['User content', 'Only upload or share content you have the right to use. Do not submit illegal, dangerous, hateful, deceptive, or privacy-invasive content. Content may be removed and abusive users may be blocked.'],
      ['Availability and liability', 'Online services may be interrupted and beta features may change. To the maximum extent allowed by law, the service is provided without a guarantee of uninterrupted availability. Mandatory consumer rights are not limited by these terms.'],
      ['Termination and contact', 'You may stop using the service and delete your account. We may restrict accounts that violate these terms or create security or legal risk. Contact support@tonplaygram.com for assistance.']
    ]
  },
  competition: {
    title: 'Competition & Fair Play Policy', updated: 'August 30, 2026',
    items: [
      ['Our role', 'TonPlaygram is designed as a gaming service provider. We supply the game software, player-to-player matchmaking, technical hosting, rules enforcement, result verification, settlement, security, and support. TonPlaygram is not a player, does not place a competing entry, and does not profit from a player losing beyond the fee disclosed before an approved match.'],
      ['Player-versus-player results', 'Paid competition, where lawfully enabled, is limited to clearly identified human player-versus-player formats approved for that location. No house player or undisclosed bot may enter a paid match. Matchmaking may use neutral criteria such as selected game, format, region, connection quality, skill rating, queue time, and entry tier; it must not select or suggest the winner.'],
      ['No predetermined winner', 'TonPlaygram does not use an algorithm to decide who should win. The game engine applies the same published rules to every participant, and the participants’ actions determine the result. Automated checks may validate moves, enforce turns, detect abuse, reconnect players, and verify the final state; these controls do not award a preferred player the win.'],
      ['Skill and chance disclosure', 'Each competition must disclose its rules and any material random element before entry. A game is not offered as paid competition merely because it is available in free or practice mode. Games involving cards, dice, random rewards, AI opponents, or other material chance remain free-only in a location unless qualified legal counsel confirms the proposed format is lawful and all required licences or approvals are in place.'],
      ['Entries, prize, and fee', 'Before confirmation, the match screen must show each player’s entry, the combined entries, the exact prize, and the TonPlaygram fee. Under the standard model, the winner receives 90% of the combined entries and TonPlaygram retains 10% as the disclosed service fee used to operate and maintain the ecosystem. TonPlaygram does not promise winnings, profit, token value, liquidity, or withdrawal availability.'],
      ['Integrity and disputes', 'Paid competitors must receive the same rules and functional game conditions. We may keep auditable match, move, connection, entry, and settlement records; investigate collusion, bots, exploits, account sharing, and manipulation; pause settlement while a dispute is reviewed; and refund or correct a result under the disclosed rules. Contact support@tonplaygram.com with the match ID to dispute a result.'],
      ['Location and age controls', 'Paid, prize, staked, token, and withdrawal features are unavailable unless TonPlaygram has approved the specific game format, player location, age threshold, distribution channel, and payment method. Users must not evade location or eligibility controls. Free-play access does not mean paid competition is approved.'],
      ['Legal status', 'This policy describes the intended service model; it is not a claim that every competition is legally exempt from gambling regulation. Legal classification depends on the actual game, prize, entry, chance, token value, marketing, and each participant’s location. TonPlaygram will obtain location-specific advice and any required licence before enabling regulated activity.']
    ]
  }
};

export default function LegalPage({ type }) {
  const document = sections[type] || sections.privacy;
  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-24 pt-6 text-text">
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">TonPlaygram</p>
    <h1 className="mt-2 text-3xl font-bold">{document.title}</h1>
    <p className="mt-2 text-sm text-subtext">Last updated: {document.updated}</p>
    <div className="mt-6 space-y-4">{document.items.map(([title, body]) => <section key={title} className="rounded-2xl border border-border bg-surface p-4 shadow-sm"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-subtext">{body}</p></section>)}</div>
    <nav className="mt-6 flex flex-wrap gap-3 text-sm" aria-label="Legal documents">
      {type !== 'privacy' && <Link className="rounded-xl border border-border px-4 py-3" to="/privacy">Privacy Policy</Link>}
      {type !== 'terms' && <Link className="rounded-xl border border-border px-4 py-3" to="/terms">Terms of Service</Link>}
      {type !== 'competition' && <Link className="rounded-xl border border-border px-4 py-3" to="/competition-policy">Competition Policy</Link>}
      <Link className="rounded-xl bg-primary px-4 py-3 font-semibold text-background" to="/delete-account">Delete account</Link>
    </nav>
  </main>;
}
