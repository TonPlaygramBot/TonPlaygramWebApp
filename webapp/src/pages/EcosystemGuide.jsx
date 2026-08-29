import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BarChart3, Check, ChevronRight, CircleDollarSign, Coins,
  Download, Gamepad2, Globe2, Languages, Layers3, MessageCircle, Rocket, ShieldCheck,
  Sparkles, Target, Trophy, Users, WalletCards, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import gamesCatalog from '../config/gamesCatalog.js';
import { achievements, gameDetails, roadmap, tokenomics } from '../config/ecosystemContent.js';

const pillars = [
  { title: 'Play', icon: Gamepad2, color: '#63d7ff', text: 'Choose a game, learn in seconds and enter practice, private or matched play.' },
  { title: 'Connect', icon: Users, color: '#a58bff', text: 'Turn every match into friendships, messages, groups, invitations and rematches.' },
  { title: 'Progress', icon: Trophy, color: '#f1cf70', text: 'Build a visible history through skill, streaks, leaderboards and achievements.' },
  { title: 'Own', icon: WalletCards, color: '#55deb0', text: 'Keep rewards, balances, equipment and collectibles attached to one identity.' }
];

const languages = {
  en: { name: 'English', edition: 'The complete introduction · 2026 edition', title: 'TonPlaygram,', accent: 'fully explained.', intro: 'One player identity. An entire connected world of competition, community, rewards and digital ownership—designed for the phone in your hand.', download: 'Download English PDF', hint: 'Your phone opens a print preview. Select “Save as PDF”.' },
  es: { name: 'Español', edition: 'Introducción completa · Edición 2026', title: 'TonPlaygram,', accent: 'explicado al completo.', intro: 'Una identidad de jugador. Todo un mundo conectado de competición, comunidad, recompensas y propiedad digital, diseñado para tu móvil.', download: 'Descargar PDF en español', hint: 'Tu teléfono abrirá la vista de impresión. Elige «Guardar como PDF».' },
  fr: { name: 'Français', edition: 'Présentation complète · Édition 2026', title: 'TonPlaygram,', accent: 'expliqué en détail.', intro: 'Une identité de joueur. Tout un univers connecté de compétition, communauté, récompenses et propriété numérique, pensé pour votre mobile.', download: 'Télécharger le PDF français', hint: 'Votre téléphone ouvre l’aperçu avant impression. Choisissez « Enregistrer en PDF ».' },
  de: { name: 'Deutsch', edition: 'Vollständige Einführung · Ausgabe 2026', title: 'TonPlaygram,', accent: 'vollständig erklärt.', intro: 'Eine Spieleridentität. Eine vernetzte Welt aus Wettbewerb, Community, Belohnungen und digitalem Eigentum – für dein Smartphone.', download: 'Deutsches PDF herunterladen', hint: 'Dein Smartphone öffnet die Druckvorschau. Wähle „Als PDF speichern“.' },
  pt: { name: 'Português', edition: 'Introdução completa · Edição 2026', title: 'TonPlaygram,', accent: 'explicado por completo.', intro: 'Uma identidade de jogador. Um mundo conectado de competição, comunidade, recompensas e propriedade digital, criado para o seu celular.', download: 'Baixar PDF em português', hint: 'O celular abrirá a pré-visualização. Selecione “Salvar como PDF”.' },
  ar: { name: 'العربية', edition: 'الدليل الكامل · إصدار 2026', title: 'TonPlaygram،', accent: 'الشرح الكامل.', intro: 'هوية لاعب واحدة وعالم متصل من المنافسة والمجتمع والمكافآت والملكية الرقمية، مصمم للهاتف.', download: 'تنزيل ملف PDF بالعربية', hint: 'ستفتح معاينة الطباعة على هاتفك. اختر «حفظ كملف PDF».' },
  hi: { name: 'हिन्दी', edition: 'संपूर्ण परिचय · 2026 संस्करण', title: 'TonPlaygram,', accent: 'पूरी जानकारी।', intro: 'एक खिलाड़ी पहचान। प्रतिस्पर्धा, समुदाय, रिवॉर्ड और डिजिटल स्वामित्व की पूरी जुड़ी हुई दुनिया—आपके फ़ोन के लिए।', download: 'हिन्दी PDF डाउनलोड करें', hint: 'फ़ोन में प्रिंट प्रीव्यू खुलेगा। “Save as PDF” चुनें।' },
  zh: { name: '中文', edition: '完整介绍 · 2026 版', title: 'TonPlaygram，', accent: '完整解析。', intro: '一个玩家身份，连接竞技、社区、奖励与数字所有权的完整世界，专为手机体验打造。', download: '下载中文 PDF', hint: '手机将打开打印预览，请选择“另存为 PDF”。' }
};

export default function EcosystemGuide() {
  const [language, setLanguage] = useState('en');
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, []);
  const copy = languages[language];
  const downloadPdf = () => {
    const previousTitle = document.title;
    document.title = `TonPlaygram_Ecosystem_Guide_2026_${language.toUpperCase()}`;
    window.print();
    window.setTimeout(() => { document.title = previousTitle; }, 500);
  };

  return <article className="ecosystem-guide -mx-1 pb-10 text-slate-200" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <header className="ecosystem-hero">
      <div className="guide-orbit guide-orbit-one" /><div className="guide-orbit guide-orbit-two" />
      <div className="guide-hero-top">
        <Link to="/" className="guide-back print-hidden"><ArrowLeft size={15} /> Home</Link>
        <span className="guide-live"><i /> PRODUCT VISION</span>
      </div>
      <div className="guide-hero-copy">
        <p className="guide-kicker">{copy.edition}</p>
        <h1>{copy.title}<br /><span>{copy.accent}</span></h1>
        <p className="guide-lead">{copy.intro}</p>
      </div>
      <PlayerUniverse />
      <div className="guide-stat-grid">
        <HeroStat value={gamesCatalog.length} label="playable worlds" icon={Gamepad2} />
        <HeroStat value={achievements.length} label="core systems" icon={Layers3} />
        <HeroStat value="1" label="connected identity" icon={Users} />
      </div>
      <div className="guide-language print-hidden">
        <label htmlFor="guide-language"><Languages size={14} /> Read & export</label>
        <div><select id="guide-language" value={language} onChange={(event) => setLanguage(event.target.value)}>{Object.entries(languages).map(([code, item]) => <option key={code} value={code}>{item.name}</option>)}</select><button type="button" onClick={downloadPdf}><Download size={16} /> PDF</button></div>
        <small>{copy.hint}</small>
      </div>
    </header>

    <nav className="guide-nav print-hidden">{[['vision','Vision'],['platform','Loop'],['games','Games'],['achievements','Built'],['roadmap','Roadmap'],['tokenomics','Economy'],['principles','Trust']].map(([id,label], i) => <a key={id} href={`#${id}`}><b>{String(i + 1).padStart(2, '0')}</b>{label}</a>)}</nav>

    <GuideSection id="vision" eyebrow="01 · The big idea" title="More than a game library" icon={Globe2} intro="TonPlaygram connects everything that usually ends when a match does.">
      <p>Most online games split play, identity, community and value into separate products. TonPlaygram is designed as one understandable journey: discover a game, learn quickly, compete, meet players, earn visible progress, personalize the experience and return with everything intact.</p>
      <JourneyMap />
      <Callout icon={Target} title="Our north star">A fair digital playground where skill and participation are recognized, ownership is understandable, and real delivery can be inspected instead of merely promised.</Callout>
    </GuideSection>

    <GuideSection id="platform" eyebrow="02 · The product loop" title="One session powers the next" icon={Layers3} intro="Every system has a clear job before, during and after play.">
      <div className="guide-pillar-grid">{pillars.map((item, index) => <PillarCard key={item.title} {...item} index={index} />)}</div>
      <PhoneExplainer />
      <h3>Everything around the match</h3>
      <BulletList items={['One profile for account connections, progress, balances and identity', 'Public or private matchmaking, AI practice and competitive events', 'Friends, messages, groups, voice/video foundations and Telegram notifications', 'Daily engagement, referrals, rewarded actions and transparent reward history', 'A marketplace for equipment, themes, gifts and collectibles', 'Public activity ledgers plus security, moderation and fair-play controls']} />
    </GuideSection>

    <GuideSection id="games" eyebrow="03 · The game universe" title="Familiar rules. Shared progress." icon={Gamepad2} intro="Quick arcade rounds, strategy classics, cards and precision cue sports all live under one profile.">
      <GameGalaxy />
      <div className="guide-game-list">{gameDetails.map(([title, text], index) => <div key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{text}</p></div><ChevronRight size={16} /></div>)}</div>
      <Callout icon={Zap} title="The shared game journey">Fast onboarding → practice or lobby → fair match → verified result → reward and progression → social rematch.</Callout>
    </GuideSection>

    <GuideSection id="achievements" eyebrow="04 · Progress report" title="Built foundations, not promises" icon={Sparkles} intro="A connected prototype already represents the systems needed to prove the larger idea.">
      <AchievementDashboard />
      <div className="guide-detail-grid">{achievements.map((item, index) => <DetailBlock key={item.title} index={index} title={item.title} summary={item.summary} items={item.details} />)}</div>
      <PageLink to="/achievements">Explore every achievement</PageLink>
    </GuideSection>

    <GuideSection id="roadmap" eyebrow="05 · Delivery direction" title="From prototype to platform" icon={Rocket} intro="Progress is shown plainly. Percentages describe delivery—not dates or guarantees.">
      <RoadmapLine />
      <div className="guide-roadmap-list">{roadmap.map((item) => <RoadmapItem key={item.title} item={item} />)}</div>
      <PageLink to="/roadmap">Open the detailed roadmap</PageLink>
    </GuideSection>

    <GuideSection id="tokenomics" eyebrow="06 · Sustainable value flow" title="A transparent platform economy" icon={Coins} intro="TPG is designed as utility for eligible play, rewards, transfers and selected items—not a promise of profit.">
      <FeeChart />
      <div className="guide-economy-grid">{tokenomics.map((item) => <div key={item.title}><strong>{item.value}</strong><span>{item.title}</span><p>{item.text}</p></div>)}</div>
      <Callout icon={CircleDollarSign} title="Read the percentages correctly">The 4% + 3% + 2% + 1% lines explain allocation of the 10% platform fee. They are not token-supply allocations, investment returns or price guarantees.</Callout>
      <PageLink to="/tokenomics">Understand the complete value model</PageLink>
    </GuideSection>

    <GuideSection id="principles" eyebrow="07 · Trust by design" title="How we intend to build" icon={ShieldCheck} intro="Scale only matters when players can trust the experience beneath it.">
      <TrustGrid />
      <p>TonPlaygram is currently a founder-built prototype developed with AI tools and no external funding. The next stage is professional validation, a dedicated team, stronger infrastructure and accountable operations—not simply more features.</p>
      <div className="guide-finale"><div><Users size={24} /><span>THE LONG-TERM VISION</span></div><h3>The goal is bigger than one game.</h3><p>A living network of games and people where every session strengthens a recognizable, connected community.</p><Link to="/"><span>Enter TonPlaygram</span><ArrowRight size={18} /></Link></div>
    </GuideSection>
  </article>;
}

function PlayerUniverse() { return <div className="player-universe" aria-label="One player identity connects play, community, progress and ownership"><div className="universe-ring"><span className="universe-node n1"><Gamepad2 /></span><span className="universe-node n2"><MessageCircle /></span><span className="universe-node n3"><Trophy /></span><span className="universe-node n4"><WalletCards /></span><div className="universe-core"><i>TP</i><strong>ONE PLAYER</strong><small>CONNECTED EVERYWHERE</small></div></div><p><span /> Identity sync active</p></div>; }
function HeroStat({ value, label, icon: Icon }) { return <div className="guide-stat"><Icon size={15} /><strong>{value}</strong><span>{label}</span></div>; }
function GuideSection({ id, eyebrow, title, icon: Icon, intro, children }) { return <section id={id} className="ecosystem-section"><div className="guide-section-head"><span><Icon size={15} />{eyebrow}</span><h2>{title}</h2><p>{intro}</p></div><div className="ecosystem-copy">{children}</div></section>; }
function JourneyMap() { const points = [['01','Discover'],['02','Learn'],['03','Compete'],['04','Connect'],['05','Progress'],['06','Return']]; return <div className="journey-map"><div className="journey-path" />{points.map(([n,label],i) => <div key={label} className={`journey-stop s${i+1}`}><b>{n}</b><span>{label}</span></div>)}<small>ONE CONTINUOUS PLAYER JOURNEY</small></div>; }
function PillarCard({ title, icon: Icon, color, text, index }) { return <div className="guide-pillar" style={{ '--pillar': color }}><span>0{index + 1}</span><Icon /><h3>{title}</h3><p>{text}</p></div>; }
function PhoneExplainer() { return <div className="phone-explainer"><div className="phone-frame"><div className="phone-speaker" /><div className="phone-profile"><span>TP</span><div><small>PLAYER LEVEL</small><strong>Level 24</strong></div><b>2,480 XP</b></div><div className="phone-match"><small>QUICK MATCH</small><strong>Pool Royale</strong><div><i>YOU</i><span>VS</span><i>AK</i></div><button>Ready to play</button></div><div className="phone-tabs"><Gamepad2 /><Trophy /><Users /><WalletCards /></div></div><div className="phone-notes"><span><b>01</b><strong>Mobile first</strong><small>Portrait controls and quick decisions</small></span><span><b>02</b><strong>Instant context</strong><small>Identity, match and value in one view</small></span><span><b>03</b><strong>Progress intact</strong><small>Every result returns to your profile</small></span></div></div>; }
function GameGalaxy() { return <div className="game-galaxy"><div className="galaxy-center"><Gamepad2 /><strong>12+</strong><span>GAME WORLDS</span></div><span className="game-chip g1">CARDS</span><span className="game-chip g2">CUE SPORTS</span><span className="game-chip g3">ARCADE</span><span className="game-chip g4">CLASSICS</span><div className="galaxy-caption"><i /> ONE PROFILE · SHARED REWARDS</div></div>; }
function AchievementDashboard() { const completed = roadmap.filter(i => i.progress >= 70).length; return <div className="achievement-dashboard"><div className="achievement-score"><div><strong>{achievements.length}</strong><span>CONNECTED<br/>FOUNDATIONS</span></div><svg viewBox="0 0 120 64" role="img" aria-label="Platform foundation progress"><path d="M8 55 C26 51,29 40,43 42 S59 23,73 30 S91 12,112 9" fill="none" stroke="#efd175" strokeWidth="3"/><path d="M8 55 C26 51,29 40,43 42 S59 23,73 30 S91 12,112 9 L112 64 L8 64Z" fill="url(#fade)"/><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#efd175" stopOpacity=".35"/><stop offset="1" stopColor="#efd175" stopOpacity="0"/></linearGradient></defs></svg></div><div className="achievement-mini"><span><b>{completed}</b><small>release-ready tracks</small></span><span><b>24/7</b><small>mobile access goal</small></span><span><b>1</b><small>unified ecosystem</small></span></div></div>; }
function DetailBlock({ index, title, summary, items }) { return <div className="guide-detail"><div className="guide-detail-title"><span><Check /></span><small>FOUNDATION {String(index + 1).padStart(2,'0')}</small></div><h3>{title}</h3><p>{summary}</p><BulletList items={items} /></div>; }
function RoadmapLine() { return <div className="roadmap-line"><span className="active"><b>NOW</b><i /></span><span><b>NEXT</b><i /></span><span><b>LATER</b><i /></span></div>; }
function RoadmapItem({ item }) { return <div className="guide-roadmap-item"><div className="roadmap-meta"><span>{item.phase}</span><strong>{item.progress}%</strong></div><h3>{item.title}</h3><p>{item.goal}</p><div className="roadmap-bar"><i style={{ width: `${item.progress}%` }} /></div><BulletList items={item.deliverables} /></div>; }
function FeeChart() { const rows = [['Player-side value',90,'#334155'],['Rewards',4,'#f0cd70'],['Treasury',3,'#68a4ff'],['Product',2,'#a88cff'],['Growth',1,'#54deb0']]; return <div className="fee-chart"><div className="fee-donut"><div><strong>10%</strong><span>PLATFORM<br/>FEE</span></div></div><div className="fee-legend"><p>ILLUSTRATIVE PAID MATCH</p>{rows.map(([label,value,color]) => <div key={label}><i style={{background:color}}/><span>{label}</span><b>{value}%</b></div>)}</div><small>90% follows the displayed match or prize rules. The 10% fee is divided across four platform functions.</small></div>; }
function TrustGrid() { return <div className="trust-grid">{[[ShieldCheck,'Fair outcomes','Authoritative match rules'],[BarChart3,'Visible records','Clear fees and activity'],[WalletCards,'Responsible utility','Compliance before rollout'],[Globe2,'Mobile access','Performance and inclusion']].map(([Icon,title,text]) => <div key={title}><Icon/><strong>{title}</strong><span>{text}</span></div>)}</div>; }
function BulletList({ items }) { return <ul className="guide-bullets">{items.map(item => <li key={item}><Check size={14}/><span>{item}</span></li>)}</ul>; }
function Callout({ icon: Icon, title, children }) { return <div className="guide-callout"><Icon size={19}/><div><strong>{title}</strong><p>{children}</p></div></div>; }
function PageLink({ to, children }) { return <Link to={to} className="guide-page-link print-hidden"><span>{children}</span><ArrowRight size={16}/></Link>; }
