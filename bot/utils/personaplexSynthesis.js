function normalizeBase64(value) {
  if (!value || typeof value !== 'string') return null;
  return value.startsWith('data:audio') ? value : `data:audio/mpeg;base64,${value}`;
}

function extractAudioSource(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return (
    payload.audioUrl ||
    payload.audio_url ||
    payload.url ||
    payload.outputUrl ||
    normalizeBase64(payload.audioBase64) ||
    normalizeBase64(payload.audio_base64) ||
    normalizeBase64(payload.base64Audio) ||
    null
  );
}

export async function synthesizeWithPersonaPlex({ text, voiceId, locale, metadata = {} }) {
  const endpoint = process.env.PERSONAPLEX_API_URL;
  const apiKey = process.env.PERSONAPLEX_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error('PersonaPlex credentials are not configured');
  }

  const url = `${endpoint.replace(/\/$/, '')}/v1/speech/synthesize`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      locale,
      voice: voiceId,
      metadata
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`PersonaPlex synthesis failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const audioSource = extractAudioSource(payload);
  if (!audioSource) {
    throw new Error('PersonaPlex response did not include an audio source');
  }

  return { audioSource, raw: payload };
}
