// 画布节点类型 → 颜色映射
// 6 色方案：生图蓝 · 视频绿 · 提示词黄 · 素材紫 · 脚本橙 · 其他灰

import { CanvasNodeType } from "../types";

export type NodeColorKey = "image" | "video" | "prompt" | "asset" | "script" | "other";

export const NODE_COLOR_MAP: Record<NodeColorKey, { label: string; hex: string; tailwind: string }> = {
    image: { label: "生图", hex: "#3b82f6", tailwind: "blue-500" },
    video: { label: "视频", hex: "#10b981", tailwind: "emerald-500" },
    prompt: { label: "提示词", hex: "#f59e0b", tailwind: "amber-500" },
    asset: { label: "素材", hex: "#8b5cf6", tailwind: "violet-500" },
    script: { label: "脚本", hex: "#f97316", tailwind: "orange-500" },
    other: { label: "其他", hex: "#6b7280", tailwind: "gray-500" },
};

export function getNodeTypeColor(type: CanvasNodeType): (typeof NODE_COLOR_MAP)[NodeColorKey] {
    switch (type) {
        case CanvasNodeType.Image:
        case CanvasNodeType.Panorama:
            return NODE_COLOR_MAP.image;
        case CanvasNodeType.Video:
            return NODE_COLOR_MAP.video;
        case CanvasNodeType.Text:
            return NODE_COLOR_MAP.prompt;
        case CanvasNodeType.Audio:
            return NODE_COLOR_MAP.asset;
        case CanvasNodeType.Config:
        case CanvasNodeType.Director:
            return NODE_COLOR_MAP.script;
        default:
            return NODE_COLOR_MAP.other;
    }
}
