import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Context } from '@deepseek-ai/cordis';
import SkillRegistry from '@deepseek-ai/dsh-skill';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const expectedFiles = [
  'LICENSE',
  'README.md',
  'cordis.patch.yml',
  'lib/index.js',
  'lib/workflow.js',
  'package.json',
  'skills/scripts/speckit-helper.mjs',
  'skills/speckit-analyze/SKILL.md',
  'skills/speckit-clarify/SKILL.md',
  'skills/speckit-constitution/SKILL.md',
  'skills/speckit-implement/SKILL.md',
  'skills/speckit-plan/SKILL.md',
  'skills/speckit-specify/SKILL.md',
  'skills/speckit-tasks/SKILL.md',
  'skills/speckit/SKILL.md',
];

function scratch(t, prefix = 'dsh-specify-lite-pack-') {
  const path = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

function npmPack(args, cache) {
  const env = { ...process.env };
  delete env.NODE_V8_COVERAGE;
  const result = spawnSync('npm', ['pack', '--json', '--cache', cache, ...args], {
    cwd: root,
    encoding: 'utf8',
    env,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout)[0];
}

test('package metadata and exports match the supported runtime contract', async () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.version, '0.2.0');
  assert.equal(manifest.engines.node, '>=20');
  assert.deepEqual(manifest.exports, {
    '.': './lib/index.js',
    './workflow': './lib/workflow.js',
    './package.json': './package.json',
  });
  assert.deepEqual(manifest.files, [
    'lib/*.js',
    'cordis.patch.yml',
    'skills/*/SKILL.md',
    'skills/scripts/speckit-helper.mjs',
  ]);
  assert.deepEqual(manifest.peerDependencies, {
    '@deepseek-ai/dsh-skill': '>=0.1.1-rc.2 <0.2.0',
    '@deepseek-ai/cordis': '^4.0.1',
  });
  assert.deepEqual(manifest.dependencies, { yaml: '^2.7.0' });

  const plugin = await import('@marcsierszen/dsh-specify-lite');
  const workflow = await import('@marcsierszen/dsh-specify-lite/workflow');
  const exportedManifest = await import('@marcsierszen/dsh-specify-lite/package.json', {
    with: { type: 'json' },
  });
  assert.equal(typeof plugin.apply, 'function');
  assert.equal(typeof workflow.deriveStage, 'function');
  assert.equal(exportedManifest.default.version, '0.2.0');
});

test('npm dry-run contains exactly the intended runtime files', t => {
  const temp = scratch(t);
  const packed = npmPack(['--dry-run', '--pack-destination', temp], join(temp, 'cache'));
  assert.deepEqual(packed.files.map(file => file.path).sort(), expectedFiles);
  assert.equal(packed.entryCount, expectedFiles.length);
});

test('packed artifact imports and boots with the real Cordis skill registry', async t => {
  const temp = scratch(t);
  const packed = npmPack(['--pack-destination', temp], join(temp, 'cache'));
  const archive = join(temp, packed.filename);
  const extracted = join(root, `.pack-test-${process.pid}-${Date.now()}`);
  t.after(() => rmSync(extracted, { recursive: true, force: true }));
  mkdirSync(extracted);
  const untar = spawnSync('tar', ['-xzf', archive, '-C', extracted], { encoding: 'utf8' });
  assert.equal(untar.status, 0, untar.stderr);

  const packedRoot = join(extracted, 'package');
  const plugin = await import(pathToFileURL(join(packedRoot, 'lib', 'index.js')));
  const workflow = await import(pathToFileURL(join(packedRoot, 'lib', 'workflow.js')));
  assert.equal(typeof workflow.selectTasks, 'function');

  const context = new Context();
  try {
    await context.plugin(SkillRegistry);
    await context.plugin(plugin);
    const skills = await context.skills.list({ cwd: root });
    assert.deepEqual(
      skills.filter(skill => skill.name.startsWith('speckit')).map(skill => skill.name),
      [
        'speckit',
        'speckit-analyze',
        'speckit-clarify',
        'speckit-constitution',
        'speckit-implement',
        'speckit-plan',
        'speckit-specify',
        'speckit-tasks',
      ],
    );
  } finally {
    await context.fiber.dispose();
  }
});
