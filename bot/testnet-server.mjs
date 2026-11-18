// Intentionally separate from server.js: no bot, database, claim or deposit routes.
import {createTestnetApp} from './testnet/app.mjs';
const port=Number(process.env.TON_TESTNET_PORT||4318);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Invalid testnet port');
createTestnetApp().listen(port,'127.0.0.1',()=>console.log(`Read-only TON TESTNET API on http://127.0.0.1:${port}`));
