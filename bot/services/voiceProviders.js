import { VOICE_DEFAULTS } from '../config/voiceDefaults.js';

const HEALTH_CACHE_TTL_MS = 15_000;

function normalizeBaseUrl(url = '') {
  return String(url || '').replace(/\/$/, '');
}

async function parseMaybeJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export class CurrentVoiceProvider {
  constructor() {
    this.id = 'current';
  }

  async synthesize() {
    return {
      provider: 'current',
      synthesis: null
    };
  }

  async health() {
    return { ok: true, provider: this.id, modelLoaded: false };
  }
}

export class PersonaPlexVoiceProvider {
  constructor({ serviceUrl, apiUrl, apiKey, synthesisPath = '/v1/speech/synthesize' } = {}) {
    this.id = 'personaplex';
    this.serviceUrl = normalizeBaseUrl(serviceUrl || process.env.PERSONAPLEX_SERVICE_URL || '');
    this.apiUrl = normalizeBaseUrl(apiUrl || process.env.PERSONAPLEX_API_URL || '');
    this.apiKey = apiKey || process.env.PERSONAPLEX_API_KEY || '';
    this.synthesisPath = synthesisPath || process.env.PERSONAPLEX_SYNTHESIS_PATH || '/v1/speech/synthesize';
    this._lastHealth = null;
    this._lastHealthAt = 0;
  }

  async health() {
    const now = Date.now();
    if (this._lastHealth && now - this._lastHealthAt < HEALTH_CACHE_TTL_MS) {
      return this._lastHealth;
    }

    let status = { ok: false, provider: this.id, modelLoaded: false };
    if (this.serviceUrl) {
      try {
        const response = await fetch(`${this.serviceUrl}/health`);
        if (response.ok) {
          const payload = await parseMaybeJson(response);
          status = {
            ok: true,
            provider: this.id,
            modelLoaded: Boolean(payload?.modelLoaded ?? payload?.model_loaded ?? true)
          };
        }
      } catch {
        status = { ok: false, provider: this.id, modelLoaded: false };
      }
    }

    this._lastHealth = status;
    this._lastHealthAt = now;
    return status;
  }

  async synthesize({ text, voiceId, locale, personaPrompt, metadata }) {
    if (!String(text || '').trim()) {
      throw new Error('text is required for synthesis');
    }

    if (this.serviceUrl) {
      const health = await this.health();
      if (!health.ok) {
        throw new Error('PersonaPlex service is unavailable');
      }

      const response = await fetch(`${this.serviceUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId,
          locale,
          personaPrompt,
          metadata,
          format: 'wav'
        })
      });

      if (!response.ok) {
        throw new Error(`PersonaPlex service /tts failed (${response.status})`);
      }

      const payload = await parseMaybeJson(response);
      return {
        provider: 'nvidia-personaplex',
        synthesis: {
          audioBase64: payload?.audioBase64 || payload?.audio_base64 || null,
          audioUrl: payload?.audioUrl || payload?.audio_url || null,
          mimeType: payload?.mimeType || payload?.mime_type || 'audio/wav',
          raw: payload
        }
      };
    }

    if (!this.apiUrl) {
      throw new Error('PersonaPlex not configured. Set PERSONAPLEX_SERVICE_URL or PERSONAPLEX_API_URL.');
    }

    const response = await fetch(`${this.apiUrl}${this.synthesisPath.startsWith('/') ? this.synthesisPath : `/${this.synthesisPath}`}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        input: text,
        voice: voiceId,
        locale,
        persona_prompt: personaPrompt,
        metadata
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`PersonaPlex synthesis failed (${response.status}): ${details}`);
    }

    const payload = await parseMaybeJson(response);
    return {
      provider: 'nvidia-personaplex',
      synthesis: {
        audioBase64: payload?.audioBase64 || payload?.audio_base64 || null,
        audioUrl: payload?.audioUrl || payload?.audio_url || null,
        mimeType: payload?.mimeType || payload?.mime_type || 'audio/mpeg',
        raw: payload
      }
    };
  }
}

let singleton = null;

export function createVoiceProvider() {
  const configured = String(process.env.VOICE_PROVIDER || 'current').toLowerCase();
  if (configured === 'personaplex') {
    return new PersonaPlexVoiceProvider();
  }
  return new CurrentVoiceProvider();
}

export function getVoiceProvider() {
  if (!singleton) singleton = createVoiceProvider();
  return singleton;
}

export function getVoiceContextDefaults(context = 'commentary') {
  return context === 'help' ? VOICE_DEFAULTS.help : VOICE_DEFAULTS.commentary;
}
