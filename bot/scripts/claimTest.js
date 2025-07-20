import dotenv from 'dotenv';
import tonClaim from '../utils/tonClaim.js';

dotenv.config();

const address = process.argv[2];
const amountArg = process.argv[3];

if (!address || !amountArg) {
  console.error('Usage: node bot/scripts/claimTest.js <TON_ADDRESS> <AMOUNT>');
  process.exit(1);
}

const amount = Number(amountArg);
if (Number.isNaN(amount)) {
  console.error('AMOUNT must be a number');
  process.exit(1);
}

try {
  await tonClaim(address, amount);
  console.log('Claim transaction sent');
} catch (err) {
  console.error(err.stack || err.message);
}
