function isTaskContainer(data) {
  return Boolean(data) && typeof data === 'object' && !Array.isArray(data);
}

export function normalizeTasksResponse(data) {
  if (Array.isArray(data?.tasks)) return data.tasks;
  if (Array.isArray(data)) return data;
  return [];
}

export function extractTasksVersion(data) {
  if (isTaskContainer(data) && data.version) {
    return data.version;
  }
  return null;
}

export function extractTasksError(data) {
  if (isTaskContainer(data) && typeof data.error === 'string') {
    return data.error;
  }
  return '';
}
