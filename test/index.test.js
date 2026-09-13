import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply, discoverSkills } from '../lib/index.js';

const bundledRoot = fileURLToPath(new URL('../skills', import.meta.url));

function fixtureRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-specify-lite-skills-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeSkill(root, directory, frontmatter, body = '# Instructions\n') {
  const dir = join(root, directory);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n${body}`);
  return dir;
}

test('bundled discovery returns exactly eight supported skills without warnings', () => {
  const found = discoverSkills(bundledRoot);
  assert.deepEqual(found.skills.map(skill => skill.name), [
    'speckit',
    'speckit-analyze',
    'speckit-clarify',
    'speckit-constitution',
    'speckit-implement',
    'speckit-plan',
    'speckit-specify',
    'speckit-tasks',
  ]);
  assert.deepEqual(found.diagnostics, []);
  assert.deepEqual(discoverSkills(bundledRoot), found);
  for (const skill of found.skills) {
    assert.equal(skill.name, skill.name.trim());
    assert.ok(skill.description.trim());
    assert.ok(skill.whenToUse.trim());
    assert.ok(skill.content.trim());
    assert.equal(skill.path, join(bundledRoot, skill.name, 'SKILL.md'));
  }
});

test('discovery scans only immediate regular skill bundles', t => {
  const root = fixtureRoot(t);
  writeSkill(root, 'valid', 'name: valid\ndescription: Valid skill');
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'empty'));
  writeSkill(join(root, 'nested'), 'hidden', 'name: hidden\ndescription: Nested skill');
  symlinkSync(join(root, 'valid'), join(root, 'linked-directory'));
  const linkedFileDir = join(root, 'linked-file');
  mkdirSync(linkedFileDir);
  symlinkSync(join(root, 'valid', 'SKILL.md'), join(linkedFileDir, 'SKILL.md'));

  const found = discoverSkills(root);
  assert.deepEqual(found.skills.map(skill => skill.name), ['valid']);
  assert.deepEqual(found.diagnostics, []);
});

test('discovery rejects malformed frontmatter with deterministic diagnostics', t => {
  const root = fixtureRoot(t);
  writeSkill(root, 'bad-duplicate', 'name: bad-duplicate\nname: bad-duplicate\ndescription: duplicate');
  writeSkill(root, 'bad-empty', 'name: bad-empty\ndescription: ""');
  writeSkill(root, 'bad-name', 'name: other-name\ndescription: mismatch');
  writeSkill(root, 'bad-syntax', 'name: Bad_Name\ndescription: invalid name');
  writeSkill(root, 'bad-when', 'name: bad-when\ndescription: invalid when\nwhenToUse: 42');
  writeSkill(root, 'bad-unknown', 'name: bad-unknown\ndescription: unknown\nmetadata: {}');
  writeSkill(root, 'duplicate-a', 'name: duplicate-a\ndescription: First winner');
  writeSkill(root, 'duplicate-b', 'name: duplicate-a\ndescription: Later duplicate');
  writeSkill(root, 'good', 'name: good\ndescription: Good\nwhenToUse: When testing');
  const noFrontmatter = join(root, 'no-frontmatter');
  mkdirSync(noFrontmatter);
  writeFileSync(join(noFrontmatter, 'SKILL.md'), '# Missing frontmatter\n');
  const unreadable = writeSkill(root, 'unreadable', 'name: unreadable\ndescription: Unreadable');
  chmodSync(join(unreadable, 'SKILL.md'), 0o000);

  const found = discoverSkills(root);
  assert.deepEqual(found.skills.map(skill => skill.name), ['duplicate-a', 'good']);
  assert.equal(found.skills[0].description, 'First winner');
  assert.deepEqual(found.diagnostics.map(item => [item.code, item.path]), [
    ['INVALID_FRONTMATTER', join(root, 'bad-duplicate', 'SKILL.md')],
    ['INVALID_FRONTMATTER', join(root, 'bad-empty', 'SKILL.md')],
    ['NAME_MISMATCH', join(root, 'bad-name', 'SKILL.md')],
    ['INVALID_FRONTMATTER', join(root, 'bad-syntax', 'SKILL.md')],
    ['INVALID_FRONTMATTER', join(root, 'bad-unknown', 'SKILL.md')],
    ['INVALID_FRONTMATTER', join(root, 'bad-when', 'SKILL.md')],
    ['DUPLICATE_SKILL', join(root, 'duplicate-b', 'SKILL.md')],
    ['INVALID_FRONTMATTER', join(root, 'no-frontmatter', 'SKILL.md')],
    ['SKILL_READ_ERROR', join(root, 'unreadable', 'SKILL.md')],
  ]);
  for (const diagnostic of found.diagnostics) {
    assert.equal(diagnostic.level, 'warning');
    assert.ok(diagnostic.message);
  }
});

test('apply registers complete definitions and cleanup runs in reverse order', () => {
  const registrations = [];
  const disposals = [];
  const warnings = [];
  let cleanup;
  const ctx = {
    skills: {
      register(skill) {
        registrations.push(skill);
        return () => disposals.push(skill.name);
      },
    },
    effect(callback) {
      cleanup = callback();
      return cleanup;
    },
    logger: { warn: message => warnings.push(message) },
  };

  const returned = apply(ctx);
  assert.equal(returned, cleanup);
  assert.equal(registrations.length, 8);
  assert.deepEqual(warnings, []);
  for (const registration of registrations) {
    assert.equal(registration.source, 'bundled');
    assert.deepEqual(registration.invocation, {
      modelInvocable: true,
      userInvocable: true,
    });
    assert.deepEqual(registration.resourceBase, {
      kind: 'directory',
      path: fileURLToPath(new URL('../skills', import.meta.url)),
    });
    assert.ok(registration.path.endsWith(join(registration.name, 'SKILL.md')));
  }

  returned();
  assert.deepEqual(disposals, registrations.map(skill => skill.name).reverse());
});
