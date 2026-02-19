import { FormEvent, useMemo, useRef, useState } from 'react';

type VoiceItem = {
  voicePromptId: string;
  label: string;
};

type ApiResponse = {
  text: string;
  audioUrl?: string | null;
  audioBase64?: string | null;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function getAudioSrc(response: ApiResponse): string | undefined {
  if (response.audioUrl) return response.audioUrl;
  if (response.audioBase64) return `data:audio/wav;base64,${response.audioBase64}`;
  return undefined;
}

export function VoiceAssistantPanel() {
  const [status, setStatus] = useState('Idle');
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [voicePromptId, setVoicePromptId] = useState<string>('');
  const [sessionId] = useState(() => crypto.randomUUID());
  const [audioSrc, setAudioSrc] = useState<string | undefined>(undefined);
  const [lastText, setLastText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'support' | 'commentary'>('support');
  const [eventType, setEventType] = useState('GOAL_SCORED');
  const [eventPayload, setEventPayload] = useState('{"player":"Alice","points":10}');

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedVoice = useMemo(() => voices.find((voice) => voice.voicePromptId === voicePromptId), [voicePromptId, voices]);

  async function fetchVoices() {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/voices`);
      const body = await res.json();
      const nextVoices = (body.voices || []) as VoiceItem[];
      setVoices(nextVoices);
      if (!voicePromptId && nextVoices[0]?.voicePromptId) {
        setVoicePromptId(nextVoices[0].voicePromptId);
      }
      setStatus(`Loaded ${nextVoices.length} voice prompt(s)`);
    } catch (error) {
      setStatus(`Failed to load voices: ${String(error)}`);
    }
  }

  async function enableMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setStatus('Microphone enabled. You can now record.');
    } catch (error) {
      setStatus(`Microphone permission error: ${String(error)}`);
    }
  }

  function startRecording() {
    if (!streamRef.current) {
      setStatus('Enable microphone first.');
      return;
    }

    chunks.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    recorder.onstart = () => setStatus('Recording... press Stop to send request');
    recorder.onstop = async () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      await sendVoice(blob);
    };
    recorder.start();
    mediaRecorder.current = recorder;
  }

  function stopRecording() {
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
  }

  async function sendVoice(blob: Blob) {
    const form = new FormData();
    form.append('audio', blob, 'voice.webm');
    form.append('sessionId', sessionId);
    if (voicePromptId) form.append('voicePromptId', voicePromptId);

    setStatus('Sending voice request...');
    try {
      const res = await fetch(`${API_BASE_URL}/v1/support/voice`, { method: 'POST', body: form });
      const body = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(JSON.stringify(body));
      setLastText(body.text);
      setAudioSrc(getAudioSrc(body));
      setStatus('Voice support response received');
    } catch (error) {
      setStatus(`Voice support failed: ${String(error)}`);
    }
  }

  async function handleCommentary(event: FormEvent) {
    event.preventDefault();
    setStatus('Requesting commentary...');
    try {
      const payload = {
        sessionId,
        eventType,
        eventPayload: JSON.parse(eventPayload),
        voicePromptId: voicePromptId || undefined,
      };
      const res = await fetch(`${API_BASE_URL}/v1/commentary/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(JSON.stringify(body));
      setLastText(body.text);
      setAudioSrc(getAudioSrc(body));
      setStatus('Commentary generated');
    } catch (error) {
      setStatus(`Commentary failed: ${String(error)}`);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', fontFamily: 'Inter, sans-serif', padding: 16 }}>
      <h1>PersonaPlex Voice Hub</h1>
      <p>Status: {status}</p>
      <p>Session: <code>{sessionId}</code></p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setActiveTab('support')}>Help Center Voice Agent</button>
        <button onClick={() => setActiveTab('commentary')}>Voice Commentary</button>
      </div>

      <section style={{ border: '1px solid #333', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3>Voice Prompt Selection</h3>
        <button onClick={fetchVoices}>Refresh Voices</button>
        <select value={voicePromptId} onChange={(event) => setVoicePromptId(event.target.value)} style={{ marginLeft: 8 }}>
          <option value="">Default voice</option>
          {voices.map((voice) => (
            <option key={voice.voicePromptId} value={voice.voicePromptId}>{voice.label}</option>
          ))}
        </select>
        <p>Selected: {selectedVoice?.label || 'Default'}</p>
      </section>

      {activeTab === 'support' && (
        <section style={{ border: '1px solid #333', borderRadius: 8, padding: 12 }}>
          <h3>Support Voice Chat</h3>
          <button onClick={enableMicrophone}>Enable Microphone</button>
          <button onClick={startRecording} style={{ marginLeft: 8 }}>Start (Push-to-talk)</button>
          <button onClick={stopRecording} style={{ marginLeft: 8 }}>Stop & Send</button>
        </section>
      )}

      {activeTab === 'commentary' && (
        <section style={{ border: '1px solid #333', borderRadius: 8, padding: 12 }}>
          <h3>Game Event Commentary</h3>
          <form onSubmit={handleCommentary}>
            <label>
              Event Type
              <input value={eventType} onChange={(event) => setEventType(event.target.value)} style={{ marginLeft: 8 }} />
            </label>
            <br />
            <label>
              Event Payload JSON
              <textarea value={eventPayload} onChange={(event) => setEventPayload(event.target.value)} rows={4} style={{ width: '100%', marginTop: 8 }} />
            </label>
            <button type="submit" style={{ marginTop: 8 }}>Generate Commentary</button>
          </form>
        </section>
      )}

      <section style={{ marginTop: 16 }}>
        <h3>Assistant Output</h3>
        <p>{lastText || 'No response yet.'}</p>
        {audioSrc ? <audio controls src={audioSrc} /> : <p>Audio unavailable (fallback text-only mode).</p>}
      </section>
    </main>
  );
}
