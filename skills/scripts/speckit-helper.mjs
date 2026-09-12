#!/usr/bin/env node
import { initPlan, features, resolveFeature, selectTasks, deriveStage, WorkflowError } from '../../lib/workflow.js';

const args = process.argv.slice(2); const operation=args.shift();
const value = name => { const i=args.indexOf(name); return i < 0 ? undefined : args[i+1]; };
function emit(obj, code=0) { for (const d of obj.diagnostics || []) console.error(`${d.code}: ${d.message}`); process.stdout.write(JSON.stringify(obj)+'\n'); process.exitCode=code; }
try {
  if (!operation || !value('--project-root')) throw new WorkflowError('INVALID_ARGUMENT','operation and --project-root are required');
  const root=value('--project-root'); let data, diagnostics=[];
  if(operation==='init-plan') { data=initPlan(root); if(!data.canInitialize) diagnostics.push({level:'warning',code:'PROJECT_CONFLICT',path:data.projectRoot,message:'One or more initialization paths conflict'}); }
  else if(operation==='features') { data=features(root); diagnostics=data.malformed.map(x=>({level:'warning',code:'MALFORMED_FEATURE',path:x.path,message:x.reason})); }
  else if(operation==='resolve-feature') data=resolveFeature(root,value('--selector'));
  else if(operation==='select-tasks') data=selectTasks(root,value('--tasks'),value('--selection'));
  else if(operation==='derive-stage') data=deriveStage(root,value('--feature'));
  else throw new WorkflowError('INVALID_ARGUMENT',`Unknown operation: ${operation}`);
  emit({ok:true,operation,data,diagnostics});
} catch (error) { const code=error instanceof WorkflowError?error.code:'UNEXPECTED'; const exit=code==='INVALID_ARGUMENT'||code==='INVALID_SELECTION'||code==='NOT_FOUND'||code==='AMBIGUOUS'?2:code==='UNSAFE_PATH'?3:code==='PROJECT_CONFLICT'||code==='MALFORMED_FEATURE'||code==='MALFORMED_ARTIFACT'?4:1; emit({ok:false,operation:operation||null,error:{code,message:error.message,details:error.details||{}},diagnostics:[]},exit); }
