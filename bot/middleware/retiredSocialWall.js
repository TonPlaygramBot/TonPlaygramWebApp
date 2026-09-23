import { posix } from 'node:path';

const RETIRED_PREFIXES = [
  '/api/flamingo-wall',
  '/api/protest-videos',
  '/api/social/wall',
  '/protestvideo'
];

// This runs before body parsers, authenticated routes and express.static. Old
// installed clients and shared media URLs must not keep streaming or uploading
// after the UI is removed. Existing database records and media remain intact.
export function retiredSocialWall(req, res, next) {
  let pathname;
  try {
    pathname = posix.normalize(decodeURIComponent(req.path).replaceAll('\\', '/')).toLowerCase();
  } catch {
    return next();
  }
  if (!RETIRED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return next();
  }
  res.set('Cache-Control', 'no-store');
  return res.status(410).json({
    code: 'SOCIAL_WALL_REMOVED',
    error: 'Social Wall is no longer available.'
  });
}
