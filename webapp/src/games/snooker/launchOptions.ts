export function resolveSnookerLaunchOptions(search: string) {
  const params = new URLSearchParams(search);
  return {
    variantKey: 'snooker',
    mode:
      params.get('mode') === 'online'
        ? 'online'
        : params.get('mode') === 'career'
          ? 'career'
          : 'ai',
    playType: params.get('type') === 'tournament' ? 'tournament' : 'regular',
    tableSizeKey: params.get('tableSize') === '10ft' ? '10ft' : '12ft',
    accountId: params.get('accountId') || undefined,
    tgId: params.get('tgId') || undefined,
    playerName: params.get('name') || undefined,
    playerAvatar: params.get('avatar') || undefined,
    opponentName:
      params.get('opponentName') || params.get('opponent') || undefined,
    opponentAvatar: params.get('opponentAvatar') || undefined
  };
}
