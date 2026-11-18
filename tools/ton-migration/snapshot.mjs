import { createHash, createHmac } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const integer = /^(0|[1-9][0-9]*)$/;
export function toBaseUnits(amount, decimals) {
  if (typeof amount !== 'string' || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(amount)) throw new Error('exact decimal string required');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('invalid decimals');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals) throw new Error('rounding prohibited');
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (units >= 2n ** 120n) throw new Error('amount exceeds coin range');
  return units.toString();
}
const leafHash = row => hash(`TPG-MIGRATION-LEAF-v1\n${JSON.stringify(row)}`);
const parent = (a,b) => hash(`TPG-MIGRATION-NODE-v1\n${a}\n${b}`);
/** Offline planning only. Input must be a synthetic fixture, not a live DB.
 * subjectKey is a separate random pseudonymization secret, never a wallet key.
 * An amount here is one-for-one snapshot accounting, NOT approved tokenomics.
 */
export function buildSyntheticSnapshot({ rows, snapshotId, decimals, subjectKey, expectedTotalBaseUnits }) {
  if (!/^fixture:[a-zA-Z0-9_-]{1,80}$/.test(snapshotId)) throw new Error('synthetic fixture snapshot required');
  if (!Buffer.isBuffer(subjectKey) || subjectKey.length < 32) throw new Error('dedicated pseudonym key required');
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 100000) throw new Error('invalid fixture rows');
  if (typeof expectedTotalBaseUnits !== 'string' || !integer.test(expectedTotalBaseUnits)) throw new Error('independent exact total required');
  const seen = new Set();
  const entries = rows.map(row => {
    if (typeof row.accountId !== 'string' || !/^fixture-account:[a-zA-Z0-9_-]+$/.test(row.accountId)) throw new Error('synthetic account required');
    if (seen.has(row.accountId)) throw new Error('duplicate account');
    seen.add(row.accountId);
    const subject = createHmac('sha256', subjectKey).update(`subject-v1\n${snapshotId}\n${row.accountId}`).digest('hex');
    return { snapshotId, subject, amountBaseUnits: toBaseUnits(row.amount, decimals) };
  }).sort((a,b) => a.subject.localeCompare(b.subject));
  const total = entries.reduce((sum,e) => sum + BigInt(e.amountBaseUnits), 0n).toString();
  if (total !== expectedTotalBaseUnits) throw new Error('independent total mismatch');
  const levels = [entries.map(leafHash)];
  while (levels.at(-1).length > 1) {
    const previous = levels.at(-1), next=[];
    for (let i=0;i<previous.length;i+=2) next.push(parent(previous[i],previous[i+1] ?? previous[i]));
    levels.push(next);
  }
  const claims = entries.map((entry,index) => {
    let cursor=index; const proof=[];
    for(let depth=0;depth<levels.length-1;depth++) {
      const level=levels[depth], sibling=cursor ^ 1;
      proof.push({ side: cursor % 2 ? 'left':'right', hash: level[sibling] ?? level[cursor] });
      cursor=Math.floor(cursor/2);
    }
    return { entry, proof, claimId: hash(`claim-v1\n${snapshotId}\n${entry.subject}`) };
  });
  return { manifest:{ version:1, mode:'synthetic-offline-only',snapshotId,decimals,accountCount:entries.length,totalBaseUnits:total,merkleRoot:levels.at(-1)[0] },claims };
}
export function verifySyntheticClaim(root, entry, proof) {
  if (!Array.isArray(proof) || proof.length>32) return false;
  let current=leafHash(entry);
  for(const step of proof) {
    if (!step || !/^[a-f0-9]{64}$/.test(step.hash) || !['left','right'].includes(step.side)) return false;
    current=step.side==='left'?parent(step.hash,current):parent(current,step.hash);
  }
  return current===root;
}
