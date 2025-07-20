import { mnemonicToWalletKey } from "ton-crypto";
import { TonClient, WalletContractV4, internal } from "ton";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
dotenv.config();

const endpoint = "https://toncenter.com/api/v2/jsonRPC"; // TON mainnet endpoint
const seed = process.env.TPC_CLAIM_WALLET_SEED;

if (!seed) {
  console.error("ERROR: TPC_CLAIM_WALLET_SEED is not set in environment variables.");
  process.exit(1);
}

async function deploy() {
  console.log("Compiling contract...");
  execSync("func -o tpc_claim_wallet.fif tpc_claim_wallet.fc");

  console.log("Generating wallet from seed...");
  const keyPair = await mnemonicToWalletKey(seed.split(" "));

  const client = new TonClient({ endpoint });
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const walletContract = client.open(wallet);

  const seqno = await walletContract.getSeqno();
  console.log("Deploying contract... Seqno:", seqno);

  // Build contract init (Fift)
  execSync("fift -s tpc_claim_wallet.fif");

  // Deploy via internal message
  await walletContract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: "CONTRACT_ADDRESS", // Replace with contract address after init
        value: "0.05", // TON for gas
        body: "", // Init body if needed
      }),
    ],
  });
  console.log("Contract deployed.");
}

async function confirmClaim(userAddress, amount) {
  const client = new TonClient({ endpoint });
  const keyPair = await mnemonicToWalletKey(seed.split(" "));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const walletContract = client.open(wallet);
  const seqno = await walletContract.getSeqno();

  console.log(`Confirming claim for ${userAddress}, amount: ${amount} TPC...`);
  await walletContract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: "CONTRACT_ADDRESS", // Replace with deployed contract address
        value: "0.05",
        body: beginCell()
          .storeUint(0x01, 32) // op::claim
          .storeAddress(Address.parse(userAddress))
          .storeCoins(amount)
          .endCell(),
      }),
    ],
  });
}

async function purchaseBundle(userAddress, bundleId) {
  const client = new TonClient({ endpoint });
  const keyPair = await mnemonicToWalletKey(seed.split(" "));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const walletContract = client.open(wallet);
  const seqno = await walletContract.getSeqno();

  console.log(`Purchasing bundle ${bundleId} for ${userAddress}...`);
  await walletContract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: "CONTRACT_ADDRESS", // Replace with deployed contract address
        value: "0.05",
        body: beginCell()
          .storeUint(0x02, 32) // op::bundle_purchase
          .storeAddress(Address.parse(userAddress))
          .storeUint(bundleId, 32)
          .endCell(),
      }),
    ],
  });
}

// Run deploy if directly executed
if (process.argv.includes("deploy")) {
  deploy();
}

export { deploy, confirmClaim, purchaseBundle };
