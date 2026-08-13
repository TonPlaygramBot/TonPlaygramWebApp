import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarClock, Check, FileText, Link2, RefreshCw, Send, Settings2, Share2, Users, XCircle } from 'lucide-react';
import { FaFacebookF, FaInstagram, FaTiktok, FaYoutube } from 'react-icons/fa';
import { FaThreads, FaXTwitter } from 'react-icons/fa6';
import { socialAdminApi } from '../utils/api.js';

const platforms = ['instagram', 'facebook', 'tiktok', 'youtube', 'x', 'threads'];
const tabs = [['overview', BarChart3, 'Overview'], ['create', Send, 'Create Post'], ['scheduled', CalendarClock, 'Scheduled'], ['posts', FileText, 'Posts'], ['accounts', Users, 'Accounts'], ['automations', Settings2, 'Automations']];
const label = (value) => value === 'x' ? 'X' : value[0].toUpperCase() + value.slice(1);
const platformIcons = { instagram: FaInstagram, facebook: FaFacebookF, tiktok: FaTiktok, youtube: FaYoutube, x: FaXTwitter, threads: FaThreads };

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
  const [connecting, setConnecting] = useState('');
  const refresh = async () => { const [o, p, a] = await Promise.all([socialAdminApi.overview(), socialAdminApi.posts(), socialAdminApi.automations()]); if (!o.error) setOverview(o); if (!p.error) setPosts(p); if (!a.error) setRules(a); };
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (tab === 'overview' || tab === 'posts' || tab === 'scheduled') refresh(); }, [tab]);
  const payload = useMemo(() => ({ caption, link, platforms: selected, overrides, media, scheduledAt: mode === 'schedule' ? scheduledAt : null }), [caption, link, selected, overrides, media, mode, scheduledAt]);
  const runValidation = async () => { const result = await socialAdminApi.validate(payload); if (!result.error) setValidation(result); };
  useEffect(() => { if (!selected.length) return setValidation({}); const timer = setTimeout(runValidation, 250); return () => clearTimeout(timer); }, [payload]);
  const publish = async () => { setBusy(true); setMessage(''); const result = await socialAdminApi.createPost(payload); setBusy(false); if (result.error) return setMessage(result.error); navigate(`/admin/social/posts/${result._id}`); };
  const connectAccount = async (platform) => {
    setConnecting(platform);
    setMessage('');
    const result = await socialAdminApi.connectAccount(platform);
    setConnecting('');
    if (result.error) return setMessage(result.error);
    if (result.authorizationUrl) {
      window.location.assign(result.authorizationUrl);
      return;
    }
    setMessage(`${label(platform)} connected successfully.`);
    await refresh();
  };
  const accountCard = (platform, compact = false) => {
    const account = overview.accounts.find((item) => item.platform === platform && item.status === 'CONNECTED');
    const Icon = platformIcons[platform];
    return <article className={compact ? 'compact-account' : ''} key={platform}><div className={`platform-dot ${platform}`}><Icon aria-hidden="true" /></div><div><strong>{label(platform)}</strong><span>{account?.accountName || 'Not connected'}</span>{!compact && <small>{account ? 'Authorized permissions active' : `Authorize TonPlaygram with ${label(platform)}`}</small>}</div><button className={account ? 'connected' : ''} disabled={connecting === platform} onClick={() => connectAccount(platform)} aria-label={`${account ? 'Reconnect' : 'Connect'} ${label(platform)}`}>{connecting === platform ? <RefreshCw className="spin" size={15} /> : account ? <Check size={15} /> : <Link2 size={15} />}<span>{connecting === platform ? 'Opening…' : account ? 'Reconnect' : 'Connect'}</span></button></article>;
  };
  const filteredPosts = tab === 'scheduled' ? posts.filter((post) => post.status === 'SCHEDULED') : posts;

  return <main className="social-admin">
    <header className="social-head"><Link to="/account" aria-label="Back to profile"><ArrowLeft /></Link><div><small>DEVELOPER CONTROL CENTER</small><h1><Share2 /> Social Media</h1></div></header>
    <nav className="social-tabs" aria-label="Social sections">{tabs.map(([id, Icon, text]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={18} /><span>{text}</span></button>)}</nav>
    {tab === 'overview' && <section className="social-stack"><h2>Overview</h2><div className="social-metrics">{[['Connected accounts', overview.accounts.filter((a) => a.status === 'CONNECTED').length], ['Scheduled posts', overview.stats.scheduled || 0], ['Published posts', overview.stats.published || 0], ['Failed posts', overview.stats.failed || 0], ['Automatic tasks', overview.stats.tasks || 0]].map(([text, value]) => <article key={text}><strong>{value}</strong><span>{text}</span></article>)}</div><div className="social-section-title"><h2>Connected Accounts</h2><button onClick={() => setTab('accounts')}>Manage</button></div><p className="social-note">Link a channel securely through its authorization screen. You never enter social passwords here.</p>{message && <p className={message.includes('successfully') ? 'social-success' : 'social-error'} role="status">{message}</p>}<div className="social-cards overview-accounts">{platforms.map((platform) => accountCard(platform, true))}</div><h2>Recent activity</h2><PostCards posts={overview.recent} /></section>}
    {tab === 'create' && <section className="social-stack composer"><h2>Create Social Post</h2><label className="upload"><input type="file" accept="image/*,video/*" multiple onChange={(e) => setMedia([...e.target.files].map((file) => ({ url: URL.createObjectURL(file), mimeType: file.type, name: file.name })))} /><Send /> <strong>Upload Media</strong><span>Images, video, multiple images or thumbnail</span></label>{media.map((item) => <small key={item.url}>{item.name}</small>)}<label>Master Caption<textarea rows="6" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What do you want to share?" /></label><label>Optional link<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></label><div className="field-title"><strong>Platforms</strong><button onClick={() => setSelected(selected.length === platforms.length ? [] : platforms)}>Select All</button></div><div className="platform-grid">{platforms.map((platform) => <button key={platform} className={selected.includes(platform) ? 'selected' : ''} onClick={() => setSelected((items) => items.includes(platform) ? items.filter((item) => item !== platform) : [...items, platform])}><span>{label(platform)}</span>{selected.includes(platform) && <Check />}</button>)}</div><details><summary>Customize by platform</summary>{selected.map((platform) => <label key={platform}>{label(platform)} {platform === 'youtube' && <input placeholder="Title (required)" value={overrides.youtube?.title || ''} onChange={(e) => setOverrides({ ...overrides, youtube: { ...overrides.youtube, title: e.target.value } })} />}<textarea rows="3" placeholder="Optional custom caption" value={overrides[platform]?.caption || ''} onChange={(e) => setOverrides({ ...overrides, [platform]: { ...overrides[platform], caption: e.target.value } })} /></label>)}</details><div className="validation">{selected.map((platform) => <p key={platform} className={validation[platform]?.ready ? 'ready' : 'problem'}><span>{label(platform)}</span><strong>{validation[platform]?.ready ? '✓ Ready' : `⚠ ${validation[platform]?.errors?.join(', ') || 'Checking…'}`}</strong></p>)}</div><fieldset><legend>Publish</legend><label><input type="radio" checked={mode === 'now'} onChange={() => setMode('now')} /> Now</label><label><input type="radio" checked={mode === 'schedule'} onChange={() => setMode('schedule')} /> Schedule</label>{mode === 'schedule' && <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />}</fieldset>{message && <p className="social-error">{message}</p>}<div className="sticky-publish"><button disabled={busy || !selected.length || Object.values(validation).some((item) => !item.ready)} onClick={publish}>{busy ? 'Queuing…' : `${mode === 'schedule' ? 'Schedule' : 'Publish to'} ${selected.length} Social${selected.length === 1 ? '' : 's'}`}</button></div></section>}
    {(tab === 'posts' || tab === 'scheduled') && <section className="social-stack"><h2>{tab === 'scheduled' ? 'Scheduled' : 'Posts'}</h2><PostCards posts={filteredPosts} /></section>}
    {tab === 'accounts' && <section className="social-stack"><h2>Connected accounts</h2><p className="social-note">Connect with each social app. You will approve the requested permissions on the provider's secure authorization screen—no credentials are entered here.</p>{message && <p className={message.includes('successfully') ? 'social-success' : 'social-error'} role="status">{message}</p>}<div className="social-cards account-cards">{platforms.map((platform) => accountCard(platform))}</div><p className="oauth-privacy"><strong>Secure OAuth</strong><br />Passwords are never shared with TonPlaygram. Access can be revoked at any time from your social account settings.</p></section>}
    {tab === 'automations' && <section className="social-stack"><h2>Automations</h2>{rules.map((rule) => <article className="automation" key={rule._id}><label>When<select value={rule.trigger} onChange={(e) => socialAdminApi.updateAutomation(rule._id, { trigger: e.target.value }).then(refresh)}><option value="PROVIDER_SUCCEEDED">Provider publication succeeded</option><option value="PROVIDER_FAILED">Provider publication failed</option><option value="ALL_PUBLISHED">All selected providers published</option><option value="PARTIALLY_FAILED">Social post partially failed</option></select></label><label>Task title<input value={rule.titleTemplate} onChange={(e) => setRules((items) => items.map((item) => item._id === rule._id ? { ...item, titleTemplate: e.target.value } : item))} onBlur={(e) => socialAdminApi.updateAutomation(rule._id, { titleTemplate: e.target.value })} /></label><div><span>{rule.dueAmount} {rule.dueUnit}</span><span>{rule.priority}</span><button onClick={() => socialAdminApi.updateAutomation(rule._id, { enabled: !rule.enabled }).then(refresh)}>{rule.enabled ? 'Enabled' : 'Disabled'}</button></div></article>)}</section>}
  </main>;
}

function PostCards({ posts }) { return <div className="post-cards">{!posts?.length && <p className="social-note">No posts yet.</p>}{posts?.map((post) => <Link to={`/admin/social/posts/${post._id}`} key={post._id}><div><strong>{post.caption}</strong><small>{new Date(post.scheduledAt || post.createdAt).toLocaleString()}</small></div><span>{post.status}</span><div className="publication-row">{post.publications.map((publication) => <i key={publication._id}>{label(publication.platform)}</i>)}</div></Link>)}</div>; }
