export function parsePlayersFromSearch(search) {
  const params = new URLSearchParams(search);
  const count = parseInt(params.get('players')) || 2;
  const avatarsParam = params.get('avatars');
  const namesParam = params.get('names');
  const tgIdsParam = params.get('tgIds');
  const accountsParam = params.get('accounts');
  const avatars = avatarsParam ? avatarsParam.split(',').map(decodeURIComponent) : [];
  const names = namesParam ? namesParam.split(',').map(decodeURIComponent) : [];
  const ids = tgIdsParam ? tgIdsParam.split(',') : [];
  const accounts = accountsParam ? accountsParam.split(',') : [];
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    name: names[i] || `P${i + 1}`,
    photoUrl: avatars[i] || '/assets/icons/profile.svg',
    id: ids[i] || null,
    accountId: accounts[i] || null,
  }));
}
