import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from 'marked';
import {renderMermaidSVG} from 'beautiful-mermaid';
import {writeFigures} from './figures.mjs';
import {traces} from './traces.mjs';
import {buildKnowledge} from './diagnostics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const input = path.resolve(process.argv[2] ?? path.join(root, '..', 'reading-list', 'Data Engineering'));
const out = path.join(root, 'docs');
const load = name => fs.readFileSync(path.join(input, name), 'utf8').replace(/\r\n/g, '\n');
const guideName = 'pyspark-on-yarn.md', caseName = 'pyspark-on-yarn-scenarios.md';
const componentDir = 'pyspark-on-yarn-components';
const source = load(caseName);
const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const slug = s => s.replace(/<[^>]+>/g,'').toLowerCase().replace(/[^a-z0-9 _-]/g,'').trim().replace(/\s+/g,'-');
const refs = [...source.matchAll(/^\[([\w-]+)\]: (https:\/\/\S+)$/gm)];
const definitions = refs.map(m => m[0]).join('\n');
const posix = path.posix;
const componentNames = fs.readdirSync(path.join(input,componentDir)).filter(n=>n.endsWith('.md')).sort();
const pages = new Map([[guideName,'guide.html'],[caseName,'scenarios.html'],
  ...componentNames.map(n=>[`${componentDir}/${n}`,`components/${n==='README.md'?'index':n.slice(0,-3)}.html`])]);
const save = (name,text) => {
  const dest=path.join(out,name);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,text);
};
// Older Markdown sources wrap illustrative figures in literal disclosure tags.
marked.use({renderer:{html:({text})=>/^(?:<details>|<\/details>|<summary>Show the animated flow<\/summary>)(?:\s|$)/.test(text)
  ? text.replace(/<(?!\/?(?:details|summary)>)/g,'&lt;') : esc(text)}});
const md = text=>marked.parse(text);
function updateLinks(html, sourceFile, outputFile) {
  return html.replace(/href="([^"?#]+\.md)(#[^"]*)?"/g,(original,href,anchor='')=>{
    if (/^(?:https?:)?\/\//.test(href)) return original;
    const file=posix.normalize(posix.join(posix.dirname(sourceFile),href));
    const dst=pages.get(file);
    if(!dst) throw Error(`Unmapped local reference in ${sourceFile}: ${href}`);
    return `href="${posix.relative(posix.dirname(outputFile),dst)}${anchor}"`;
  });
}
const diagrams=new Map();
function illustrated(text, sourceFile, outputFile, prefix, extraDefs='') {
  const images=[];
  const tokenized=text.replace(/```mermaid[ \t]*\n([\s\S]*?)^```/gm,(_,raw)=>{
    const graph=raw.trim();
    let asset=diagrams.get(graph);
    if(!asset){
      asset=`diagrams/${prefix}-${images.length+1}.svg`;
      let svg=renderMermaidSVG(graph,{bg:'#101d2e',fg:'#ecf3f8',accent:'#93e3d1',line:'#839ab5',font:'system-ui'});
      // Keep the compiled figures offline; the emitted CSS already has a system font fallback.
      svg=svg.split('\n').filter(l=>!l.trimStart().startsWith('@import ')).join('\n');
      if(!svg.includes('<svg')||svg.includes('<script')) throw Error(`Invalid diagram ${asset}`);
      save(asset,svg);diagrams.set(graph,asset);
    }
    const href=posix.relative(posix.dirname(outputFile),asset);
    const type=/^sequenceDiagram/.test(graph)?'Sequence diagram':/^stateDiagram/.test(graph)?'State diagram':'Flowchart';
    images.push(`<figure class="source-figure"><a href="${href}" title="Open diagram at full size"><img loading="lazy" src="${href}" alt="${type} for ${esc(prefix.replaceAll('-',' '))}; open to enlarge"></a><figcaption>${type} · <a href="${href}">Open full size</a></figcaption><details><summary>Text equivalent</summary><pre>${esc(graph)}</pre></details></figure>`);
    return `\nFIGUREPLACEHOLDER${images.length}END\n`;
  });
  return updateLinks(md(tokenized+'\n\n'+extraDefs),sourceFile,outputFile)
    .replace(/<p>FIGUREPLACEHOLDER(\d+)END<\/p>/g,(_,i)=>images[i-1]);
}
function reader(sourceFile) {
  const name=pages.get(sourceFile),src=load(sourceFile);
  const prefix=name.replace('.html','').replaceAll('/','-'),base=posix.dirname(name)==='.'?'':'../';
  const html=illustrated(src,sourceFile,name,prefix).replace(/<(h[1-4])>(.*?)<\/\1>/g,(_,tag,body)=>
    `<${tag} id="${slug(body)}">${body}</${tag}>`);
  const title=src.match(/^# (.+)/m)?.[1]??name;
  save(name,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Troubleshoot Spark</title><link rel="stylesheet" href="${base}style.css"><main class="reader"><nav><a href="${base}./#map">Diagnostic map</a> · <a href="${base}guide.html">Lifecycle</a> · <a href="${base}scenarios.html">Cases</a> · <a href="${base}components/index.html">Components</a></nav>${html}</main></html>`);
}
for(const sourceFile of pages.keys()) reader(sourceFile);
const originals=path.join(input,componentDir,'visuals');
const visualDest=path.join(out,'components','visuals');
fs.mkdirSync(visualDest,{recursive:true});
for(const n of fs.readdirSync(originals).filter(n=>n.endsWith('.svg'))) {
  const svg=fs.readFileSync(path.join(originals,n),'utf8');
  if(!svg.startsWith('<svg')||/<script\b|\son\w+\s*=|(?:href|src)="(?:https?:|javascript:)/i.test(svg))
    throw Error(`Non-local content in ${n}`);
  save(`components/visuals/${n}`,svg);
}
const result = [];
let current, section;
for (const line of source.split('\n')) {
  if (/^\[[\w-]+\]: /.test(line)) continue;
  if (/^## /.test(line)) { section=line.slice(3); current=null; continue; }
  const m=/^### (\d{2})\. (.+)/.exec(line);
  if (m) {current={id:m[1],title:m[2],section,lines:[]};result.push(current);}
  else if(current) current.lines.push(line);
}
const catalog=result.map(({lines,...c},i)=>{
  const text=lines.join('\n').trim(), model=traces[c.id];
  if(!model || Number(c.id)!==i+1)throw Error(`No authored trace for ${c.id}`);
  const positions=[...text.matchAll(/^\*\*([^*\n]+):\*\*\s*/gm)];
  const fields=new Map(positions.map((m,j)=>[m[1],text.slice(m.index+m[0].length,positions[j+1]?.index??text.length).trim()]));
  function field(key){
    if(!fields.has(key))throw Error(`Missing ${key} in case ${c.id}`);
    return md(fields.get(key)+'\n\n'+definitions);
  }
  const steps=[...text.matchAll(/^([1-3])\. (.+(?:\n {2,}[^\n]+)*)/gm)].map(m=>md(m[2].replace(/\n\s+/g,' ')));
  const used=new Set([...text.matchAll(/\]\[([\w-]+)\]/g)].map(m=>m[1]));
  const links=refs.filter(m=>used.has(m[1])).map(m=>({url:m[2],label:decodeURIComponent(m[2].split('/').pop())}));
  for(const m of text.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)) links.push({url:m[2],label:m[1]});
  for(const node of model.nodes)if(!componentNames.includes(node.reference+'.md'))throw Error(`Unknown reference for ${node.name}`);
  return {...c,...model,route:fields.get('Components').replace(/\.$/,'').split(' → '),steps,
    trigger:md(fields.get('Trigger').split(/\n\s*1\. /)[0]),clue:field('Consequence / clue'),repro:field('Reproduce'),
    fix:md(fields.get('Resolve / verify').split(/\n!\[/)[0]+'\n\n'+definitions),links,
    full:illustrated(text,caseName,'index.html',`case-${c.id}`,definitions)};
});
if(catalog.length!==Object.keys(traces).length)throw Error('Trace catalog drift');
save('cases.json',JSON.stringify(catalog,null,2)+'\n');
const knowledge=buildKnowledge(catalog,JSON.parse(fs.readFileSync(path.join(out,'upstream-inventory.json'),'utf8')));
save('knowledge.json',JSON.stringify(knowledge,null,2)+'\n');
writeFigures(path.join(out,'pyspark-yarn-media'));
if(process.argv.includes('--write-guide-media'))writeFigures(path.join(input,'pyspark-yarn-media'));
console.log(`Generated ${knowledge.records.length} diagnostic paths, ${catalog.length} traces (${catalog.reduce((n,c)=>n+c.events.length,0)} events), ${componentNames.length-1} component articles and ${diagrams.size} unique source diagrams.`);
