// Use the API base URL from the build environment or fallback to the same origin

// so the webapp works when served by the Express server in production.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
export const API_AUTH_TOKEN = import.meta.env.VITE_API_AUTH_TOKEN || '';

export async function ping() {
  const data = await get('/api/ping');
  return data.message;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
  try {
    const res = await fetch(url, options);
    if (res.status === 502 && retries > 0) {
      await wait(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await wait(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const initData = window?.Telegram?.WebApp?.initData;
  if (initData) headers['X-Telegram-Init-Data'] = initData;

  let res;
  try {
    res = await fetchWithRetry(API_BASE_URL + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
  } catch (err) {
    return { error: 'Network request failed' };
  }

  // Read response as text first to handle non-JSON replies gracefully
  let text;
  try {
    text = await res.text();
  } catch {
    return { error: 'Invalid server response' };
  }
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    // Provide a generic error instead of exposing parse details
    return { error: 'Invalid server response' };
  }
  if (!res.ok) {
    if (res.status === 502) {
      return { error: 'Server unavailable. Please try again later.' };
    }
    return { error: data.error || res.statusText || 'Request failed' };
  }
  return data;
}

async function get(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const initData = window?.Telegram?.WebApp?.initData;
  if (initData) headers['X-Telegram-Init-Data'] = initData;

  let res;
  try {
    res = await fetchWithRetry(API_BASE_URL + path, { headers });
  } catch (err) {
    return { error: 'Network request failed' };
  }

  let text;
  try {
    text = await res.text();
  } catch {
    return { error: 'Invalid server response' };
  }
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    return { error: 'Invalid server response' };
  }
  if (!res.ok) {
    if (res.status === 502) {
      return { error: 'Server unavailable. Please try again later.' };
    }
    return { error: data.error || res.statusText || 'Request failed' };
  }
  return data;
}

export function getMiningStatus(telegramId) {
  return post('/api/mining/status', { telegramId });
}

export function startMining(telegramId) {
  return post('/api/mining/start', { telegramId });
}

export function stopMining(telegramId) {
  return post('/api/mining/stop', { telegramId });
}

export function claimMining(telegramId) {
  return post('/api/mining/claim', { telegramId });
}

export function getLeaderboard(id) {
  let body;
  if (typeof id === 'object') body = id;
  else if (typeof id === 'string' && id.includes('-')) body = { accountId: id };
  else body = { telegramId: id };
  return post('/api/mining/leaderboard', body);
}

export function listTasks(telegramId) {
  return post('/api/tasks/list', { telegramId });
}

export function completeTask(telegramId, taskId) {
  return post('/api/tasks/complete', { telegramId, taskId });
}

export function verifyPost(telegramId, tweetUrl) {
  return post('/api/tasks/verify-post', { telegramId, tweetUrl });
}

export function verifyTelegramReaction(telegramId, messageId, threadId) {
  return post('/api/tasks/verify-telegram-reaction', {
    telegramId,
    messageId,
    threadId
  });
}

export function adminListTasks() {
  return post('/api/tasks/admin/list', {}, API_AUTH_TOKEN || undefined);
}

export function adminCreateTask(platform, reward, link, description) {
  return post(
    '/api/tasks/admin/create',
    { platform, reward, link, description },
    API_AUTH_TOKEN || undefined
  );
}

export function adminUpdateTask(id, platform, reward, link, description) {
  return post(
    '/api/tasks/admin/update',
    { id, platform, reward, link, description },
    API_AUTH_TOKEN || undefined
  );
}

export function adminDeleteTask(id) {
  return post('/api/tasks/admin/delete', { id }, API_AUTH_TOKEN || undefined);
}

export function listVideos(telegramId) {
  return post('/api/watch/list', { telegramId });
}

export function watchVideo(telegramId, videoId) {
  return post('/api/watch/watch', { telegramId, videoId });
}

export function getAdStatus(telegramId) {
  return post('/api/ads/status', { telegramId });
}

export function watchAd(telegramId) {
  return post('/api/ads/watch', { telegramId });
}

export function getQuestStatus(telegramId) {
  return post('/api/ads/quest-status', { telegramId });
}

export function completeQuest(telegramId) {
  return post('/api/ads/quest-watch', { telegramId });
}

export function submitInfluencerVideo(telegramId, platform, videoUrl) {
  return post('/api/influencer/submit', { telegramId, platform, videoUrl });
}

export function myInfluencerVideos(telegramId) {
  return post('/api/influencer/mine', { telegramId });
}

export function listAllInfluencer() {
  return get('/api/influencer/admin', API_AUTH_TOKEN);
}

export function verifyInfluencer(id, status, views) {
  const headers = { 'Content-Type': 'application/json' };
  if (API_AUTH_TOKEN) headers['Authorization'] = `Bearer ${API_AUTH_TOKEN}`;
  const initData = window?.Telegram?.WebApp?.initData;
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  return fetch(API_BASE_URL + `/api/influencer/admin/${id}/verify`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status, views })
  }).then(async (res) => {
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { error: 'Invalid server response' };
    }
    if (!res.ok) return { error: data.error || res.statusText };
    return data;
  });
}

export function getProfile(telegramId) {
  return post('/api/profile/get', { telegramId });
}

export function updateProfile(data) {
  return post('/api/profile/update', data);
}

export function updateBalance(telegramId, balance) {
  return post('/api/profile/updateBalance', { telegramId, balance });
}

export function addTransaction(telegramId, amount, type, extra = {}) {
  const body = {
    amount,
    type,
    ...extra
  };
  if (telegramId != null) body.telegramId = telegramId;
  return post('/api/profile/addTransaction', body);
}

export function getProfileByAccount(accountId) {
  return post('/api/profile/by-account', { accountId });
}

export function linkSocial(data) {
  return post('/api/profile/link-social', data);
}

export function fetchTelegramInfo(telegramId) {
  return post('/api/profile/telegram-info', { telegramId });
}

export function getWalletBalance(telegramId) {
  return post('/api/wallet/balance', { telegramId });
}

export function getTonBalance(address) {
  return post('/api/wallet/ton-balance', { address });
}

export function getUsdtBalance(address) {
  return post('/api/wallet/usdt-balance', { address });
}
export function sendTpc(fromId, toId, amount, note) {
  const body = { fromId, toId, amount };
  if (note) body.note = note;
  return post('/api/wallet/send', body);
}

export function getTransactions(telegramId) {
  return post('/api/wallet/transactions', { telegramId });
}

export function getDepositAddress() {
  return get('/api/wallet/deposit-address');
}

export function deposit(telegramId, amount) {
  return post('/api/wallet/deposit', { telegramId, amount });
}

export function withdraw(telegramId, address, amount) {
  return post('/api/wallet/withdraw', { telegramId, address, amount });
}

export function claimExternal(telegramId, address, amount) {
  return post('/api/wallet/claim-external', { telegramId, address, amount });
}

export function getReferralInfo(telegramId) {
  return post('/api/referral/code', { telegramId });
}

export function claimReferral(telegramId, code) {
  return post('/api/referral/claim', { telegramId, code });
}

// ✅ Daily check-in (user-facing)

export function dailyCheckIn(telegramId) {
  return post('/api/checkin/check-in', { telegramId });
}

// ✅ Admin-only airdrop grant

export function grantAirdrop(token, telegramId, amount, reason = '') {
  return post('/api/airdrop/grant', { telegramId, amount, reason }, token);
}

export function grantAirdropAll(token, amount, reason = '') {
  return post('/api/airdrop/grant-all', { amount, reason }, token);
}

export function getSnakeLobbies() {
  return get('/api/snake/lobbies');
}

export function getSnakeLobby(id) {
  return get('/api/snake/lobby/' + id);
}

export function getSnakeBoard(id) {
  return get('/api/snake/board/' + id);
}

export function getSnakeResults() {
  return get('/api/snake/results');
}

export function seatTable(playerId, tableId, name) {
  return post('/api/snake/table/seat', { playerId, tableId, name });
}

export function unseatTable(playerId, tableId) {
  return post('/api/snake/table/unseat', { playerId, tableId });
}

export function pingOnline(playerId, status) {
  return post('/api/online/ping', { playerId, status });
}

export function getOnlineCount() {
  return get('/api/online/count');
}

export function getOnlineUsers() {
  return get('/api/online/list');
}

export function registerWallet(walletAddress) {
  return post('/api/profile/register-wallet', { walletAddress });
}

export function linkGoogleAccount(data) {
  return post('/api/profile/link-google', data);
}

export function linkTelegramAccount(data) {
  return post('/api/profile/link-telegram', data);
}

export function searchUsers(query) {
  return post('/api/social/search', { query });
}

export function sendFriendRequest(fromId, toId) {
  return post('/api/social/request', { fromId, toId });
}

export function listFriendRequests(telegramId) {
  return post('/api/social/requests', { telegramId });
}

export function acceptFriendRequest(requestId) {
  return post('/api/social/accept', { requestId });
}

export function listFriends(telegramId) {
  return post('/api/social/friends', { telegramId });
}

export function sendMessage(fromId, toId, text) {
  return post('/api/social/send-message', { fromId, toId, text });
}

export function sendGift(fromId, toId, gift) {
  return post('/api/account/gift', {
    fromAccount: fromId,
    toAccount: toId,
    gift
  });
}

export function convertGifts(accountId, giftIds, action = 'burn', toAccount) {
  const body = { accountId, giftIds, action };
  if (toAccount) body.toAccount = toAccount;
  return post('/api/account/convert-gifts', body);
}

export function getMessages(telegramId, withId) {
  return post('/api/social/messages', { telegramId, withId });
}

export function getUnreadCount(telegramId) {
  return post('/api/social/unread-count', { telegramId });
}

export function markInboxRead(telegramId) {
  return post('/api/social/mark-read', { telegramId });
}

export function listWallPosts(ownerId) {
  return post('/api/social/wall/list', { ownerId });
}

export function listWallFeed(telegramId) {
  return post('/api/social/wall/feed', { telegramId });
}

export function createWallPost(
  ownerId,
  authorId,
  text,
  photo,
  photoAlt,
  tags = [],
  sharedPost
) {
  return post('/api/social/wall/post', {
    ownerId,
    authorId,
    text,
    photo,
    photoAlt,
    tags,
    sharedPost
  });
}

export function likeWallPost(postId, telegramId) {
  return post('/api/social/wall/like', { postId, telegramId });
}

export function commentWallPost(postId, telegramId, text) {
  return post('/api/social/wall/comment', { postId, telegramId, text });
}

export function shareWallPost(postId, telegramId) {
  return post('/api/social/wall/share', { postId, telegramId });
}

export function reactWallPost(postId, telegramId, emoji) {
  return post('/api/social/wall/react', { postId, telegramId, emoji });
}

export function pinWallPost(postId, telegramId, pinned) {
  return post('/api/social/wall/pin', { postId, telegramId, pinned });
}

export function listTrendingPosts(limit = 20) {
  return post('/api/social/wall/trending', { limit });
}

export function resetTpcWallet(telegramId) {
  return post('/api/wallet/reset', { telegramId });
}

export function registerWalletPasskey(telegramId, passkeyId, publicKey) {
  return post('/api/wallet/passkey', { telegramId, passkeyId, publicKey });
}

// ----- Account based wallet -----

export function createAccount(telegramId, googleId) {
  const body = {};
  if (telegramId) body.telegramId = telegramId;
  if (googleId) body.googleId = googleId;
  return post('/api/account/create', body);
}

export function getAccountBalance(accountId) {
  return post('/api/account/balance', { accountId });
}

export function getAccountInfo(accountId) {
  return post('/api/account/info', { accountId });
}

export function sendAccountTpc(fromAccount, toAccount, amount, note) {
  const body = { fromAccount, toAccount, amount };
  if (note) body.note = note;
  return post('/api/account/send', body);
}

export function getAccountTransactions(accountId) {
  return post('/api/account/transactions', { accountId });
}

export function getGameTransactions(limit = 1000) {
  return get(`/api/account/transactions/public?limit=${limit}`);
}

export function getMiningTransactions(limit = 1000) {
  return get(`/api/mining/transactions?limit=${limit}`);
}

export function depositAccount(accountId, amount, extra = {}) {
  return post(
    '/api/account/deposit',
    { accountId, amount, ...extra },
    API_AUTH_TOKEN || undefined
  );
}

export function buyBundle(accountId, bundle) {
  return post('/api/store/purchase', { accountId, bundle });
}

export function claimPurchase(accountId, txHash) {
  return post('/api/store/purchase', { accountId, txHash });
}

export function sendBroadcast(data) {
  return post('/api/broadcast/send', data, API_AUTH_TOKEN || undefined);
}

export function getWatchCount(tableId) {
  return get('/api/watchers/count/' + tableId);
}

export function getAppStats() {
  return get('/api/stats');
}
