(function(){
  const API_BASE_URL = window.API_BASE_URL || '';
  async function post(path, body){
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
  window.prApi = {
    async depositAccount(accountId, amount, extra = {}) {
      const receipt = await post('/api/account/receipt', { accountId, amount, ...extra });
      if (receipt && receipt.error) return receipt;
      return post('/api/account/claim-reward', {
        accountId,
        amount,
        ...extra,
        receipt: receipt.receipt,
        nonce: receipt.nonce,
        ts: receipt.ts
      });
    },
    addTransaction(telegramId, amount, type, extra = {}) {
      return Promise.resolve({ error: 'admin token missing' });
    }
  };
})();
