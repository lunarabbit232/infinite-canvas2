"use client";

import { Layers3, Sparkles } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

export function CanvasDirectorNodePanel({ onOpen, onAgent, panoramaCount = 0, screenshotCount = 0 }: { onOpen: () => void; onAgent?: () => void; panoramaCount?: number; screenshotCount?: number }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center" style={{ color: theme.node.text }}>
            <Layers3 className="size-8" strokeWidth={1.5} style={{ color: theme.node.muted }} />
            <p className="m-0 text-xs leading-4" style={{ color: theme.node.placeholder }}>3D 场景搭建，多视角截图</p>
            {(panoramaCount > 0 || screenshotCount > 0) ? (
                <p className="m-0 text-[11px]" style={{ color: theme.node.faint }}>
                    {panoramaCount > 0 ? `${panoramaCount} 输入全景` : ""}
                    {panoramaCount > 0 && screenshotCount > 0 ? " · " : ""}
                    {screenshotCount > 0 ? `${screenshotCount} 张截图` : ""}
                </p>
            ) : null}
            <div className="flex gap-2">
                <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                    style={{ background: theme.toolbar.itemHover, borderColor: theme.node.stroke, color: theme.node.text }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); onOpen(); }}
                    title="打开 3D 场景编辑器，设置机位、角色、灯光并截图"
                >
                    打开
                </button>
                {onAgent ? (
                    <button
                        type="button"
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                        style={{ background: theme.toolbar.itemHover, borderColor: theme.node.stroke, color: theme.node.text }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => { event.stopPropagation(); onAgent(); }}
                        title="AI 导演：输入剧本→生成分镜建议→一键应用到画布"
                    >
                        <span className="flex items-center gap-1">
                            <Sparkles className="size-3" />
                            AI
                        </span>
                    </button>
                ) : null}
            </div>
        </div>
    );
}