export function normalizeTasksResponse(data) {
  if (!data || data.error) return [];
  if (Array.isArray(data?.tasks)) return data.tasks;
  if (Array.isArray(data)) return data;
  return [];
}
