import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Camera, FlipHorizontal, Mic, MicOff, Monitor, Radio, Square, Video, VideoOff } from 'lucide-react';
import { API_BASE_URL } from '../../utils/api.js';
import { Account, creatorApi, Platform } from './api';
export default function LiveStudio({ accounts, platforms, enabled, signedIn, onError, visible = true, onBroadcastStateChange }: { accounts: Account[]; platforms: Platform[]; enabled: boolean; signedIn: boolean; onError: (text: string) => void; visible?: boolean; onBroadcastStateChange?: (state: 'idle' | 'preparing' | 'active') => void }) {
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), recorder = useRef<MediaRecorder | null>(null), socket = useRef<Socket | null>(null);
  const current = useRef<any>(null), mounted = useRef(true), capturing = useRef(false), stopping = useRef(false);
  const [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [live, setLive] = useState<any>(null), [starting, setStarting] = useState(false);
  const captureRequest = useRef(0);
  const [title, setTitle] = useState(''), [targets, setTargets] = useState<string[]>([]), [muted, setMuted] = useState(false), [cameraOff, setCameraOff] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user'), [portrait, setPortrait] = useState(true), [quality, setQuality] = useState('720');
  const [privacy, setPrivacy] = useState('unlisted'), [kids, setKids] = useState(''), [source, setSource] = useState('camera');
  const [elapsed, setElapsed] = useState(0), [wakeNotice, setWakeNotice] = useState('');
  const wake = useRef<any>(null);
  const eligible = accounts.filter(a => a.status === 'connected' && platforms.find(p => p.id === a.platform)?.live);
  function releaseCamera() { captureRequest.current++; stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; if (video.current) video.current.srcObject = null; if (mounted.current) setPreview(false); }
  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    const active = current.current;
    current.current = null;
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    recorder.current = null; socket.current?.disconnect(); socket.current = null;
    await wake.current?.release?.().catch(() => {}); wake.current = null;
    if (mounted.current) { setLive(null); setBusy(false); }
    if (active) await creatorApi(`/live/${active.id}/stop`, 'POST', {}).catch(() => { if (mounted.current) onError('The connection closed. Check your platforms to confirm the broadcast has ended.'); });
    stopping.current = false;
  }
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    if (signedIn) creatorApi('/live').then(r => { if (!cancelled && r.live) { current.current = r.live; setLive(r.live); } }).catch(() => {});
    const leaving = (event: BeforeUnloadEvent) => { if (current.current) { event.preventDefault(); event.returnValue = ''; } };
    const hidden = () => { if (document.hidden && current.current) setWakeNotice('Keep Studio open. Your phone may pause the camera in the background.'); };
    window.addEventListener('beforeunload', leaving); document.addEventListener('visibilitychange', hidden);
    return () => { cancelled = true; mounted.current = false; void stop(); releaseCamera(); window.removeEventListener('beforeunload', leaving); document.removeEventListener('visibilitychange', hidden); };
  }, [signedIn]);
  useEffect(() => { onBroadcastStateChange?.(starting ? 'preparing' : live ? 'active' : 'idle'); }, [starting, Boolean(live), onBroadcastStateChange]);
  useEffect(() => { if (!visible && !live && !starting) releaseCamera(); }, [visible, Boolean(live), starting]);
  useEffect(() => { if (!live) { setElapsed(0); return; } const timer = setInterval(() => setElapsed(x => x + 1), 1000); return () => clearInterval(timer); }, [Boolean(live)]);
  async function openCamera(nextFacing = facing, nextSource = source) {
    if (capturing.current || live) return;
    capturing.current = true; setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs a secure browser. Open Studio in Chrome or Safari.');
      releaseCamera();
      const request = captureRequest.current;
      let media: MediaStream;
      if (nextSource === 'screen') {
        if (!navigator.mediaDevices.getDisplayMedia) throw new Error('Screen sharing is not available in this browser. Use your camera.');
        media = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        if (!media.getAudioTracks().length) {
          try { const mic = await navigator.mediaDevices.getUserMedia({ audio: true }); mic.getAudioTracks().forEach(t => media.addTrack(t)); }
          catch { media.getTracks().forEach(t => t.stop()); throw new Error('Allow microphone access to continue.'); }
        }
      } else {
        const w = quality === '1080' ? 1080 : 720, h = quality === '1080' ? 1920 : 1280;
        media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacing }, width: { ideal: portrait ? w : h }, height: { ideal: portrait ? h : w }, frameRate: { ideal: 30, max: 30 } }, audio: { echoCancellation: true, noiseSuppression: true } });
      }
      if (!mounted.current || request !== captureRequest.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media; setMuted(false); setCameraOff(false); setFacing(nextFacing); setSource(nextSource); setPreview(true);
      if (video.current) { video.current.srcObject = media; await video.current.play().catch(() => {}); }
      media.getVideoTracks()[0]?.addEventListener('ended', () => { void stop(); releaseCamera(); });
    } catch (e: any) { onError(e.name === 'NotAllowedError' ? 'Allow camera and microphone access, then try again.' : e.message); }
    finally { capturing.current = false; if (mounted.current) setBusy(false); }
  }
  async function goLive() {
    if (!stream.current || busy || current.current) return;
    setBusy(true); setStarting(true); onError('');
    try {
      if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot broadcast. Try the latest Chrome or Safari.');
      const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
      if (!mimeType) throw new Error('This browser cannot broadcast this camera format.');
      const recording = new MediaRecorder(stream.current, { mimeType, videoBitsPerSecond: quality === '1080' ? 4500000 : 2500000, audioBitsPerSecond: 128000 });
      const active = await creatorApi('/live', 'POST', { title, targets, portrait, quality, privacy, madeForKids: kids === 'yes' });
      current.current = active;
      if (!mounted.current) { await stop(); return; }
      setLive(active); setElapsed(0);
      const ws = io(`${API_BASE_URL}/creator-live`, { auth: { broadcastId: active.id, ticket: active.ticket }, transports: ['websocket'], reconnection: false, timeout: 15000 });
      socket.current = ws;
      await new Promise<void>((resolve, reject) => { ws.once('connect', () => resolve()); ws.once('connect_error', () => reject(new Error('Broadcast connection failed. Please try again.'))); });
      ws.on('status', state => { if (mounted.current && current.current) setLive(state); });
      ws.on('ended', data => { if (data.needsReview) onError('Check your platforms to confirm every broadcast has ended.'); void stop(); });
      ws.on('disconnect', () => { if (current.current && !stopping.current) { onError('Broadcast connection lost. Reopen the studio and start again.'); void stop(); } });
      let sequence = 0, queuedBytes = 0, chain = Promise.resolve();
      recording.ondataavailable = event => {
        if (!event.data.size || !current.current) return;
        queuedBytes += event.data.size;
        if (queuedBytes > 4 * 1024 ** 2) { onError('Your upload connection is too slow. Restart at 720p.'); void stop(); return; }
        chain = chain.then(async () => {
          for (let offset = 0; offset < event.data.size; offset += 256 * 1024) {
            if (!current.current) return;
            const bytes = await event.data.slice(offset, offset + 256 * 1024).arrayBuffer();
            const response = await ws.timeout(12000).emitWithAck('chunk', { bytes, sequence: sequence++ });
            if (response.error) throw new Error(response.error);
          }
          queuedBytes -= event.data.size;
        }).catch(e => { if (current.current) { onError(e.message || 'Broadcast connection interrupted.'); void stop(); } });
      };
      recording.onerror = () => { onError('The camera stopped recording. Please restart the broadcast.'); void stop(); };
      recorder.current = recording; recording.start(400);
      try { wake.current = await (navigator as any).wakeLock?.request('screen'); } catch { setWakeNotice('Keep your screen awake while broadcasting.'); }
    } catch (e: any) { onError(e.message); await stop(); }
    finally { if (mounted.current) { setBusy(false); setStarting(false); } }
  }
  return <section className="cs-live-grid">
    <div className="cs-panel cs-camera-panel">
      <div className="cs-section-heading"><h2>Live studio</h2><span className={live ? 'cs-tag cs-tag-live' : 'cs-tag'}>{live ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : 'Private preview'}</span></div>
      <div className={`cs-viewfinder ${portrait ? '' : 'cs-wide'}`}>
        <video ref={video} autoPlay playsInline muted style={{ transform: source === 'camera' && facing === 'user' ? 'scaleX(-1)' : undefined, display: preview ? 'block' : 'none' }} />
        {!preview && <div className="cs-camera-empty"><Camera size={40} strokeWidth={1.3} /><h3>Your studio, wherever you are</h3><p>Check your camera and sound before going live.</p><button className="cs-primary" onClick={() => openCamera()} disabled={busy}><Camera size={18} /> Enable camera</button></div>}
        {preview && <span className="cs-camera-label">{live ? 'Broadcasting · see destinations below' : 'Only you can see this'}</span>}
      </div>
      <div className="cs-camera-tools">
        <button disabled={!preview} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={muted} onClick={() => { stream.current?.getAudioTracks().forEach(t => { t.enabled = muted; }); setMuted(!muted); }}>{muted ? <MicOff /> : <Mic />}</button>
        <button disabled={!preview} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'} aria-pressed={cameraOff} onClick={() => { stream.current?.getVideoTracks().forEach(t => { t.enabled = cameraOff; }); setCameraOff(!cameraOff); }}>{cameraOff ? <VideoOff /> : <Video />}</button>
        <button disabled={!preview || busy || Boolean(live) || source === 'screen'} aria-label="Switch front and back camera" onClick={() => openCamera(facing === 'user' ? 'environment' : 'user')}><FlipHorizontal /></button>
        <button disabled={busy || Boolean(live)} aria-label="Share screen where supported" onClick={() => openCamera(facing, source === 'screen' ? 'camera' : 'screen')}><Monitor /></button>
      </div>
      {preview && !live && <button className="cs-link-button" onClick={releaseCamera}>Turn preview off</button>}
    </div>
    <div className="cs-panel cs-live-settings">
      <h2>Broadcast settings</h2>
      <label>Stream title<input value={title} maxLength={100} disabled={Boolean(live)} onChange={e => setTitle(e.target.value)} placeholder="What are you going live about?" /></label>
      <div className="cs-two-fields"><label>Format<select value={String(portrait)} disabled={Boolean(live) || preview} onChange={e => setPortrait(e.target.value === 'true')}><option value="true">Portrait · 9:16</option><option value="false">Landscape · 16:9</option></select></label><label>Quality<select value={quality} disabled={Boolean(live) || preview} onChange={e => setQuality(e.target.value)}><option value="720">720p · less data</option><option value="1080">1080p · best detail</option></select></label></div>
      {preview && !live && <p className="cs-muted">Turn preview off to change format or quality.</p>}
      <h3>Go live on</h3>
      {!eligible.length && <p className="cs-muted">Connect YouTube, a Facebook Page or Twitch in Accounts.</p>}
      <div className="cs-destinations">{eligible.map(a => <label className="cs-destination" key={a.id}><input type="checkbox" disabled={Boolean(live)} checked={targets.includes(a.id)} onChange={() => setTargets(old => old.includes(a.id) ? old.filter(x => x !== a.id) : [...old, a.id])} /><span><strong>{a.name}</strong><small>{platforms.find(p => p.id === a.platform)?.name}</small></span></label>)}</div>
      {targets.some(id => eligible.find(a => a.id === id)?.platform === 'youtube') && <><label>YouTube visibility<select value={privacy} disabled={Boolean(live)} onChange={e => setPrivacy(e.target.value)}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label><label>Is this made for children?<select value={kids} disabled={Boolean(live)} onChange={e => setKids(e.target.value)}><option value="">Choose audience</option><option value="no">No, not made for children</option><option value="yes">Yes, made for children</option></select></label></>}
      {targets.some(id => eligible.find(a => a.id === id)?.platform !== 'youtube') && <p className="cs-muted">Facebook and Twitch use their platform’s broadcast visibility. YouTube visibility only applies to YouTube.</p>}
      {live && <div className="cs-live-status" aria-live="polite">{live.destinations.map((d: any) => <div key={d.id}><span>{d.name}</span><strong className={d.status === 'live' ? 'cs-on-air' : ''}>{({ connecting: 'Connecting', sending: 'Sending video', live: 'Live confirmed', failed: 'Connection failed', ended: 'Ended' } as any)[d.status]}</strong></div>)}</div>}
      {wakeNotice && <p className="cs-notice">{wakeNotice}</p>}
      {!enabled && <p className="cs-notice">Live broadcasting is being prepared. Camera preview is available now.</p>}
      {live ? <button className="cs-danger" onClick={() => void stop()}><Square size={18} /> End broadcast everywhere</button> : <button className="cs-primary cs-go-live" onClick={goLive} disabled={!enabled || !signedIn || !preview || !title.trim() || !targets.length || targets.length > 3 || busy || (targets.some(id => eligible.find(a => a.id === id)?.platform === 'youtube') && !kids)}><Radio size={19} /> {busy ? 'Preparing broadcast…' : `Go live${targets.length ? ` on ${targets.length}` : ''}`}</button>}
      <p className="cs-muted">Keep this page open while live. Video uses mobile data; Wi-Fi is recommended.</p>
    </div>
  </section>;
}
