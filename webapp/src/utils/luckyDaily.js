import { post } from './api.js';

// Identity, UTC day, eligibility and amount are all chosen by the server.
// Retrying an ambiguous response is safe: the endpoint is once per account/day.
export async function claimLuckyDaily() {
  const result = await post('/api/lucky-daily/claim', {});
  if (result?.error || result?.claimed !== true || !Number.isFinite(result.balance)) {
    throw new Error('Daily reward could not be confirmed. Please sign in and retry.');
  }
  return result;
}
