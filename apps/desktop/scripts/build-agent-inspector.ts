#!/usr/bin/env bun
/**
 * Builds the vendored claude-devtools standalone server (vendor/agent-inspector)
 * so the desktop app can spawn it — the full devtools UI (out/renderer) + the
 * Fastify server bundle (dist-standalone/index.cjs).
 *
 * Self-contained: devtools keeps its own pnpm deps; we just invoke its build.
 * Idempotent — skips if already built (pass --force to rebuild). Hooked into the
 * desktop predev/prebuild so a fresh clone "just works".
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const vendorDir = path.resolve(
	import.meta.dirname,
	"../../../vendor/agent-inspector",
);
const serverBundle = path.join(vendorDir, "dist-standalone/index.cjs");
const rendererIndex = path.join(vendorDir, "out/renderer/index.html");
const force = process.argv.includes("--force");

if (!existsSync(vendorDir)) {
	console.error(`[agent-inspector] vendor dir missing: ${vendorDir}`);
	process.exit(1);
}

if (!force && existsSync(serverBundle) && existsSync(rendererIndex)) {
	console.log(
		"[agent-inspector] already built — skipping (use --force to rebuild)",
	);
	process.exit(0);
}

function run(cmd: string, args: string[]): void {
	const r = spawnSync(cmd, args, { cwd: vendorDir, stdio: "inherit" });
	if (r.status !== 0) {
		console.error(`[agent-inspector] failed: ${cmd} ${args.join(" ")}`);
		process.exit(1);
	}
}

if (!existsSync(path.join(vendorDir, "node_modules"))) {
	console.log("[agent-inspector] installing vendored deps (pnpm)…");
	run("npx", [
		"-y",
		"pnpm@9",
		"install",
		"--ignore-workspace",
		"--prefer-offline",
	]);
}

console.log("[agent-inspector] building UI + standalone server…");
run("./node_modules/.bin/electron-vite", ["build"]);
run("./node_modules/.bin/vite", [
	"build",
	"--config",
	"vite.standalone.config.ts",
]);
console.log("[agent-inspector] built ✓");
