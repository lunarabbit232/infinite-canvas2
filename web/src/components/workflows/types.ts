import type { AiConfig } from "@/stores/use-config-store";
import type { CanvasImageTask } from "@/services/api/image";
import type { ReferenceImage } from "@/types/image";

export type WorkflowVariableType = "text" | "textarea" | "number" | "select" | "boolean";
export type WorkflowMode = "single_image" | "multi_image_series" | "single_video" | "single_drama";

export type WorkflowVariable = {
    id: string;
    key: string;
    label: string;
    type: WorkflowVariableType;
    required: boolean;
    defaultValue: string;
    options: string[];
    placeholder?: string;
};

export type WorkflowGenerationConfig = Pick<
    AiConfig,
    "model" | "imageModel" | "imageChannelId" | "quality" | "size" | "count" | "apiMode" | "timeout" | "streamImages" | "streamPartialImages" | "responseFormatB64Json" | "codexCli" | "videoModel" | "videoChannelId" | "videoSeconds" | "videoMode" | "vquality" | "videoGenerateAudio" | "videoWatermark" | "videoMultiShot" | "videoShotType"
> & {
    systemPrompt: string;
    promptTemplate: string;
    negativePrompt: string;
    videoNegativePrompt: string;
};

export type WorkflowSeriesConfig = {
    targetCount: string;
    promptModel: string;
    promptChannelId: string;
    promptInstruction: string;
    reviewRequired: boolean;
    concurrency: string;
};

export type CreativeWorkflow = {
    id: string;
    ownerUserId?: string;
    scope: "private" | "public";
    editable?: boolean;
    mode: WorkflowMode;
    name: string;
    category: string;
    description: string;
    variables: WorkflowVariable[];
    config: WorkflowGenerationConfig;
    seriesConfig: WorkflowSeriesConfig;
    createdAt: number;
    updatedAt: number;
    lastRunAt?: number;
};

export type SeriesPromptDraft = {
    id: string;
    title: string;
    prompt: string;
    status: "draft" | "running" | "success" | "failed";
    error?: string;
    resultIds?: string[];
};

export type WorkflowRunResult = {
    id: string;
    workflowId: string;
    workflowName: string;
    prompt: string;
    imageUrl: string;
    storageKey: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
    durationMs: number;
    createdAt: number;
};

export type WorkflowExternalTaskStart = {
    taskId: string;
    workflowId: string;
    workflowName: string;
    prompt: string;
    inputs: Record<string, string>;
    references: ReferenceImage[];
    model: string;
    apiMode: AiConfig["apiMode"];
    config: WorkflowGenerationConfig;
    count: number;
    startedAt: number;
};

export type WorkflowExternalTaskSuccess = {
    taskId: string;
    images: WorkflowRunResult[];
    durationMs: number;
    endedAt: number;
};

export type WorkflowExternalTaskFailure = {
    taskId: string;
    error: string;
    durationMs: number;
    endedAt: number;
};

export type WorkflowTask = {
    id: string;
    status: "running" | "success" | "failed";
    workflowId: string;
    workflowName: string;
    prompt: string;
    inputs: Record<string, string>;
    references: ReferenceImage[];
    model: string;
    apiMode: AiConfig["apiMode"];
    mode: WorkflowMode;
    config: WorkflowGenerationConfig;
    count: number;
    startedAt: number;
    endedAt?: number;
    durationMs?: number;
    images: WorkflowRunResult[];
    error?: string;
    seriesTitle?: string;
    seriesIndex?: number;
};

export type ImageHistoryLog = {
    id: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    config: WorkflowGenerationConfig & Partial<Pick<AiConfig, "channelMode" | "activeChannelId">>;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    imageCount: number;
    size: string;
    quality: string;
    status: "生成中" | "成功" | "失败";
    images: Array<{
        id: string;
        dataUrl: string;
        storageKey: string;
        durationMs: number;
        width: number;
        height: number;
        bytes: number;
        mimeType: string;
    }>;
    thumbnails: string[];
    errors: string[];
    categoryIds: string[];
    workflowId: string;
    workflowName: string;
    workflowInputs: Record<string, unknown>;
    task?: CanvasImageTask;
    lastPolledAt?: number;
};

export type GenerationCategory = { id: string; name: string; createdAt: number };
