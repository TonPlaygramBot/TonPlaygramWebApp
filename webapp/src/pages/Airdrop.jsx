import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Download, ExternalLink, Gift, ListChecks, Megaphone, Plus, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { airdropVideoApi, listTasks } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { normalizeTasksResponse } from '../utils/taskUtils.js';

const socialTasks = [
  ['Follow on TikTok', 'Daily clips & game launches', 'TikTok', 'https://www.tiktok.com/@tonplaygram'],
  ['Join Telegram', 'News, drops & community votes', 'Telegram', 'https://t.me/TonPlaygram'],
  ['Follow on X', 'Share updates with your network', 'X', 'https://x.com/TonPlaygram'],
  ['Subscribe on YouTube', 'Watch trailers and tutorials', 'YouTube', 'https://youtube.com/@TonPlaygram']
];

const viewRewards = [
  ['150 – 2,999', '900'],
  ['3,000 – 7,999', '2,700'],
  ['8,000 – 14,999', '5,400'],
  ['15,000 – 29,999', '10,500'],
  ['30,000 – 99,999', '24,000'],
  ['100,000+', '60,000']
];

export default function Airdrop({ admin = false }) {
  const [videos, setVideos] = useState([]);
  const [earnTasks, setEarnTasks] = useState([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ title: '', videoUrl: '', thumbnailUrl: '', platform: 'TikTok', description: '' });
  let telegramId = null;
  try { telegramId = getTelegramId(); } catch { /* sign-in prompt is shown by the API */ }

  const load = () => {
    if (!telegramId) return;
    Promise.all([airdropVideoApi.list(telegramId), listTasks(telegramId)]).then(([videoData, taskData]) => {
      if (!videoData.error) setVideos(videoData);
      setEarnTasks(normalizeTasksResponse(taskData).filter((task) => !task.completed));
    });
  };
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
    const result = await airdropVideoApi.create(form);
    if (result.error) return setNotice(result.error);
    setVideos((items) => [result, ...items]);
    setForm({ title: '', videoUrl: '', thumbnailUrl: '', platform: 'TikTok', description: '' });
    setNotice('Video task published.');
  };

  return <main className="airdrop-page">
    <header className="airdrop-top"><Link to="/"><ArrowLeft /></Link><span>TPG AIRDROP</span><div className="airdrop-balance"><Gift size={15} /> 5,000</div></header>
    <section className="airdrop-hero"><div className="airdrop-orb"><Sparkles /><strong>TPG</strong></div><span className="airdrop-pill">INFLUENCER REWARD CAMPAIGN</span><h1>Download. Share.<br /><em>Earn TPG.</em></h1><p>Download an official TonPlaygram video for your first <b>5,000 TPG</b>, then earn more as your post gains views.</p><div className="airdrop-how"><div><b>1</b><span>Download video</span></div><i /><div><b>2</b><span>Post & submit</span></div><i /><div><b>3</b><span>Earn by views</span></div></div></section>
    {notice && <p className="airdrop-notice" role="status">{notice}</p>}
    {admin && <form className="airdrop-admin" onSubmit={publish}><div><ShieldCheck /><span><b>Developer studio</b><small>Only authorised developers can publish campaign videos</small></span></div><input required placeholder="Video title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input required type="url" placeholder="Direct video URL" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} /><input type="url" placeholder="Thumbnail URL (optional)" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} /><textarea placeholder="Short instructions" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><button><Plus /> Publish task</button></form>}
    <section className="airdrop-section"><div className="airdrop-title"><span><Download /> Download & earn</span><small>{videos.length} available</small></div>
      {!telegramId && <div className="airdrop-empty">Open TonPlaygram with Telegram to unlock your rewards.</div>}
      {telegramId && !videos.length && <div className="airdrop-empty"><Megaphone /> Fresh video drops are coming soon. Follow our channels below so you do not miss one.</div>}
      <div className="airdrop-videos">{videos.map((video) => <article key={video._id}><div className="airdrop-thumb" style={video.thumbnailUrl ? { backgroundImage: `url(${video.thumbnailUrl})` } : {}}><span>{video.platform}</span><b>{Number(video.reward || 5000).toLocaleString()}<small> TPG</small></b></div><div><h3>{video.title}</h3><p>{video.description || 'Download this official TonPlaygram video and share it on your channel.'}</p><button disabled={video.claimed || busy === video._id} onClick={() => download(video)}>{video.claimed ? <><Check /> Reward claimed</> : <><Download /> {busy === video._id ? 'Claiming…' : 'Download & earn'}</>}</button></div></article>)}</div>
    </section>
    <section className="airdrop-section"><div className="airdrop-title"><span><TrendingUp /> Influencer bonus</span><small>More views, more TPG</small></div><div className="airdrop-influencer"><p>After posting the downloaded video, submit your public post in <b>Earn → Tasks → Influencer</b>. Your 5,000 TPG download reward is only the start.</p><div className="airdrop-reward-grid">{viewRewards.map(([views, reward]) => <div key={views}><span>{views} views</span><strong>+{reward} TPG</strong></div>)}</div><Link to="/earn#tasks" className="airdrop-cta">Submit influencer post <ExternalLink size={16} /></Link></div></section>
    <section className="airdrop-section"><div className="airdrop-title"><span><ListChecks /> Earn tasks</span><small>{earnTasks.length} ready</small></div><div className="airdrop-socials">{earnTasks.slice(0, 6).map((task) => <Link key={task.id} to="/earn#tasks"><b><Check size={16} /></b><span><strong>{task.description}</strong><small>Complete on the Earn page</small></span><em>+{Number(task.reward || 0).toLocaleString()}</em></Link>)}</div>{telegramId && !earnTasks.length && <div className="airdrop-empty">You are all caught up with your current Earn tasks.</div>}<Link to="/earn#tasks" className="airdrop-cta">View all Earn tasks <ExternalLink size={16} /></Link></section>
    <section className="airdrop-section"><div className="airdrop-title"><span><Megaphone /> Grow with us</span><small>Social tasks</small></div><div className="airdrop-socials">{socialTasks.map(([title, copy, platform, url]) => <a key={platform} href={url} target="_blank" rel="noreferrer"><b>{platform.slice(0, 1)}</b><span><strong>{title}</strong><small>{copy}</small></span><em>GO</em></a>)}</div></section>
    <p className="airdrop-terms"><ShieldCheck /> One reward per video and verified account. Campaign terms apply.</p>
  </main>;
}
