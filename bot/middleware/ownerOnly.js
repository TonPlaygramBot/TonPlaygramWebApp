export default function ownerOnly(bot) {
  const rawOwnerId = process.env.OWNER_TELEGRAM_ID;
  if (!rawOwnerId) return;

  const ownerId = Number(rawOwnerId);
  if (!Number.isFinite(ownerId) || ownerId <= 0) {
    console.warn('OWNER_TELEGRAM_ID is set but invalid; owner-only mode disabled');
    return;
  }

  bot.use(async (ctx, next) => {
    const fromId = ctx.from?.id;
    if (fromId !== ownerId) {
      // Ignore everyone else.
      return;
    }
    return next();
  });
}
