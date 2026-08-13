import { useEffect, useState } from 'react';
import { Check, LockKeyhole, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { APP_THEMES, getOwnedThemes, unlockAppTheme } from '../utils/appTheme.js';
import { buyBundle, getAccountBalance } from '../utils/api.js';
import { poolRoyalAccountId } from '../utils/poolRoyalInventory.js';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function HomeThemeStore() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const accountId = poolRoyalAccountId();
  const [owned, setOwned] = useState(getOwnedThemes);
  const [balance, setBalance] = useState(null);
  const [processing, setProcessing] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!accountId || accountId === 'guest') return;
    getAccountBalance(accountId).then((result) => {
      if (Number.isFinite(Number(result?.balance))) setBalance(Number(result.balance));
    });
  }, [accountId]);

  const purchase = async (theme) => {
    if (!accountId || accountId === 'guest') {
      setMessage('Link your TPG account before purchasing a premium theme.');
      return;
    }
    if (balance !== null && balance < theme.price) {
      setMessage(`You need ${theme.price} TPG to unlock ${theme.name}.`);
      return;
    }
    setProcessing(theme.id);
    setMessage('Confirming TPG payment…');
    try {
      const result = await buyBundle(accountId, { items: [{ slug: 'home-themes', type: 'appTheme', optionId: theme.id, price: theme.price }] });
      if (result?.error) throw new Error(result.error);
      setOwned(unlockAppTheme(theme.id));
      setBalance((current) => current === null ? current : Math.max(0, current - theme.price));
      setMessage(`${theme.name} is unlocked and ready to use.`);
    } catch (error) {
      setMessage(error?.message || 'The purchase could not be completed.');
    } finally { setProcessing(''); }
  };

  return (
    <main className="home-theme-store">
      <header className="home-theme-store__header">
        <button type="button" onClick={() => navigate(-1)}>Back</button>
        <Palette size={24} />
        <div><h1>Home Themes</h1><p>Five included · five premium</p></div>
        <strong>{balance === null ? '—' : balance.toFixed(2)} TPG</strong>
      </header>
      {message && <p className="home-theme-store__message" role="status">{message}</p>}
      <section className="home-theme-store__grid">
        {APP_THEMES.map((theme, index) => {
          const isOwned = owned.has(theme.id);
          return (
            <article className="home-theme-card" key={theme.id}>
              <div className="home-theme-card__preview" style={{ '--preview-bg': theme.colors[0], '--preview-accent': theme.colors[1], '--preview-gold': theme.colors[2] }}>
                <span className="home-theme-card__number">{index + 1}</span>
                <div className="home-theme-card__coin">G</div><div className="home-theme-card__title">TonPlayGram</div>
                <div className="home-theme-card__button">Connect Wallet</div><div className="home-theme-card__panel" />
              </div>
              <div className="home-theme-card__details">
                <div><h2>{theme.name}</h2><span>{theme.free ? 'Included free' : `${theme.price} TPG`}</span></div>
                {isOwned ? <span className="home-theme-card__owned"><Check size={14} /> Owned</span> : <button disabled={Boolean(processing)} onClick={() => purchase(theme)}>{processing === theme.id ? 'Buying…' : <><LockKeyhole size={13} /> Buy</>}</button>}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
