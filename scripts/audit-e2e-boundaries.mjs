// Audit diagnostics. A PASS reproduces a gap; it does not certify a fix.
// Synthetic inputs and intercepted transport only; no remote writes or paid AI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiReviewProvider } from '../src/server/reviews/model-router.ts';
import { extractDocumentText } from '../src/server/reviews/extract.ts';
import { assertCapturedLinkSet, captureLinkArtifacts, freezeLinkArtifacts, LINK_SNAPSHOT_ERROR_MESSAGE } from '../src/server/reviews/artifacts.ts';

test('in-process AI transport includes brief, explanation and evidence limits',async t=>{
  let sent;
  const provider=new ApiReviewProvider({baseUrl:'https://audit.invalid',apiKey:'synthetic',models:{review:'synthetic',judge:'synthetic',generation:'synthetic',validate:'synthetic'}},async(_url,init)=>{
    sent=JSON.parse(JSON.parse(init.body).messages[1].content);
    throw new Error('AUDIT_CAPTURE_ONLY');
  });
  const input={projectTitle:'Synthetic retention task',divisionName:'Data',brief:{caseBackground:'Only compare the last two years',mission:'Analyze churn',objective:'Recommend retention strategy'},rubric:[],sources:[{id:'source-1',kind:'LINK',sha256:'synthetic',text:'Synthetic evidence longer than twelve characters.'}],explanation:'Synthetic reasoning from participant',notes:null,items:[],attemptNumber:1,evidenceLimits:['This source is static text, not a rendered dashboard.']};
  await assert.rejects(provider.review({profile:'judge',model:'synthetic',input}),/AUDIT_CAPTURE_ONLY/);
  assert.deepEqual(sent.brief,input.brief);
  assert.equal(sent.explanation,input.explanation);
  assert.deepEqual(sent.evidenceLimits,input.evidenceLimits);
  t.diagnostic(JSON.stringify({sentKeys:Object.keys(sent),briefSent:true,explanationSent:true,evidenceLimitsSent:true}));
});

test('AUDIT: interactive HTML loading shell passes readable-text threshold',async t=>{
  const bytes=Buffer.from('<html><body><h1>Loading interactive dashboard, please wait.</h1><div id="app"></div><script>document.getElementById("app").innerHTML="Revenue chart: 900,000; retention: 75%";</script></body></html>');
  const extracted=await extractDocumentText(bytes,'dashboard.html','text/html');
  assert.ok(extracted.length>=12);
  assert.equal(extracted.includes('retention: 75%'),false);
  t.diagnostic(JSON.stringify({extracted,chartContentPresent:false,acceptedAsReadable:true}));
});

test('transient link fetch failure rejects the snapshot with the participant-safe message',async t=>{
  let writes=0;
  const db={insert(){writes++;throw new Error('Unexpected snapshot write');}};
  await assert.rejects(()=>freezeLinkArtifacts(db,'synthetic-version',[{id:'synthetic-link',itemType:'LINK',externalUrl:'https://audit.invalid/report',originalFilename:null}],{
    fetch:async()=>{throw new Error('synthetic transient timeout');},extract:async()=>{throw new Error('must not reach extractor');},now:()=>0,
  }),error=>error?.message===LINK_SNAPSHOT_ERROR_MESSAGE);
  assert.equal(writes,0);
  t.diagnostic(JSON.stringify({rejected:true,snapshotWrites:writes}));
});

test('captured link content is tied to the exact draft item and URL',async()=>{
  const items=[{id:'link-1',itemType:'LINK',externalUrl:'https://audit.invalid/report',originalFilename:'report.html'}];
  const captured=await captureLinkArtifacts(items,{fetch:async()=>({bytes:Buffer.from('<p>Frozen evidence from submit time.</p>'),mime:'text/html'}),extract:async()=>('Frozen evidence from submit time.'),now:()=>0});
  assert.equal(captured.length,1);
  assertCapturedLinkSet(items,captured);
  assert.throws(()=>assertCapturedLinkSet([{...items[0],externalUrl:'https://audit.invalid/edited'}],captured),/berubah/i);
});
