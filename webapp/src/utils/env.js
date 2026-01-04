export function resolveRuntimeEnv() {
  try {
    // eslint-disable-next-line no-new-func
    const metaEnv = Function('try { return import.meta.env || {}; } catch (e) { return {}; }')();
    if (metaEnv && typeof metaEnv === 'object' && Object.keys(metaEnv).length > 0) {
      return metaEnv;
    }
  } catch {
    // ignore resolution failures
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }

  return {};
}

