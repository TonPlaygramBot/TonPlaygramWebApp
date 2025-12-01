(function () {
  const API_BASE_URL = window.API_BASE_URL || '';

  async function post(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const initData = window?.Telegram?.WebApp?.initData;
    if (initData) headers['X-Telegram-Init-Data'] = initData;
    let res;
    try {
      res = await fetch(API_BASE_URL + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
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
    } catch {
      return { error: 'Invalid server response' };
    }
    if (!res.ok) {
      return { error: data.error || res.statusText || 'Request failed' };
    }
    return data;
  }

  window.blackjackApi = {
    async depositAccount(accountId, amount, extra = {}) {
      const res = await post('/api/account/deposit', {
        accountId,
        amount,
        ...extra
      });
      if (res && res.error) {
        return post('/api/profile/addTransaction', {
          amount,
          type: 'deposit',
          accountId,
          ...extra
        });
      }
      return res;
    },
    getAccountBalance(accountId) {
      return post('/api/account/balance', { accountId });
    },
    addTransaction(telegramId, amount, type, extra = {}) {
      const body = { amount, type, ...extra };
      if (telegramId != null) body.telegramId = telegramId;
      return post('/api/profile/addTransaction', body);
    },
    getUserInfo(params) {
      return post('/api/profile/get', params);
    }
  };

  // For backwards compatibility with existing games expecting fbApi
  window.fbApi = window.blackjackApi;
})();
