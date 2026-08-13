import { Clapperboard, ImagePlus, Maximize2, Video } from "lucide-react";

export const navigationTools = [
    {
        slug: "canvas",
        label: "我的画布",
        icon: Maximize2,
    },
    {
        slug: "workflows",
        label: "工作流",
        icon: Clapperboard,
    },
    {
        slug: "image",
        label: "生图工作台",
        icon: ImagePlus,
    },
    {
        slug: "video",
        label: "视频创作台",
        icon: Video,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];

export const assetLibraryItems = [
    { slug: "characters", label: "角色", icon: "user" as const },
    { slug: "props", label: "道具", icon: "box" as const },
    { slug: "prompts", label: "提示词", icon: "file" as const },
    { slug: "voices", label: "声线", icon: "music" as const },
    { slug: "assets", label: "我的素材", icon: "image" as const },
] as const;
