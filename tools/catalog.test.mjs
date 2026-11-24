import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(new URL('../docs/'+file,import.meta.url),'utf8');
const all=JSON.parse(read('cases.json'));
test('all forty cases retain complete trace, operational guidance and provenance',()=>{
  assert.deepEqual(all.map(c=>c.id),Array.from({length:40},(_,i)=>String(i+1).padStart(2,'0')));
  for(const c of all){
    assert.equal(c.steps.length,3,c.id);
    for(const field of [c.title,c.trigger,c.clue,c.repro,c.fix,...c.steps])assert.ok(field.trim().length>8,c.id);
    assert.ok(c.route.length>=2,c.id);
    assert.ok(c.links.some(l=>/^https:\/\/github\.com\/apache\/spark\/blob\/[a-f0-9]{40}\//.test(l.url)),c.id);
  }
});
test('readers resolve their local navigation, source links, and animated figures',()=>{
  for(const name of ['guide.html','scenarios.html']){
    const html=read(name);
    const ids=new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]));
    for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
      if(url.startsWith('#'))assert.ok(ids.has(url.slice(1)),name+' '+url);
      else if(!url.startsWith('https://')&&url!=='./')assert.doesNotThrow(()=>read(url),url);
    }
    assert.doesNotMatch(html,/DIAGRAMPLACEHOLDER|file:\/\/\/|[A-Z]:\\Users\\/);
  }
  const text=read('scenarios.html');
  assert.equal((text.match(/<h3 id="\d{2}-/g)??[]).length,40);
  for(const fig of ['shuffle-recovery','am-restart','parquet-mismatch']){
    assert.ok(text.includes(`pyspark-yarn-media/${fig}.svg`));
    assert.match(read(`pyspark-yarn-media/${fig}.svg`),/prefers-reduced-motion/);
  }
});
