import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarClock, Check, ExternalLink, FileText, Link2, Radio, RefreshCw, Send, Settings2, Share2, Trash2, Users, X, XCircle } from 'lucide-react';
import { FaDiscord, FaFacebookF, FaInstagram, FaTelegramPlane, FaTiktok, FaYoutube } from 'react-icons/fa';
import { FaThreads, FaXTwitter } from 'react-icons/fa6';
import { socialAdminApi } from '../utils/api.js';
import { loadLinkedProfiles, normalizeSocialProfile, saveLinkedProfiles } from '../utils/socialProfileLinks.js';

const platforms = ['tiktok', 'instagram', 'facebook', 'youtube', 'x', 'telegram', 'discord'];
const tabs = [['overview', BarChart3, 'Home'], ['create', Send, 'Post'], ['live', Radio, 'Go Live'], ['scheduled', CalendarClock, 'Schedule'], ['posts', FileText, 'History'], ['accounts', Users, 'Accounts'], ['automations', Settings2, 'Rules']];
const label = (value) => value === 'x' ? 'X' : value[0].toUpperCase() + value.slice(1);
const platformIcons = { instagram: FaInstagram, facebook: FaFacebookF, tiktok: FaTiktok, youtube: FaYoutube, x: FaXTwitter, threads: FaThreads, telegram: FaTelegramPlane, discord: FaDiscord };

function Status({ publication }) {
  const good = publication.status === 'PUBLISHED';
  return <span className={`social-status ${good ? 'good' : publication.status === 'FAILED' ? 'bad' : ''}`}>{good ? <Check size={14} /> : publication.status === 'FAILED' ? <XCircle size={14} /> : <RefreshCw size={14} />}{publication.status}</span>;
}

export default function SocialAdmin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState({ accounts: [], recent: [], stats: {} });
  const [posts, setPosts] = useState([]);
  const [rules, setRules] = useState([]);
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [selected, setSelected] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [media, setMedia] = useState([]);
  const [mode, setMode] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [validation, setValidation] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkedProfiles, setLinkedProfiles] = useState(() => loadLinkedProfiles(window.localStorage));
  const [profileEditor, setProfileEditor] = useState('');
  const [profileInput, setProfileInput] = useState('');
  const [liveTitle, setLiveTitle] = useState('');
  const [liveTargets, setLiveTargets] = useState([]);
  const [liveSource, setLiveSource] = useState('camera');
  const refresh = async () => { const [o, p, a] = await Promise.all([socialAdminApi.overview(), socialAdminApi.posts(), socialAdminApi.automations()]); if (!o.error) setOverview(o); if (!p.error) setPosts(p); if (!a.error) setRules(a); };
  useEffect(() => { if (tab === 'overview' || tab === 'posts' || tab === 'scheduled') refresh(); }, [tab]);
  const payload = useMemo(() => ({ caption, link, platforms: selected, overrides, media, scheduledAt: mode === 'schedule' ? scheduledAt : null }), [caption, link, selected, overrides, media, mode, scheduledAt]);
  const runValidation = async () => { const result = await socialAdminApi.validate(payload); if (!result.error) setValidation(result); };
  useEffect(() => { if (!selected.length) return setValidation({}); const timer = setTimeout(runValidation, 250); return () => clearTimeout(timer); }, [payload]);
  const publish = async () => { setBusy(true); setMessage(''); const result = await socialAdminApi.createPost(payload); setBusy(false); if (result.error) return setMessage(result.error); navigate(`/admin/social/posts/${result._id}`); };
  const openProfileEditor = (platform) => {
    setMessage('');
    setProfileInput(linkedProfiles[platform]?.accountName || '');
    setProfileEditor(platform);
  };
  const linkProfile = () => {
    const profile = normalizeSocialProfile(profileEditor, profileInput);
    if (profile.error) return setMessage(profile.error);
    const updated = { ...linkedProfiles, [profileEditor]: profile };
    saveLinkedProfiles(window.localStorage, updated);
    setLinkedProfiles(updated);
    setMessage(`${label(profileEditor)} profile linked successfully.`);
    setProfileEditor('');
  };
  const unlinkProfile = () => {
    const updated = { ...linkedProfiles };
    delete updated[profileEditor];
    saveLinkedProfiles(window.localStorage, updated);
    setLinkedProfiles(updated);
    setMessage(`${label(profileEditor)} profile removed.`);
    setProfileEditor('');
  };
  const accountCard = (platform, compact = false) => {
    const account = linkedProfiles[platform] || overview.accounts.find((item) => item.platform === platform && item.status === 'CONNECTED');
    const Icon = platformIcons[platform];
    return <article className={compact ? 'compact-account' : ''} key={platform}><div className={`platform-dot ${platform}`}><Icon aria-hidden="true" /></div><div><strong>{label(platform)}</strong><span>{account?.accountName || 'Not linked'}</span>{!compact && <small>{account ? 'Profile link saved on this phone' : 'No developer account needed'}</small>}</div>{account?.profileUrl && <a className="profile-open" href={account.profileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${label(platform)} profile`}><ExternalLink size={15} /><span>Open</span></a>}<button className={account ? 'connected' : ''} onClick={() => openProfileEditor(platform)} aria-label={`${account ? 'Edit' : 'Link'} ${label(platform)}`}>{account ? <Check size={15} /> : <Link2 size={15} />}<span>{account ? 'Edit' : 'Link'}</span></button></article>;
  };
  const filteredPosts = tab === 'scheduled' ? posts.filter((post) => post.status === 'SCHEDULED') : posts;

  return <main className="social-admin">
    <header className="social-head"><Link to="/social" aria-label="Back to social hub"><ArrowLeft /></Link><div><small>YOUR CREATOR STUDIO</small><h1><Share2 /> Social Manager</h1><p>One post. One stream. Every community.</p></div></header>
    <nav className="social-tabs" aria-label="Social sections">{tabs.map(([id, Icon, text]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={18} /><span>{text}</span></button>)}</nav>
    {tab === 'overview' && <section className="social-stack"><h2>Overview</h2><div className="social-metrics">{[['Connected accounts', new Set([...overview.accounts.filter((a) => a.status === 'CONNECTED').map((a) => a.platform), ...Object.keys(linkedProfiles)]).size], ['Scheduled posts', overview.stats.scheduled || 0], ['Published posts', overview.stats.published || 0], ['Failed posts', overview.stats.failed || 0], ['Automatic tasks', overview.stats.tasks || 0]].map(([text, value]) => <article key={text}><strong>{value}</strong><span>{text}</span></article>)}</div><div className="social-section-title"><h2>Connected Accounts</h2><button onClick={() => setTab('accounts')}>Manage</button></div><p className="social-note">Save your official profile links for quick access. No developer setup or social password is needed.</p>{message && <p className={message.includes('successfully') ? 'social-success' : 'social-error'} role="status">{message}</p>}<div className="social-cards overview-accounts">{platforms.map((platform) => accountCard(platform, true))}</div><h2>Recent activity</h2><PostCards posts={overview.recent} /></section>}
    {tab === 'create' && <section className="social-stack composer"><h2>Create Social Post</h2><label className="upload"><input type="file" accept="image/*,video/*" multiple onChange={(e) => setMedia([...e.target.files].map((file) => ({ url: URL.createObjectURL(file), mimeType: file.type, name: file.name })))} /><Send /> <strong>Upload Media</strong><span>Images, video, multiple images or thumbnail</span></label>{media.map((item) => <small key={item.url}>{item.name}</small>)}<label>Master Caption<textarea rows="6" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What do you want to share?" /></label><label>Optional link<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label><div className="field-title"><strong>Platforms</strong><button onClick={() => setSelected(selected.length === platforms.length ? [] : platforms)}>Select All</button></div><div className="platform-grid">{platforms.map((platform) => <button key={platform} className={selected.includes(platform) ? 'selected' : ''} onClick={() => setSelected((items) => items.includes(platform) ? items.filter((item) => item !== platform) : [...items, platform])}><span>{label(platform)}</span>{selected.includes(platform) && <Check />}</button>)}</div><details><summary>Customize by platform</summary>{selected.map((platform) => <label key={platform}>{label(platform)} {platform === 'youtube' && <input placeholder="Title (required)" value={overrides.youtube?.title || ''} onChange={(e) => setOverrides({ ...overrides, youtube: { ...overrides.youtube, title: e.target.value } })} />}<textarea rows="3" placeholder="Optional custom caption" value={overrides[platform]?.caption || ''} onChange={(e) => setOverrides({ ...overrides, [platform]: { ...overrides[platform], caption: e.target.value } })} /></label>)}</details><div className="validation">{selected.map((platform) => <p key={platform} className={validation[platform]?.ready ? 'ready' : 'problem'}><span>{label(platform)}</span><strong>{validation[platform]?.ready ? '✓ Ready' : `⚠ ${validation[platform]?.errors?.join(', ') || 'Checking…'}`}</strong></p>)}</div><fieldset><legend>Publish</legend><label><input type="radio" checked={mode === 'now'} onChange={() => setMode('now')} /> Now</label><label><input type="radio" checked={mode === 'schedule'} onChange={() => setMode('schedule')} /> Schedule</label>{mode === 'schedule' && <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />}</fieldset>{message && <p className="social-error">{message}</p>}<div className="sticky-publish"><button disabled={busy || !selected.length || Object.values(validation).some((item) => !item.ready)} onClick={publish}>{busy ? 'Queuing…' : `${mode === 'schedule' ? 'Schedule' : 'Publish to'} ${selected.length} Social${selected.length === 1 ? '' : 's'}`}</button></div></section>}
    {tab === 'live' && <section className="social-stack social-live"><div className="live-hero"><span><Radio /></span><div><small>MULTISTREAM STUDIO</small><h2>Go live everywhere</h2><p>Broadcast once to every selected channel. You stay in control of camera, microphone and chat.</p></div></div><label>Stream title<input value={liveTitle} onChange={(event) => setLiveTitle(event.target.value)} placeholder="Give your live a clear title" /></label><div><strong>Video source</strong><div className="live-source"><button className={liveSource === 'camera' ? 'selected' : ''} onClick={() => setLiveSource('camera')}>Phone camera</button><button className={liveSource === 'stream' ? 'selected' : ''} onClick={() => setLiveSource('stream')}>Stream key / RTMP</button></div></div><div className="field-title"><strong>Live destinations</strong><button onClick={() => setLiveTargets(liveTargets.length === platforms.length ? [] : platforms)}>Select all</button></div><div className="platform-grid">{platforms.map((platform) => <button key={platform} className={liveTargets.includes(platform) ? 'selected' : ''} onClick={() => setLiveTargets((items) => items.includes(platform) ? items.filter((item) => item !== platform) : [...items, platform])}><span>{label(platform)}</span>{liveTargets.includes(platform) && <Check />}</button>)}</div><div className="live-checks"><span><Check /> 1080p adaptive quality</span><span><Check /> Unified live-chat view</span><span><Check /> Save recording after live</span></div><button className="start-live" disabled={!liveTitle.trim() || !liveTargets.length}><Radio /> Start live on {liveTargets.length || 0} channel{liveTargets.length === 1 ? '' : 's'}</button><p className="social-note">A preview and permission check will appear before your broadcast begins.</p></section>}
    {(tab === 'posts' || tab === 'scheduled') && <section className="social-stack"><h2>{tab === 'scheduled' ? 'Scheduled' : 'Posts'}</h2><PostCards posts={filteredPosts} /></section>}
    {tab === 'accounts' && <section className="social-stack"><h2>Linked social profiles</h2><p className="social-note">The easy option: paste a username or official profile link. No developer account, app review, password, or authorization screen is needed.</p>{message && <p className={message.includes('successfully') ? 'social-success' : 'social-error'} role="status">{message}</p>}<div className="social-cards account-cards">{platforms.map((platform) => accountCard(platform))}</div><p className="oauth-privacy"><strong>Private on this phone</strong><br />Profile links stay on this device. Linking creates a shortcut; social apps still control automatic posting and live-stream permissions.</p></section>}
    {profileEditor && <ProfileLinkSheet platform={profileEditor} value={profileInput} message={message} linked={Boolean(linkedProfiles[profileEditor])} onChange={setProfileInput} onSave={linkProfile} onRemove={unlinkProfile} onClose={() => setProfileEditor('')} />}
    {tab === 'automations' && <section className="social-stack"><h2>Automations</h2>{rules.map((rule) => <article className="automation" key={rule._id}><label>When<select value={rule.trigger} onChange={(e) => socialAdminApi.updateAutomation(rule._id, { trigger: e.target.value }).then(refresh)}><option value="PROVIDER_SUCCEEDED">Provider publication succeeded</option><option value="PROVIDER_FAILED">Provider publication failed</option><option value="ALL_PUBLISHED">All selected providers published</option><option value="PARTIALLY_FAILED">Social post partially failed</option></select></label><label>Task title<input value={rule.titleTemplate} onChange={(e) => setRules((items) => items.map((item) => item._id === rule._id ? { ...item, titleTemplate: e.target.value } : item))} onBlur={(e) => socialAdminApi.updateAutomation(rule._id, { titleTemplate: e.target.value })} /></label><div><span>{rule.dueAmount} {rule.dueUnit}</span><span>{rule.priority}</span><button onClick={() => socialAdminApi.updateAutomation(rule._id, { enabled: !rule.enabled }).then(refresh)}>{rule.enabled ? 'Enabled' : 'Disabled'}</button></div></article>)}</section>}
  </main>;
}

function PostCards({ posts }) { return <div className="post-cards">{!posts?.length && <p className="social-note">No posts yet.</p>}{posts?.map((post) => <Link to={`/admin/social/posts/${post._id}`} key={post._id}><div><strong>{post.caption}</strong><small>{new Date(post.scheduledAt || post.createdAt).toLocaleString()}</small></div><span>{post.status}</span><div className="publication-row">{post.publications.map((publication) => <i key={publication._id}>{label(publication.platform)}</i>)}</div></Link>)}</div>; }


function ProfileLinkSheet({ platform, value, message, linked, onChange, onSave, onRemove, onClose }) {
  const Icon = platformIcons[platform];
  return <div className="profile-link-backdrop" role="presentation" onClick={onClose}><section className="profile-link-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-link-title" onClick={(event) => event.stopPropagation()}><button className="profile-link-close" onClick={onClose} aria-label="Close"><X /></button><div className={`platform-dot ${platform}`}><Icon aria-hidden="true" /></div><h2 id="profile-link-title">Link {label(platform)}</h2><p>Paste your username or the link to your profile.</p><label>Username or profile link<input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={platform === 'discord' ? 'Numeric Discord User ID' : '@username'} onKeyDown={(event) => event.key === 'Enter' && onSave()} /></label>{message && <p className="social-error" role="alert">{message}</p>}<button className="profile-link-save" onClick={onSave}><Link2 /> Save profile link</button>{linked && <button className="profile-link-remove" onClick={onRemove}><Trash2 /> Remove link</button>}</section></div>;
}
