import type { AiConfig } from "@/stores/use-config-store";
import type { CanvasImageTask } from "@/services/api/image";
import type { ReferenceImage } from "@/types/image";

export type GeneratedImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType?: string;
};

export type GenerationResult = {
    id: string;
    taskLogId?: string;
    status: "pending" | "success" | "failed";
    createdAt: number;
    prompt: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    image?: GeneratedImage;
    error?: string;
    errorDetail?: string;
    durationMs?: number;
    workflowId?: string;
    workflowName?: string;
    workflowInputs?: Record<string, unknown>;
    workflowTaskId?: string;
    task?: CanvasImageTask;
    progress?: number;
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
    durationMs: number;
    successCount: number;
    failCount: number;
    imageCount: number;
    size: string;
    quality: string;
    status: "生成中" | "成功" | "失败";
    images: GeneratedImage[];
    thumbnails: string[];
    errors: string[];
    errorDetails?: string[];
    categoryIds: string[];
    workflowId?: string;
    workflowName?: string;
    workflowInputs?: Record<string, unknown>;
    workflowTaskId?: string;
    task?: CanvasImageTask;
    lastPolledAt?: number;
};

export type GenerationLogConfig = Pick<AiConfig, "channelMode" | "model" | "imageModel" | "activeChannelId" | "imageChannelId" | "quality" | "size" | "count" | "apiMode" | "streamImages" | "streamPartialImages" | "responseFormatB64Json" | "codexCli">;
export type RequestSnapshot = { text: string; requestConfig: AiConfig; displayConfig: GenerationLogConfig; references: ReferenceImage[] };
export type GenerationCategory = { id: string; name: string; createdAt: number };
export type ResultViewMode = "all" | "category";

export type UpdateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
export type WorkbenchLayout = "side" | "bottom";
