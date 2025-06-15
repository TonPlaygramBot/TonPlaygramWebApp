router.post('/transactions', authenticate, async (req, res) => {
  const { telegramId } = req.body;

  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }

  const user = await User.findOne({ telegramId });

  if (user) {
    // Ensure the transactions property is always an array
    const modified = ensureTransactionArray(user);

    // Persist fixes for legacy string data
    if (modified) {
      try {
        await user.save();
      } catch (err) {
        console.error(
          'Failed to save user after ensuring transaction array:',
          err.message
        );
      }
    }
  }

  res.json({ transactions: user ? user.transactions : [] });
});
