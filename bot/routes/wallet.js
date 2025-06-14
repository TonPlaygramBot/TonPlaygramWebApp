// Transfer TPC from one Telegram user to another
router.post('/send', async (req, res) => {
  const { fromId, toId, amount } = req.body;
  if (!fromId || !toId || typeof amount !== 'number') {
    return res.status(400).json({ error: 'fromId, toId and amount required' });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: 'amount must be positive' });
  }

  const sender = await User.findOne({ telegramId: fromId });
  if (!sender || sender.balance < amount) {
    return res.status(400).json({ error: 'insufficient balance' });
  }

  const txDate = new Date();
  let deducted = false;

  try {
    // Create or update receiver
    await User.findOneAndUpdate(
      { telegramId: toId },
      {
        $inc: { balance: amount },
        $setOnInsert: { referralCode: toId.toString() }
      },
      { upsert: true }
    );

    // Deduct from sender
    sender.balance -= amount;
    await sender.save();
    deducted = true;

    const senderTx = {
      amount: -amount,
      type: 'send',
      status: 'delivered',
      date: txDate
    };

    const receiverTx = {
      amount,
      type: 'receive',
      status: 'delivered',
      date: txDate
    };

    // Log transactions
    await User.updateOne(
      { telegramId: fromId },
      { $push: { transactions: senderTx } }
    );

    await User.updateOne(
      { telegramId: toId },
      { $push: { transactions: receiverTx } }
    );

    // Notify receiver
    try {
      await bot.telegram.sendMessage(
        String(toId),
        `You received ${amount} TPC from ${fromId}`
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }

    return res.json({ balance: sender.balance, transaction: senderTx });
  } catch (err) {
    console.error('Failed to complete TPC transfer:', err.message);

    const failedTx = {
      amount: -amount,
      type: 'send',
      status: 'failed',
      date: txDate
    };

    await User.updateOne(
      { telegramId: fromId },
      { $push: { transactions: failedTx } }
    ).catch((e) => console.error('Failed to log failed transaction:', e.message));

    // Revert receiver credit
    await User.updateOne(
      { telegramId: toId },
      { $inc: { balance: -amount } }
    ).catch(() => {});

    // Revert sender deduction if it was already deducted
    if (deducted) {
      await User.updateOne(
        { telegramId: fromId },
        { $inc: { balance: amount } }
      ).catch(() => {});
    }

    res.status(500).json({ error: 'Failed to send TPC' });
  }
});
