import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, Check, Download, Gamepad2, Globe2, Languages, Layers3, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import gamesCatalog from '../config/gamesCatalog.js';
import { achievements, gameDetails, roadmap, tokenomics } from '../config/ecosystemContent.js';

const pillars = [
  ['Play', 'Choose quick casual sessions, strategic classics, cards or realistic cue sports. Play with AI, friends or matched opponents.'],
  ['Connect', 'A single player profile brings together community, messaging, groups, invitations and account connections.'],
  ['Earn', 'Transparent reward loops include games, daily activity, mining, referrals and community tasks.'],
  ['Own', 'Wallet and inventory records let players track TPG, items, rewards and transfers in one place.']
];

const languages = {
  en: { name: 'English', edition: 'The complete introduction · 2026 edition', title: 'TonPlaygram,', accent: 'fully explained.', intro: 'A social gaming ecosystem where competition, community, rewards and digital ownership work through one mobile-first player identity.', download: 'Download English PDF', hint: 'Your phone opens a print preview. Select “Save as PDF”.' },
  es: { name: 'Español', edition: 'Introducción completa · Edición 2026', title: 'TonPlaygram,', accent: 'explicado al completo.', intro: 'Un ecosistema de juegos sociales donde la competición, la comunidad, las recompensas y la propiedad digital se unen en una identidad móvil.', download: 'Descargar PDF en español', hint: 'Tu teléfono abrirá la vista de impresión. Elige «Guardar como PDF».' },
  fr: { name: 'Français', edition: 'Présentation complète · Édition 2026', title: 'TonPlaygram,', accent: 'expliqué en détail.', intro: 'Un écosystème de jeu social où compétition, communauté, récompenses et propriété numérique s’unissent dans une identité mobile.', download: 'Télécharger le PDF français', hint: 'Votre téléphone ouvre l’aperçu avant impression. Choisissez « Enregistrer en PDF ».' },
  de: { name: 'Deutsch', edition: 'Vollständige Einführung · Ausgabe 2026', title: 'TonPlaygram,', accent: 'vollständig erklärt.', intro: 'Ein Social-Gaming-Ökosystem, das Wettbewerb, Community, Belohnungen und digitales Eigentum in einer mobilen Identität vereint.', download: 'Deutsches PDF herunterladen', hint: 'Dein Smartphone öffnet die Druckvorschau. Wähle „Als PDF speichern“.' },
  pt: { name: 'Português', edition: 'Introdução completa · Edição 2026', title: 'TonPlaygram,', accent: 'explicado por completo.', intro: 'Um ecossistema de jogos sociais que reúne competição, comunidade, recompensas e propriedade digital numa identidade móvel.', download: 'Baixar PDF em português', hint: 'O celular abrirá a pré-visualização. Selecione “Salvar como PDF”.' },
  ar: { name: 'العربية', edition: 'الدليل الكامل · إصدار 2026', title: 'TonPlaygram،', accent: 'الشرح الكامل.', intro: 'منظومة ألعاب اجتماعية تجمع المنافسة والمجتمع والمكافآت والملكية الرقمية في هوية واحدة مصممة للهاتف.', download: 'تنزيل ملف PDF بالعربية', hint: 'ستفتح معاينة الطباعة على هاتفك. اختر «حفظ كملف PDF».' },
  hi: { name: 'हिन्दी', edition: 'संपूर्ण परिचय · 2026 संस्करण', title: 'TonPlaygram,', accent: 'पूरी जानकारी।', intro: 'एक सोशल गेमिंग इकोसिस्टम जहाँ प्रतिस्पर्धा, समुदाय, रिवॉर्ड और डिजिटल स्वामित्व एक मोबाइल पहचान में जुड़ते हैं।', download: 'हिन्दी PDF डाउनलोड करें', hint: 'फ़ोन में प्रिंट प्रीव्यू खुलेगा। “Save as PDF” चुनें।' },
  zh: { name: '中文', edition: '完整介绍 · 2026 版', title: 'TonPlaygram，', accent: '完整解析。', intro: '一个以移动玩家身份为核心，融合竞技、社区、奖励和数字所有权的社交游戏平台。', download: '下载中文 PDF', hint: '手机将打开打印预览，请选择“另存为 PDF”。' }
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

  return (
    <article className="ecosystem-guide -mx-1 space-y-5 pb-8 text-slate-200" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="ecosystem-hero relative overflow-hidden rounded-[1.75rem] border border-[#d7b96e]/25 bg-[#09101a] px-5 pb-7 pt-5">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#d7b96e]/10 blur-3xl" />
        <div className="relative">
          <Link to="/" className="print-hidden inline-flex items-center gap-1.5 text-xs text-slate-400 no-underline"><ArrowLeft size={15} /> Home</Link>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.25em] text-[#d7b96e]">{copy.edition}</p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] text-white">{copy.title}<br /><span className="text-[#ddc47f]">{copy.accent}</span></h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">{copy.intro}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <HeroStat value={gamesCatalog.length} label="Games" />
            <HeroStat value={achievements.length} label="Systems" />
            <HeroStat value="24/7" label="Access" />
          </div>
          <div className="print-hidden mt-5 rounded-2xl border border-white/10 bg-black/20 p-3">
            <label htmlFor="guide-language" className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400"><Languages size={14} /> PDF language</label>
            <select id="guide-language" value={language} onChange={(event) => setLanguage(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#111925] px-3 py-3 text-sm font-semibold text-white outline-none">
              {Object.entries(languages).map(([code, item]) => <option key={code} value={code}>{item.name}</option>)}
            </select>
            <button type="button" onClick={downloadPdf} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d7b96e] px-4 py-3 text-sm font-bold text-[#10141b]"><Download size={17} /> {copy.download}</button>
          </div>
          <p className="print-hidden mt-2 text-center text-[10px] text-slate-500">{copy.hint}</p>
        </div>
      </header>

      <nav className="print-hidden flex gap-2 overflow-x-auto pb-1 text-xs [scrollbar-width:none]">
        {['vision', 'platform', 'games', 'achievements', 'roadmap', 'tokenomics', 'principles'].map((id) => <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 capitalize text-slate-300 no-underline">{id}</a>)}
      </nav>

      <GuideSection id="vision" eyebrow="01 · Purpose" title="Why TonPlaygram exists" icon={Globe2}>
        <p>Most online games separate the match from the people and value around it. TonPlaygram’s goal is to make them one understandable journey: discover a game, learn quickly, compete, meet players, earn visible rewards, personalize your experience and return with progress intact.</p>
        <p>We are building for a global, mobile-first community. That means fast onboarding, portrait-friendly controls and clear information before complex crypto mechanics. Blockchain is infrastructure—not a barrier—and no player should need to understand a wallet before enjoying a game.</p>
        <Callout title="Our north star">Create a fair digital playground where skill and participation are recognized, ownership is understandable, and every system can be inspected instead of merely promised.</Callout>
      </GuideSection>

      <GuideSection id="platform" eyebrow="02 · Core loop" title="How the ecosystem works" icon={Layers3}>
        <div className="grid gap-3">{pillars.map(([title, text], index) => <InfoCard key={title} number={index + 1} title={title} text={text} />)}</div>
        <h3>Everything around the match</h3>
        <BulletList items={['One profile for account connections, progress, balances and identity', 'Public or private matchmaking, AI practice and competitive events', 'Friends, messages, groups, voice/video foundations and Telegram notifications', 'Daily engagement, referrals, rewarded actions and transparent reward history', 'A marketplace for game equipment, visual customization, themes, gifts and collectibles', 'Public activity ledgers plus security, moderation and fair-play controls']} />
      </GuideSection>

      <GuideSection id="games" eyebrow="03 · Game universe" title="Games, modes and possibilities" icon={Gamepad2}>
        <p>The catalogue mixes familiar board, card, arcade and cue-sport rules so players can enter quickly while still finding long-term mastery. Availability can evolve while the prototype is tested.</p>
        <div className="grid gap-3">{gameDetails.map(([title, text]) => <div key={title} className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4"><h3 className="!mt-0 !text-sm">{title}</h3><p className="!mt-1 text-[11px] !leading-5">{text}</p></div>)}</div>
        <Callout title="A shared game journey">Fast onboarding → practice or lobby → fair match → verified result → reward and progression → social rematch. Each title adapts this loop to its own rules.</Callout>
      </GuideSection>

      <GuideSection id="achievements" eyebrow="04 · Delivered" title="Achievements so far" icon={Sparkles}>
        <p>These are product foundations already represented in the working prototype—not a list of future promises.</p>
        {achievements.map((item) => <DetailBlock key={item.title} title={item.title} summary={item.summary} items={item.details} />)}
        <PageLink to="/achievements">Open the dedicated achievements page</PageLink>
      </GuideSection>

      <GuideSection id="roadmap" eyebrow="05 · Direction" title="Roadmap to a durable platform" icon={Target}>
        <p>Percentages describe delivery progress, not dates or guarantees. Quality, compliance and player safety can change sequencing.</p>
        {roadmap.map((item) => <RoadmapItem key={item.title} item={item} />)}
        <PageLink to="/roadmap">Open the dedicated roadmap page</PageLink>
      </GuideSection>

      <GuideSection id="tokenomics" eyebrow="06 · Value flow" title="TPG and platform economics" icon={BarChart3}>
        <p>TPG is designed as an ecosystem utility: a common unit for eligible rewards, game participation, transfers and selected digital items. Exact utilities remain subject to product, legal and technical readiness.</p>
        <FeeChart />
        <div className="grid gap-3">{tokenomics.map((item) => <div key={item.title} className="flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4"><strong className="w-12 shrink-0 font-mono text-xl text-[#d7b96e]">{item.value}</strong><div><h3 className="!mt-0 !text-sm">{item.title}</h3><p className="!mt-1 text-[11px] !leading-5">{item.text}</p></div></div>)}</div>
        <Callout title="Important distinction">The 4% + 3% + 2% + 1% lines explain allocation of the 10% platform fee. They are not percentages of total token supply and do not promise investment returns or future price.</Callout>
        <PageLink to="/tokenomics">Open the dedicated tokenomics page</PageLink>
      </GuideSection>

      <GuideSection id="principles" eyebrow="07 · Trust" title="How we intend to build" icon={ShieldCheck}>
        <BulletList items={['Fair rules and authoritative match outcomes', 'Security and privacy proportionate to every feature', 'Visible fees, reward records and honest delivery status', 'Responsible token rollout after compliance review', 'Mobile performance and accessibility before visual excess', 'Community feedback without sacrificing player safety']} />
        <p>TonPlaygram is currently a founder-built prototype developed with AI tools and no external funding. The next stage is not simply more features: it is professional validation, a dedicated team, stronger infrastructure and accountable operations.</p>
        <div className="rounded-2xl bg-[#d7b96e] p-5 text-[#111720]"><Users size={22} /><h3 className="!mt-3 !text-[#111720]">The goal is bigger than one game.</h3><p className="!mt-2 !text-[#27303b]">It is a living network of games and people where every session strengthens a recognizable, connected community.</p></div>
      </GuideSection>
    </article>
  );
}

function FeeChart() { const rows = [['Player-side value', 90, '#334155'], ['Rewards', 4, '#e0c16d'], ['Treasury', 3, '#7198ff'], ['Product', 2, '#aa7cff'], ['Growth', 1, '#5dd6ad']]; return <div className="rounded-2xl border border-white/10 bg-[#080d14] p-4"><div className="flex items-center gap-4"><div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: 'conic-gradient(#334155 0 90%, #e0c16d 90% 94%, #7198ff 94% 97%, #aa7cff 97% 99%, #5dd6ad 99%)' }}><div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-[#0b111b]"><strong className="font-serif text-xl text-white">10%</strong><span className="text-[8px] uppercase tracking-widest text-slate-500">platform fee</span></div></div><div className="flex-1 space-y-2">{rows.map(([label, value, color]) => <div key={label} className="flex items-center gap-2 text-[9px]"><i className="h-2 w-2 rounded-full" style={{ background: color }} /><span className="flex-1 text-slate-400">{label}</span><strong className="font-mono text-white">{value}%</strong></div>)}</div></div><p className="mt-3 border-t border-white/10 pt-3 text-[9px] leading-4 text-slate-500">Illustrative allocation of a paid match. Percentages are not token supply allocations.</p></div>; }

function HeroStat({ value, label }) { return <div className="rounded-xl border border-white/10 bg-white/[0.04] py-3 text-center"><strong className="font-serif text-xl text-white">{value}</strong><span className="block text-[8px] uppercase tracking-[0.16em] text-slate-500">{label}</span></div>; }
function GuideSection({ id, eyebrow, title, icon: Icon, children }) { return <section id={id} className="ecosystem-section scroll-mt-5 rounded-[1.5rem] border border-white/10 bg-[#0b111b] p-5"><div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.23em] text-[#d7b96e]"><Icon size={14} />{eyebrow}</div><h2 className="mt-2 font-serif text-2xl leading-tight text-white">{title}</h2><div className="ecosystem-copy mt-4 space-y-4 text-xs leading-6 text-slate-400">{children}</div></section>; }
function InfoCard({ number, title, text }) { return <div className="flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d7b96e]/15 font-mono text-[10px] text-[#d7b96e]">0{number}</span><div><h3 className="!mt-0 !text-sm">{title}</h3><p className="!mt-1 text-[11px] !leading-5">{text}</p></div></div>; }
function BulletList({ items }) { return <ul className="space-y-2">{items.map((item) => <li key={item} className="flex gap-2"><Check size={14} className="mt-1 shrink-0 text-emerald-400" /><span>{item}</span></li>)}</ul>; }
function Callout({ title, children }) { return <div className="rounded-xl border border-[#d7b96e]/20 bg-[#d7b96e]/[0.07] p-4"><strong className="text-xs text-[#e2ca89]">{title}</strong><p className="!mt-1 text-[11px] !leading-5">{children}</p></div>; }
function DetailBlock({ title, summary, items }) { return <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4"><h3 className="!mt-0 !text-sm">{title}</h3><p className="!mt-1 text-[11px] !leading-5">{summary}</p><div className="mt-3"><BulletList items={items} /></div></div>; }
function RoadmapItem({ item }) { return <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4"><div className="flex items-start justify-between gap-2"><div><span className="text-[9px] font-bold uppercase tracking-widest text-[#d7b96e]">{item.phase}</span><h3 className="!mt-1 !text-sm">{item.title}</h3></div><strong className="font-mono text-sm text-white">{item.progress}%</strong></div><div className="my-3 h-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-[#d7b96e]" style={{ width: `${item.progress}%` }} /></div><p className="text-[11px] !leading-5">{item.goal}</p><div className="mt-3"><BulletList items={item.deliverables} /></div></div>; }
function PageLink({ to, children }) { return <Link to={to} className="print-hidden block rounded-xl border border-[#d7b96e]/25 py-3 text-center text-xs font-bold text-[#d7b96e] no-underline">{children}</Link>; }
