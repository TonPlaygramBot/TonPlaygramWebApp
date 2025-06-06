

export async function ping() {
  const res = await fetch(API_BASE_URL + '/api/ping');
  const data = await res.json();
  return data.message;
}

async function post(path, body) {
  const res = await fetch(API_BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
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

export function listTasks(telegramId) {
  return post('/api/tasks/list', { telegramId });
}

export function completeTask(telegramId, taskId) {
  return post('/api/tasks/complete', { telegramId, taskId });
}
<
