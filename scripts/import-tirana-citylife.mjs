/** Import the exact previously delivered CityLife review archive, not new artwork.
 * node scripts/import-tirana-citylife.mjs /path/to/Tirana-CityLife-Review-Pack.zip --check
 * Use --apply only on a clean review branch. This script never commits or pushes.
 */
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdtemp,rm,access,copyFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
const EXPECTED='7f90091c0213b6ce317f222e182beec593cfc5d7b984e0fab5124bd5d2f3a85f';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),archive=args.find(a=>!a.startsWith('--')),apply=args.includes('--apply');
if(!archive||args.some(a=>a.startsWith('--')&&!['--apply','--check'].includes(a))||args.includes('--check')&&apply){
 console.error('Usage: node scripts/import-tirana-citylife.mjs <review-pack.zip> [--check|--apply]');process.exit(2);
}
const sha=createHash('sha256');for await(const chunk of createReadStream(resolve(archive)))sha.update(chunk);
if(sha.digest('hex')!==EXPECTED)throw Error('Archive SHA-256 does not match the previously delivered review pack. No repository files changed.');
const git=(...a)=>execFileSync('git',a,{cwd:repo,encoding:'utf8'}).trim();
if(apply){const branch=git('branch','--show-current');if(!branch||['main','master'].includes(branch))throw Error('Use a review branch, never main/master or detached HEAD.');if(git('status','--porcelain'))throw Error('Working tree must be clean.');}
const destination=join(repo,'webapp/public/assets/tirana-citylife/v1');
try{await access(destination);throw Error('Asset destination already exists. Reconcile it manually; do not overwrite.');}catch(e){if(e.code!=='ENOENT')throw e;}
const temp=await mkdtemp(join(tmpdir(),'tpg-citylife-'));
try{
 // The archive is pinned above. Still reject traversal, unexpected roots and symlinks.
 execFileSync('python3',['-c',`import pathlib,sys,zipfile,stat
root=pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(sys.argv[1]) as z:
 for info in z.infolist():
  p=pathlib.PurePosixPath(info.filename)
  if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0]!='Tirana-CityLife' or stat.S_ISLNK(info.external_attr>>16):
   raise ValueError('Unsafe archive member: '+info.filename)
 z.extractall(root)
`,resolve(archive),temp],{stdio:'inherit'});
 const pack=join(temp,'Tirana-CityLife');
 // Existing modules must still be byte-identical; never overwrite later reviewed fixes.
 for(const name of ['CityLifeCore.ts','CityLifeLayer.ts','createCityLife.ts','citylife.css']){
  const a=await readFile(join(pack,'integration',name)),b=await readFile(join(repo,'webapp/src/games/tiranastreets/citylife',name));
  if(!a.equals(b))throw Error(name+' differs from the review archive. Reconcile the importer before proceeding.');
 }
 const installer=join(pack,'integration/install.mjs');let code=await readFile(installer,'utf8');
 const guard="try{await access(dest);throw Error('citylife directory already exists; reconcile instead of overwriting.');}catch(e){if(e.code!=='ENOENT')throw e;}";
 if(code.split(guard).length!==2)throw Error('Unexpected installer structure.');
 // The guard is replaced only after the four existing source files matched exactly.
 code=code.replace(guard,'/* Existing source modules verified byte-for-byte by the archive importer. */');
 await writeFile(installer,code);
 execFileSync(process.execPath,[installer,repo,'--check'],{stdio:'inherit'});
 if(apply){
  execFileSync(process.execPath,[installer,repo,'--apply'],{stdio:'inherit'});
  for(const name of ['ATTRIBUTION.md','ORIGINAL_REFERENCE_ATTRIBUTION.md','APACHE-2.0.txt','REFERENCES.md'])await copyFile(join(pack,name),join(destination,name));
  await cp(join(pack,'source'),join(repo,'assets-source/tirana-citylife-review/source'),{recursive:true,errorOnExist:true,force:false});
  console.log('Imported the 30 GLBs, HDR, manifest, notices, authoring scripts and career hooks locally. Review, test and commit these changes on this PR branch; nothing was pushed or deployed.');
 }else console.log('Archive, existing modules and career source anchors verified. No repository files changed.');
}finally{await rm(temp,{recursive:true,force:true});}
