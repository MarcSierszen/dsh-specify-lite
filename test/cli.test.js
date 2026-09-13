import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const helper = fileURLToPath(new URL('../skills/scripts/speckit-helper.mjs', import.meta.url));

function project() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-specify-lite-cli-'));
  mkdirSync(join(root, 'specs'));
  return root;
}

function run(...args) {
  const result = spawnSync(process.execPath, [helper, ...args], { encoding: 'utf8' });
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 1, 'CLI must emit exactly one JSON line');
  return { ...result, json: JSON.parse(lines[0]) };
}

function tasksFile(root) {
  const feature = join(root, 'specs', '001-cli');
  mkdirSync(feature, { recursive: true });
  const file = join(feature, 'tasks.md');
  writeFileSync(file, '# Tasks: CLI\n## Task List\n- [ ] T001 [FR-001] Test the CLI\n## Verification\nNo verification has been recorded.\n');
  return file;
}

test('CLI rejects unknown arguments with structured stderr and JSON', () => {
  const root = project();
  const result = run('features', '--project-root', root, '--unknown', 'value');
  assert.equal(result.status, 2);
  assert.equal(result.json.ok, false);
  assert.equal(result.json.operation, 'features');
  assert.equal(result.json.error.code, 'INVALID_ARGUMENT');
  assert.match(result.stderr, /^INVALID_ARGUMENT: Unknown argument: --unknown\n$/);
});

test('CLI validates required arguments and explicit empty selection', () => {
  const root = project();
  const missing = run('select-tasks', '--project-root', root);
  assert.equal(missing.status, 2);
  assert.equal(missing.json.error.code, 'INVALID_ARGUMENT');
  assert.match(missing.stderr, /^INVALID_ARGUMENT: /);

  const empty = run('select-tasks', '--project-root', root, '--tasks', tasksFile(root), '--selection', '');
  assert.equal(empty.status, 2);
  assert.equal(empty.json.error.code, 'INVALID_SELECTION');
  assert.match(empty.stderr, /^INVALID_SELECTION: /);
});

test('CLI classifies unsafe and missing feature paths', () => {
  const root = project();
  const unsafe = run('resolve-feature', '--project-root', root, '--selector', 'other/feature');
  assert.equal(unsafe.status, 3);
  assert.equal(unsafe.json.error.code, 'UNSAFE_PATH');
  assert.match(unsafe.stderr, /^UNSAFE_PATH: /);

  const missing = run('derive-stage', '--project-root', root, '--feature', join(root, 'specs', '001-missing'));
  assert.equal(missing.status, 2);
  assert.equal(missing.json.error.code, 'NOT_FOUND');
  assert.match(missing.stderr, /^NOT_FOUND: /);
});

test('CLI reports duplicate flags, missing values, and missing task files', () => {
  const root = project();
  const duplicate = run('features', '--project-root', root, '--project-root', root);
  assert.equal(duplicate.status, 2);
  assert.equal(duplicate.json.error.code, 'INVALID_ARGUMENT');

  const missingValue = run('resolve-feature', '--project-root', root, '--selector');
  assert.equal(missingValue.status, 2);
  assert.equal(missingValue.json.error.code, 'INVALID_ARGUMENT');

  const missingFile = run('select-tasks', '--project-root', root, '--tasks', join(root, 'specs', 'missing.md'));
  assert.equal(missingFile.status, 4);
  assert.equal(missingFile.json.error.code, 'MALFORMED_ARTIFACT');
  assert.match(missingFile.stderr, /^MALFORMED_ARTIFACT: /);
});

test('CLI returns successful data and warning diagnostics', () => {
  const root = project();
  mkdirSync(join(root, 'specs', 'bad'));
  const result = run('features', '--project-root', root);
  assert.equal(result.status, 0);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.operation, 'features');
  assert.equal(result.json.data.nextPrefix, '001');
  assert.equal(result.json.diagnostics.length, 1);
  assert.match(result.stderr, /^MALFORMED_FEATURE: /);
});

test('CLI exposes every helper operation with stable success envelopes', () => {
  const root = project();
  const init = run('init-plan', '--project-root', root);
  assert.equal(init.json.operation, 'init-plan');
  assert.equal(init.json.data.paths.specs.state, 'directory');

  const feature = join(root, 'specs', '001-cli');
  mkdirSync(feature, { recursive: true });
  writeFileSync(join(feature, 'spec.md'), '# Feature: CLI\n## Problem\nx\n## Goals\nx\n## User Stories\nUS-001\n## Functional Requirements\nFR-001\n## Success Criteria\nSC-001\n## Edge Cases\nEC-001\n## Out of Scope\nx\n## Assumptions\nx\n## Open Questions\nx\n');
  writeFileSync(join(feature, 'plan.md'), '# Plan: CLI\n## Technical Context\nx\n## Constraints from Constitution and Specification\nx\n## Architecture and Components\nx\n## Data Flow and Interfaces\nx\n## Dependencies\nx\n## Requirement Mapping\nFR-001 SC-001 EC-001\n## Testing Strategy\nx\n## Risks and Fallbacks\nx\n');
  const tasks = tasksFile(root);

  const resolved = run('resolve-feature', '--project-root', root, '--selector', '001-cli');
  assert.equal(resolved.json.data.feature.name, '001-cli');
  const selected = run('select-tasks', '--project-root', root, '--tasks', tasks);
  assert.deepEqual(selected.json.data.selected.map(item => item.id), ['T001']);
  const stage = run('derive-stage', '--project-root', root, '--feature', feature);
  assert.equal(stage.json.data.stage, 'tasked');
});
