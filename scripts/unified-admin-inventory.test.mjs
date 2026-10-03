import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync('src/server/admin/operations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const catalog={id:'id',title:'title'}, inventoryPeriods={rewardId:'rewardId',periodStart:'periodStart',id:'id'};
const exports={};
new Function('require','exports',code)(name=>{
  if(name==='server-only') return {};
  if(name==='@/server/db/schema') return {catalog,inventoryPeriods};
  if(name==='@/server/career/jobs/contract') return {fieldMapSchema:require('zod').z.any()};
  if(name.startsWith('@/')) return {};
  if(name==='drizzle-orm') return {
    desc:key=>key,inArray:(key,values)=>row=>values.includes(row[key]),
    ilike:(key,pattern)=>row=>row[key].toLowerCase().includes(pattern.slice(1,-1).toLowerCase()),
  };
  return require(name);
},exports);
const rewards=[{id:'a',title:'Other'},{id:'b',title:'Resume kit'},{id:'c',title:'Resume pack'}];
const periods=[{id:'p1',rewardId:'a'},{id:'p2',rewardId:'b'},{id:'p3',rewardId:'c'}];
function db(){return {select:()=>{
  let rows=[],offset=0,limit=Infinity;
  const query={from:table=>{rows=table===catalog?rewards:periods;return query;},where:predicate=>{if(predicate) rows=rows.filter(predicate);return query;},orderBy:()=>query,limit:size=>{limit=size;return query;},offset:value=>{offset=value;return query;},then:(yes,no)=>Promise.resolve(rows.slice(offset,offset+limit)).then(yes,no)};
  return query;
}};}
test('inventory search pages catalog and returns only selected reward periods',async()=>{
  const result=await exports.listAdminInventory({q:'Resume',offset:1,limit:1},db());
  assert.deepEqual(result.rewards.map(r=>r.id),['c']);
  assert.deepEqual(result.periods.map(p=>p.rewardId),['c']);
});
test('empty inventory page has no unrelated periods',async()=>{
  const result=await exports.listAdminInventory({q:'Absent',offset:0,limit:20},db());
  assert.deepEqual(result,{rewards:[],periods:[]});
});
