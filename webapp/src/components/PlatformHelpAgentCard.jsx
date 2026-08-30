import { ChevronRight, CircleHelp, Headphones, MessageCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const questions = [
  {
    question: 'What is TonPlayGram?',
    answer:
      'TonPlayGram brings games, rewards, social features, and your TON-connected wallet together in one mobile-first experience.'
  },
  {
    question: 'How do I connect my TON wallet?',
    answer:
      'Tap Connect Wallet on the home or wallet screen, choose your wallet provider, and approve the connection. TonPlayGram never asks for your recovery phrase.'
  },
  {
    question: 'How do rewards and TPG work?',
    answer:
      'Eligible games, tasks, and community activities can award TPG. Available opportunities and their requirements are always shown in the Earn section.'
  },
  {
    question: 'Where can I get account help?',
    answer:
      'For sign-in, profile, wallet, or gameplay questions, contact the official TonPlayGram support channel and include a short description of the issue.'
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
        Quick answers for a smoother TonPlayGram experience.
      </p>

      <div className="home-help__questions">
        {questions.map(({ question, answer }, index) => (
          <details key={question} className="home-help__question">
            <summary>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{question}</strong>
              <ChevronRight size={17} aria-hidden="true" />
            </summary>
            <p>{answer}</p>
          </details>
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
