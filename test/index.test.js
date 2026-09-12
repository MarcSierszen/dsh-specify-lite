import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { discoverSkills } from '../lib/index.js';
const root=fileURLToPath(new URL('../skills',import.meta.url));
test('bundled discovery returns exactly the supported skills without warnings',()=>{const found=discoverSkills(root);assert.deepEqual(found.skills.map(x=>x.name),['speckit','speckit-analyze','speckit-clarify','speckit-constitution','speckit-implement','speckit-plan','speckit-specify','speckit-tasks']);assert.deepEqual(found.diagnostics,[]);for(const skill of found.skills){assert.ok(skill.description);assert.ok(skill.content);}});
test('registration cleanup is reverse ordered',()=>{const events=[];const ctx={skills:{register:s=>{events.push(s.name);return()=>events.push(`dispose:${s.name}`)}},effect:fn=>fn(),logger:{warn:()=>assert.fail('unexpected warning')}};return import('../lib/index.js').then(({apply})=>{apply(ctx);assert.deepEqual(events.slice(0,8),['speckit','speckit-analyze','speckit-clarify','speckit-constitution','speckit-implement','speckit-plan','speckit-specify','speckit-tasks']);});});
