import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const FEATURE_RE = /^(\d{3,})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const ID_RE = /^(US|FR|SC|EC|OQ)-\d{3,}$/;
const TASK_ID_RE = /^T\d{3,}$/;
// - [ ] T001 [FR-001, SC-001] Description (depends: T000)
const TASK_RE = /^- \[([ x])\] (T\d{3,}) ((?:\[(?:FOUNDATION|(?:FR|SC|EC)-\d{3,}(?:, (?:FR|SC|EC)-\d{3,})*)\] )?)(.+?)(?: \(depends: (T\d{3,}(?:, T\d{3,})*)\))?$/;
const MACHINE_TOKEN_RE = /\b(?:US|FR|SC|EC|OQ)-[A-Za-z0-9-]+\b/g;

const SPEC_HEADINGS = [
  '# Feature:',
  '## Problem',
  '## Goals',
  '## User Stories',
  '## Functional Requirements',
  '## Success Criteria',
  '## Edge Cases',
  '## Out of Scope',
  '## Assumptions',
  '## Open Questions',
];

const PLAN_HEADINGS = [
  '# Plan:',
  '## Technical Context',
  '## Constraints from Constitution and Specification',
  '## Architecture and Components',
  '## Data Flow and Interfaces',
  '## Dependencies',
  '## Requirement Mapping',
  '## Testing Strategy',
  '## Risks and Fallbacks',
];

/**
 * Structured error returned by deterministic workflow operations.
 * @property {string} code Stable machine-readable error code.
 * @property {Record<string, unknown>} details Structured error context.
 */
export class WorkflowError extends Error {
  /**
   * @param {string} code Stable machine-readable error code.
   * @param {string} message Human-readable error explanation.
   * @param {Record<string, unknown>} [details] Optional structured context.
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.details = details;
  }
}

/** @typedef {'missing' | 'directory' | 'conflict'} InitializationState */
/** @typedef {'missing' | 'valid' | 'invalid'} ArtifactState */
/** @typedef {'invalid' | 'not-started' | 'specified' | 'planned' | 'tasked' | 'in-progress' | 'complete'} WorkflowStage */

/**
 * @typedef {object} InitializationPath
 * @property {string} path Absolute path beneath the canonical project root.
 * @property {InitializationState} state Classification of the path.
 * @property {string | null} type Existing filesystem type, or null when missing.
 */

/**
 * @typedef {object} InitPlanData
 * @property {string} projectRoot Canonical project root.
 * @property {boolean} canInitialize Whether neither initialization target conflicts.
 * @property {{'.speckit': InitializationPath, specs: InitializationPath}} paths Target classifications.
 */

/**
 * @typedef {object} Feature
 * @property {string} name Feature directory basename.
 * @property {number} number Safe numeric prefix value.
 * @property {string} prefix Original numeric prefix.
 * @property {string} slug Kebab-case feature slug.
 * @property {string} path Canonical feature directory path.
 */

/**
 * @typedef {object} MalformedFeature
 * @property {string} name Directory entry name.
 * @property {string} path Absolute entry path.
 * @property {string} reason Mechanical rejection reason.
 */

/**
 * @typedef {object} FeaturesData
 * @property {string} projectRoot Canonical project root.
 * @property {string} specsRoot Absolute specs directory.
 * @property {Feature[]} features Valid features in deterministic order.
 * @property {MalformedFeature[]} malformed Rejected entries in deterministic order.
 * @property {number} nextNumber Next safe numeric prefix value.
 * @property {string} nextPrefix Next prefix padded to at least three digits.
 */

/**
 * @typedef {object} ResolveFeatureData
 * @property {string} projectRoot Canonical project root.
 * @property {string} specsRoot Absolute specs directory.
 * @property {string} selector Original selector.
 * @property {Feature} feature The unique resolved feature.
 */

/**
 * @typedef {object} Task
 * @property {string} id Task identifier.
 * @property {boolean} checked Whether the task is complete.
 * @property {string[]} references Requirement identifiers.
 * @property {string[]} dependencies Earlier task dependencies.
 * @property {number} line One-based source line.
 * @property {string} text Task description.
 */

/**
 * @typedef {object} SelectTasksData
 * @property {string} projectRoot Canonical project root.
 * @property {string} tasksFile Canonical tasks file path.
 * @property {string | null} requested Explicit selection, or null for implicit selection.
 * @property {Task[]} selected Selected tasks in document order.
 * @property {{task: string, dependency: string}[]} incompleteDependencies Unmet dependencies outside the selection.
 */

/**
 * @typedef {object} ArtifactStatus
 * @property {string} path Absolute artifact path.
 * @property {ArtifactState} state Mechanical validity state.
 */

/**
 * @typedef {object} LatestVerification
 * @property {string} timestamp UTC timestamp from the latest run.
 * @property {{kind: 'full' | 'partial', tasks: string[]}} scope Verified task scope.
 * @property {'pass' | 'fail'} overallResult Aggregate result.
 * @property {number} checks Number of recorded checks.
 */

/**
 * @typedef {object} DeriveStageData
 * @property {string} projectRoot Canonical project root.
 * @property {string} feature Canonical feature directory.
 * @property {WorkflowStage} stage Derived lifecycle stage.
 * @property {{spec: ArtifactStatus, plan: ArtifactStatus, tasks: ArtifactStatus}} artifacts Artifact states.
 * @property {{total: number, completed: number, remaining: number} | null} tasks Task counts when tasks.md is valid.
 * @property {LatestVerification | null} latestVerification Latest valid evidence summary.
 */

function compareCodepoint(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stat(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function reportedExistingPath(path) {
  try {
    return realpathSync(path);
  } catch {
    // Broken links have no canonical realpath; retain their absolute normalized location.
    return resolve(path);
  }
}

function isRegularFile(path) {
  const entry = stat(path);
  return Boolean(entry?.isFile() && !entry.isSymbolicLink());
}

function isRealDirectory(path) {
  const entry = stat(path);
  return Boolean(entry?.isDirectory() && !entry.isSymbolicLink());
}

function requireProject(projectRoot) {
  if (!projectRoot) {
    throw new WorkflowError('INVALID_ARGUMENT', '--project-root is required');
  }

  let root;
  try {
    root = realpathSync(projectRoot);
  } catch {
    throw new WorkflowError('PROJECT_CONFLICT', 'Project root must be a real directory');
  }

  if (!isRealDirectory(root)) {
    throw new WorkflowError('PROJECT_CONFLICT', 'Project root must be a real directory');
  }
  return root;
}

function requireSpecs(root) {
  const specsRoot = join(root, 'specs');
  if (!isRealDirectory(specsRoot)) {
    throw new WorkflowError('PROJECT_CONFLICT', 'specs/ must be a real directory');
  }
  return specsRoot;
}

function isConfined(root, path) {
  const difference = relative(root, path);
  return difference === '' || (
    difference !== '..'
    && !difference.startsWith(`..${sep}`)
    && !isAbsolute(difference)
  );
}

function hasSymlinkComponent(root, target) {
  const difference = relative(root, target);
  if (!isConfined(root, target) || difference === '') return false;

  let current = root;
  for (const component of difference.split(sep)) {
    current = join(current, component);
    const entry = stat(current);
    if (!entry) return false;
    if (entry.isSymbolicLink()) return true;
  }
  return false;
}

function headingMatches(line, heading) {
  if (heading.endsWith(':')) {
    return line.startsWith(`${heading} `) && line.length > heading.length + 1;
  }
  return line === heading;
}

function headingsValid(text, headings) {
  const lines = text.split(/\r?\n/);
  let previous = -1;

  for (const heading of headings) {
    const matches = [];
    for (const [index, line] of lines.entries()) {
      if (headingMatches(line, heading)) matches.push(index);
    }
    if (matches.length !== 1 || matches[0] <= previous) return false;
    previous = matches[0];
  }
  return true;
}

function tokensValid(text, unique) {
  const tokens = [...text.matchAll(MACHINE_TOKEN_RE)].map(match => match[0]);
  if (tokens.some(token => !ID_RE.test(token))) return false;
  return !unique || new Set(tokens).size === tokens.length;
}

function specValid(text) {
  return tokensValid(text, true)
    && /\bFR-\d{3,}\b/.test(text)
    && /\bSC-\d{3,}\b/.test(text);
}

function planValid(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.indexOf('## Requirement Mapping');
  const end = lines.indexOf('## Testing Strategy');
  return start >= 0
    && end > start
    && tokensValid(lines.slice(start + 1, end).join('\n'), false);
}

function readUtf8(path) {
  return new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
}

function validUtcTimestamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(value);
  if (!match) return false;

  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysPerMonth[month - 1]
    && hour <= 23
    && minute <= 59
    && second <= 59;
}

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort(compareCodepoint);
  const expected = [...keys].sort(compareCodepoint);
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function parseTasks(text) {
  const lines = text.split(/\r?\n/);
  const taskHeadingIndexes = [];
  const verificationHeadingIndexes = [];
  for (const [index, line] of lines.entries()) {
    if (line === '## Task List') taskHeadingIndexes.push(index);
    if (line === '## Verification') verificationHeadingIndexes.push(index);
  }

  if (
    taskHeadingIndexes.length !== 1
    || verificationHeadingIndexes.length !== 1
    || taskHeadingIndexes[0] >= verificationHeadingIndexes[0]
  ) {
    throw new WorkflowError(
      'MALFORMED_ARTIFACT',
      'tasks.md must contain one ordered Task List and Verification section',
    );
  }

  const taskStart = taskHeadingIndexes[0];
  const verificationStart = verificationHeadingIndexes[0];
  const tasks = [];
  const identifiers = new Set();
  let inComment = false;

  for (let index = taskStart + 1; index < verificationStart; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (inComment) {
      if (trimmed.includes('-->')) inComment = false;
      continue;
    }
    if (trimmed.startsWith('<!--')) {
      if (!trimmed.includes('-->')) inComment = true;
      continue;
    }
    if (!trimmed || /^### \S.*$/.test(line)) continue;
    if (!line.startsWith('- [')) {
      throw new WorkflowError(
        'MALFORMED_ARTIFACT',
        `Unexpected Task List content at line ${index + 1}`,
      );
    }

    const match = TASK_RE.exec(line);
    if (!match) {
      throw new WorkflowError('MALFORMED_ARTIFACT', `Malformed task at line ${index + 1}`);
    }

    const [, checkbox, id, referencesSource, description, dependenciesSource] = match;
    if (identifiers.has(id)) {
      throw new WorkflowError('MALFORMED_ARTIFACT', `Duplicate task ID ${id}`);
    }
    identifiers.add(id);

    const references = [...referencesSource.matchAll(/(?:FR|SC|EC)-\d{3,}/g)]
      .map(reference => reference[0]);
    if (!referencesSource.includes('FOUNDATION') && references.length === 0) {
      throw new WorkflowError('MALFORMED_ARTIFACT', `Task ${id} lacks requirement mapping`);
    }

    const dependencies = dependenciesSource ? dependenciesSource.split(', ') : [];
    if (new Set(dependencies).size !== dependencies.length) {
      throw new WorkflowError('MALFORMED_ARTIFACT', `Duplicate dependency on ${id}`);
    }

    tasks.push({
      id,
      checked: checkbox === 'x',
      references,
      dependencies,
      line: index + 1,
      text: description,
    });
  }

  if (inComment) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'Unclosed Markdown comment in Task List');
  }
  if (tasks.length === 0) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'tasks.md requires at least one task');
  }

  validateDependencies(tasks);
  return {
    tasks,
    verification: lines.slice(verificationStart + 1).join('\n').trim(),
  };
}

function validateDependencies(tasks) {
  const positions = new Map(tasks.map((task, index) => [task.id, index]));
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (!positions.has(dependency)) {
        throw new WorkflowError('MALFORMED_ARTIFACT', `Unknown dependency ${dependency}`);
      }
      if (dependency === task.id) {
        throw new WorkflowError('MALFORMED_ARTIFACT', `Task ${task.id} depends on itself`);
      }
    }
  }

  const byId = new Map(tasks.map(task => [task.id, task]));
  const visiting = new Set();
  const visited = new Set();
  function visit(task) {
    if (visiting.has(task.id)) {
      throw new WorkflowError('MALFORMED_ARTIFACT', `Dependency cycle includes ${task.id}`);
    }
    if (visited.has(task.id)) return;
    visiting.add(task.id);
    for (const dependency of task.dependencies) visit(byId.get(dependency));
    visiting.delete(task.id);
    visited.add(task.id);
  }
  for (const task of tasks) visit(task);

  for (const [index, task] of tasks.entries()) {
    for (const dependency of task.dependencies) {
      if (positions.get(dependency) >= index) {
        throw new WorkflowError(
          'MALFORMED_ARTIFACT',
          `Dependency ${dependency} must precede ${task.id}`,
        );
      }
    }
  }
}

function parseVerification(source, tasks) {
  if (source === 'No verification has been recorded.') return [];
  if (!source || source.includes('No verification has been recorded.')) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'Malformed Verification section');
  }

  const normalized = source.replace(/\r\n/g, '\n').trim();
  const block = /### Verification Run: ([^\n]+)\n\n```json\n([\s\S]*?)\n```/y;
  const runs = [];
  const timestamps = new Set();
  let cursor = 0;

  while (cursor < normalized.length) {
    block.lastIndex = cursor;
    const match = block.exec(normalized);
    if (!match) {
      throw new WorkflowError('MALFORMED_ARTIFACT', 'Malformed verification block');
    }

    const [, timestamp, json] = match;
    if (!validUtcTimestamp(timestamp) || timestamps.has(timestamp)) {
      throw new WorkflowError('MALFORMED_ARTIFACT', 'Invalid or duplicate verification timestamp');
    }
    timestamps.add(timestamp);

    let value;
    try {
      value = JSON.parse(json);
    } catch {
      throw new WorkflowError('MALFORMED_ARTIFACT', 'Verification block contains invalid JSON');
    }
    validateVerification(value, tasks);
    runs.push({ timestamp, ...value });

    cursor = block.lastIndex;
    while (normalized[cursor] === '\n') cursor += 1;
  }

  return runs;
}

function validateVerification(value, tasks) {
  if (!exactKeys(value, ['scope', 'overallResult', 'checks'])) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'Verification record has invalid fields');
  }
  if (!exactKeys(value.scope, ['kind', 'tasks'])) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'Verification scope has invalid fields');
  }
  if (!['full', 'partial'].includes(value.scope.kind) || !Array.isArray(value.scope.tasks)) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'Verification scope is invalid');
  }

  const taskOrder = new Map(tasks.map((task, index) => [task.id, index]));
  if (value.scope.kind === 'full' && value.scope.tasks.length !== 0) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'Full verification scope must have no tasks');
  }
  if (value.scope.kind === 'partial') {
    if (value.scope.tasks.length === 0) {
      throw new WorkflowError('MALFORMED_ARTIFACT', 'Partial verification scope must name tasks');
    }
    let previous = -1;
    const scoped = new Set();
    for (const id of value.scope.tasks) {
      const position = taskOrder.get(id);
      if (!TASK_ID_RE.test(id) || position === undefined || scoped.has(id) || position <= previous) {
        throw new WorkflowError(
          'MALFORMED_ARTIFACT',
          'Partial verification tasks must be valid, unique, and in document order',
        );
      }
      scoped.add(id);
      previous = position;
    }
  }

  if (!Array.isArray(value.checks) || value.checks.length === 0) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'Verification checks must be non-empty');
  }
  for (const check of value.checks) {
    if (!exactKeys(check, ['command', 'exitCode', 'result'])) {
      throw new WorkflowError('MALFORMED_ARTIFACT', 'Verification check has invalid fields');
    }
    if (
      typeof check.command !== 'string'
      || check.command.trim().length === 0
      || !Number.isInteger(check.exitCode)
      || check.exitCode < 0
      || !['pass', 'fail'].includes(check.result)
      || (check.exitCode === 0) !== (check.result === 'pass')
    ) {
      throw new WorkflowError('MALFORMED_ARTIFACT', 'Verification check is invalid');
    }
  }

  const expected = value.checks.every(check => check.result === 'pass') ? 'pass' : 'fail';
  if (!['pass', 'fail'].includes(value.overallResult) || value.overallResult !== expected) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'Verification overall result is inconsistent');
  }
}

function artifact(path, headings, validator) {
  const entry = stat(path);
  if (!entry) return { path, state: 'missing', text: null };
  if (!isRegularFile(path)) return { path, state: 'invalid', text: null };

  try {
    const text = readUtf8(path);
    const valid = headingsValid(text, headings) && validator(text);
    return { path, state: valid ? 'valid' : 'invalid', text };
  } catch {
    return { path, state: 'invalid', text: null };
  }
}

function resolveFeaturePath(root, featureSelector) {
  if (typeof featureSelector !== 'string' || featureSelector.length === 0) {
    throw new WorkflowError('INVALID_ARGUMENT', '--feature is required');
  }
  if (!isAbsolute(featureSelector)) {
    return resolveFeature(root, featureSelector).feature.path;
  }

  const specsRoot = requireSpecs(root);
  const target = resolve(featureSelector);
  if (!isConfined(specsRoot, target) || dirname(target) !== specsRoot) {
    throw new WorkflowError('UNSAFE_PATH', 'Feature path must be a direct child of specs/');
  }
  if (hasSymlinkComponent(root, target)) {
    throw new WorkflowError('UNSAFE_PATH', 'Feature path contains a symlink');
  }

  const entry = stat(target);
  if (!entry) throw new WorkflowError('NOT_FOUND', 'Feature directory does not exist');
  if (!isRealDirectory(target) || !FEATURE_RE.test(basename(target))) {
    throw new WorkflowError('MALFORMED_FEATURE', 'Feature path is not a valid feature directory');
  }

  const canonical = realpathSync(target);
  if (!isConfined(specsRoot, canonical) || dirname(canonical) !== specsRoot) {
    throw new WorkflowError('UNSAFE_PATH', 'Feature path escapes specs/');
  }
  return canonical;
}

/**
 * Classify initialization targets without modifying the filesystem.
 * @param {string} projectRoot Project directory.
 * @returns {InitPlanData} Exact initialization data shape.
 * @throws {WorkflowError} If the project root is unusable.
 */
export function initPlan(projectRoot) {
  const root = requireProject(projectRoot);
  const paths = {};

  for (const name of ['.speckit', 'specs']) {
    const path = join(root, name);
    const entry = stat(path);
    if (!entry) {
      paths[name] = { path, state: 'missing', type: null };
    } else if (isRealDirectory(path)) {
      paths[name] = {
        path: reportedExistingPath(path),
        state: 'directory',
        type: 'directory',
      };
    } else {
      const type = entry.isSymbolicLink() ? 'symlink' : entry.isFile() ? 'file' : 'other';
      paths[name] = {
        path: reportedExistingPath(path),
        state: 'conflict',
        type,
      };
    }
  }

  return {
    projectRoot: root,
    canInitialize: Object.values(paths).every(item => item.state !== 'conflict'),
    paths,
  };
}

/**
 * Enumerate valid and malformed feature directory entries deterministically.
 * @param {string} projectRoot Project directory.
 * @returns {FeaturesData} Exact feature enumeration data shape.
 * @throws {WorkflowError} If the project or specs directory is unusable.
 */
export function features(projectRoot) {
  const root = requireProject(projectRoot);
  const specsRoot = requireSpecs(root);
  const valid = [];
  const malformed = [];
  const entries = readdirSync(specsRoot, { withFileTypes: true })
    .sort((left, right) => compareCodepoint(left.name, right.name));

  for (const entry of entries) {
    const path = join(specsRoot, entry.name);
    const match = FEATURE_RE.exec(entry.name);
    if (!entry.isDirectory() || entry.isSymbolicLink() || !match) {
      malformed.push({
        name: entry.name,
        path: reportedExistingPath(path),
        reason: !entry.isDirectory() || entry.isSymbolicLink()
          ? 'not a real feature directory'
          : 'invalid feature name',
      });
      continue;
    }

    const number = Number(match[1]);
    if (!Number.isSafeInteger(number)) {
      malformed.push({
        name: entry.name,
        path: reportedExistingPath(path),
        reason: 'numeric prefix exceeds safe integer range',
      });
      continue;
    }

    valid.push({
      name: entry.name,
      number,
      prefix: match[1],
      slug: match[2],
      path: realpathSync(path),
    });
  }

  valid.sort((left, right) => left.number - right.number || compareCodepoint(left.name, right.name));
  const maximum = valid.length === 0 ? 0 : valid.at(-1).number;
  if (maximum >= Number.MAX_SAFE_INTEGER) {
    throw new WorkflowError('MALFORMED_FEATURE', 'Feature number cannot be incremented safely');
  }
  const nextNumber = maximum + 1;

  return {
    projectRoot: root,
    specsRoot,
    features: valid,
    malformed,
    nextNumber,
    nextPrefix: String(nextNumber).padStart(3, '0'),
  };
}

/**
 * Resolve an exact name, unique slug, or direct project-relative feature path.
 * @param {string} projectRoot Project directory.
 * @param {string} selector Feature selector.
 * @returns {ResolveFeatureData} Exact resolved-feature data shape.
 * @throws {WorkflowError} If the selector is invalid, unsafe, absent, or ambiguous.
 */
export function resolveFeature(projectRoot, selector) {
  const data = features(projectRoot);
  if (typeof selector !== 'string' || selector.length === 0) {
    throw new WorkflowError('INVALID_ARGUMENT', '--selector is required');
  }
  if (selector !== selector.trim()) {
    throw new WorkflowError(
      'INVALID_ARGUMENT',
      'Feature selector must not contain surrounding whitespace',
    );
  }

  const components = selector.split(/[\\/]/);
  if (isAbsolute(selector) || components.includes('..')) {
    throw new WorkflowError(
      'UNSAFE_PATH',
      'Feature selector must be project-relative and confined',
    );
  }
  if (
    components.length > 1
    && (components.length !== 2 || components[0] !== 'specs' || !components[1])
  ) {
    throw new WorkflowError('UNSAFE_PATH', 'Feature paths must be direct children of specs/');
  }

  let candidates;
  if (components.length === 2) {
    const expected = join(data.specsRoot, components[1]);
    if (!isConfined(data.specsRoot, expected)) {
      throw new WorkflowError('UNSAFE_PATH', 'Feature selector escapes specs/');
    }
    if (hasSymlinkComponent(data.projectRoot, expected)) {
      throw new WorkflowError('UNSAFE_PATH', 'Feature selector contains a symlink');
    }
    candidates = data.features.filter(feature => feature.path === expected);
  } else {
    candidates = data.features.filter(feature => (
      feature.name === selector || feature.slug === selector
    ));
  }

  if (candidates.length === 0) {
    throw new WorkflowError('NOT_FOUND', 'No matching feature directory');
  }
  if (candidates.length > 1) {
    throw new WorkflowError('AMBIGUOUS', 'Feature slug matches multiple features', {
      matches: candidates.map(feature => feature.name),
    });
  }

  return {
    projectRoot: data.projectRoot,
    specsRoot: data.specsRoot,
    selector,
    feature: candidates[0],
  };
}

/**
 * Select explicit task IDs/ranges or all incomplete tasks without writing files.
 * @param {string} projectRoot Project directory.
 * @param {string} tasksFile Absolute or project-relative tasks.md path.
 * @param {string | null} [selection=null] Comma-separated IDs and inclusive ranges.
 * @returns {SelectTasksData} Exact selected-task data shape.
 * @throws {WorkflowError} If the file, artifact, or selection is invalid or unsafe.
 */
export function selectTasks(projectRoot, tasksFile, selection = null) {
  const root = requireProject(projectRoot);
  requireSpecs(root);
  if (typeof tasksFile !== 'string' || tasksFile.length === 0) {
    throw new WorkflowError('INVALID_ARGUMENT', '--tasks is required');
  }
  if (selection !== null && (typeof selection !== 'string' || selection.length === 0)) {
    throw new WorkflowError('INVALID_SELECTION', 'Explicit task selection must not be empty');
  }

  const candidate = isAbsolute(tasksFile) ? resolve(tasksFile) : resolve(root, tasksFile);
  if (!isConfined(root, candidate) || hasSymlinkComponent(root, candidate)) {
    throw new WorkflowError('UNSAFE_PATH', 'Tasks file must stay within the project without symlinks');
  }
  if (!isRegularFile(candidate)) {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'Tasks file must be a real regular file');
  }

  const canonical = realpathSync(candidate);
  if (!isConfined(root, canonical)) {
    throw new WorkflowError('UNSAFE_PATH', 'Tasks file escapes the project');
  }

  let source;
  try {
    source = readUtf8(canonical);
  } catch {
    throw new WorkflowError('MALFORMED_ARTIFACT', 'tasks file must contain valid UTF-8');
  }

  const parsed = parseTasks(source);
  parseVerification(parsed.verification, parsed.tasks);
  const byId = new Map(parsed.tasks.map(task => [task.id, task]));
  let selected;

  if (selection === null) {
    selected = parsed.tasks.filter(task => !task.checked);
  } else {
    const requestedIds = new Set();
    const parts = selection.split(',').map(part => part.trim());
    if (parts.some(part => part.length === 0)) {
      throw new WorkflowError('INVALID_SELECTION', 'Selection contains an empty item');
    }

    for (const part of parts) {
      if (TASK_ID_RE.test(part)) {
        if (!byId.has(part)) {
          throw new WorkflowError('INVALID_SELECTION', `Unknown task ${part}`);
        }
        requestedIds.add(part);
        continue;
      }

      const range = /^(T\d{3,})-(T\d{3,})$/.exec(part);
      if (!range) {
        throw new WorkflowError('INVALID_SELECTION', `Malformed task selector ${part}`);
      }
      const [, firstId, lastId] = range;
      if (!byId.has(firstId) || !byId.has(lastId)) {
        throw new WorkflowError('INVALID_SELECTION', `Unknown task range endpoint ${part}`);
      }

      const first = BigInt(firstId.slice(1));
      const last = BigInt(lastId.slice(1));
      if (first > last) {
        throw new WorkflowError('INVALID_SELECTION', `Reversed task range ${part}`);
      }
      for (const task of parsed.tasks) {
        const number = BigInt(task.id.slice(1));
        if (number >= first && number <= last) requestedIds.add(task.id);
      }
    }

    selected = parsed.tasks.filter(task => requestedIds.has(task.id));
    if (selected.length === 0) {
      throw new WorkflowError('INVALID_SELECTION', 'Selection is empty');
    }
  }

  const selectedIds = new Set(selected.map(task => task.id));
  const incompleteDependencies = [];
  for (const task of selected) {
    for (const dependency of task.dependencies) {
      if (!byId.get(dependency).checked && !selectedIds.has(dependency)) {
        incompleteDependencies.push({ task: task.id, dependency });
      }
    }
  }

  return {
    projectRoot: root,
    tasksFile: canonical,
    requested: selection,
    selected,
    incompleteDependencies,
  };
}

/**
 * Derive the exact workflow stage from mechanically validated artifacts.
 * @param {string} projectRoot Project directory.
 * @param {string} featurePath Absolute feature path or supported feature selector.
 * @returns {DeriveStageData} Exact stage and artifact status data shape.
 * @throws {WorkflowError} If the project or feature path is absent, malformed, or unsafe.
 */
export function deriveStage(projectRoot, featurePath) {
  const root = requireProject(projectRoot);
  const feature = resolveFeaturePath(root, featurePath);

  const spec = artifact(join(feature, 'spec.md'), SPEC_HEADINGS, specValid);
  const plan = artifact(join(feature, 'plan.md'), PLAN_HEADINGS, planValid);
  const tasks = artifact(
    join(feature, 'tasks.md'),
    ['# Tasks:', '## Task List', '## Verification'],
    () => true,
  );

  let parsedTasks = null;
  let verificationRuns = [];
  if (tasks.state === 'valid') {
    try {
      parsedTasks = parseTasks(tasks.text);
      verificationRuns = parseVerification(parsedTasks.verification, parsedTasks.tasks);
    } catch {
      tasks.state = 'invalid';
    }
  }

  const artifacts = {
    spec: { path: spec.path, state: spec.state },
    plan: { path: plan.path, state: plan.state },
    tasks: { path: tasks.path, state: tasks.state },
  };

  let stage;
  const invalidArtifact = [spec, plan, tasks].some(item => item.state === 'invalid');
  const planWithoutSpec = plan.state !== 'missing' && spec.state === 'missing';
  const tasksWithoutPrerequisites = tasks.state !== 'missing'
    && (spec.state === 'missing' || plan.state === 'missing');

  if (invalidArtifact || planWithoutSpec || tasksWithoutPrerequisites) {
    stage = 'invalid';
  } else if (spec.state === 'missing') {
    stage = 'not-started';
  } else if (plan.state === 'missing') {
    stage = 'specified';
  } else if (tasks.state === 'missing') {
    stage = 'planned';
  } else {
    const completed = parsedTasks.tasks.filter(task => task.checked).length;
    const latest = verificationRuns.at(-1);
    const complete = completed === parsedTasks.tasks.length
      && latest?.scope.kind === 'full'
      && latest.overallResult === 'pass';
    if (complete) {
      stage = 'complete';
    } else if (completed === 0 && verificationRuns.length === 0) {
      stage = 'tasked';
    } else {
      stage = 'in-progress';
    }
  }

  const completed = parsedTasks?.tasks.filter(task => task.checked).length ?? 0;
  const latest = verificationRuns.at(-1);
  return {
    projectRoot: root,
    feature,
    stage,
    artifacts,
    tasks: parsedTasks ? {
      total: parsedTasks.tasks.length,
      completed,
      remaining: parsedTasks.tasks.length - completed,
    } : null,
    latestVerification: latest ? {
      timestamp: latest.timestamp,
      scope: latest.scope,
      overallResult: latest.overallResult,
      checks: latest.checks.length,
    } : null,
  };
}
