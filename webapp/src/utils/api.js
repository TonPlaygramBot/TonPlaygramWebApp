// Use the API base URL from the build environment or fallback to the same origin

// so the webapp works when served by the Express server in production.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function ping() {

  const res = await fetch(API_BASE_URL + '/api/ping');

  const data = await res.json();

  return data.message;

}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const initData = window?.Telegram?.WebApp?.initData;
  if (initData) headers['X-Telegram-Init-Data'] = initData;

  const res = await fetch(API_BASE_URL + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  let data;
  try {
    data = await res.json();
  } catch (err) {
    return { error: err.message };
  }
  if (!res.ok) {
    return { error: data.error || res.statusText };
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
  return post("/api/mining/leaderboard", body);
}

export function listTasks(telegramId) {

  return post('/api/tasks/list', { telegramId });

}

export function completeTask(telegramId, taskId) {

  return post('/api/tasks/complete', { telegramId, taskId });

}

export function listVideos(telegramId) {

  return post('/api/watch/list', { telegramId });

}

export function watchVideo(telegramId, videoId) {

  return post('/api/watch/watch', { telegramId, videoId });

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
  return post('/api/profile/addTransaction', {
    telegramId,
    amount,
    type,
    ...extra,
  });
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

export function sendTpc(fromId, toId, amount) {

  return post('/api/wallet/send', { fromId, toId, amount });

}

export function getTransactions(telegramId) {

  return post('/api/wallet/transactions', { telegramId });

}

export function getDepositAddress() {
  return fetch(API_BASE_URL + '/api/wallet/deposit-address').then((r) => r.json());
}

export function deposit(telegramId, amount) {
  return post('/api/wallet/deposit', { telegramId, amount });
}

export function withdraw(telegramId, address, amount) {
  return post('/api/wallet/withdraw', { telegramId, address, amount });
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
  return fetch(API_BASE_URL + '/api/snake/lobbies').then((r) => r.json());
}

export function getSnakeLobby(id) {
  return fetch(API_BASE_URL + '/api/snake/lobby/' + id).then((r) => r.json());
}

export function getSnakeBoard(id) {
  return fetch(API_BASE_URL + '/api/snake/board/' + id).then((r) => r.json());
}

export function getSnakeResults() {
  return fetch(API_BASE_URL + '/api/snake/results').then((r) => r.json());
}

export function seatTable(playerId, tableId, name) {
  return fetch(API_BASE_URL + '/api/snake/table/seat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, tableId, name }),
  }).then((r) => r.json());
}

export function unseatTable(playerId, tableId) {
  return fetch(API_BASE_URL + '/api/snake/table/unseat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, tableId }),
  }).then((r) => r.json());
}

export function pingOnline(playerId) {
  return fetch(API_BASE_URL + '/api/online/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId }),
  }).then((r) => r.json());
}

export function getOnlineCount() {
  return fetch(API_BASE_URL + '/api/online/count').then((r) => r.json());
}

export function getOnlineUsers() {
  return fetch(API_BASE_URL + '/api/online/list').then((r) => r.json());
}

export function registerWallet(walletAddress) {
  return post('/api/profile/register-wallet', { walletAddress });
}

export function linkGoogleAccount(data) {
  return post('/api/profile/link-google', data);
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

export function getMessages(userId, withId) {
  return post('/api/social/messages', { userId, withId });
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

export function createAccount(telegramId) {
  const body = {};
  if (telegramId) body.telegramId = telegramId;
  return post('/api/account/create', body);
}

export function getAccountBalance(accountId) {
  return post('/api/account/balance', { accountId });
}

export function sendAccountTpc(fromAccount, toAccount, amount) {
  return post('/api/account/send', { fromAccount, toAccount, amount });
}

export function getAccountTransactions(accountId) {
  return post('/api/account/transactions', { accountId });
}

export function depositAccount(accountId, amount, extra = {}) {
  return post('/api/account/deposit', { accountId, amount, ...extra });
}

export function buyBundle(accountId, bundle) {
  return post('/api/store/purchase', { accountId, bundle });
}

export function claimPurchase(accountId, txHash) {
  return post('/api/store/purchase', { accountId, txHash });
}