export function unpackRecords({keys,defaults,rows}){
 return rows.map(row=>{const record={};let cursor=1;
  keys.forEach((key,i)=>{record[key]=row[0]&(1<<i)?row[cursor++]:defaults[i];});return record;
 });
}
