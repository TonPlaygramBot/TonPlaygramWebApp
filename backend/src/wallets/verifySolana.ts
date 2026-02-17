import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';

export function verifySolanaSignature(input: { message: string; signature: number[]; address: string }) {
  const messageBytes = new TextEncoder().encode(input.message);
  const sigBytes = new Uint8Array(input.signature);
  const pubkey = new PublicKey(input.address);
  const isValid = nacl.sign.detached.verify(messageBytes, sigBytes, pubkey.toBytes());
  if (!isValid) throw new Error('Invalid Solana signature');
}
