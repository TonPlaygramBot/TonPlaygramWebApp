import { Router } from 'express';
import { TwitterApi } from 'twitter-api-v2';

const router = Router();

const oauthStore = new Map();

function getTwitterCreds() {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn('X OAuth not configured');
    return null;
  }
  return { clientId, clientSecret };
}

router.post('/start', async (req, res) => {
  const { telegramId } = req.body || {};
  if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
  const creds = getTwitterCreds();
  if (!creds) {
    return res.status(500).json({ error: 'X OAuth not configured' });
  }
  const { clientId, clientSecret } = creds;
  try {
    const twitterClient = new TwitterApi({ appKey: clientId, appSecret: clientSecret });
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/twitter/callback`;
    const { url, oauth_token, oauth_token_secret } = await twitterClient.generateAuthLink(callbackUrl);
    oauthStore.set(oauth_token, { secret: oauth_token_secret, telegramId });
    setTimeout(() => oauthStore.delete(oauth_token), 5 * 60 * 1000);
    res.json({ url });
  } catch (err) {
    console.error('x start failed:', err);
    res.status(500).json({ error: 'failed to start auth' });
  }
});

router.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const entry = oauthStore.get(oauth_token);
  if (!entry) {
    return res.status(400).send('Invalid token');
  }
  const creds = getTwitterCreds();
  if (!creds) {
    return res.status(500).send('X OAuth not configured');
  }
  const { clientId, clientSecret } = creds;
  try {
    const twitterClient = new TwitterApi({
      appKey: clientId,
      appSecret: clientSecret,
      accessToken: oauth_token,
      accessSecret: entry.secret,
    });
    const { client: loggedClient, accessToken, accessSecret, screenName, userId } = await twitterClient.login(oauth_verifier);
    oauthStore.delete(oauth_token);
    // Save the X handle via existing profile route
    await fetch(`${req.protocol}://${req.get('host')}/api/profile/link-social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: entry.telegramId, twitter: screenName }),
    });
    res.send('X account linked. You can close this window.');
  } catch (err) {
    console.error('x callback failed:', err);
    res.status(500).send('Failed to link X');
  }
});

export default router;
