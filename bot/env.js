function isTruthy(value) {
  if (!value) return false;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

function requireEnv(key, { allowEmpty = false } = {}) {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error(`${key} is required`);
  }
  if (!allowEmpty && String(value).trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value;
}

function warnMissing(key, hint) {
  if (!process.env[key]) {
    console.warn(`WARN: ${key} is not set${hint ? ` (${hint})` : ''}`);
  }
}

export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';

  // Required for production runtime.
  if (isProd) {
    requireEnv('BOT_TOKEN');
    // MONGO_URI can be set later by server.js fallback, but in production we want it explicit.
    requireEnv('MONGO_URI');
  }

  // Optional but recommended.
  warnMissing(
    'ALLOWED_ORIGINS',
    'comma-separated list, e.g. https://tonplaygram-bot.onrender.com,https://web.telegram.org'
  );

  // TON claim / withdraw requirements.
  const withdrawEnabled = isTruthy(process.env.WITHDRAW_ENABLED);
  if (withdrawEnabled) {
    // These are required to sign claim transfers.
    warnMissing('CLAIM_CONTRACT_ADDRESS');
    warnMissing('CLAIM_WALLET_MNEMONIC');
  }

  // Token used for privileged server-to-server calls (optional but useful).
  warnMissing('API_AUTH_TOKEN');

  // Server-side TTS fallback (recommended for Telegram WebView where speechSynthesis may not output audio).
  warnMissing('OPENAI_API_KEY', 'required for /api/tts/speak');
  warnMissing('OPENAI_TTS_MODEL', "optional (default: gpt-4o-mini-tts)");

  return {
    isProd,
    withdrawEnabled
  };
}
