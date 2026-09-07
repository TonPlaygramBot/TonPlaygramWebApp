import ts from 'typescript';
import { readFile, writeFile } from 'node:fs/promises';
const files=['world','simulation'];
for(const name of files){
  const source=await readFile(`webapp/src/games/explorealbania/${name}.ts`,'utf8');
  const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
  await writeFile(`webapp/src/games/explorealbania/${name}.js`,outputText);
}
