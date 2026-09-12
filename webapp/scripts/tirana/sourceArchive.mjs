import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Frozen gzip archives may be split into bounded, checksummed Git objects. */
export function readSourceArchive(input){
 const file=input instanceof URL?fileURLToPath(input):input;
 if(existsSync(file))return readFileSync(file);
 const manifest=JSON.parse(readFileSync(file+'.parts.json','utf8'));
 const bytes=Buffer.concat(manifest.parts.map(part=>{
  if(path.basename(part.file)!==part.file)throw Error('Invalid source part path');
  const data=readFileSync(path.join(path.dirname(file),part.file));
  if(data.length!==part.bytes||createHash('sha256').update(data).digest('hex')!==part.sha256)throw Error('Source part checksum mismatch: '+part.file);
  return data;
 }));
 if(bytes.length!==manifest.bytes||createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('Source archive checksum mismatch');
 return bytes;
}
