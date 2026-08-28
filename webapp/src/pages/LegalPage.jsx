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
    title: 'Terms of Service', updated: 'August 28, 2026',
    items: [
      ['Eligibility', 'You must be legally able to use the service in your country. Age-restricted, wallet, token, prize, or competitive features may be unavailable based on age, location, platform, or law.'],
      ['Games and fair play', 'Do not cheat, automate play, exploit defects, harass players, impersonate others, manipulate matchmaking, or interfere with the service. We may suspend access and reverse clearly erroneous in-service entries when reasonably necessary to protect players.'],
      ['TPG and digital items', 'Unless a feature explicitly and lawfully states otherwise, TPG, rewards, and digital items are in-service game features, are not legal tender, do not represent ownership in TonPlaygram, and have no guaranteed cash value. Availability and functionality may change for security, legal, or platform-policy reasons.'],
      ['Wallets and blockchains', 'You control connected external wallets and are responsible for their security. Never share a recovery phrase or private key. Blockchain transactions may be irreversible and network fees or third-party wallet terms may apply.'],
      ['Restricted play', 'TonPlaygram does not promise that paid, staked, prize, withdrawal, or real-value play is available. Such functionality remains disabled wherever it has not passed legal, store-policy, security, and regional approval.'],
      ['User content', 'Only upload or share content you have the right to use. Do not submit illegal, dangerous, hateful, deceptive, or privacy-invasive content. Content may be removed and abusive users may be blocked.'],
      ['Availability and liability', 'Online services may be interrupted and beta features may change. To the maximum extent allowed by law, the service is provided without a guarantee of uninterrupted availability. Mandatory consumer rights are not limited by these terms.'],
      ['Termination and contact', 'You may stop using the service and delete your account. We may restrict accounts that violate these terms or create security or legal risk. Contact support@tonplaygram.com for assistance.']
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
    <div className="mt-6 flex flex-wrap gap-3 text-sm"><Link className="rounded-xl border border-border px-4 py-3" to={type === 'privacy' ? '/terms' : '/privacy'}>Read {type === 'privacy' ? 'Terms' : 'Privacy Policy'}</Link><Link className="rounded-xl bg-primary px-4 py-3 font-semibold text-background" to="/delete-account">Delete account</Link></div>
  </main>;
}
