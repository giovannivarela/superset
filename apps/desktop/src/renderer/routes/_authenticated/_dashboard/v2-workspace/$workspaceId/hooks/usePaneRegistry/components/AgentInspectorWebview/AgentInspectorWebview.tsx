import { useEffect, useRef } from "react";

// TEMP (validation): point at a manually-run standalone server. Next step
// replaces this with the spawned server's URL via tRPC.
const SERVER_URL = "http://127.0.0.1:4601";

/**
 * Agent Inspector pane — embeds the full, real claude-devtools UI served by its
 * standalone server (vendored under vendor/agent-inspector) in an Electron
 * <webview>. The webview tag isn't a typed JSX intrinsic here, so we create it
 * imperatively (same approach as Superset's Browser pane).
 */
export function AgentInspectorWebview() {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const webview = document.createElement("webview");
		webview.setAttribute("src", SERVER_URL);
		webview.setAttribute("partition", "persist:superset");
		webview.setAttribute("allowpopups", "");
		webview.style.width = "100%";
		webview.style.height = "100%";
		webview.style.border = "0";
		container.appendChild(webview);

		return () => {
			webview.remove();
		};
	}, []);

	return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
