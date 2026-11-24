import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=fileURLToPath(new URL('../docs/',import.meta.url));
const mime={html:'text/html',js:'text/javascript',json:'application/json',svg:'image/svg+xml',css:'text/css'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(!file.startsWith(root))throw Error('Not a site asset');
    const data=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file).slice(1)]??'text/plain');res.end(data);
  }catch{res.writeHead(404);res.end();}
});
let browser;
try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=process.env.TEST_SITE_URL??`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||undefined});
  const errors=[],p=await browser.newPage({viewport:{width:1440,height:990}});
  p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  // Exercise actual SVG anchors rather than setting the hash to the desired diagnosis.
  await p.goto(url);await p.locator('#fork a[href="#map/data"]').click();
  await p.locator('#fork a[href="#map/data/transfer"]').click();
  await p.locator('#fork a[href="#errors/case-11"]').click();
  await p.locator('#probe').getByRole('button',{name:'Not checked yet'}).click();
  assert.match(await p.locator('#probe').innerText(),/Gather this evidence first/);
  await p.locator('#probe').getByRole('button',{name:'No, not observed'}).click();
  assert.match(await p.locator('#probe').innerText(),/does not establish/);
  await p.locator('#probe').getByRole('button',{name:'Previous observation'}).click();
  await p.locator('#probe').getByRole('button',{name:'Yes, observed'}).click();
  assert.match(await p.locator('#probe').innerText(),/Verification|Verify on the original workload/);
  await p.locator('#case-links a[href="#case-11"]').click();
  const packet=()=>p.locator('.payload').getAttribute('transform');
  const start=await packet();await p.locator('#play').click();
  await p.waitForFunction(initial=>document.querySelector('.payload').getAttribute('transform')!==initial,start);
  await p.locator('#play').click();const paused=await packet();await p.waitForTimeout(170);assert.equal(await packet(),paused);
  await p.locator('#jump').click();assert.equal(await p.locator('#state').innerText(),'Block unavailable');
  assert.equal(await p.locator('[data-node="old"] .specimen').getAttribute('data-state'),'missing');
  const shortOfTarget=await p.locator('.payload').evaluate(g=>{
    const wire=g.parentElement.querySelector('path'),end=wire.getPointAtLength(wire.getTotalLength()),m=g.transform.baseVal.consolidate().matrix;
    return Math.hypot(end.x-m.e,end.y-m.f);
  });assert.ok(shortOfTarget>12);
  await p.locator('#scrub button').last().click();
  assert.equal(await p.locator('[data-node="reader"] .specimen').getAttribute('data-state'),'ready');
  await p.locator('#prev').click();
  assert.equal(await p.locator('[data-node="reader"] .specimen').getAttribute('data-state'),'pending');
  await p.locator('[data-pane="decision"]').click();assert.deepEqual(await p.locator('#decision-chart .fork-badge').allTextContents(),['YES','NO']);
  await p.locator('[data-pane="full"]').click();assert.ok(await p.locator('#full-pane .source-figure img').count());
  await p.locator('#way-errors').click();
  const sample='Py4JJavaError: Caused by org.apache.spark.shuffle.MetadataFetchFailedException: Missing an output location for shuffle 42';
  const requests=[];p.on('request',r=>requests.push(r.url()));await p.locator('#log-query').fill(sample);
  assert.equal(await p.locator('#match-list a').first().getAttribute('href'),'#errors/shuffle-meta');
  assert.equal(requests.some(s=>s.includes('Py4JJavaError')),false);
  await p.locator('#error-pick').selectOption('shuffle-meta');await p.locator('#probe').getByRole('button',{name:'No, not observed'}).click();
  assert.match(await p.locator('#probe').innerText(),/Observation 2 of/);
  await p.locator('#probe').getByRole('button',{name:'Yes, observed'}).click();
  assert.match(await p.locator('#probe').innerText(),/registration/i);
  await p.goBack();await p.locator('#log-query').waitFor();assert.equal(await p.locator('#log-query').inputValue(),sample);
  await p.locator('#log-query').fill('zzz-no-known-signature-zzz');assert.ok(await p.locator('#match-list a[href="#errors/handoff"]').isVisible());
  await p.locator('a[href="#sources"]').click();await p.locator('#coverage-items>li').first().waitFor();
  assert.equal(await p.locator('#coverage-items>li').count(),57);
  const mobile=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(url+'#errors/memory-owner');await mobile.locator('#probe').waitFor();
  for(let i=0;i<3;i++)await mobile.getByRole('button',{name:'No, not observed'}).click();
  assert.match(await mobile.locator('#probe').innerText(),/does not establish/);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.goto(url+'#case-36');await mobile.locator('#play').click();const still=await mobile.locator('.payload').getAttribute('transform');
  await mobile.waitForTimeout(150);assert.equal(await mobile.locator('.payload').getAttribute('transform'),still);
  await mobile.locator('#jump').click();assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const staticReader=await browser.newPage({javaScriptEnabled:false});await staticReader.goto(url+'components/shuffle-reader.html');
  assert.ok(await staticReader.getByRole('heading',{level:1}).isVisible());
  assert.ok(await staticReader.locator('.source-figure img').count());
  assert.deepEqual(errors,[]);
  if(process.env.CAPTURE_DIR){
    await p.goto(url+'#errors');await p.locator('button[data-query="OutOfMemoryError"]').click();
    await p.screenshot({path:path.join(process.env.CAPTURE_DIR,'spark-error-lookup.png')});
    await p.goto(url+'#map');await p.locator('#fork a').first().waitFor();
    await p.screenshot({path:path.join(process.env.CAPTURE_DIR,'spark-diagnostic-map.png')});
  }
  console.log('Browser paths passed: map → investigation → replay; lookup → evidence → remedy; negative/unknown evidence; reduced motion; static reference.');
}finally{
  await browser?.close();
  if(server.listening)await new Promise(r=>server.close(r));
}
