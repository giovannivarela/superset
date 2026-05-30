import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { publicProcedure, router } from "../index";

/**
 * Spawns + supervises the vendored claude-devtools standalone server
 * (vendor/agent-inspector) and hands the Agent Inspector pane its URL. The pane
 * embeds that URL in a <webview>. Lives in host-service because that's the
 * process the workspace pane talks to — and on a remote host it reads the
 * remote ~/.claude for free.
 */

let proc: ChildProcess | null = null;
let url: string | null = null;
let starting: Promise<string> | null = null;
let exitHookInstalled = false;

function resolveServerEntry(): string {
	// host-service runs as `node <...>/dist/main/host-service.js`; argv[1] is that
	// script. Dev: repo root is 4 levels up → vendor/agent-inspector. Packaged:
	// the bundle is copied beside resources.
	const base = path.dirname(process.argv[1] ?? "");
	// resourcesPath is Electron-only (host-service runs as electron-as-node); not in node types.
	const resourcesPath = (process as { resourcesPath?: string }).resourcesPath;
	const candidates = [
		path.resolve(
			base,
			"../../../../vendor/agent-inspector/dist-standalone/index.cjs",
		),
		process.env.AGENT_INSPECTOR_SERVER_ENTRY ?? "",
		resourcesPath
			? path.join(resourcesPath, "agent-inspector/dist-standalone/index.cjs")
			: "",
	].filter(Boolean);
	const found = candidates.find((c) => existsSync(c));
	if (!found) {
		throw new Error(
			`Agent Inspector server bundle not found. Looked in:\n${candidates.join("\n")}`,
		);
	}
	return found;
}

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = net.createServer();
		srv.unref();
		srv.on("error", reject);
		srv.listen(0, "127.0.0.1", () => {
			const addr = srv.address();
			const port = typeof addr === "object" && addr ? addr.port : 0;
			srv.close(() => resolve(port));
		});
	});
}

async function waitForReady(port: number, timeoutMs = 15000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const ok = await new Promise<boolean>((resolve) => {
			const req = http.get(
				{ host: "127.0.0.1", port, path: "/", timeout: 1000 },
				(res) => {
					res.resume();
					resolve(true);
				},
			);
			req.on("error", () => resolve(false));
			req.on("timeout", () => {
				req.destroy();
				resolve(false);
			});
		});
		if (ok) return;
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error("Agent Inspector server did not become ready in time");
}

function installExitHook(): void {
	if (exitHookInstalled) return;
	exitHookInstalled = true;
	const kill = () => {
		proc?.kill();
		proc = null;
	};
	process.on("exit", kill);
	process.on("SIGTERM", kill);
	process.on("SIGINT", kill);
}

async function ensureServer(): Promise<string> {
	if (url && proc && !proc.killed) return url;
	if (starting) return starting;
	starting = (async () => {
		const entry = resolveServerEntry();
		// out/renderer ships beside dist-standalone (…/agent-inspector/out/renderer).
		// Pin it explicitly so the server never falls back to a cwd-relative guess.
		const rendererPath = path.join(
			path.dirname(path.dirname(entry)),
			"out/renderer",
		);
		const port = await getFreePort();
		const child = spawn(process.execPath, [entry], {
			env: {
				...process.env,
				ELECTRON_RUN_AS_NODE: "1",
				HOST: "127.0.0.1",
				PORT: String(port),
				RENDERER_PATH: rendererPath,
			},
			stdio: "ignore",
		});
		proc = child;
		installExitHook();
		child.on("exit", () => {
			if (proc === child) {
				proc = null;
				url = null;
				starting = null;
			}
		});
		await waitForReady(port);
		url = `http://127.0.0.1:${port}`;
		return url;
	})();
	try {
		return await starting;
	} catch (err) {
		starting = null;
		throw err;
	}
}

export const agentInspectorRouter = router({
	/** Spawn-if-needed and return the standalone server's base URL. */
	serverUrl: publicProcedure.query(() => ensureServer()),
});
