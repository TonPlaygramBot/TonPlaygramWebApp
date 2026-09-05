import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, BarChart3, CheckCircle2, ChevronDown,
  Coins, Gamepad2, Gift, LockKeyhole, RefreshCw, ShieldCheck, ShoppingBag,
  Sparkles, Trophy, Users, WalletCards, Wrench
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './tokenomics.css';

const feeAllocation = [
  { value: 4, label: 'Player rewards', detail: 'Tournaments, quests and competitive rewards.', color: '#00d8b4', icon: Trophy },
  { value: 3, label: 'Treasury & liquidity', detail: 'Long-term reserves and responsible liquidity planning.', color: '#8b7cff', icon: WalletCards },
  { value: 2, label: 'Product & infrastructure', detail: 'Games, servers, security, support and audits.', color: '#ffb84d', icon: Wrench },
  { value: 1, label: 'Community growth', detail: 'Creators, education and selected partnerships.', color: '#ff6e88', icon: Users }
];

const utility = [
  { icon: Gamepad2, title: 'Play', text: 'Enter eligible competitive modes with terms shown before every match.' },
  { icon: Trophy, title: 'Earn', text: 'Receive eligible quest, tournament and gameplay rewards.' },
  { icon: ShoppingBag, title: 'Use', text: 'Access selected items, cosmetics and platform experiences.' },
  { icon: Gift, title: 'Connect', text: 'Send eligible rewards and participate in community programs.' }
];

const safeguards = [
  ['Capped issuance', 'Any final supply cap and mint authority will be published and independently reviewed before launch.'],
  ['Measured rewards', 'Reward emissions should follow active-player demand instead of uncontrolled distribution.'],
  ['Transparent treasury', 'Material treasury movements and allocation reports should be visible to the community.'],
  ['Long-term alignment', 'Team and partner allocations should use disclosed locks and gradual vesting—not immediate liquidity.']
];

export default function Tokenomics() {
  const [stake, setStake] = useState(100);
  const [openGuard, setOpenGuard] = useState(0);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, []);
  const split = useMemo(() => feeAllocation.map((item) => ({ ...item, amount: stake * item.value / 100 })), [stake]);

  return <article className="token-page">
    <header className="token-hero">
      <div className="token-hero__glow" />
      <Link to="/" className="token-back"><ArrowLeft size={16} /> Back</Link>
      <div className="token-mark"><Coins size={25} /><i><Sparkles size={12} /></i></div>
      <p className="token-kicker">THE TPG ECONOMY</p>
      <h1>Built to power play.<br /><em>Designed to last.</em></h1>
      <p className="token-lede">A clear value loop that rewards players, funds better games and protects the health of the ecosystem.</p>
      <div className="token-hero__chips"><span><ShieldCheck size={13} /> Utility first</span><span><LockKeyhole size={13} /> Controlled supply</span></div>
      <a href="#value-flow" className="token-scroll" aria-label="Explore tokenomics"><ArrowDown size={15} /></a>
    </header>

    <section className="token-section" id="value-flow">
      <div className="token-heading"><span>01</span><div><p>VALUE FLOW</p><h2>One fee. Clear destination.</h2></div></div>
      <p className="token-intro">For a paid match, <strong>90% stays on the player side</strong> and follows the prize rules shown before play. The remaining 10% platform fee sustains the ecosystem.</p>

      <div className="fee-visual">
        <div className="fee-ring"><div><strong>10%</strong><span>platform fee</span></div></div>
        <div className="fee-key"><p><i className="player-dot" /><span><b>90%</b> Player-side value</span></p>{feeAllocation.map(item => <p key={item.label}><i style={{ background: item.color }} /><span><b>{item.value}%</b> {item.label}</span></p>)}</div>
      </div>

      <div className="fee-cards">{feeAllocation.map(({ icon: Icon, ...item }) => <div key={item.label} style={{ '--item': item.color }}><span><Icon size={16} /></span><p><strong>{item.value}% · {item.label}</strong><small>{item.detail}</small></p></div>)}</div>
      <p className="token-note"><ShieldCheck size={15} /><span><b>Important:</b> these percentages describe the platform-fee flow—not token-supply allocation or guaranteed returns.</span></p>
    </section>

    <section className="token-section">
      <div className="token-heading"><span>02</span><div><p>UTILITY LOOP</p><h2>Value moves. Games improve.</h2></div></div>
      <div className="utility-loop">{utility.map(({ icon: Icon, title, text }, index) => <div key={title} className="utility-step"><span><Icon size={19} /></span><div><small>0{index + 1}</small><strong>{title}</strong><p>{text}</p></div>{index < utility.length - 1 && <ArrowDown className="utility-arrow" size={17} />}</div>)}</div>
      <div className="loop-return"><RefreshCw size={17} /><p><strong>A healthier flywheel</strong><span>More useful experiences → stronger engagement → sustainable platform revenue → better games.</span></p></div>
    </section>

    <section className="token-section token-simulator">
      <div className="token-heading"><span>03</span><div><p>FEE EXPLORER</p><h2>See where value goes.</h2></div></div>
      <div className="sim-total"><span>Example match pool</span><strong>{stake.toLocaleString()} TPG</strong></div>
      <input aria-label="Example match pool" type="range" min="10" max="1000" step="10" value={stake} onChange={(event) => setStake(Number(event.target.value))} />
      <div className="sim-labels"><span>10 TPG</span><span>1,000 TPG</span></div>
      <div className="sim-player"><span>Player-side value</span><strong>{(stake * .9).toLocaleString()} TPG</strong></div>
      <div className="sim-grid">{split.map(item => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.amount.toLocaleString()} TPG</strong></div>)}</div>
      <p>Illustrative fee breakdown only. Actual match and prize terms must be displayed before entry.</p>
    </section>

    <section className="token-section">
      <div className="token-heading"><span>04</span><div><p>ECONOMIC GUARDRAILS</p><h2>Growth without shortcuts.</h2></div></div>
      <p className="token-intro">The final launch model should pass legal, security and independent economic review. These principles set the standard.</p>
      <div className="guard-list">{safeguards.map(([title, text], index) => <button key={title} onClick={() => setOpenGuard(openGuard === index ? -1 : index)} aria-expanded={openGuard === index}><span><CheckCircle2 size={17} /></span><div><strong>{title}</strong>{openGuard === index && <p>{text}</p>}</div><ChevronDown className={openGuard === index ? 'open' : ''} size={17} /></button>)}</div>
    </section>

    <section className="token-cta"><BarChart3 size={25} /><p>Explore the complete vision</p><h2>See how every system connects.</h2><Link to="/ecosystem">Open ecosystem guide <ArrowRight size={16} /></Link></section>
  </article>;
}
