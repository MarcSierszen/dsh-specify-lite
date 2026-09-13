import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  WorkflowError,
  deriveStage,
  features,
  initPlan,
  resolveFeature,
  selectTasks,
} from '../lib/workflow.js';

function project(t, initialized = true) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-specify-lite-workflow-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (initialized) {
    mkdirSync(join(root, '.speckit'));
    mkdirSync(join(root, 'specs'));
  }
  return root;
}

function feature(root, name = '001-login') {
  const path = join(root, 'specs', name);
  mkdirSync(path);
  return path;
}

function spec(name = 'Login') {
  return `# Feature: ${name}
## Problem
A user needs access.
## Goals
Provide access.
## User Stories
- US-001: A user signs in.
## Functional Requirements
- FR-001: The user can sign in.
## Success Criteria
- SC-001: Valid credentials succeed.
## Edge Cases
- EC-001: Invalid credentials fail safely.
## Out of Scope
Account recovery.
## Assumptions
An account exists.
## Open Questions
None.
`;
}

function plan(name = 'Login') {
  return `# Plan: ${name}
## Technical Context
Existing application.
## Constraints from Constitution and Specification
Honor FR-001.
## Architecture and Components
Authentication service.
## Data Flow and Interfaces
Request and response.
## Dependencies
None.
## Requirement Mapping
FR-001 SC-001 EC-001
## Testing Strategy
Test valid and invalid credentials.
## Risks and Fallbacks
Reject unsafe input.
`;
}

function taskDocument({ checked = ' ', verification = 'No verification has been recorded.' } = {}) {
  return `# Tasks: Login

## Task List

- [${checked}] T001 [FR-001] Implement login

## Verification

${verification}
`;
}

function verification(timestamp, scope, {
  overallResult = 'pass',
  checks = [{ command: 'npm test', exitCode: 0, result: 'pass' }],
  extra = {},
} = {}) {
  return `### Verification Run: ${timestamp}

\`\`\`json
${JSON.stringify({ scope, overallResult, checks, ...extra })}
\`\`\``;
}

function writeCore(featurePath, options = {}) {
  writeFileSync(join(featurePath, 'spec.md'), options.spec ?? spec());
  writeFileSync(join(featurePath, 'plan.md'), options.plan ?? plan());
  writeFileSync(join(featurePath, 'tasks.md'), options.tasks ?? taskDocument());
}

function isCode(code) {
  return error => error instanceof WorkflowError && error.code === code;
}

function snapshot(root, current = root) {
  return readdirSync(current).sort().map(name => {
    const path = join(current, name);
    const entry = lstatSync(path);
    const relativePath = path.slice(root.length + 1);
    if (entry.isSymbolicLink()) return [relativePath, 'symlink'];
    if (entry.isDirectory()) return [relativePath, 'directory', snapshot(root, path)];
    return [relativePath, 'file', readFileSync(path).toString('base64')];
  });
}

test('initPlan classifies missing, existing, file, and symlink states', t => {
  const root = project(t, false);
  const before = snapshot(root);
  let result = initPlan(root);
  assert.deepEqual(initPlan(root), result);
  assert.deepEqual(snapshot(root), before);
  assert.equal(existsSync(join(root, '.speckit')), false);
  assert.equal(existsSync(join(root, 'specs')), false);
  assert.equal(result.canInitialize, true);
  assert.equal(result.paths['.speckit'].state, 'missing');
  assert.equal(result.paths.specs.state, 'missing');

  mkdirSync(join(root, '.speckit'));
  writeFileSync(join(root, 'specs'), 'conflict');
  result = initPlan(root);
  assert.equal(result.canInitialize, false);
  assert.equal(result.paths['.speckit'].state, 'directory');
  assert.deepEqual(
    { state: result.paths.specs.state, type: result.paths.specs.type },
    { state: 'conflict', type: 'file' },
  );

  rmSync(join(root, 'specs'));
  symlinkSync(join(root, '.speckit'), join(root, 'specs'));
  result = initPlan(root);
  assert.equal(result.canInitialize, false);
  assert.equal(result.paths.specs.type, 'symlink');
  assert.equal(result.paths.specs.path, join(root, '.speckit'));
});

test('operations reject missing project roots and symlinked specs directories', t => {
  const root = project(t, false);
  assert.throws(() => initPlan(join(root, 'missing')), isCode('PROJECT_CONFLICT'));
  const realSpecs = join(root, 'real-specs');
  mkdirSync(realSpecs);
  symlinkSync(realSpecs, join(root, 'specs'));
  assert.throws(() => features(root), isCode('PROJECT_CONFLICT'));
});

test('features enumerates valid directories, diagnostics, and next prefixes', t => {
  const root = project(t);
  assert.equal(features(root).nextPrefix, '001');
  for (const name of ['010-z', '002-a', '010-a-1', '1000-large']) mkdirSync(join(root, 'specs', name));
  mkdirSync(join(root, 'specs', 'bad'));
  writeFileSync(join(root, 'specs', '003-file'), 'not a directory');
  symlinkSync(join(root, 'specs', '002-a'), join(root, 'specs', '004-link'));

  const result = features(root);
  assert.deepEqual(result.features.map(item => item.name), [
    '002-a',
    '010-a-1',
    '010-z',
    '1000-large',
  ]);
  assert.equal(result.nextPrefix, '1001');
  assert.deepEqual(result.malformed.map(item => item.name), ['003-file', '004-link', 'bad']);
  assert.equal(
    result.malformed.find(item => item.name === '004-link').path,
    join(root, 'specs', '002-a'),
  );
});

test('features rejects an unincrementable safe-integer prefix', t => {
  const root = project(t);
  mkdirSync(join(root, 'specs', `${Number.MAX_SAFE_INTEGER}-last`));
  assert.throws(() => features(root), isCode('MALFORMED_FEATURE'));
});

test('resolveFeature supports exact, slug, and project-relative selectors', t => {
  const root = project(t);
  feature(root, '001-login');
  assert.equal(resolveFeature(root, '001-login').feature.name, '001-login');
  assert.equal(resolveFeature(root, 'login').feature.name, '001-login');
  assert.equal(resolveFeature(root, 'specs/001-login').feature.name, '001-login');
  assert.equal(resolveFeature(root, 'specs\\001-login').feature.name, '001-login');
});

test('resolveFeature rejects ambiguity, absence, traversal, and outside paths', t => {
  const root = project(t);
  feature(root, '001-login');
  feature(root, '002-login');
  assert.throws(() => resolveFeature(root, 'login'), isCode('AMBIGUOUS'));
  assert.throws(() => resolveFeature(root, 'missing'), isCode('NOT_FOUND'));
  assert.throws(() => resolveFeature(root, join(root, 'specs', '001-login')), isCode('UNSAFE_PATH'));
  assert.throws(() => resolveFeature(root, '../login'), isCode('UNSAFE_PATH'));
  assert.throws(() => resolveFeature(root, 'other/login'), isCode('UNSAFE_PATH'));
  assert.throws(() => resolveFeature(root, ' login '), isCode('INVALID_ARGUMENT'));
});

test('feature and task paths reject symlink components', t => {
  const root = project(t);
  const realFeature = feature(root, '001-real');
  writeFileSync(join(realFeature, 'tasks.md'), taskDocument());
  const taskLink = join(root, 'tasks-link.md');
  symlinkSync(join(realFeature, 'tasks.md'), taskLink);
  assert.throws(() => selectTasks(root, taskLink), isCode('UNSAFE_PATH'));
  const outside = mkdtempSync(join(tmpdir(), 'dsh-specify-lite-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  const outsideTasks = join(outside, 'tasks.md');
  writeFileSync(outsideTasks, taskDocument());
  const escapingLink = join(root, 'escaping-tasks.md');
  symlinkSync(outsideTasks, escapingLink);
  assert.throws(() => selectTasks(root, escapingLink), isCode('UNSAFE_PATH'));

  const featureLink = join(root, 'specs', '002-link');
  symlinkSync(realFeature, featureLink);
  assert.throws(() => resolveFeature(root, 'specs/002-link'), isCode('UNSAFE_PATH'));
  assert.throws(() => deriveStage(root, featureLink), isCode('UNSAFE_PATH'));
});

test('all helper operations are read-only', t => {
  const root = project(t);
  const path = feature(root);
  writeCore(path);
  const before = snapshot(root);
  features(root);
  resolveFeature(root, '001-login');
  selectTasks(root, join(path, 'tasks.md'));
  deriveStage(root, path);
  assert.deepEqual(snapshot(root), before);
});

test('selectTasks preserves document order and reports incomplete dependencies', t => {
  const root = project(t);
  const path = join(feature(root), 'tasks.md');
  writeFileSync(path, `# Tasks: Login
## Task List
<!-- setup -->
### Phase One
- [x] T001 [FOUNDATION] Set up
- [ ] T002 [FR-001] Add feature (depends: T001)
- [ ] T003 [SC-001] Test feature (depends: T002)
## Verification
No verification has been recorded.
`);
  const result = selectTasks(root, path, 'T003,T002,T003');
  assert.deepEqual(result.selected.map(item => item.id), ['T002', 'T003']);
  assert.deepEqual(result.incompleteDependencies, []);

  const blocked = selectTasks(root, path, 'T003');
  assert.deepEqual(blocked.incompleteDependencies, [{ task: 'T003', dependency: 'T002' }]);
  assert.deepEqual(selectTasks(root, path).selected.map(item => item.id), ['T002', 'T003']);
  assert.equal(selectTasks(root, path, 'T001').selected[0].checked, true);
});

test('selectTasks handles huge ranges without numeric expansion', t => {
  const root = project(t);
  const path = join(feature(root), 'tasks.md');
  writeFileSync(path, `# Tasks: Ranges
## Task List
- [ ] T001 [FR-001] First
- [ ] T010 [FR-001] Middle
- [ ] T999999999999999999999 [SC-001] Last
## Verification
No verification has been recorded.
`);
  assert.deepEqual(
    selectTasks(root, path, 'T001-T999999999999999999999').selected.map(item => item.id),
    ['T001', 'T010', 'T999999999999999999999'],
  );
  assert.throws(() => selectTasks(root, path, 'T002-T010'), isCode('INVALID_SELECTION'));
  assert.throws(
    () => selectTasks(root, path, 'T999999999999999999999-T001'),
    isCode('INVALID_SELECTION'),
  );
});

test('selectTasks rejects empty and malformed selections', t => {
  const root = project(t);
  const path = join(feature(root), 'tasks.md');
  writeFileSync(path, taskDocument());
  assert.throws(() => selectTasks(root, path, ''), isCode('INVALID_SELECTION'));
  assert.throws(() => selectTasks(root, path, 'T1'), isCode('INVALID_SELECTION'));
  assert.throws(() => selectTasks(root, path, 'T999'), isCode('INVALID_SELECTION'));
  assert.throws(() => selectTasks(root, path, 'T002-T001'), isCode('INVALID_SELECTION'));
});

test('selectTasks rejects malformed task structures and dependencies', t => {
  const root = project(t);
  const path = join(feature(root), 'tasks.md');
  const invalidTaskLists = [
    '- [X] T001 [FR-001] Invalid checkbox',
    '- [ ] T001 [FR-001] One\n- [ ] T001 [SC-001] Duplicate',
    '- [ ] T001 [FR-001] Unknown dependency (depends: T999)',
    '- [ ] T001 [FR-001] Self dependency (depends: T001)',
    '- [ ] T001 [FR-001] Later dependency (depends: T002)\n- [ ] T002 [SC-001] Later',
    '- [ ] T001 [FR-001] Cycle start (depends: T002)\n- [ ] T002 [SC-001] Cycle end (depends: T001)',
    '- [ ] T001 [FR-001] Duplicate dependency (depends: T000, T000)',
    'ordinary prose is not allowed here\n- [ ] T001 [FR-001] Otherwise valid',
    '<!-- unclosed comment\n- [ ] T001 [FR-001] Hidden task',
    '',
  ];
  for (const taskList of invalidTaskLists) {
    writeFileSync(path, `# Tasks: Invalid\n## Task List\n${taskList}\n## Verification\nNo verification has been recorded.\n`);
    assert.throws(() => selectTasks(root, path), isCode('MALFORMED_ARTIFACT'));
  }
  writeFileSync(path, Buffer.concat([Buffer.from(taskDocument()), Buffer.from([0xff])]));
  assert.throws(() => selectTasks(root, path), isCode('MALFORMED_ARTIFACT'));
});

test('deriveStage follows lifecycle and prerequisite precedence', t => {
  const root = project(t);
  const path = feature(root);
  assert.equal(deriveStage(root, '001-login').stage, 'not-started');
  assert.equal(deriveStage(root, path).stage, 'not-started');
  writeFileSync(join(path, 'spec.md'), spec());
  assert.equal(deriveStage(root, '001-login').stage, 'specified');
  writeFileSync(join(path, 'plan.md'), plan());
  assert.equal(deriveStage(root, '001-login').stage, 'planned');
  writeFileSync(join(path, 'tasks.md'), taskDocument());
  const tasked = deriveStage(root, '001-login');
  assert.equal(tasked.stage, 'tasked');
  assert.deepEqual(tasked.tasks, { total: 1, completed: 0, remaining: 1 });
  assert.equal(tasked.latestVerification, null);
  assert.deepEqual(Object.fromEntries(Object.entries(tasked.artifacts).map(([name, item]) => [name, item.state])), {
    spec: 'valid',
    plan: 'valid',
    tasks: 'valid',
  });
  writeFileSync(join(path, 'tasks.md'), taskDocument({ checked: 'x' }));
  assert.equal(deriveStage(root, '001-login').stage, 'in-progress');

  rmSync(join(path, 'spec.md'));
  assert.equal(deriveStage(root, '001-login').stage, 'invalid');
});

test('deriveStage rejects every missing-prerequisite combination', t => {
  const root = project(t);
  const planOnly = feature(root, '001-plan-only');
  writeFileSync(join(planOnly, 'plan.md'), plan());
  assert.equal(deriveStage(root, '001-plan-only').stage, 'invalid');

  const tasksOnly = feature(root, '002-tasks-only');
  writeFileSync(join(tasksOnly, 'tasks.md'), taskDocument());
  assert.equal(deriveStage(root, '002-tasks-only').stage, 'invalid');

  const specAndTasks = feature(root, '003-no-plan');
  writeFileSync(join(specAndTasks, 'spec.md'), spec());
  writeFileSync(join(specAndTasks, 'tasks.md'), taskDocument());
  assert.equal(deriveStage(root, '003-no-plan').stage, 'invalid');
});

test('deriveStage rejects malformed headings, identifiers, and UTF-8', t => {
  const root = project(t);
  const path = feature(root);
  writeCore(path, { spec: spec().replace('## Problem', '## Problematic') });
  assert.equal(deriveStage(root, '001-login').stage, 'invalid');

  writeFileSync(join(path, 'spec.md'), spec().replace('- FR-001:', '- FR-001:\n- FR-001:'));
  assert.equal(deriveStage(root, '001-login').stage, 'invalid');

  writeFileSync(join(path, 'spec.md'), spec());
  writeFileSync(join(path, 'plan.md'), plan().replace('FR-001 SC-001', 'FR-1 SC-001'));
  assert.equal(deriveStage(root, '001-login').stage, 'invalid');

  writeFileSync(join(path, 'plan.md'), plan());
  writeFileSync(join(path, 'spec.md'), Buffer.concat([Buffer.from(spec()), Buffer.from([0xff])]));
  assert.equal(deriveStage(root, '001-login').stage, 'invalid');
});

test('deriveStage requires exact valid verification records', t => {
  const root = project(t);
  const path = feature(root);
  writeFileSync(join(path, 'spec.md'), spec());
  writeFileSync(join(path, 'plan.md'), plan());
  const completed = taskDocument({ checked: 'x', verification: '' });
  const fullScope = { kind: 'full', tasks: [] };

  const invalidRuns = [
    verification('2026-99-99T99:99:99Z', fullScope),
    verification('2026-01-01T00:00:00Z', { ...fullScope, extra: true }),
    verification('2026-01-01T00:00:00Z', fullScope, { extra: { extra: true } }),
    verification('2026-01-01T00:00:00Z', fullScope, {
      checks: [{ command: 'npm test', exitCode: 1, result: 'pass' }],
    }),
    verification('2026-01-01T00:00:00Z', fullScope, { checks: [] }),
    verification('2026-01-01T00:00:00Z', { kind: 'partial', tasks: ['T999'] }),
    verification('2026-01-01T00:00:00Z', fullScope, {
      checks: [{ command: 'npm test', exitCode: 0, result: 'pass', extra: true }],
    }),
    `No verification has been recorded.\n${verification('2026-01-01T00:00:00Z', fullScope)}`,
    `${verification('2026-01-01T00:00:00Z', fullScope)}\n${verification('2026-01-01T00:00:00Z', fullScope)}`,
    '### Verification Run: 2026-01-01T00:00:00Z\n\n```json\n{invalid}\n```',
    `${verification('2026-01-01T00:00:00Z', fullScope)}\nextra text`,
  ];
  for (const run of invalidRuns) {
    writeFileSync(join(path, 'tasks.md'), completed.replace('\n\n\n', `\n\n${run}\n`));
    assert.equal(deriveStage(root, '001-login').stage, 'invalid');
  }
});

test('deriveStage rejects partial verification scopes outside document order', t => {
  const root = project(t);
  const path = feature(root);
  writeFileSync(join(path, 'spec.md'), spec());
  writeFileSync(join(path, 'plan.md'), plan());
  const record = verification('2026-01-01T00:00:00Z', {
    kind: 'partial',
    tasks: ['T002', 'T001'],
  });
  writeFileSync(join(path, 'tasks.md'), `# Tasks: Login
## Task List
- [x] T001 [FR-001] Implement login
- [x] T002 [SC-001] Verify login (depends: T001)
## Verification
${record}
`);
  assert.equal(deriveStage(root, '001-login').stage, 'invalid');
});

test('deriveStage applies final verification run semantics', t => {
  const root = project(t);
  const path = feature(root);
  writeFileSync(join(path, 'spec.md'), spec());
  writeFileSync(join(path, 'plan.md'), plan());
  const taskText = taskDocument({ checked: 'x', verification: '' });
  const failed = verification('2026-01-01T00:00:00Z', { kind: 'full', tasks: [] }, {
    overallResult: 'fail',
    checks: [{ command: 'npm test', exitCode: 1, result: 'fail' }],
  });
  const passed = verification('2026-01-01T00:01:00Z', { kind: 'full', tasks: [] });
  const partial = verification('2026-01-01T00:02:00Z', { kind: 'partial', tasks: ['T001'] });

  writeFileSync(join(path, 'tasks.md'), taskText.replace('\n\n\n', `\n\n${failed}\n`));
  assert.equal(deriveStage(root, '001-login').stage, 'in-progress');
  writeFileSync(join(path, 'tasks.md'), taskText.replace('\n\n\n', `\n\n${failed}\n${passed}\n`));
  const complete = deriveStage(root, '001-login');
  assert.equal(complete.stage, 'complete');
  assert.deepEqual(complete.latestVerification, {
    timestamp: '2026-01-01T00:01:00Z',
    scope: { kind: 'full', tasks: [] },
    overallResult: 'pass',
    checks: 1,
  });
  writeFileSync(join(path, 'tasks.md'), taskText.replace('\n\n\n', `\n\n${failed}\n${passed}\n${partial}\n`));
  assert.equal(deriveStage(root, '001-login').stage, 'in-progress');
});
