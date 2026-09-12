/** Lossless column defaults remove repeated tags, boilerplate and null fields.
 * Only encoding changes; source geometry and provenance remain intact.
 */
export function packRecords(records){
 const keys=[...new Set(records.flatMap(Object.keys))];
 if(keys.length>30)throw Error('Record format exceeds 30 fields');
 const defaults=keys.map(key=>{
  const counts=new Map();for(const r of records){const v=JSON.stringify(r[key]??null);counts.set(v,(counts.get(v)||0)+1);}
  return JSON.parse([...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]??'null');
 });
 const encoded=defaults.map(JSON.stringify);
 return {keys,defaults,rows:records.map(record=>{
  const row=[0];keys.forEach((key,i)=>{const value=record[key]??null;if(JSON.stringify(value)!==encoded[i]){row[0]|=1<<i;row.push(value);}});return row;
 })};
}
