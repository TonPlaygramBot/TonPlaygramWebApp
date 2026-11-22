// Classification uses server-owned task metadata only. An Instagram OAuth
// token or a public Reel URL does not prove the claimant completed a task.
export function requiresInstagramVerification(task) {
  if ([task?.platform, task?.icon].some((value) => String(value || '').trim().toLowerCase() === 'instagram')) {
    return true;
  }
  try {
    const { hostname } = new URL(task?.link);
    const host = hostname.toLowerCase().replace(/\.$/, '');
    return host === 'instagram.com' || host.endsWith('.instagram.com') ||
      host === 'instagr.am' || host.endsWith('.instagr.am');
  } catch {
    return false;
  }
}
