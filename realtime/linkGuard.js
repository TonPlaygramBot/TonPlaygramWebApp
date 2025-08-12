const VALID_SLUGS = new Set(['snake', 'crazydice']);

export function linkGuard(req, res, next) {
  const { slug } = req.params;
  if (!VALID_SLUGS.has(slug)) {
    return res.status(404).send('Unknown game');
  }
  next();
}

export function isValidSlug(slug) {
  return VALID_SLUGS.has(slug);
}
