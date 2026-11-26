import { readInstagramMarketingSnapshot } from '../services/instagramMarketingSnapshot.js';

// Run only on a trusted server or maintainer terminal with the separately
// authorized professional-account analytics credential. No app route or reward.
try {
  const snapshot = await readInstagramMarketingSnapshot({
    accountId: process.env.INSTAGRAM_MARKETING_ACCOUNT_ID,
    mediaId: process.env.INSTAGRAM_MARKETING_REEL_ID,
    token: process.env.INSTAGRAM_MARKETING_ACCESS_TOKEN
  });
  console.log(JSON.stringify(snapshot, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
