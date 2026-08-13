import type { AiConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";
import type { VideoResponse } from "@/services/api/video";

export type GeneratedVideo = {
    id: string;
    url: string;
    storageKey: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

export type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    taskLogId?: string;
    createdAt: number;
    prompt: string;
    negativePrompt?: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    firstFrame?: ReferenceImage | null;
    lastFrame?: ReferenceImage | null;
    videoReferences: ReferenceVideo[];
    audioReferences: ReferenceAudio[];
    taskCount?: number;
    durationMs?: number;
    progress?: number;
    task?: VideoResponse;
    video?: GeneratedVideo;
    error?: string;
    errorDetail?: string;
    lastPolledAt?: number;
};

export type GenerationLog = {
    id: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    firstFrame?: ReferenceImage | null;
    lastFrame?: ReferenceImage | null;
    videoReferences: ReferenceVideo[];
    audioReferences: ReferenceAudio[];
    taskCount?: number;
    durationMs: number;
    size: string;
    resolution: string;
    seconds: string;
    status: "生成中" | "成功" | "失败";
    task?: VideoResponse;
    video?: GeneratedVideo;
    error?: string;
    errorDetail?: string;
    lastPolledAt?: number;
};

export type GenerationLogConfig = Pick<AiConfig, "channelMode" | "activeChannelId" | "videoChannelId" | "model" | "videoModel" | "size" | "vquality" | "videoSeconds" | "videoMode" | "videoNegativePrompt" | "videoMultiShot" | "videoShotType" | "videoMultiPrompt" | "videoElementList" | "videoGenerateAudio" | "videoWatermark" | "videoCharacterOrientation">;

export type UpdateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
export type WorkbenchLayout = "side" | "bottom" | "fullscreen";
export type AssetPickerTarget = "general" | "image" | "video" | "audio" | "firstFrame" | "lastFrame" | "element";
