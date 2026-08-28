function isTruthy(value) {
  if (!value) return false;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

export function isMobileStoreMode(env = process.env) {
  return isTruthy(env.MOBILE_STORE_MODE);
}

export function blockExternalValueInMobileStore(req, res, next) {
  if (!isMobileStoreMode()) return next();
  return res.status(403).json({
    error: 'external value features are unavailable in the mobile store release',
    code: 'mobile_store_free_play'
  });
}
