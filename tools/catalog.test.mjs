import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {groups, inspectRoute, pathToCase} from '../docs/triage.js';
import {rank,investigateStep} from '../docs/investigate.js';
import {specimenState} from '../docs/replay.js';
const read = file => fs.readFileSync(new URL('../docs/'+file,import.meta.url),'utf8');
const all=JSON.parse(read('cases.json'));
const knowledge=JSON.parse(read('knowledge.json'));
test('all forty cases retain complete trace, operational guidance and provenance',()=>{
  assert.deepEqual(all.map(c=>c.id),Array.from({length:40},(_,i)=>String(i+1).padStart(2,'0')));
  for(const c of all){
    assert.equal(c.steps.length,3,c.id);
    for(const field of [c.title,c.trigger,c.clue,c.repro,c.fix,...c.steps])assert.ok(field.trim().length>8,c.id);
    assert.ok(c.route.length>=2,c.id);
    assert.ok(c.links.some(l=>/^https:\/\/github\.com\/apache\/spark\/blob\/[a-f0-9]{40}\//.test(l.url)),c.id);
    const actors=new Set(c.nodes.map(n=>n.key));
    assert.ok(c.events.length>3 && c.events.some(e=>e.from!==e.to),c.id);
    for(const e of c.events){
      assert.ok(actors.has(e.from)&&actors.has(e.to),c.id);
      assert.ok(e.label && e.state && e.detail,c.id);
    }
    for(const n of c.nodes)assert.ok(read(`components/${n.reference}.html`).includes('<h1'),n.reference);
    for(const key of ['Trigger','Components','Reproduce','Resolve / verify','Consequence / clue'])
      assert.ok(c.full.includes(`<strong>${key}:</strong>`),`${c.id}: missing ${key}`);
  }
});
test('the diagnostic tree and error picker reach the exact same investigations, including all replay breadcrumbs',()=>{
  const leaves=[];
  for(const [k,g] of Object.entries(groups))for(const [branch] of g.branches){
    const fork=inspectRoute(`map/${k}/${branch}`,knowledge.records);
    assert.ok(fork.choices.length,`${k}/${branch}`);
    for(const choice of fork.choices){
      assert.match(choice.href,/^#errors\//);
      const id=choice.href.slice(8);
      if(id.startsWith('case-'))assert.equal(pathToCase(id.slice(5)),`#map/${k}/${branch}`);
      leaves.push(id);
    }
  }
  assert.deepEqual(leaves.sort(),knowledge.records.map(d=>d.id).sort());
  assert.deepEqual(rank(knowledge.records,'').map(d=>d.id).sort(),leaves);
});
test('the failed transfer and regenerated shuffle bytes use different endpoints and never pass through the driver',()=>{
  const c=all.find(c=>c.id==='11'),failure=c.events.findIndex(e=>e.kind==='blocked'),last=c.events.at(-1);
  assert.deepEqual([c.events[failure].from,c.events[failure].to],['reader','old']);
  assert.ok(c.events.slice(failure+1).some(e=>e.from==='dag'&&e.to==='fresh'&&e.kind==='recovery'));
  assert.deepEqual([last.from,last.to],['fresh','reader']);
  const old=c.specimens.find(s=>s.node==='old'),copy=c.specimens.find(s=>s.node==='reader');
  assert.equal(specimenState(old,failure),'known');
  assert.equal(specimenState(old,failure+1),'missing');
  assert.equal(specimenState(copy,c.events.length-1),'pending');
  assert.equal(specimenState(copy,c.events.length),'ready');
});
test('all pinned upstream pages and graph nodes map to cited entry points, without treating heading-only stubs as independent evidence',()=>{
  const inventory=JSON.parse(read('upstream-inventory.json')), ids=new Set(knowledge.records.map(r=>r.id));
  assert.deepEqual(knowledge.coverage.map(p=>p.blob),inventory.pages.map(p=>p.blob));
  assert.equal(knowledge.coverage.filter(p=>p.section==='details').length,53);
  assert.equal(knowledge.coverage.filter(p=>p.section==='flowchart').length,4);
  assert.equal(knowledge.coverage.filter(p=>p.type==='heading only').length,3);
  for(const p of knowledge.coverage){
    assert.ok(p.targets.length && p.targets.every(id=>ids.has(id)),p.slug);
    if(p.nodes)for(const n of p.nodes)assert.ok(n.targets.length&&n.targets.every(id=>ids.has(id)),n.node);
  }
  for(const r of knowledge.records){
    assert.ok(r.primary.length&&r.primary.every(s=>s.startsWith('https://')),r.id);
    assert.ok(r.related.every(id=>ids.has(id))&&r.related.length&&r.reproduce.length>35,r.id);
    assert.ok(r.cases.every(id=>all.some(c=>c.id===id)),r.id);
    for(const p of r.checks)for(const k of ['question','inspect','action','verify'])assert.ok(p[k]?.length>=12,r.id+' '+k);
  }
});
test('noisy nested causes outrank generic wrappers and ambiguous OOMs start with identifying the process',()=>{
  const a=knowledge.records;
  for(const [q,id] of [
    ['Py4JJavaError: Job aborted. Caused by: org.apache.spark.shuffle.MetadataFetchFailedException: Missing an output location for shuffle 7','shuffle-meta'],
    ['executor log: KRYO_BUFFER_OVERFLOW','kryo-limit'],['org.example.NoSuchMethodError: lib.Call.m','jvm-linkage'],
    ['java.lang.OutOfMemoryError: Java heap space','memory-owner'],['OutOfMemoryError','memory-owner'],
    ['Caused by: FAILED_READ_FILE.PARQUET_COLUMN_DATA_TYPE_MISMATCH','case-36'],
    ['Serialized task 3:0 was 28000000 bytes, which exceeds max allowed: spark.rpc.message.maxSize','task-size']
  ])assert.equal(rank(a,q)[0]?.id,id,q);
  assert.ok(!rank(a,'OutOfMemoryError').some(d=>d.id==='python-memory'));
  assert.ok(rank(a,'','error').every(d=>d.kind==='error'));
  assert.deepEqual(rank(a,'xyz-no-compatible-signature-xyz'),[]);
});
test('unsupported and unknown observations do not prescribe the confirmed branch resolution',()=>{
  const r=knowledge.records.find(d=>d.id==='memory-owner');
  assert.deepEqual(investigateStep(r,0,'unknown'),{index:0,status:'evidence'});
  assert.deepEqual(investigateStep(r,0,'no'),{index:1,status:'ask'});
  assert.deepEqual(investigateStep(r,1,'yes'),{index:1,status:'supported'});
  assert.equal(investigateStep(r,r.checks.length-1,'no').status,'unresolved');
});
test('all reader links, diagrams, components and deep links resolve within the published directory',()=>{
  const components=fs.readdirSync(new URL('../docs/components/',import.meta.url)).filter(n=>n.endsWith('.html')).map(n=>'components/'+n);
  assert.ok(components.length>50);
  const cache=new Map();
  for(const name of ['guide.html','scenarios.html',...components]){
    const html=read(name);
    for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
      if(/^(?:https?:|mailto:)/.test(url))continue;
      const [local,fragment]=url.split('#');
      let target=local?path.posix.normalize(path.posix.join(path.posix.dirname(name),local)):name;
      if(target.endsWith('/')||target==='.')target=path.posix.join(target,'index.html');
      if(!cache.has(target))cache.set(target,read(target));
      if(fragment&&!(target==='index.html'&&fragment==='map'))
        assert.ok(cache.get(target).includes(`id="${fragment}"`),`${name}: ${url}`);
    }
    assert.doesNotMatch(html,/FIGUREPLACEHOLDER|file:\/\/\/|[A-Z]:\\Users\\/);
  }
  const text=read('scenarios.html');
  const words=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const complete=words(text);
  for(const c of all)assert.ok(complete.includes(words(c.full)),`${c.id}: case content missing from full view or reader`);
  assert.equal((text.match(/<h3 id="\d{2}-/g)??[]).length,40);
  assert.match(read('guide.html'),/<img[^>]+src="diagrams\//);
  assert.match(read('components/shuffle-reader.html'),/<img[^>]+src="\.\.\/diagrams\//);
  for(const fig of ['shuffle-recovery','am-restart','parquet-mismatch']){
    assert.ok(text.includes(`pyspark-yarn-media/${fig}.svg`));
    assert.match(read(`pyspark-yarn-media/${fig}.svg`),/prefers-reduced-motion/);
  }
});
