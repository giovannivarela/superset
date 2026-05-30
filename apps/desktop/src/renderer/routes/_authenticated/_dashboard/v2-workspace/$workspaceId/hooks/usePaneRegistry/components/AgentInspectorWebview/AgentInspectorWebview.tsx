import { workspaceTrpc } from "@superset/workspace-client";
import { useEffect, useRef } from "react";

interface AgentInspectorWebviewProps {
	/** Worktree path — passed to devtools as ?cwd= to auto-select that project. */
	worktreePath?: string;
}

/**
 * Agent Inspector pane — embeds the full, real claude-devtools UI (served by the
 * vendored standalone server, spawned + supervised by host-service) in an
 * Electron <webview>. The webview tag isn't a typed JSX intrinsic here, so we
 * create it imperatively (same approach as Superset's Browser pane).
 */
export function AgentInspectorWebview({
	worktreePath,
}: AgentInspectorWebviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const {
		data: baseUrl,
		isLoading,
		isError,
		error,
	} = workspaceTrpc.agentInspector.serverUrl.useQuery(undefined, {
		retry: false,
	});

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !baseUrl) return;

		const src = worktreePath
			? `${baseUrl}/?cwd=${encodeURIComponent(worktreePath)}`
			: baseUrl;
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
	}, [baseUrl, worktreePath]);

	if (isLoading) {
		return (
			<div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
				Starting Agent Inspector…
			</div>
		);
	}

	if (isError || !baseUrl) {
		return (
			<div className="flex h-full w-full flex-col items-center justify-center gap-1 px-6 text-center text-muted-foreground text-xs">
				<div className="text-foreground">Agent Inspector unavailable</div>
				<div className="max-w-md text-[hsl(0_84%_60%)]">
					{error?.message ?? "Could not start the inspector server"}
				</div>
			</div>
		);
	}

	return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
