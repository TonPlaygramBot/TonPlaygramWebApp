import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, CircleUserRound,
  ClipboardCheck, Clock3, Copy, Download, ExternalLink, EyeOff, FileText, Globe2,
  Home, Info, LayoutDashboard, LockKeyhole, Map, MapPin, Megaphone,
  MessageCircle, Navigation, Plus, Radio, Search, Send, Share2, ShieldCheck, Siren, Smartphone,
  Users, Video, X,
} from 'lucide-react';
import HomeSocialHub from '../../components/HomeSocialHub.jsx';
import MediaWall from './MediaWall';
import { documents, groups, locations, onlineTasks, protests, tasks, updates } from './mock';
import { useFlamingoStore } from './store';
import type { LiveUpdate, Protest, Task } from './types';
import './flamingo.css';

const getStaffRole = () => localStorage.getItem('flamingoRole') || 'ADMIN';
const canManage = () => ['ADMIN', 'COORDINATOR', 'ORGANIZER'].includes(getStaffRole());

const badgeClass = (value: string) => `fr-badge ${['LIVE', 'URGJENTE', 'Lartë'].includes(value) ? 'danger' : value === 'INFO' ? 'muted' : ''}`;

const marchStops = [
  { time: '17:30', name: 'Grumbullimi', place: 'Sheshi Skënderbej', note: 'Pika e informacionit pranë Muzeut Kombëtar' },
  { time: '18:15', name: 'Nisja e marshimit', place: 'Bulevardi Dëshmorët e Kombit', note: 'Korsi e përcaktuar nga koordinatorët' },
  { time: '18:45', name: 'Ndalesa qytetare', place: 'Sheshi Nënë Tereza', note: 'Fjalime dhe leximi i kërkesave' },
  { time: '20:15', name: 'Mbyllja paqësore', place: 'Sheshi Skënderbej', note: 'Kthim përgjatë të njëjtit itinerar' },
];

const digitalActions = [
  { icon: Share2, title: 'Shpërndaj informacionin e verifikuar', text: 'Përdor kartat zyrtare, shto burimin dhe mos posto orare apo rrugë që nuk janë konfirmuar.', action: 'Merr paketën digjitale' },
  { icon: MessageCircle, title: 'Korrigjo dezinformimin', text: 'Raporto postimet e rreme në platformë; përgjigju qetësisht me lidhjen e burimit, pa sulme personale.', action: 'Hap udhëzuesin' },
  { icon: Globe2, title: 'Aktivizo diasporën', text: 'Përkthe njoftimet, kontakto komunitetin tënd dhe dërgo materialet te media e organizata lokale.', action: 'Zgjidh shtetin' },
  { icon: Smartphone, title: 'Vullnetar digjital', text: 'Monitoro një kanal social për 30 minuta dhe dërgo vetëm sinjalizime publike te ekipi i verifikimit.', action: 'Merr një detyrë' },
];

const fieldReports = [
  { area: 'Selenicë + 47 fshatra', title: 'Kundërshtim ndaj humbjes së bashkisë', status: 'PËR T’U VERIFIKUAR', text: 'Raportime mediatike flasin për mobilizim të banorëve kundër bashkimit administrativ. Platforma pret orar dhe organizator të konfirmuar.' },
  { area: 'Peqin', title: 'Kërkesë për ruajtjen e bashkisë', status: 'PËR T’U VERIFIKUAR', text: 'Qytetarë të zonës janë raportuar kundër shkrirjes së bashkisë me Elbasanin. Mos udhëtoni pa njoftim zyrtar.' },
  { area: 'Diaspora', title: 'Koordinim ndërkombëtar', status: 'THIRRJE E HAPUR', text: 'Regjistro qytetin ku jeton për të marrë materialet e verifikuara dhe për të propozuar një pikë kontakti.' },
];

function TopBar({ title, back = false, action }: { title?: string; back?: boolean; action?: ReactNode }) {
  const navigate = useNavigate();
  return <header className="fr-top"><div className="fr-top-inner">
    {back ? <button className="fr-icon" onClick={() => navigate(-1)} aria-label="Kthehu"><ChevronLeft /></button> :
      <Link to="/flamingo" className="fr-brand"><span className="fr-mark">F</span><span>{title || 'Flamingo Revolution'}</span></Link>}
    {back && <strong>{title}</strong>}
    <div className="fr-top-action">{action ?? <Link className="fr-icon" to="/flamingo/live" aria-label="Njoftimet live"><Bell /><i /></Link>}</div>
  </div></header>;
}

function BottomNavigation() {
  const items = [['/flamingo', Home, 'Kreu'], ['/flamingo/protests', Megaphone, 'Protestat'], ['/flamingo/digital', Globe2, 'Online'], ['/flamingo/map', Map, 'Harta'], ['/flamingo/profile', CircleUserRound, 'Profili']] as const;
  return <nav className="fr-nav" aria-label="Navigimi kryesor">{items.map(([to, Icon, label]) => <NavLink key={to} to={to} end={to === '/flamingo'}><Icon /><span>{label}</span></NavLink>)}</nav>;
}

function Shell({ children, title, back = false, noNav = false }: { children: ReactNode; title?: string; back?: boolean; noNav?: boolean }) {
  return <div className="flamingo"><TopBar title={title} back={back} /><main className="fr-main">{children}</main>{!noNav && <BottomNavigation />}<ReportButton /><Toast /></div>;
}

function Toast() {
  const { toast, clearToast } = useFlamingoStore();
  useEffect(() => { if (!toast) return; const timer = setTimeout(clearToast, 2600); return () => clearTimeout(timer); }, [toast, clearToast]);
  return toast ? <div className="fr-toast"><ShieldCheck />{toast}</div> : null;
}
function ReportButton() { return <Link to="/flamingo/report" className="fr-report"><EyeOff />Denonco</Link>; }
function SectionTitle({ children, link }: { children: ReactNode; link?: string }) { return <div className="fr-section-title"><h2>{children}</h2>{link && <Link to={link}>Shiko të gjitha <ChevronRight /></Link>}</div>; }

function Hero() {
  return <section className="fr-new-hero">
    <div className="fr-hero-orbit"><span>FR</span></div>
    <span className="fr-kicker"><i /> QENDRA QYTETARE • LIVE</span>
    <h1>Bashkë, zëri ynë<br /><em>nuk shuhet.</em></h1>
    <p>Informacion i verifikuar, koordinim paqësor dhe një urë për çdo shqiptar—në Shqipëri apo diasporë.</p>
    <div className="fr-hero-actions"><Link className="fr-primary" to="/flamingo/protests">Shiko protestat <ChevronRight /></Link><Link className="fr-glass" to="/flamingo/digital"><Globe2 /> Kontribuo online</Link></div>
    <div className="fr-hero-trust"><ShieldCheck /> Privatësia në plan të parë <span /> Pa lista publike pjesëmarrësish</div>
  </section>;
}

function StatusCard() {
  return <section className="fr-status fr-status-new"><div className="fr-eyebrow"><span>AKTIVITETI KRYESOR</span><span className="fr-live"><i /> LIVE</span></div>
    <h2>Tubim qytetar në Tiranë</h2><div className="fr-place"><MapPin /> Sheshi Skënderbej</div><div className="fr-date"><CalendarDays /> Sot, 7 Gusht • 18:00</div>
    <div className="fr-status-copy"><strong>Itinerari dhe pikat e ndihmës janë publikuar.</strong><p>Kontrollo përditësimin e fundit para se të nisesh.</p><small><Clock3 /> Përditësuar 2 minuta më parë</small></div>
    <div className="fr-actions"><Link className="fr-primary" to="/flamingo/protests/tirana">Detajet & itinerari</Link><Link className="fr-secondary" to="/flamingo/map">Harta</Link></div>
  </section>;
}

function QuickGrid() {
  return <div className="fr-home-grid">
    <Link to="/flamingo/digital"><span className="coral"><Globe2 /></span><strong>Nuk vjen dot?</strong><small>Kontribuo online</small><ChevronRight /></Link>
    <Link to="/flamingo/report"><span><EyeOff /></span><strong>Denonco</strong><small>Edhe anonim</small><ChevronRight /></Link>
    <Link to="/flamingo/research"><span><Radio /></span><strong>Në gjithë vendin</strong><small>Qytete & fshatra</small><ChevronRight /></Link>
    <Link to="/flamingo/media"><span><Video /></span><strong>Media Wall</strong><small>Video të certifikuara</small><ChevronRight /></Link>
  </div>;
}

function UpdateCard({ item }: { item: LiveUpdate }) { return <article className={`fr-update ${item.type === 'URGJENTE' ? 'urgent' : ''}`}><time>{item.time}</time><div><div className="fr-update-meta"><span className={badgeClass(item.type)}>{item.type}</span><span>{item.author}</span></div><p>{item.text}</p></div></article>; }

function HomePage() { return <Shell><Hero /><div className="fr-marquee"><span>FLAMINGO REVOLUTION</span><b>•</b><span>PAQË • DINJITET • BASHKIM</span></div><QuickGrid /><MediaWall compact /><StatusCard /><SectionTitle link="/flamingo/live">Përditësime të verifikuara</SectionTitle><div className="fr-list">{updates.slice(0, 3).map(item => <UpdateCard key={item.id} item={item} />)}</div><section className="fr-safety"><ShieldCheck /><div><strong>Siguria para gjithçkaje</strong><p>Nuk publikojmë vendndodhje individuale. Për emergjenca telefono 112.</p></div></section></Shell>; }

function EventCard({ event }: { event: Protest }) { return <Link to={`/flamingo/protests/${event.id}`} className="fr-card fr-event"><div className="fr-card-top"><span className={badgeClass(event.status)}>{event.status}</span><span className="fr-count"><Users />{event.participants.toLocaleString('sq-AL')}</span></div><h3>{event.title}</h3><p><MapPin />{event.city} • {event.place}</p><p><CalendarDays />{event.date} • {event.time}</p><footer><span>{event.organizer}</span><ChevronRight /></footer></Link>; }
function ProtestsPage() { const [query, setQuery] = useState(''); const shown = protests.filter(p => `${p.city} ${p.title}`.toLowerCase().includes(query.toLowerCase())); return <Shell title="Protestat"><div className="fr-page-intro"><span className="fr-kicker">HARTA E MOBILIZIMIT</span><h1>Çdo zë, në çdo qytet.</h1><p>Oraret publikohen vetëm pasi konfirmohen nga organizatorët.</p></div><div className="fr-search"><Search /><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Kërko protesta" placeholder="Kërko qytetin ose zonën..." /></div><div className="fr-list">{shown.map(event => <EventCard key={event.id} event={event} />)}</div><Link className="fr-wide-link" to="/flamingo/research"><Radio /> Raportimet nga bashkitë, fshatrat & diaspora <ChevronRight /></Link></Shell>; }

function RoutePanel() { return <section className="fr-route-panel"><div className="fr-route-head"><div><span className="fr-kicker">ITINERARI I MARSHIMIT</span><h2>Rruga e konfirmuar</h2></div><span className="fr-verified"><Check /> Verifikuar</span></div><div className="fr-route-map"><div className="fr-route-line" />{marchStops.map((stop, i) => <div className="fr-route-stop" key={stop.name}><b>{i + 1}</b><div><time>{stop.time}</time><strong>{stop.name}</strong><span>{stop.place}</span><small>{stop.note}</small></div></div>)}</div><div className="fr-route-warning"><AlertTriangle /><span>Itinerari mund të ndryshojë. Ndiq vetëm njoftimet “ZYRTARE” dhe udhëzimet e autoriteteve në terren.</span></div></section>; }

function ProtestDetail() {
  const { id } = useParams(); const event = protests.find(x => x.id === id) || protests[0]; const [tab, setTab] = useState('Itinerari'); const { joined, joinProtest } = useFlamingoStore();
  const tabs = ['Itinerari', 'Përmbledhje', 'Programi', 'Njoftime', 'Dokumente'];
  return <Shell title="Detajet e protestës" back><div className="fr-detail-head"><span className={badgeClass(event.status)}>{event.status}</span><h1>{event.title}</h1><p><CalendarDays />{event.date} • {event.time}</p><p><MapPin />{event.place}, {event.city}</p></div><div className="fr-tabs">{tabs.map(tabName => <button className={tab === tabName ? 'active' : ''} onClick={() => setTab(tabName)} key={tabName}>{tabName}</button>)}</div>
    {tab === 'Itinerari' && <RoutePanel />}{tab === 'Përmbledhje' && <div className="fr-stack"><section className="fr-panel"><h2>Rreth tubimit</h2><p>{event.description}</p></section><section className="fr-panel"><h2>Parimet e pjesëmarrjes</h2><ul><li>Paqe, dinjitet dhe respekt për hapësirën publike</li><li>Mos shpërnda identitete pa pëlqim</li><li>Verifiko informacionin para publikimit</li></ul></section></div>}
    {tab === 'Programi' && <div className="fr-panel fr-program">{marchStops.map(x => <p key={x.time}><time>{x.time}</time>{x.name}</p>)}</div>}{tab === 'Njoftime' && updates.map(x => <UpdateCard key={x.id} item={x} />)}{tab === 'Dokumente' && documents.map(x => <DocumentCard key={x.id} doc={x} />)}
    <button className="fr-sticky-cta" disabled={joined.includes(event.id)} onClick={() => joinProtest(event.id)}>{joined.includes(event.id) ? 'Po e ndjek këtë aktivitet ✓' : 'Merr njoftime për këtë protestë'}</button></Shell>;
}

function DigitalPage() { const notify = useFlamingoStore(s => s.notify); const [country, setCountry] = useState(''); const [done, setDone] = useState<string[]>(() => JSON.parse(localStorage.getItem('fr-online-tasks') || '[]')); const complete = (id: string) => { const next = [...new Set([...done, id])]; setDone(next); localStorage.setItem('fr-online-tasks', JSON.stringify(next)); notify('Kontributi u regjistrua. Faleminderit që po ndërton komunitetin!'); }; return <Shell title="Kontribuo online" back><div className="fr-page-intro digital"><span className="fr-kicker"><Globe2 /> PËR SHQIPTARËT KUDO</span><h1>Nuk je në shesh?<br /><em>Je ende pjesë e zërit.</em></h1><p>Zgjidh një detyrë, kryeje në rrjetin përkatës dhe regjistro kontributin. Pa spam dhe pa gjuhë urrejtjeje.</p></div><div className="fr-task-summary"><strong>{done.length}/{onlineTasks.length}</strong><span>detyrat e tua të përfunduara</span><i><em style={{width:`${done.length / onlineTasks.length * 100}%`}} /></i></div><div className="fr-online-list">{onlineTasks.map(task => <article key={task.id}><div className="fr-online-head"><span>{task.network}</span><b>+{task.reward} pikë</b></div><h2>{task.title}</h2><p>{task.description}</p><div className="fr-progress"><i><em style={{width:`${Math.min(100, task.completed / task.goal * 100)}%`}} /></i><small>{task.completed}/{task.goal} kontribues</small></div><div className="fr-online-actions"><a href={task.url} target="_blank" rel="noreferrer">Hap detyrën <ExternalLink /></a><button disabled={done.includes(task.id)} onClick={() => complete(task.id)}>{done.includes(task.id) ? <><Check /> U krye</> : 'Shëno si të kryer'}</button></div></article>)}</div><section className="fr-diaspora"><Globe2 /><div><span className="fr-kicker">RRJETI I DIASPORËS</span><h2>Lidhu me qytetin tënd</h2><p>Merr njoftime në gjuhën dhe zonën tënde.</p></div><label><span>Shteti ku jeton</span><select value={country} onChange={e => setCountry(e.target.value)}><option value="">Zgjidh shtetin</option><option>Itali</option><option>Greqi</option><option>Gjermani</option><option>Mbretëri e Bashkuar</option><option>SHBA</option><option>Tjetër</option></select></label><button disabled={!country} onClick={() => notify(`U regjistrove në rrjetin e diasporës: ${country}.`)}>Bashkohu me rrjetin</button></section></Shell>; }

function MediaPage() { return <Shell title="Media Wall" back><MediaWall /><section className="fr-safety"><ShieldCheck /><div><strong>Standard publikimi</strong><p>Publikohen vetëm video me burim, leje përdorimi dhe pa të dhëna private të personave.</p></div></section></Shell>; }

function TelegramPage() { const notify = useFlamingoStore(s => s.notify); const [message, setMessage] = useState('Përditësimi i verifikuar nga Flamingo Revolution: '); const share = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(location.origin + '/flamingo/live')}&text=${encodeURIComponent(message)}`, '_blank', 'noopener'); return <Shell title="Njoftimet Telegram" back><div className="fr-page-intro digital"><span className="fr-kicker"><Send /> TELEGRAM CENTER</span><h1>Informacioni, direkt te komuniteti.</h1><p>Merr tekst, video dhe dokumente të verifikuara në Telegram. Asnjë numër telefoni nuk shfaqet publikisht.</p></div><a className="fr-telegram-connect" href="https://t.me/TonPlaygramBot?start=flamingo_notifications" target="_blank" rel="noreferrer"><Send /><span><strong>Aktivizo njoftimet te boti</strong><small>Tekst • video • dokumente • njoftime urgjente</small></span><ChevronRight /></a><section className="fr-compose-card"><h2>Shpërndaj një njoftim</h2><textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} /><div><small>{message.length}/500</small><button onClick={share}><Send /> Dërgo në Telegram</button></div></section><div className="fr-telegram-files">{documents.map(doc => <article key={doc.id}><FileText /><div><strong>{doc.title}</strong><small>{doc.category} • {doc.date}</small></div><button onClick={() => { navigator.clipboard.writeText(`${doc.title} — ${location.origin}/flamingo/documents`); notify('Lidhja e dokumentit u kopjua.'); }} aria-label="Kopjo lidhjen"><Copy /></button></article>)}</div></Shell>; }

function CallsPage() { return <Shell title="Thirrje të certifikuara" back><div className="fr-cert-call"><ShieldCheck /><div><span>ANËTAR I CERTIFIKUAR</span><h1>Krijo një dhomë video për ekipin.</h1><p>Emërto dhomën dhe dërgoju bashkëpunëtorëve të njëjtin emër. Kamera dhe mikrofoni aktivizohen vetëm pasi shtyp “Join room”.</p></div></div><HomeSocialHub /></Shell>; }

function ResearchPage() { return <Shell title="Në gjithë Shqipërinë" back><div className="fr-page-intro"><span className="fr-kicker"><Radio /> MONITORIM QYTETAR</span><h1>Bashki, qytete, fshatra & diasporë</h1><p>Një tablo e raportimeve publike. “Për t’u verifikuar” nuk është thirrje për pjesëmarrje.</p></div><div className="fr-source-note"><Info /><p><strong>Standardi ynë:</strong> çdo orar, vend dhe organizator kërkon konfirmim të drejtpërdrejtë. Raportimet mediatike paraqiten veçmas.</p></div><div className="fr-list">{fieldReports.map(report => <article className="fr-field-card" key={report.area}><div><MapPin /><span>{report.area}</span><b>{report.status}</b></div><h2>{report.title}</h2><p>{report.text}</p><Link to="/flamingo/report">Ke informacion? Dërgoje në mënyrë të sigurt <ChevronRight /></Link></article>)}</div><section className="fr-panel fr-sources"><h2>Burimet & përditësimi</h2><p>Kërkimi fillestar u krye më 7 gusht 2026 në raportime publike online. Për shkak se situatat ndryshojnë shpejt, platforma nuk e paraqet një aktivitet si aktiv pa verifikim nga organizatori.</p><button>Propozo një burim <ExternalLink /></button></section></Shell>; }

function GroupCard({ group }: { group: (typeof groups)[number] }) { return <Link to={`/flamingo/groups/${group.id}`} className="fr-card fr-group"><div className="fr-group-icon"><Users /></div><div><h3>{group.name}</h3><p>{group.description}</p><small>{group.members} anëtarë • {group.tasks} detyra aktive</small></div><ChevronRight /></Link>; }
function GroupsPage() { return <Shell title="Grupet"><p className="fr-lead">Gjej grupin ku mund të kontribuosh.</p><div className="fr-list">{groups.map(x => <GroupCard key={x.id} group={x} />)}</div><Link className="fr-wide-link" to="/flamingo/tasks"><ClipboardCheck />Shiko të gjitha detyrat<ChevronRight /></Link></Shell>; }
function GroupDetail() { const { id } = useParams(); const group = groups.find(x => x.id === id) || groups[0]; const { joinedGroups, joinGroup } = useFlamingoStore(); return <Shell title={group.name} back><div className="fr-detail-head"><div className="fr-group-icon"><Users /></div><h1>{group.name}</h1><p>{group.description}</p><small>Admin: {group.admin} • {group.members} anëtarë</small></div><div className="fr-channel"><div className="fr-pinned"><Megaphone /><span><b>Mesazh i fiksuar</b> Takimi i ekipit është në 17:00 te pika e informacionit.</span></div><div className="fr-message"><b>Elira <em>ADMIN</em></b><time>16:24</time><p>Ju lutem konfirmoni detyrat para se të niseni.</p></div><div className="fr-compose"><Plus /><input placeholder="Shkruaj në kanal..." /><button aria-label="Dërgo"><ChevronRight /></button></div></div><button className="fr-sticky-cta" disabled={joinedGroups.includes(group.id)} onClick={() => joinGroup(group.id)}>{joinedGroups.includes(group.id) ? 'Anëtar i grupit ✓' : 'Bashkohu në grup'}</button></Shell>; }
function TaskCard({ task }: { task: Task }) { const { acceptedTasks, acceptTask } = useFlamingoStore(); return <article className="fr-card fr-task"><div className="fr-card-top"><span className={badgeClass(task.status)}>{task.status}</span><span>{task.priority}</span></div><h3>{task.title}</h3><p>{task.description}</p><div className="fr-task-meta"><span><Users />{task.people} persona</span><span><Clock3 />{task.deadline}</span></div><button disabled={acceptedTasks.includes(task.id)} onClick={() => acceptTask(task.id)}>{acceptedTasks.includes(task.id) ? 'E more detyrën ✓' : 'Marr këtë detyrë'}</button></article>; }
function TasksPage() { return <Shell title="Detyrat" back><div className="fr-list">{tasks.map(x => <TaskCard key={x.id} task={x} />)}</div></Shell>; }

function MapPage() { const [selected, setSelected] = useState<(typeof locations)[number] | null>(null); const destination = selected?.name || 'Sheshi Skënderbej, Tirana'; return <Shell title="Harta"><p className="fr-map-note"><ShieldCheck />Harta shfaq vetëm pika publike organizative.</p><div className="fr-osm"><iframe title="Harta OpenStreetMap e Tiranës" src="https://www.openstreetmap.org/export/embed.html?bbox=19.807%2C41.318%2C19.828%2C41.336&layer=mapnik&marker=41.3275%2C19.8187" loading="lazy" referrerPolicy="no-referrer" /><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`} target="_blank" rel="noreferrer"><Navigation /> Nise navigimin hap pas hapi</a></div><div className="fr-map-points">{locations.map(x => <button className={selected?.id === x.id ? 'active' : ''} onClick={() => setSelected(x)} key={x.id}><span>{x.type === 'Ndihmë' ? <Siren /> : <MapPin />}</span><div><strong>{x.name}</strong><small>{x.status} • {x.hours}</small></div><ChevronRight /></button>)}</div><RoutePanel />{selected && <div className="fr-sheet"><div className="fr-sheet-handle" /><button className="fr-sheet-close" onClick={() => setSelected(null)}><X /></button><span className="fr-badge">{selected.type}</span><h2>{selected.name}</h2><p>{selected.description}</p><div><strong>Statusi</strong><span>{selected.status}</span></div><div><strong>Orari</strong><span>{selected.hours}</span></div></div>}</Shell>; }
function LivePage() { return <Shell title="Përditësime Live" back><div className="fr-live-head"><span className="fr-live"><i /> LIVE</span><h1>Tiranë</h1><p>Përditësime të verifikuara nga organizatorët.</p></div><div className="fr-timeline">{updates.map(x => <UpdateCard key={x.id} item={x} />)}</div></Shell>; }
function DocumentCard({ doc }: { doc: (typeof documents)[number] }) { return <article className="fr-card fr-doc"><div className="fr-doc-icon"><FileText /></div><div><span>{doc.category}</span><h3>{doc.title}</h3><small>{doc.date} • {doc.author}</small></div><button aria-label="Shkarko dokumentin"><Download /></button></article>; }
function DocumentsPage() { return <Shell title="Dokumente & Informacion" back><div className="fr-list">{documents.map(x => <DocumentCard key={x.id} doc={x} />)}</div></Shell>; }

function ProfilePage() { return <Shell title="Profili"><div className="fr-profile"><div className="fr-avatar">AM</div><h1>Arta M.</h1><span className="fr-badge">✓ ANËTAR I CERTIFIKUAR</span><p>Të dhënat e kontaktit nuk shfaqen publikisht.</p></div><div className="fr-menu">{[[Globe2, 'Kontributet online', '/flamingo/digital'], [Video, 'Media Wall', '/flamingo/media'], [Send, 'Njoftimet Telegram', '/flamingo/telegram'], [Users, 'Grupet e mia', '/flamingo/groups'], [Video, 'Krijo thirrje video', '/flamingo/calls'], [ClipboardCheck, 'Detyrat e mia', '/flamingo/tasks'], [FileText, 'Dokumentet', '/flamingo/documents'], [LayoutDashboard, 'Paneli i organizatorit', '/flamingo/admin']].map(([Icon, label, to]) => <Link key={String(label)} to={String(to)}><Icon /><span>{String(label)}</span><ChevronRight /></Link>)}</div><section className="fr-safety"><ShieldCheck /><div><strong>Privacy-first</strong><p>Vendndodhja, telefoni dhe email-i yt nuk publikohen.</p></div></section></Shell>; }

function ReportPage() {
  const nav = useNavigate(); const notify = useFlamingoStore(s => s.notify); const [anonymous, setAnonymous] = useState(true); const [step, setStep] = useState(1); const [category, setCategory] = useState('Korrupsion / abuzim');
  function submit(e: FormEvent) { e.preventDefault(); notify(anonymous ? 'Denoncimi anonim u pranua. Ruaj kodin FR-8A29.' : 'Denoncimi u dërgua për shqyrtim.'); nav('/flamingo'); }
  return <Shell title="Denonco në siguri" back noNav><div className="fr-report-hero"><LockKeyhole /><span className="fr-kicker">KANAL I MBROJTUR</span><h1>Fjala jote ka peshë.<br /><em>Identiteti yt, jo.</em></h1><p>Zgjidh çfarë të ndash. Mos dërgo të dhëna që mund të rrezikojnë ty apo persona të tjerë.</p></div><div className="fr-steps"><span className={step >= 1 ? 'active' : ''}>1</span><i /><span className={step >= 2 ? 'active' : ''}>2</span><i /><span className={step >= 3 ? 'active' : ''}>3</span></div><form className="fr-form fr-secure-form" onSubmit={submit}>
    <label className="fr-anonymous-toggle"><div><EyeOff /><span><strong>Dërgoje anonimisht</strong><small>Nuk kërkohet emër, email apo llogari.</small></span></div><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /><i /></label>
    <label>Kategoria<select value={category} onChange={e => setCategory(e.target.value)}>{['Korrupsion / abuzim', 'Presion ose kërcënim', 'Problem me bashkinë', 'Shkelje mjedisore', 'Informacion i rremë', 'Tjetër'].map(x => <option key={x}>{x}</option>)}</select></label>
    <label>Përshkrimi <small>Pa emra nëse nuk janë të domosdoshëm</small><textarea required minLength={20} onFocus={() => setStep(2)} placeholder="Çfarë ka ndodhur? Kur? Cili institucion ose zonë lidhet me rastin?" /></label>
    <label>Qyteti / zona <small>(opsionale)</small><input placeholder="P.sh. Selenicë" /></label><label className="fr-upload">Prova <small>(opsionale — hiq metadata para ngarkimit)</small><input type="file" accept="image/*,.pdf,.doc,.docx" /><span><Plus />Shto foto ose dokument</span></label>
    <div className="fr-privacy-list"><p><Check />Skedarët shqyrtohen vetëm nga moderatorët.</p><p><Check />Raporti nuk publikohet automatikisht.</p><p><Check />Do marrësh një kod për ndjekje pa llogari.</p></div><button className="fr-primary" type="submit" onClick={() => setStep(3)}><Send /> Dërgo në mënyrë të sigurt</button><p className="fr-rate">Në rrezik të menjëhershëm telefono 112. Ky formular nuk zëvendëson emergjencën.</p>
  </form></Shell>;
}

const team = [
  { initials: 'AM', name: 'Arta M.', role: 'ADMIN', description: 'Administron platformën, lejet e publikimit dhe koordinimin mes ekipeve.' },
  { initials: 'ED', name: 'Elira D.', role: 'KOORDINATORE', description: 'Koordinon vullnetarët në terren dhe konfirmon informacionin para publikimit.' },
  { initials: 'KL', name: 'Klea L.', role: 'VULLNETARE', description: 'Mbështet pikën e informacionit dhe orienton qytetarët drejt burimeve të verifikuara.' },
  { initials: 'AB', name: 'Arben B.', role: 'VULLNETAR', description: 'Ndihmon ekipin e medias me dokumentimin dhe organizimin e skedarëve.' },
];
function TeamPage() { if (!canManage()) return <Shell title="Qasje e kufizuar" back><section className="fr-safety"><ShieldCheck /><div><strong>Nuk ke leje për këtë faqe.</strong><p>Vetëm koordinatorët dhe administratorët mund ta shohin ekipin.</p></div></section></Shell>; return <Shell title="Ekipi" back><div className="fr-admin-head"><span className="fr-badge">VETËM STAFI</span><h1>Koordinatorët & vullnetarët</h1><p>Kjo faqe shfaqet vetëm për koordinatorët dhe administratorët.</p></div><div className="fr-team-list">{team.map(member => <article key={member.name}><span>{member.initials}</span><div><b>{member.role}</b><h2>{member.name}</h2><p>{member.description}</p></div></article>)}</div></Shell>; }
function AdminPage() { if (!canManage()) return <Shell title="Qasje e kufizuar" back><section className="fr-safety"><ShieldCheck /><div><strong>Panel vetëm për stafin.</strong><p>Kërko leje nga një administrator.</p></div></section></Shell>; const notify = useFlamingoStore(s => s.notify); return <Shell title="Paneli i organizatorit" back><div className="fr-admin-head"><span className="fr-badge">ORGANIZATOR</span><h1>Mirë se erdhe, Arta</h1><p>Menaxho aktivitetin dhe njoftimet zyrtare.</p></div><Link className="fr-admin-team-link" to="/flamingo/admin/team"><Users /><span><strong>Ekipi i koordinatorëve</strong><small>Rolet dhe përgjegjësitë e stafit</small></span><ChevronRight /></Link><div className="fr-stats">{[['1', 'Protestë aktive'], ['5', 'Grupe aktive'], ['8', 'Detyra të hapura'], ['3', 'Raporte në pritje']].map(x => <div key={x[1]}><strong>{x[0]}</strong><span>{x[1]}</span></div>)}</div><SectionTitle>Veprime të shpejta</SectionTitle><div className="fr-quick">{['Krijo protestë', 'Publiko njoftim', 'Përcakto itinerarin', 'Krijo detyrë online', 'Shto pikë në hartë'].map(x => <button onClick={() => notify(`${x}: formulari u hap.`)} key={x}><Plus />{x}</button>)}</div></Shell>; }

export default function FlamingoApp() { return <Routes><Route index element={<HomePage />} /><Route path="protests" element={<ProtestsPage />} /><Route path="protests/:id" element={<ProtestDetail />} /><Route path="digital" element={<DigitalPage />} /><Route path="media" element={<MediaPage />} /><Route path="telegram" element={<TelegramPage />} /><Route path="calls" element={<CallsPage />} /><Route path="research" element={<ResearchPage />} /><Route path="groups" element={<GroupsPage />} /><Route path="groups/:id" element={<GroupDetail />} /><Route path="tasks" element={<TasksPage />} /><Route path="map" element={<MapPage />} /><Route path="live" element={<LivePage />} /><Route path="documents" element={<DocumentsPage />} /><Route path="profile" element={<ProfilePage />} /><Route path="report" element={<ReportPage />} /><Route path="admin" element={<AdminPage />} /><Route path="admin/team" element={<TeamPage />} /></Routes>; }
