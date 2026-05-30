import { useEffect, useRef } from "react";

// TEMP (validation): point at a manually-run standalone server. Next step
// replaces this with the spawned server's URL via tRPC.
const SERVER_ORIGIN = "http://127.0.0.1:4601";

interface AgentInspectorWebviewProps {
	/** Worktree path — passed to devtools as ?cwd= to auto-select that project. */
	worktreePath?: string;
}

/**
 * Agent Inspector pane — embeds the full, real claude-devtools UI served by its
 * standalone server (vendored under vendor/agent-inspector) in an Electron
 * <webview>. The webview tag isn't a typed JSX intrinsic here, so we create it
 * imperatively (same approach as Superset's Browser pane).
 */
export function AgentInspectorWebview({
	worktreePath,
}: AgentInspectorWebviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const src = worktreePath
			? `${SERVER_ORIGIN}/?cwd=${encodeURIComponent(worktreePath)}`
			: SERVER_ORIGIN;
		const webview = document.createElement("webview");
		webview.setAttribute("src", src);
		webview.setAttribute("partition", "persist:superset");
		webview.setAttribute("allowpopups", "");
		webview.style.width = "100%";
		webview.style.height = "100%";
		webview.style.border = "0";
		container.appendChild(webview);

		return () => {
			webview.remove();
		};
	}, [worktreePath]);

	return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
