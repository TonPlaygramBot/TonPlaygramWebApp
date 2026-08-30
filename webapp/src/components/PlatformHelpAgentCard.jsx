import { ChevronRight, CircleHelp, Clock3, Headphones, MessageCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const questionGroups = [
  {
    title: 'Getting started',
    questions: [
      ['What is TonPlayGram?', 'TonPlayGram is a mobile-first entertainment platform that brings games, social features, community activities, rewards, and optional TON wallet connectivity into one experience.'],
      ['How do I get started?', 'Open TonPlayGram through its official app or Telegram experience, complete your profile, review the available games and tasks, and follow the instructions shown for each feature.'],
      ['Do I need a wallet to use TonPlayGram?', 'No. You can explore many platform features without connecting a wallet. A compatible TON wallet may be required for future on-chain features or eligible withdrawals after launch.'],
      ['Which devices are supported?', 'TonPlayGram is designed primarily for phones in portrait orientation and also works in supported modern desktop browsers. Keep your browser, Telegram, and wallet app updated for the best experience.']
    ]
  },
  {
    title: 'TPG & launch status',
    questions: [
      ['Is TPG live on-chain?', 'No. TonPlayGram and TPG have not been deployed on-chain yet. Token minting and the official on-chain launch are planned for the coming weeks. We will publish verified contract details only through official TonPlayGram channels when deployment is complete.'],
      ['Are my current TPG rewards blockchain tokens?', 'No. Any TPG balance currently shown is an in-platform reward record, not an on-chain token balance. Eligible balances are expected to be handled under the final launch, verification, and distribution rules.'],
      ['When will TPG be minted?', 'The team plans to mint TPG and go live on-chain in the coming weeks. A confirmed date, network details, eligibility rules, and the verified contract address will be announced through official channels.'],
      ['Can I buy, sell, or transfer TPG now?', 'Not through an official on-chain TPG contract. Be cautious of any token, pool, presale, or contract claiming to be official before TonPlayGram publishes verified launch details.'],
      ['Will every in-app point convert to on-chain TPG?', 'Final conversion, eligibility, verification, vesting, and distribution terms will be provided before launch. In-app balances should not be treated as guaranteed cash value or a promise of a specific allocation.']
    ]
  },
  {
    title: 'Games & rewards',
    questions: [
      ['How can I earn rewards?', 'Complete eligible games, tasks, campaigns, referrals, and community activities. Each opportunity shows its requirements, limits, and reward status in the relevant section.'],
      ['Why did I not receive a game reward?', 'Confirm that the match finished successfully, your connection remained active, and the activity was eligible. Allow time for processing, then contact support with the game name, approximate time, and any result or transaction reference shown.'],
      ['How are leaderboards calculated?', 'Leaderboards use eligible recorded results and may apply game-specific scoring, season dates, anti-abuse checks, and tie-breaking rules. Invalid or manipulated activity can be removed.'],
      ['Can rewards or tasks expire?', 'Yes. Campaigns, daily tasks, promotions, and seasonal rewards may have deadlines or claim windows. Always review the displayed terms before participating.'],
      ['What happens if a game disconnects?', 'Reconnect and return to the match as soon as possible. Depending on the game mode and server state, the match may resume, time out, or be recorded under that mode’s rules.']
    ]
  },
  {
    title: 'Wallets & security',
    questions: [
      ['How do I connect my TON wallet?', 'Select Connect Wallet on the home or wallet screen, choose a supported provider, and approve the request inside your wallet. Review every permission and address before confirming.'],
      ['Does TonPlayGram hold my wallet funds?', 'A connected self-custody wallet remains controlled by you and your wallet provider. TonPlayGram will never ask for your seed phrase, recovery phrase, private key, or wallet password.'],
      ['How do I disconnect or change wallets?', 'Open the wallet or account area, disconnect the current wallet, then connect the preferred address. Future reward eligibility may be tied to verification rules, so check launch guidance before changing addresses.'],
      ['How can I identify official TPG information?', 'Use only links published in the app and official TonPlayGram channels. Before the on-chain launch, no third-party contract address should be assumed to represent TPG.'],
      ['What should I do if I suspect a scam?', 'Do not sign the request or share credentials. Disconnect from the suspicious site, review wallet sessions, and report the account or link to official support with screenshots where possible.']
    ]
  },
  {
    title: 'Account, social & support',
    questions: [
      ['How do referrals work?', 'Use your personal referral link from the invite area. Referral credit is subject to eligibility, anti-abuse checks, campaign limits, and the invited user completing any required steps.'],
      ['Can I edit my profile and privacy settings?', 'Open Account to manage the profile and available preferences. Avoid publishing sensitive personal or wallet information in your bio, posts, comments, or messages.'],
      ['What content is not allowed?', 'Spam, scams, impersonation, harassment, illegal content, exploit instructions, and attempts to manipulate games or rewards may be removed and can lead to account restrictions.'],
      ['Why might my account be restricted?', 'Accounts may be limited during security, eligibility, moderation, or anti-abuse reviews. Contact official support for a review and include only non-sensitive information needed to identify the issue.'],
      ['How do I report a bug or payment issue?', 'Contact official support with the affected feature, steps to reproduce, device and app version, approximate time, and relevant reference IDs. Never send your recovery phrase or private key.'],
      ['Where will launch announcements appear?', 'Confirmed minting, contract, claim, and launch information will be posted in the TonPlayGram app and official community channels. Treat direct messages and unverified links as untrusted.']
    ]
  }
];

export default function PlatformHelpAgentCard() {
  return (
    <section className="home-help" aria-labelledby="home-help-title">
      <div className="home-help__glow" aria-hidden="true" />
      <header className="home-help__header">
        <div className="home-help__icon" aria-hidden="true">
          <CircleHelp size={23} />
        </div>
        <div>
          <span>SUPPORT, MADE SIMPLE</span>
          <h2 id="home-help-title">Help Center <em>/ FAQ</em></h2>
        </div>
        <div className="home-help__online"><i />ONLINE</div>
      </header>

      <p className="home-help__intro">
        Clear guidance for accounts, games, rewards, wallets, safety, and the upcoming on-chain launch.
      </p>

      <aside className="home-help__launch" aria-label="Important TPG launch status">
        <div className="home-help__launch-icon" aria-hidden="true"><Clock3 size={18} /></div>
        <div>
          <span>IMPORTANT LAUNCH STATUS</span>
          <strong>TPG is not live on-chain yet</strong>
          <p>Token minting and the official on-chain launch are planned for the coming weeks. Trust only contract details published through official TonPlayGram channels.</p>
        </div>
      </aside>

      <div className="home-help__questions">
        {questionGroups.map((group) => (
          <section className="home-help__group" key={group.title} aria-labelledby={`faq-${group.title.replaceAll(' ', '-')}`}>
            <h3 id={`faq-${group.title.replaceAll(' ', '-')}`}>{group.title}</h3>
            {group.questions.map(([question, answer], index) => (
              <details key={question} className="home-help__question">
                <summary>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{question}</strong>
                  <ChevronRight size={17} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </section>
        ))}
      </div>

      <div className="home-help__trust">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Official guidance · Your recovery phrase stays private</span>
      </div>

      <div className="home-help__actions">
        <a href="https://t.me/TonPlaygram" target="_blank" rel="noopener noreferrer">
          <MessageCircle size={17} aria-hidden="true" />
          Ask the community
        </a>
        <Link to="/account">
          <Headphones size={17} aria-hidden="true" />
          Account support
        </Link>
      </div>
    </section>
  );
}
