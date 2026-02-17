import crypto from 'crypto';
import nacl from 'tweetnacl';

export type TonProof = {
  timestamp: number;
  domain: { lengthBytes: number; value: string };
  signature: string;
  payload: string;
  publicKey?: string;
};

export function verifyTonProof(input: {
  tonProof: TonProof;
  address: string;
  expectedPayload: string;
}) {
  const { tonProof, expectedPayload } = input;

  if (tonProof.payload !== expectedPayload) {
    throw new Error('TON proof payload mismatch');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tonProof.timestamp) > 5 * 60) {
    throw new Error('TON proof timestamp too old');
  }

  if (!tonProof.publicKey) {
    throw new Error('TON proof public key missing');
  }

  const signature = Buffer.from(tonProof.signature, 'base64');
  const pubKey = Buffer.from(tonProof.publicKey, 'hex');

  const msg = [
    'ton-proof-item-v2/',
    input.address,
    tonProof.domain.lengthBytes.toString(),
    tonProof.domain.value,
    tonProof.timestamp.toString(),
    tonProof.payload,
  ].join('');

  const messageHash = crypto.createHash('sha256').update(msg).digest();
  const fullMsg = Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect'), messageHash]);
  const fullMsgHash = crypto.createHash('sha256').update(fullMsg).digest();

  const ok = nacl.sign.detached.verify(fullMsgHash, signature, pubKey);
  if (!ok) throw new Error('Invalid TON proof signature');
}
