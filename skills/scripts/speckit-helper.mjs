#!/usr/bin/env node

import {
	deriveStage,
	features,
	initPlan,
	resolveFeature,
	selectTasks,
	WorkflowError,
} from "../../lib/workflow.js";

const OPERATION_FLAGS = {
	"init-plan": [],
	features: [],
	"resolve-feature": ["--selector"],
	"select-tasks": ["--tasks", "--selection"],
	"derive-stage": ["--feature"],
};

const REQUIRED_FLAGS = {
	"init-plan": [],
	features: [],
	"resolve-feature": ["--selector"],
	"select-tasks": ["--tasks"],
	"derive-stage": ["--feature"],
};

function parseArguments(argv) {
	const [operation, ...tokens] = argv;
	if (!operation || !Object.hasOwn(OPERATION_FLAGS, operation)) {
		throw new WorkflowError(
			"INVALID_ARGUMENT",
			operation ? `Unknown operation: ${operation}` : "Operation is required",
		);
	}

	const allowed = new Set(["--project-root", ...OPERATION_FLAGS[operation]]);
	const values = {};
	for (let index = 0; index < tokens.length; index += 2) {
		const flag = tokens[index];
		const value = tokens[index + 1];
		if (!allowed.has(flag))
			throw new WorkflowError("INVALID_ARGUMENT", `Unknown argument: ${flag}`);
		if (Object.hasOwn(values, flag))
			throw new WorkflowError(
				"INVALID_ARGUMENT",
				`Duplicate argument: ${flag}`,
			);
		if (value === undefined || value.startsWith("--"))
			throw new WorkflowError("INVALID_ARGUMENT", `Missing value for ${flag}`);
		values[flag] = value;
	}

	for (const flag of ["--project-root", ...REQUIRED_FLAGS[operation]]) {
		if (!Object.hasOwn(values, flag) || values[flag] === "")
			throw new WorkflowError("INVALID_ARGUMENT", `${flag} is required`);
	}
	return { operation, values };
}

function emitSuccess(operation, data, diagnostics = []) {
	for (const item of diagnostics)
		console.error(`${item.code}: ${item.message}`);
	process.stdout.write(
		`${JSON.stringify({ ok: true, operation, data, diagnostics })}\n`,
	);
}

function emitError(operation, error) {
	const code = error instanceof WorkflowError ? error.code : "UNEXPECTED";
	const message = error instanceof Error ? error.message : String(error);
	const exitCode = [
		"INVALID_ARGUMENT",
		"INVALID_SELECTION",
		"NOT_FOUND",
		"AMBIGUOUS",
	].includes(code)
		? 2
		: code === "UNSAFE_PATH"
			? 3
			: [
						"PROJECT_CONFLICT",
						"MALFORMED_FEATURE",
						"MALFORMED_ARTIFACT",
					].includes(code)
				? 4
				: 1;
	console.error(`${code}: ${message}`);
	process.stdout.write(
		`${JSON.stringify({
			ok: false,
			operation: operation ?? null,
			error: { code, message, details: error?.details ?? {} },
			diagnostics: [],
		})}\n`,
	);
	process.exitCode = exitCode;
}

let operation = process.argv[2] ?? null;
try {
	const parsed = parseArguments(process.argv.slice(2));
	operation = parsed.operation;
	const root = parsed.values["--project-root"];
	let data;
	let diagnostics = [];

	if (operation === "init-plan") {
		data = initPlan(root);
		if (!data.canInitialize) {
			diagnostics = [
				{
					level: "warning",
					code: "PROJECT_CONFLICT",
					path: data.projectRoot,
					message: "One or more initialization paths conflict",
				},
			];
		}
	} else if (operation === "features") {
		data = features(root);
		diagnostics = data.malformed.map((item) => ({
			level: "warning",
			code: "MALFORMED_FEATURE",
			path: item.path,
			message: item.reason,
		}));
	} else if (operation === "resolve-feature") {
		data = resolveFeature(root, parsed.values["--selector"]);
	} else if (operation === "select-tasks") {
		const selection = Object.hasOwn(parsed.values, "--selection")
			? parsed.values["--selection"]
			: null;
		data = selectTasks(root, parsed.values["--tasks"], selection);
	} else {
		data = deriveStage(root, parsed.values["--feature"]);
	}

	emitSuccess(operation, data, diagnostics);
} catch (error) {
	emitError(operation, error);
}
