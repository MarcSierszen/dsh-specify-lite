import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from '../lib/index.js';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const skillsRoot = join(root, 'skills');
const expectedCommands = [
  'speckit',
  'speckit-analyze',
  'speckit-clarify',
  'speckit-constitution',
  'speckit-implement',
  'speckit-plan',
  'speckit-specify',
  'speckit-tasks',
];

function text(path) {
  return readFileSync(join(root, path), 'utf8');
}

function activeReadme() {
  return text('README.md').split(/^## Legacy artifacts from versions before 0\.2\.0$/m)[0];
}

function productInstructions() {
  const found = discoverSkills(skillsRoot);
  assert.deepEqual(found.diagnostics, []);
  return [activeReadme(), text('cordis.patch.yml'), ...found.skills.map(skill => skill.content)].join('\n');
}

function commandsIn(value) {
  return [...value.matchAll(/\/((?:speckit)(?:-[a-z0-9]+)?)\b/g)].map(match => match[1]);
}

test('README, registration, and skill directories expose exactly eight commands', () => {
  const discovered = discoverSkills(skillsRoot).skills.map(skill => skill.name);
  const directories = readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, 'SKILL.md')))
    .map(entry => entry.name)
    .sort();
  const documented = [...new Set(commandsIn(activeReadme()))].sort();
  assert.deepEqual(discovered, expectedCommands);
  assert.deepEqual(directories, expectedCommands);
  assert.deepEqual(documented, expectedCommands);
});

test('active product instructions contain no removed workflow or mutating Git command', () => {
  const instructions = productInstructions();
  const forbidden = [
    /\/speckit\./,
    /\/speckit-(?:checklist|status|brownfield|reverse-engineer|integration-plan|migrate)\b/,
    /\bspecify init\b/,
    /\buvx?(?:\s|$)/,
    /\.claude(?:\/|\\)/,
    /(?:^|\s)--ai(?:\s|$)/,
    /\bgit\s+(?:checkout|switch|stash|commit|reset|merge|rebase|branch)\b/,
    /\.speckit[\\/]features/,
    /\bspecify\.md\b/,
    /\bstatus\.json\b/,
    /\bchecklist\.md\b/,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(instructions, pattern);
});

test('skills reference only the bundled helper resource', () => {
  const found = discoverSkills(skillsRoot);
  const helper = join(skillsRoot, 'scripts', 'speckit-helper.mjs');
  assert.equal(existsSync(helper), true);
  for (const skill of found.skills) {
    assert.match(skill.content, /scripts\/speckit-helper\.mjs/);
    const resources = [...skill.content.matchAll(/(?:scripts|references)\/[A-Za-z0-9._/-]+/g)]
      .map(match => match[0]);
    assert.deepEqual([...new Set(resources)], ['scripts/speckit-helper.mjs']);
  }
  assert.equal(existsSync(join(skillsRoot, 'references')), false);
});

test('artifact-producing skills retain required headings and identifiers', () => {
  const byName = new Map(discoverSkills(skillsRoot).skills.map(skill => [skill.name, skill.content]));
  for (const heading of [
    '# Feature: <name>',
    '## Problem',
    '## Goals',
    '## User Stories',
    '## Functional Requirements',
    '## Success Criteria',
    '## Edge Cases',
    '## Out of Scope',
    '## Assumptions',
    '## Open Questions',
  ]) assert.ok(byName.get('speckit-specify').includes(heading));

  for (const heading of [
    '# Plan: <name>',
    '## Technical Context',
    '## Constraints from Constitution and Specification',
    '## Architecture and Components',
    '## Data Flow and Interfaces',
    '## Dependencies',
    '## Requirement Mapping',
    '## Testing Strategy',
    '## Risks and Fallbacks',
  ]) assert.ok(byName.get('speckit-plan').includes(heading));

  const tasks = byName.get('speckit-tasks');
  assert.match(tasks, /# Tasks: <name>/);
  assert.match(tasks, /## Task List/);
  assert.match(tasks, /## Verification/);
  for (const id of ['US-001', 'FR-001', 'SC-001', 'EC-001', 'OQ-001', 'T001']) {
    assert.match(productInstructions(), new RegExp(`\\b${id}\\b`));
  }
});

test('implementation instructions replace the first verification placeholder safely', () => {
  const implementation = discoverSkills(skillsRoot).skills
    .find(skill => skill.name === 'speckit-implement').content;
  assert.match(implementation, /replace the exact standalone sentence `No verification has been recorded\.`/);
  assert.match(implementation, /Do not leave the placeholder in the file\./);
  assert.match(implementation, /run `derive-stage` again/);
});
