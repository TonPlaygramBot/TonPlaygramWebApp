import TonWeb from 'tonweb';

export function normalizeAddress(addr) {
  try {
    return new TonWeb.utils.Address(addr).toString(true, false, false);
  } catch {
    return null;
  }
}
