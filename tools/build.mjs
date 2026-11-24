import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from 'marked';
import {writeFigures} from './figures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const input = path.resolve(process.argv[2] ?? path.join(root, '..', 'reading-list', 'Data Engineering'));
const out = path.join(root, 'docs');
const load = name => fs.readFileSync(path.join(input, name), 'utf8').replace(/\r\n/g, '\n');
const guide = load('pyspark-on-yarn.md'), source = load('pyspark-on-yarn-scenarios.md');
const refs = [...source.matchAll(/^\[([\w-]+)\]: (https:\/\/\S+)$/gm)];
const definitions = refs.map(m => m[0]).join('\n');
const esc = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
marked.use({renderer:{html: token => esc(token.text)}});
function md(text) {
  // The build inputs are the maintained guides, not visitor input. Never emit raw Markdown HTML.
  return marked.parse(`${text}\n\n${definitions}`);
}
const result = [];
let current, section;
for (const line of source.split('\n')) {
  if (/^\[[\w-]+\]: /.test(line)) continue;
  if (/^## /.test(line)) { section=line.slice(3); current=null; continue; }
  const m=/^### (\d{2})\. (.+)/.exec(line);
  if (m) {
    current={id:m[1], title:m[2], section, lines:[]};result.push(current);
  } else if(current) current.lines.push(line);
}
const catalog=result.map(({lines,...caseInfo}, index)=>{
  const text=lines.join('\n');
  const field=(name)=>{
    const lit=`**${name}:**`;
    const pos=text.indexOf(lit);
    if(pos<0)throw Error(`Missing ${name} in case ${caseInfo.id}`);
    return text.slice(pos+lit.length).trimStart().split(/\n\s*\n/)[0].replace(/\n\s*/g,' ').trim();
  };
  const route=field('Components').replace(/\.$/,'').split(' → ');
  const steps=[...text.matchAll(/^([1-3])\. (.+(?:\n {2,}[^\n]+)*)/gm)].map(m=>md(m[2].replace(/\n\s+/g,' ')));
  const used=new Set([...text.matchAll(/\]\[([\w-]+)\]/g)].map(m=>m[1]));
  const links=refs.filter(m=>used.has(m[1])).map(m=>({url:m[2],label:decodeURIComponent(m[2].split('/').pop())}));
  for(const m of text.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)) links.push({url:m[2],label:m[1]});
  if(Number(caseInfo.id)!==index+1 || steps.length!==3 || !links.length)throw Error(`Incomplete case ${caseInfo.id}`);
  const clue=field('Consequence / clue').split(/\[[^\]]+\]\[/)[0].replace(/\s*·\s*$/,'').trim();
  return {...caseInfo,route,steps,trigger:md(field('Trigger')),clue:md(clue),repro:md(field('Reproduce')),fix:md(field('Resolve / verify')),links};
});
if(catalog.length!==40)throw Error(`Expected 40 source cases, got ${catalog.length}`);
if(!fs.existsSync(path.join(out,'index.html')))throw Error('Missing explorer interface');
fs.writeFileSync(path.join(out,'cases.json'),JSON.stringify(catalog,null,2)+'\n');
writeFigures(path.join(out,'pyspark-yarn-media'));
if(process.argv.includes('--write-guide-media'))writeFigures(path.join(input,'pyspark-yarn-media'));

// Render sequence diagrams from the guides as accessible ordered message lists in the static reader.
function diagram(block) {
  const aliases=new Map(), events=[];
  for(const raw of block.trim().split('\n')){
    const row=raw.trim(), p=/^participant (\S+) as (.+)$/.exec(row);
    if(p){aliases.set(p[1],p[2]);continue;}
    const msg=/^(\w+)(?:--?>>?|--x)(\w+):\s*(.+)$/.exec(row);
    if(msg)events.push(`<li><b>${esc(aliases.get(msg[1])??msg[1])} → ${esc(aliases.get(msg[2])??msg[2])}</b><span>${esc(msg[3])}</span></li>`);
    const note=/^Note (?:over|right of|left of) [^:]+:\s*(.*)$/i.exec(row);
    if(note)events.push(`<li><i>${esc(note[1])}</i></li>`);
  }
  return events.length?`<ol class="sequence">${events.join('')}</ol>`:`<pre>${esc(block)}</pre>`;
}
function reader(src,name,title){
  const diagrams=[];
  let text=src.replace(/```mermaid\s*\n([\s\S]*?)```/g,(_,body)=>{diagrams.push(diagram(body));return `DIAGRAMPLACEHOLDER${diagrams.length}END`;});
  text=text.replace(/pyspark-on-yarn-scenarios\.md\)/g,'scenarios.html)').replace(/pyspark-on-yarn\.md\)/g,'guide.html)')
    .replace(/^(?:For the messages, state, and decisions each component owns, use the\n)?[^\n]*\[component design reference\][^\n]*\n(?:the inputs, outputs, and internal decisions of the participants in each case\.\n)?/gmi,'');
  let html=md(text).replace(/<p>DIAGRAMPLACEHOLDER(\d+)END<\/p>/g,(_,n)=>diagrams[n-1]);
  html=html.replace(/<(h[1-4])>(.*?)<\/\1>/g,(_,tag,body)=>{
    const slug=body.replace(/<[^>]+>/g,'').toLowerCase().replace(/[^a-z0-9 _-]/g,'').trim().replace(/\s+/g,'-');
    return `<${tag} id="${slug}">${body}</${tag}>`;
  });
  fs.writeFileSync(path.join(out,name),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Troubleshoot Spark</title><link rel="stylesheet" href="style.css"><main class="reader"><nav><a href="./">← Scenario explorer</a> · <a href="guide.html">Lifecycle</a> · <a href="scenarios.html">All cases</a></nav>${html}</main></html>`);
}
reader(guide,'guide.html','PySpark on YARN');
reader(source,'scenarios.html','40 troubleshooting scenarios');
console.log(`Generated ${catalog.length} cases, two readers and three animated failure diagrams.`);
