if (!data.nickname || !data.photo || !data.firstName || !data.lastName) {

  setAutoUpdating(true);

  try {

    let tg;

    try {

      tg = await fetchTelegramInfo(getTelegramId());

    } catch (err) {

      console.error('fetchTelegramInfo failed', err);

    }

    const firstName = data.firstName || tg?.firstName || getTelegramFirstName();

    const lastName = data.lastName || tg?.lastName || getTelegramLastName();

    const photo = data.photo || tg?.photoUrl || '';

    const updated = await updateProfile({

      telegramId: getTelegramId(),

      nickname: data.nickname || firstName,

      photo,

      firstName,

      lastName,

    });

    // Set profile and show Telegram info notice if any field was filled

    setProfile({ ...updated, filledFromTelegram: true });

    setForm({

      nickname: updated.nickname || '',

      photo: updated.photo || '',

      bio: updated.bio || '',

    });

  } finally {

    setAutoUpdating(false);

  }

}