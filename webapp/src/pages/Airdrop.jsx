import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Download, Gift, Megaphone, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { airdropVideoApi } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

const socialTasks = [
  ['Follow on TikTok', 'Daily clips & game launches', 'TikTok', 'https://www.tiktok.com/@tonplaygram'],
  ['Join Telegram', 'News, drops & community votes', 'Telegram', 'https://t.me/TonPlaygram'],
  ['Follow on X', 'Share updates with your network', 'X', 'https://x.com/TonPlaygram'],
  ['Subscribe on YouTube', 'Watch trailers and tutorials', 'YouTube', 'https://youtube.com/@TonPlaygram']
];

export default function Airdrop({ admin = false }) {
  const [videos, setVideos] = useState([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [token, setToken] = useState('');
  const [form, setForm] = useState({ title: '', videoUrl: '', thumbnailUrl: '', platform: 'TikTok', description: '' });
  let telegramId = null;
  try { telegramId = getTelegramId(); } catch { /* sign-in prompt is shown by the API */ }

  const load = () => telegramId && airdropVideoApi.list(telegramId).then((data) => !data.error && setVideos(data));
  useEffect(load, [telegramId]);

  const download = async (video) => {
    if (video.claimed || busy) return;
    setBusy(video._id);
    const result = await airdropVideoApi.claim(telegramId, video._id);
    setBusy('');
    if (result.error) return setNotice(result.error);
    setVideos((items) => items.map((item) => item._id === video._id ? { ...item, claimed: true } : item));
    setNotice(`+${result.reward.toLocaleString()} TPG added to your balance!`);
    const anchor = document.createElement('a');
    anchor.href = video.videoUrl;
    anchor.download = '';
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.click();
  };

  const publish = async (event) => {
    event.preventDefault();
    const result = await airdropVideoApi.create(form, token);
    if (result.error) return setNotice(result.error);
    setVideos((items) => [result, ...items]);
    setForm({ title: '', videoUrl: '', thumbnailUrl: '', platform: 'TikTok', description: '' });
    setNotice('Video task published.');
  };

  return <main className="airdrop-page">
    <header className="airdrop-top"><Link to="/"><ArrowLeft /></Link><span>TPG AIRDROP</span><div className="airdrop-balance"><Gift size={15} /> 2,500</div></header>
    <section className="airdrop-hero"><div className="airdrop-orb"><Sparkles /><strong>TPG</strong></div><span className="airdrop-pill">LIMITED REWARD CAMPAIGN</span><h1>Download. Share.<br /><em>Earn TPG.</em></h1><p>Help TonPlaygram grow across social media and earn <b>2,500 TPG</b> for every eligible video you download.</p><div className="airdrop-how"><div><b>1</b><span>Choose a video</span></div><i /><div><b>2</b><span>Download it</span></div><i /><div><b>3</b><span>Get rewarded</span></div></div></section>
    {notice && <p className="airdrop-notice" role="status">{notice}</p>}
    {admin && <form className="airdrop-admin" onSubmit={publish}><div><ShieldCheck /><span><b>Admin studio</b><small>Publish a new campaign video</small></span></div><input required placeholder="Admin access token" type="password" value={token} onChange={(e) => setToken(e.target.value)} /><input required placeholder="Video title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input required type="url" placeholder="Direct video URL" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} /><input type="url" placeholder="Thumbnail URL (optional)" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} /><textarea placeholder="Short instructions" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><button><Plus /> Publish task</button></form>}
    <section className="airdrop-section"><div className="airdrop-title"><span><Download /> Download & earn</span><small>{videos.length} available</small></div>
      {!telegramId && <div className="airdrop-empty">Open TonPlaygram with Telegram to unlock your rewards.</div>}
      {telegramId && !videos.length && <div className="airdrop-empty"><Megaphone /> Fresh video drops are coming soon. Follow our channels below so you do not miss one.</div>}
      <div className="airdrop-videos">{videos.map((video) => <article key={video._id}><div className="airdrop-thumb" style={video.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : {}}><span>{video.platform}</span><b>2,500<small> TPG</small></b></div><div><h3>{video.title}</h3><p>{video.description || 'Download this official TonPlaygram video and share it on your channel.'}</p><button disabled={video.claimed || busy === video._id} onClick={() => download(video)}>{video.claimed ? <><Check /> Reward claimed</> : <><Download /> {busy === video._id ? 'Claiming…' : 'Download & earn'}</>}</button></div></article>)}</div>
    </section>
    <section className="airdrop-section"><div className="airdrop-title"><span><Megaphone /> Grow with us</span><small>Social tasks</small></div><div className="airdrop-socials">{socialTasks.map(([title, copy, platform, url]) => <a key={platform} href={url} target="_blank" rel="noreferrer"><b>{platform.slice(0, 1)}</b><span><strong>{title}</strong><small>{copy}</small></span><em>GO</em></a>)}</div></section>
    <p className="airdrop-terms"><ShieldCheck /> One reward per video and verified account. Campaign terms apply.</p>
  </main>;
}
