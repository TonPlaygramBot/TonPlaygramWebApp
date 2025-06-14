router.post('/leaderboard', async (req, res) => {

  const { telegramId } = req.body;

  

  let users = await User.find()

    .sort({ balance: -1 })

    .limit(100)

    .select('telegramId balance nickname firstName lastName photo')

    .lean();

  // Enrich missing Telegram profile data

  await Promise.all(

    users.map(async (u) => {

      if (!u.firstName || !u.lastName || !u.photo) {

        const info = await fetchTelegramInfo(u.telegramId);

        await User.updateOne(

          { telegramId: u.telegramId },

          {

            $set: {

              firstName: info.firstName,

              lastName: info.lastName,

              photo: info.photoUrl,

            },

          }

        );

        u.firstName = info.firstName;

        u.lastName = info.lastName;

        u.photo = info.photoUrl;

      }

    })

  );

  // Calculate rank if telegramId is provided

  let rank = null;

  if (telegramId) {

    const user = await User.findOne({ telegramId });

    if (user) {

      rank = (await User.countDocuments({ balance: { $gt: user.balance } })) + 1;

    }

  }

  res.json({ users, rank });

});