// Legacy tests seeded balances via arbitrary client deposit, then expected TON
// payout rollback. Those routes are intentionally retired. Exercise the actual
// routers' fail-closed contract without a DB, wallet secret or external network.
import './walletFailClosed.test.mjs';
