import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
mock.module('../bot.js', { defaultExport: { telegram: { sendMessage: async () => {} } } });
mock.module('../utils/notifications.js', { namedExports: { sendTransferNotification: async () => {}, sendGiftNotification: async () => {}, sendDepositNotification: async () => {}, sendStorePurchaseNotification: async () => {} } });
let calls = [];
mock.module('../services/accountDeletion.js', { namedExports: { deleteAccountRecords: async (...args) => { calls.push(args); } } });
const { OAuth2Client } = await import('google-auth-library');
const { default: router } = await import('../routes/profile.js');
const stack = router.stack.find((l) => l.route?.path === '/delete').route.stack;
const handler = stack.at(-1).handle;
const response = () => ({ statusCode: 200, setHeader() {}, status(n) { this.statusCode=n; return this; }, json(body) { this.body=body; return this; } });
test('deletion rejects identifier headers, API token and selector injection without signed identity', async () => {
  calls = [];
  for (const accountId of ['owner', { $ne: null }, '', null]) {
    const res=response();
    await handler({ body: { accountId, confirmation:'DELETE' }, get: (key) => ({ 'x-google-id':'owner', 'x-tpc-account-id':'owner', authorization:'Bearer secret' })[key], auth: { apiToken:true } }, res);
    assert.ok([400,401].includes(res.statusCode));
  }
  assert.equal(calls.length,0);
});
test('signed Google-only deletion reaches service without legacy authenticate middleware', async () => {
  process.env.GOOGLE_CLIENT_ID='client';
  const verifier=mock.method(OAuth2Client.prototype,'verifyIdToken',async () => ({ getPayload: () => ({sub:'owner-google', aud:'client', iss:'https://accounts.google.com', exp:Date.now()/1000+300,iat:Date.now()/1000}) }));
  try {
    calls=[];
    const res=response();
    await handler({ body:{accountId:'owner',confirmation:'DELETE'},get:key=>key==='x-google-id-token'?'signed':undefined },res);
    assert.equal(stack.length,1);
    assert.equal(res.statusCode,200);
    assert.equal(calls[0][1].googleId,'owner-google');
    assert.equal(res.body.success,true);
  } finally { verifier.mock.restore(); }
});
