import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';

const FEATURE_RE = /^(\d{3,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const ID_RE = /^(US|FR|SC|EC|OQ)-\d{3,}$/;
const TASK_RE = /^- \[([ x])\] (T\d{3,}) ((?:\[(?:FOUNDATION|(?:FR|SC|EC)-\d{3,}(?:, (?:FR|SC|EC)-\d{3,})*)\] )?)(.+?)(?: \(depends: (T\d{3,}(?:, T\d{3,})*)\))?$/;
const SPEC_HEADINGS = ['# Feature:', '## Problem', '## Goals', '## User Stories', '## Functional Requirements', '## Success Criteria', '## Edge Cases', '## Out of Scope', '## Assumptions', '## Open Questions'];
const PLAN_HEADINGS = ['# Plan:', '## Technical Context', '## Constraints from Constitution and Specification', '## Architecture and Components', '## Data Flow and Interfaces', '## Dependencies', '## Requirement Mapping', '## Testing Strategy', '## Risks and Fallbacks'];

export class WorkflowError extends Error { constructor(code, message, details = {}) { super(message); this.code = code; this.details = details; } }
const stat = p => { try { return lstatSync(p); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const regular = p => { const s = stat(p); return !!s && s.isFile() && !s.isSymbolicLink(); };
const directory = p => { const s = stat(p); return !!s && s.isDirectory() && !s.isSymbolicLink(); };
const requireProject = root => { if (!root) throw new WorkflowError('INVALID_ARGUMENT', '--project-root is required'); let p; try { p = realpathSync(root); } catch { throw new WorkflowError('PROJECT_CONFLICT', 'Project root must be a real directory'); } if (!directory(p)) throw new WorkflowError('PROJECT_CONFLICT', 'Project root must be a real directory'); return p; };
const confined = (root, p) => { const r = relative(root, p); return r === '' || (!r.startsWith('..' + sep) && r !== '..' && !isAbsolute(r)); };
const hasSymlinkComponent = (root, target) => {
  const rel = relative(root, target);
  if (!confined(root, target) || rel === '') return false;
  let current = root;
  for (const part of rel.split(sep)) {
    current = join(current, part);
    const entry = stat(current);
    if (!entry) return false;
    if (entry.isSymbolicLink()) return true;
  }
  return false;
};
const machineToken = /\b(?:US|FR|SC|EC|OQ)-[A-Za-z0-9-]+\b/g;
const headingMatches = (line, heading) => heading.endsWith(':')
  ? line.startsWith(`${heading} `) && line.length > heading.length + 1
  : line === heading;
const headingsValid = (text, headings) => {
  const lines = text.split(/\r?\n/);
  let last = -1;
  for (const heading of headings) {
    const found = lines.flatMap((line, index) => headingMatches(line, heading) ? [index] : []);
    if (found.length !== 1 || found[0] <= last) return false;
    last = found[0];
  }
  return true;
};
const tokensValid = (text, unique) => {
  const tokens = [...text.matchAll(machineToken)].map(match => match[0]);
  if (tokens.some(token => !ID_RE.test(token))) return false;
  return !unique || new Set(tokens).size === tokens.length;
};
const specValid = text => tokensValid(text, true)
  && /\bFR-\d{3,}\b/.test(text)
  && /\bSC-\d{3,}\b/.test(text);
const planValid = text => {
  const mapping = text.split(/\r?\n/);
  const start = mapping.indexOf('## Requirement Mapping');
  const end = mapping.indexOf('## Testing Strategy');
  return start >= 0 && end > start && tokensValid(mapping.slice(start + 1, end).join('\n'), false);
};
const readUtf8 = path => new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
const validUtcTimestamp = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12
    && day >= 1 && day <= days[month - 1]
    && hour <= 23 && minute <= 59 && second <= 59;
};
export function initPlan(projectRoot) { const root = requireProject(projectRoot); const paths = {}; for (const name of ['.speckit', 'specs']) { const p = join(root, name), s = stat(p); paths[name] = !s ? { path:p, state:'missing', type:null } : directory(p) ? {path:p,state:'directory',type:'directory'} : {path:p,state:'conflict',type:s.isSymbolicLink()?'symlink':s.isFile()?'file':'other'}; } return { projectRoot:root, canInitialize:Object.values(paths).every(x=>x.state !== 'conflict'), paths }; }
export function features(projectRoot) { const root = requireProject(projectRoot), specsRoot = join(root,'specs'); if (!directory(specsRoot)) throw new WorkflowError('PROJECT_CONFLICT','specs/ must be a real directory'); const features=[], malformed=[]; for (const entry of readdirSync(specsRoot,{withFileTypes:true}).sort((a,b)=>a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) { const p=join(specsRoot,entry.name), match=FEATURE_RE.exec(entry.name); if (!entry.isDirectory() || entry.isSymbolicLink() || !match) { malformed.push({name:entry.name,path:p,reason:!entry.isDirectory()||entry.isSymbolicLink()?'not a real feature directory':'invalid feature name'}); continue; } const number=Number(match[1]); if (!Number.isSafeInteger(number)) { malformed.push({name:entry.name,path:p,reason:'numeric prefix exceeds safe integer range'}); continue; } features.push({name:entry.name,number,prefix:match[1],slug:match[2],path:realpathSync(p)}); } features.sort((a,b)=>a.number-b.number||a.name.localeCompare(b.name)); const max=features.length?features[features.length-1].number:0; if (max >= Number.MAX_SAFE_INTEGER) throw new WorkflowError('MALFORMED_FEATURE','Feature number cannot be incremented safely'); const nextNumber=max+1; return {projectRoot:root,specsRoot,features,malformed,nextNumber,nextPrefix:String(nextNumber).padStart(3,'0')}; }
export function resolveFeature(projectRoot, selector) { const data=features(projectRoot); if (typeof selector !== 'string' || !selector.length) throw new WorkflowError('INVALID_ARGUMENT','--selector is required'); if(selector!==selector.trim()) throw new WorkflowError('INVALID_ARGUMENT','Feature selector must not contain surrounding whitespace'); const parts=selector.split(/[\\/]/); if (isAbsolute(selector) || parts.includes('..')) throw new WorkflowError('UNSAFE_PATH','Feature selector must be project-relative and confined'); if(parts.length>1&&(parts.length!==2||parts[0]!=='specs'||!parts[1])) throw new WorkflowError('UNSAFE_PATH','Feature paths must be direct children of specs/'); let candidates=[]; if (parts.length===2) { const expected=join(data.specsRoot,parts[1]); if (!confined(data.specsRoot,expected)) throw new WorkflowError('UNSAFE_PATH','Feature selector escapes specs/'); if(hasSymlinkComponent(data.projectRoot,expected)) throw new WorkflowError('UNSAFE_PATH','Feature selector contains a symlink'); candidates=data.features.filter(x=>x.path===expected); } else candidates=data.features.filter(x=>x.name===selector || x.slug===selector); if (!candidates.length) throw new WorkflowError('NOT_FOUND','No matching feature directory'); if (candidates.length>1) throw new WorkflowError('AMBIGUOUS','Feature slug matches multiple features',{matches:candidates.map(x=>x.name)}); return {projectRoot:data.projectRoot,specsRoot:data.specsRoot,selector,feature:candidates[0]}; }
function parseTasks(text) { const lines=text.split(/\r?\n/), taskStart=lines.indexOf('## Task List'), verify=lines.indexOf('## Verification'); if (taskStart<0||verify<0||taskStart>=verify||lines.filter(x=>x==='## Task List').length!==1||lines.filter(x=>x==='## Verification').length!==1) throw new WorkflowError('MALFORMED_ARTIFACT','tasks.md must contain one ordered Task List and Verification section'); const tasks=[], ids=new Set(); let inComment=false; for(let i=taskStart+1;i<verify;i++){const l=lines[i], trimmed=l.trim();if(inComment){if(trimmed.includes('-->'))inComment=false;continue;}if(trimmed.startsWith('<!--')){if(!trimmed.includes('-->'))inComment=true;continue;}if(!trimmed||/^### \S.*$/.test(l))continue;if(!l.startsWith('- ['))throw new WorkflowError('MALFORMED_ARTIFACT',`Unexpected Task List content at line ${i+1}`);const m=TASK_RE.exec(l);if(!m)throw new WorkflowError('MALFORMED_ARTIFACT',`Malformed task at line ${i+1}`);const [,checked,id,refsRaw,textBody,depsRaw]=m;if(ids.has(id))throw new WorkflowError('MALFORMED_ARTIFACT',`Duplicate task ID ${id}`);ids.add(id);const references=[...refsRaw.matchAll(/(?:FR|SC|EC)-\d{3,}/g)].map(x=>x[0]); if(!refsRaw.includes('FOUNDATION')&&!references.length)throw new WorkflowError('MALFORMED_ARTIFACT',`Task ${id} lacks requirement mapping`); const dependencies=depsRaw?depsRaw.split(', '):[]; if(new Set(dependencies).size!==dependencies.length)throw new WorkflowError('MALFORMED_ARTIFACT',`Duplicate dependency on ${id}`); tasks.push({id,checked:checked==='x',references,dependencies,line:i+1,text:textBody});} if(inComment)throw new WorkflowError('MALFORMED_ARTIFACT','Unclosed Markdown comment in Task List'); if(!tasks.length)throw new WorkflowError('MALFORMED_ARTIFACT','tasks.md requires at least one task'); const pos=new Map(tasks.map((x,i)=>[x.id,i])); for(const [i,t] of tasks.entries())for(const d of t.dependencies){if(!pos.has(d))throw new WorkflowError('MALFORMED_ARTIFACT',`Unknown dependency ${d}`);if(d===t.id||pos.get(d)>=i)throw new WorkflowError('MALFORMED_ARTIFACT',`Dependency ${d} must precede ${t.id}`);} return {tasks,verification:lines.slice(verify+1).join('\n')}; }
const hasExactKeys = (value, keys) => value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const orderedTaskScope = (ids, tasks) => {
  const positions = new Map(tasks.map((task, index) => [task.id, index]));
  return ids.every((id, index) => positions.has(id)
    && (index === 0 || positions.get(ids[index - 1]) < positions.get(id)));
};
function parseVerification(section,tasks){const no='No verification has been recorded.';if(section.trim()===no)return [];if(section.includes(no))throw new WorkflowError('MALFORMED_ARTIFACT','No-evidence sentence cannot accompany verification runs');const re=/^### Verification Run: (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)\n\n```json\n([\s\S]*?)\n```$/gm;let m,last=0,runs=[],seen=new Set();while((m=re.exec(section))){if(!validUtcTimestamp(m[1]))throw new WorkflowError('MALFORMED_ARTIFACT','Verification timestamp is invalid');if(section.slice(last,m.index).trim())throw new WorkflowError('MALFORMED_ARTIFACT','Extra text in Verification section');last=re.lastIndex;if(seen.has(m[1]))throw new WorkflowError('MALFORMED_ARTIFACT','Duplicate verification timestamp');seen.add(m[1]);let o;try{o=JSON.parse(m[2]);}catch{throw new WorkflowError('MALFORMED_ARTIFACT','Verification JSON is invalid');}if(!hasExactKeys(o,['scope','overallResult','checks'])||!Array.isArray(o.checks)||!o.checks.length)throw new WorkflowError('MALFORMED_ARTIFACT','Verification record has invalid fields');const valid=o.checks.every(c=>hasExactKeys(c,['command','exitCode','result'])&&typeof c.command==='string'&&c.command.length>0&&Number.isInteger(c.exitCode)&&c.result===(c.exitCode===0?'pass':'fail'));const pass=o.checks.every(c=>c.result==='pass');if(!valid||!['pass','fail'].includes(o.overallResult)||o.overallResult!==(pass?'pass':'fail')||!hasExactKeys(o.scope,['kind','tasks'])||!['full','partial'].includes(o.scope.kind)||!Array.isArray(o.scope.tasks)||(o.scope.kind==='full'&&o.scope.tasks.length)||(o.scope.kind==='partial'&&!o.scope.tasks.length))throw new WorkflowError('MALFORMED_ARTIFACT','Verification record is inconsistent');if(o.scope.kind==='partial'&&(new Set(o.scope.tasks).size!==o.scope.tasks.length||o.scope.tasks.some(id=>!/^T\d{3,}$/.test(id))||!orderedTaskScope(o.scope.tasks,tasks)))throw new WorkflowError('MALFORMED_ARTIFACT','Verification scope has invalid task IDs');runs.push({timestamp:m[1],scope:o.scope,overallResult:o.overallResult,checks:o.checks.length});}if(!runs.length||section.slice(last).trim())throw new WorkflowError('MALFORMED_ARTIFACT','Malformed verification section');return runs;}
export function selectTasks(projectRoot,tasksFile,selection=null){
  const root=requireProject(projectRoot);
  if(!directory(join(root,'specs'))) throw new WorkflowError('PROJECT_CONFLICT','specs/ must be a real directory');
  if(typeof tasksFile!=='string'||!tasksFile.length) throw new WorkflowError('INVALID_ARGUMENT','--tasks is required');
  if(selection!==null&&(typeof selection!=='string'||!selection.length)) throw new WorkflowError('INVALID_SELECTION','Explicit task selection must not be empty');
  const lexical=resolve(root,tasksFile);
  if(!confined(root,lexical)||hasSymlinkComponent(root,lexical)) throw new WorkflowError('UNSAFE_PATH','tasks file must be confined and contain no symlink');
  if(!regular(lexical)) throw new WorkflowError('MALFORMED_ARTIFACT','tasks file must be a regular file');
  const real=realpathSync(lexical);
  if(!confined(root,real)) throw new WorkflowError('UNSAFE_PATH','tasks file escapes the project');
  let source;
  try{source=readUtf8(real);}catch{throw new WorkflowError('MALFORMED_ARTIFACT','tasks file must contain valid UTF-8');}
  const parsed=parseTasks(source);
  parseVerification(parsed.verification,parsed.tasks);
  const {tasks}=parsed;
  const by=new Map(tasks.map(task=>[task.id,task]));
  let wanted;
  if(selection===null) wanted=tasks.filter(task=>!task.checked).map(task=>task.id);
  else {
    wanted=[];
    for(const part of selection.split(',')){
      const range=/^(T\d{3,})-(T\d{3,})$/.exec(part);
      const one=/^T\d{3,}$/.test(part);
      if(!range&&!one) throw new WorkflowError('INVALID_SELECTION','Invalid task selection');
      if(one){
        if(!by.has(part)) throw new WorkflowError('INVALID_SELECTION',`Unknown task ${part}`);
        wanted.push(part);
        continue;
      }
      const [,startId,endId]=range;
      if(!by.has(startId)||!by.has(endId)) throw new WorkflowError('INVALID_SELECTION','Task range endpoints must exist');
      const start=BigInt(startId.slice(1));
      const end=BigInt(endId.slice(1));
      if(start>end) throw new WorkflowError('INVALID_SELECTION','Task ranges must ascend');
      for(const task of tasks){
        const value=BigInt(task.id.slice(1));
        if(value>=start&&value<=end) wanted.push(task.id);
      }
    }
  }
  wanted=[...new Set(wanted)];
  if(selection&& !wanted.length) throw new WorkflowError('INVALID_SELECTION','Selection is empty');
  const selected=tasks.filter(task=>wanted.includes(task.id));
  const incompleteDependencies=[];
  for(const task of selected) for(const dependency of task.dependencies) if(!by.get(dependency).checked&&!wanted.includes(dependency)) incompleteDependencies.push({task:task.id,dependency});
  return {projectRoot:root,tasksFile:real,requested:selection,selected,incompleteDependencies};
}
function artifact(path, headings, extra){if(!stat(path))return {state:'missing',path};if(!regular(path))return {state:'invalid',path};let text;try{text=readUtf8(path);}catch{return {state:'invalid',path};}try{if(!headingsValid(text,headings)||!extra(text))return {state:'invalid',path};return {state:'valid',path,text};}catch{return {state:'invalid',path};}}
export function deriveStage(projectRoot,feature){const root=requireProject(projectRoot); const listing=features(root); let f; if(typeof feature==='string' && isAbsolute(feature)){ const lexical=resolve(feature); if(!confined(listing.specsRoot,lexical)||hasSymlinkComponent(root,lexical)) throw new WorkflowError('UNSAFE_PATH','Feature path must be confined and contain no symlink'); if(!stat(lexical)) throw new WorkflowError('NOT_FOUND','Feature path does not exist'); if(!directory(lexical)) throw new WorkflowError('MALFORMED_FEATURE','Feature path must be a real directory'); const candidate=realpathSync(lexical); if(!confined(listing.specsRoot,candidate) || !listing.features.some(x=>x.path===candidate)) throw new WorkflowError('UNSAFE_PATH','Feature path must be a valid real directory under specs/'); f=candidate; } else f=resolveFeature(root,feature).feature.path;const spec=artifact(join(f,'spec.md'),SPEC_HEADINGS,specValid);const plan=artifact(join(f,'plan.md'),PLAN_HEADINGS,planValid);let tasks=artifact(join(f,'tasks.md'),['# Tasks:','## Task List','## Verification'],()=>true), parsed=null,runs=[];if(tasks.state==='valid'){try{parsed=parseTasks(tasks.text);runs=parseVerification(parsed.verification,parsed.tasks);}catch{tasks.state='invalid';}}const artifacts={spec:{path:spec.path,state:spec.state},plan:{path:plan.path,state:plan.state},tasks:{path:tasks.path,state:tasks.state}};let stage;if([spec,plan,tasks].some(x=>x.state==='invalid')||(plan.state!=='missing'&&spec.state==='missing')||(tasks.state!=='missing'&&(spec.state==='missing'||plan.state==='missing')))stage='invalid';else if(spec.state==='missing')stage='not-started';else if(plan.state==='missing')stage='specified';else if(tasks.state==='missing')stage='planned';else {const done=parsed.tasks.filter(t=>t.checked).length, latest=runs.at(-1), complete=done===parsed.tasks.length&&latest?.scope.kind==='full'&&latest.overallResult==='pass';stage=complete?'complete':(!done&&!runs.length?'tasked':'in-progress');} const latest=runs.at(-1);return {projectRoot:root,feature:f,stage,artifacts,tasks:parsed?{total:parsed.tasks.length,completed:parsed.tasks.filter(t=>t.checked).length,remaining:parsed.tasks.filter(t=>!t.checked).length}:null,latestVerification:latest||null};}
