import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Run on an intentional source refresh, not during each offline site build.
const repo='holdenk/spark-flowchart', rev='4f046b70c9bf83f4e51b7381512c6a6c8480110e';
const api=endpoint=>JSON.parse(execFileSync('gh',['api',`repos/${repo}/${endpoint}`],{encoding:'utf8'}));
const tree=api(`git/trees/${rev}?recursive=1`);
if(tree.truncated)throw Error('Incomplete upstream tree');
const routing=new Set(['error-job','error-memory','error-other','slow-job','slow-writes']);
const overlapping=new Set(['driver-max-result-size','revise-even_partitioning_still_slow','revise-bad_partitioning']);
const stubs=new Set(['notenoughexecs','toofew_tasks','toomany_tasks']);
const pages=tree.tree.filter(e=>/^docs\/(details|flowchart)\/[^/]+\.md$/.test(e.path)).map(e=>{
  const [,section,slug]=/^docs\/([^/]+)\/(.+)\.md$/.exec(e.path);
  const type=section==='flowchart'?'flowchart':stubs.has(slug)?'heading only':routing.has(slug)?'routing':overlapping.has(slug)?'overlapping':'article';
  const record={section,slug,type,blob:e.sha};
  if(section==='flowchart'){
    const text=Buffer.from(api(`git/blobs/${e.sha}`).content,'base64').toString();
    const nodes=new Set();
    for(const line of text.split('\n')){
      const edge=/^\s*(\w+)(?:\[[^\]]+\])?\s*-->\s*(\w+)/.exec(line);
      if(edge){nodes.add(edge[1]);nodes.add(edge[2]);}
      const single=/^\s*(?:click\s+)?(\w+)(?:\[| ")/.exec(line);if(single)nodes.add(single[1]);
    }
    record.nodes=[...nodes].sort();
  }
  return record;
});
writeFileSync(fileURLToPath(new URL('../docs/upstream-inventory.json',import.meta.url)),JSON.stringify({repo,rev,pages},null,2)+'\n');
console.log('Recorded',pages.length,'pinned source entries');
