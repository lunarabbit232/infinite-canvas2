"use client";

import { useEffect, useRef, useState } from "react";
import { ListEnd, LoaderCircle, StopCircle, X } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { formatDuration } from "@/lib/image-utils";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "../types";

type VideoTaskInfo = {
    nodeId: string;
    title: string;
    status: string;
    progress: number;
    startedAt: number;
    videoTaskId: string;
};

type Props = {
    nodes: Pick<CanvasNodeData, "id" | "type" | "title" | "metadata">[];
    now: number;
    onJumpToNode?: (nodeId: string) => void;
    onCancelTask?: (nodeId: string) => void;
};

function videoTaskStageLabel(apiStatus?: string, progress?: number): string {
    if (progress === 100) return "下载中";
    const s = (apiStatus || "").toLowerCase();
    if (s === "queued" || s === "submitted") return "排队中";
    if (s === "processing") return "生成中";
    if (progress !== undefined && progress > 0) return "生成中";
    return "排队中";
}

function videoTaskId(metadata?: CanvasNodeData["metadata"]): string {
    return (metadata?.videoTaskVideoId as string) || (metadata?.videoTaskId as string) || "";
}

export function CanvasVideoTaskQueue({ nodes, now, onJumpToNode, onCancelTask }: Props) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [collapsed, setCollapsed] = useState(false);
    const prevTaskIdsRef = useRef(new Set<string>());

    const tasks: VideoTaskInfo[] = nodes
        .filter(
            (n) =>
                n.type === CanvasNodeType.Video &&
                (n.metadata?.status as string | undefined) === "loading" &&
                !n.metadata?.content &&
                videoTaskId(n.metadata),
        )
        .map((n) => ({
            nodeId: n.id,
            title: n.title,
            status: (n.metadata?.status as string) || "",
            progress: Math.max(0, Math.min(100, Math.round((n.metadata?.progress as number) || 0))),
            startedAt: (n.metadata?.startedAt as number) || Date.now(),
            videoTaskId: videoTaskId(n.metadata),
        }));

    const currentTaskIds = new Set(tasks.map((t) => t.nodeId));

    useEffect(() => {
        const prevIds = prevTaskIdsRef.current;
        if (currentTaskIds.size > prevIds.size) setCollapsed(false);
        prevTaskIdsRef.current = currentTaskIds;
    }, [currentTaskIds]);

    if (!tasks.length) return null;

    const visibleTasks = collapsed ? [] : tasks;

    return (
        <div
            className="pointer-events-auto absolute right-3 top-14 z-50 max-h-[60vh] w-72 overflow-hidden rounded-2xl border shadow-lg backdrop-blur-xl"
            style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}
        >
            <div className="flex items-center justify-between gap-2 px-3 py-2">
                <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs font-medium transition hover:opacity-70"
                    style={{ color: theme.node.text }}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    <ListEnd className="size-3.5" />
                    视频任务 ({tasks.length})
                </button>
                <button
                    type="button"
                    className="grid size-6 place-items-center rounded-md transition hover:opacity-70"
                    style={{ color: theme.node.placeholder }}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    <X className="size-3.5" />
                </button>
            </div>
            {visibleTasks.length ? (
                <div className="thin-scrollbar max-h-[50vh] overflow-y-auto border-t px-3 py-2" style={{ borderColor: theme.toolbar.border }}>
                    <div className="grid gap-2">
                        {visibleTasks.map((task) => {
                            const elapsedMs = Math.max(0, now - task.startedAt);
                            const stage = videoTaskStageLabel(task.status, task.progress);
                            return (
                                <div
                                    key={task.nodeId}
                                    role="button"
                                    tabIndex={0}
                                    className="w-full rounded-xl px-3 py-2.5 text-left transition hover:opacity-80 cursor-pointer"
                                    style={{ background: theme.node.fill }}
                                    onClick={() => onJumpToNode?.(task.nodeId)}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onJumpToNode?.(task.nodeId); } }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="min-w-0 flex-1 truncate text-xs font-medium" style={{ color: theme.node.text }}>
                                            {task.title || "视频生成"}
                                        </span>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <button
                                                type="button"
                                                className="grid size-5 place-items-center rounded transition hover:opacity-70"
                                                style={{ color: theme.node.placeholder }}
                                                title="取消任务"
                                                onClick={(e) => { e.stopPropagation(); onCancelTask?.(task.nodeId); }}
                                            >
                                                <StopCircle className="size-3.5" />
                                            </button>
                                            <span className="text-[11px] opacity-55" style={{ color: theme.node.muted }}>
                                                {formatDuration(elapsedMs)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <LoaderCircle className="size-3 shrink-0 animate-spin opacity-55" style={{ color: theme.node.muted }} />
                                        <span className="text-[11px] opacity-65" style={{ color: theme.node.muted }}>
                                            {stage} {task.progress}%
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: theme.node.stroke }}>
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${task.progress}%`, background: theme.toolbar.activeText }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
