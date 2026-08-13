import { isKIEKlingV3Config } from "@/components/video-settings-panel";
import { resolveImageUrl, type UploadedImage, uploadImage } from "@/services/image-storage";
import { resolveMediaUrl, type UploadedFile } from "@/services/file-storage";
import { defaultConfig, type AiConfig } from "@/stores/use-config-store";
import { type VideoResponse } from "@/services/api/video";
import { type CanvasImageTask } from "@/services/api/image";
import { type CanvasAudioTask } from "@/services/api/audio";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";
import type { CanvasImageAngleParams } from "../components/canvas-node-angle-dialog";
import type { NodeGenerationContext, NodeGenerationInput } from "../components/canvas-node-generation";
import type { CanvasNodeGenerationMode } from "../components/canvas-node-prompt-panel";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeMetadata, type CanvasAssistantSession, type Position, type ViewportTransform, type CanvasImageGenerationType, type ConnectionHandle } from "../types";
import { fitNodeSize, nodeSizeFromRatio } from "../utils/canvas-node-size";
import { isCanvasImageNodeType, isPanoramaNodeType, PANORAMA_NODE_SIZE, PANORAMA_IMAGE_SIZE } from "../utils/canvas-panorama";
import { NODE_DEFAULT_SIZE, getNodeSpec, NODE_STATUS_ERROR, NODE_STATUS_LOADING, NODE_STATUS_SUCCESS, VIDEO_NODE_MAX_HEIGHT, VIDEO_NODE_MAX_WIDTH } from "../constants";

export function imageExtension(dataUrl: string) {
    return dataUrl.match(/^data:image[/]([^;]+)/)?.[1] || dataUrl.match(/image[/]([^;]+)/)?.[1] || "png";
}

export function audioExtension(mimeType?: string) {
    if (mimeType?.includes("wav")) return "wav";
    if (mimeType?.includes("opus")) return "opus";
    if (mimeType?.includes("aac")) return "aac";
    if (mimeType?.includes("flac")) return "flac";
    if (mimeType?.includes("pcm")) return "pcm";
    return "mp3";
}

export function imageMetadata(image: UploadedImage): CanvasNodeMetadata {
    return { content: image.url, storageKey: image.storageKey, status: "success", naturalWidth: image.width, naturalHeight: image.height, bytes: image.bytes, mimeType: image.mimeType };
}

export function videoMetadata(video: UploadedFile): CanvasNodeMetadata {
    return { content: video.url, storageKey: video.storageKey, status: "success", naturalWidth: video.width, naturalHeight: video.height, bytes: video.bytes, mimeType: video.mimeType || "video/mp4", durationMs: video.durationMs };
}

export function audioMetadata(audio: UploadedFile): CanvasNodeMetadata {
    return { content: audio.url, storageKey: audio.storageKey, status: "success", bytes: audio.bytes, mimeType: audio.mimeType || "audio/mpeg", durationMs: audio.durationMs };
}

export function buildImageGenerationMetadata(type: CanvasImageGenerationType, config: AiConfig, count: number, references: ReferenceImage[]): CanvasNodeMetadata {
    return {
        generationType: type,
        model: config.model,
        channelId: config.imageChannelId || config.activeChannelId,
        size: config.size,
        quality: config.quality,
        count,
        references: references.map(referenceUrl).filter((url): url is string => Boolean(url)),
    };
}

export function buildAudioGenerationMetadata(config: AiConfig): CanvasNodeMetadata {
    return {
        model: config.model,
        channelId: config.audioChannelId || config.activeChannelId,
        audioVoice: config.audioVoice,
        audioFormat: config.audioFormat,
        audioSpeed: config.audioSpeed,
        audioInstructions: config.audioInstructions,
    };
}

export function referenceUrl(image: ReferenceImage) {
    return image.storageKey || image.url || (!image.dataUrl.startsWith("data:") ? image.dataUrl : undefined);
}

export function withCanvasVideoAdvancedConfig(config: AiConfig, context: Pick<NodeGenerationContext, "videoMultiPrompt" | "videoElementList">): AiConfig {
    const kieKlingV3 = isKIEKlingV3Config(config, config.model || config.videoModel);
    return {
        ...config,
        videoNegativePrompt: kieKlingV3 ? "" : config.videoNegativePrompt,
        videoShotType: kieKlingV3 ? "intelligence" : config.videoShotType,
        videoMultiPrompt: context.videoMultiPrompt.length ? context.videoMultiPrompt : config.videoMultiPrompt,
        videoElementList: context.videoElementList.length ? context.videoElementList : config.videoElementList,
    };
}

export function generationReferenceUrls(context: { referenceImages: ReferenceImage[]; firstFrame?: ReferenceImage | null; lastFrame?: ReferenceImage | null; referenceVideos: Array<{ storageKey?: string; url?: string }>; referenceAudios?: Array<{ storageKey?: string; url?: string }> }) {
    return [
        context.firstFrame ? referenceUrl(context.firstFrame) : null,
        context.lastFrame ? referenceUrl(context.lastFrame) : null,
        ...context.referenceImages.map(referenceUrl).filter((url): url is string => Boolean(url)),
        ...context.referenceVideos.map((video) => video.storageKey || video.url).filter((url): url is string => Boolean(url)),
        ...(context.referenceAudios || []).map((audio) => audio.storageKey || audio.url).filter((url): url is string => Boolean(url)),
    ].filter((url): url is string => Boolean(url));
}

async function resolveMetadataReferences(metadata: CanvasNodeMetadata) {
    if (metadata.generationType !== "edit") return [];
    if (!metadata.references?.length) return null;
    const references = await Promise.all(
        metadata.references.map(async (url, index) => {
            const dataUrl = url.startsWith("image:") ? await resolveImageUrl(url, "") : url;
            return dataUrl ? { id: `${index}`, name: `reference-${index}.png`, type: "image/png", dataUrl, storageKey: url.startsWith("image:") ? url : undefined } : null;
        }),
    );
    return references.every(Boolean) ? (references as ReferenceImage[]) : null;
}

async function hydrateCanvasImages(nodes: CanvasNodeData[]) {
    return Promise.all(
        nodes.map(async (node) => {
            const content = node.metadata?.content;
            if ((node.type === CanvasNodeType.Video || node.type === CanvasNodeType.Audio) && node.metadata?.storageKey) return { ...node, metadata: { ...node.metadata, content: await resolveMediaUrl(node.metadata.storageKey, content) } };
            if (!isCanvasImageNodeType(node.type) || !content) return node;
            if (node.metadata?.storageKey) return { ...node, metadata: { ...node.metadata, content: await resolveImageUrl(node.metadata.storageKey, content) } };
            if (!content.startsWith("data:image/")) return node;
            return { ...node, metadata: { ...node.metadata, ...imageMetadata(await uploadImage(content)) } };
        }),
    );
}

async function hydrateAssistantImages(sessions: CanvasAssistantSession[]) {
    const hydrateItem = async <T extends { dataUrl?: string; storageKey?: string }>(item: T) => {
        if (item.storageKey) return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        if (item.dataUrl?.startsWith("data:image/")) {
            const image = await uploadImage(item.dataUrl);
            return { ...item, dataUrl: image.url, storageKey: image.storageKey };
        }
        return item;
    };
    return Promise.all(
        sessions.map(async (session) => ({
            ...session,
            messages: await Promise.all(
                session.messages.map(async (message) => ({
                    ...message,
                    references: await Promise.all((message.references || []).map(hydrateItem)),
                    images: await Promise.all((message.images || []).map(hydrateItem)),
                })),
            ),
        })),
    );
}

export function getGenerationCount(count: string) {
    return Math.max(1, Math.min(15, Math.floor(Math.abs(Number(count)) || 1)));
}

export function applyNodeConfigPatch(node: CanvasNodeData, patch: Partial<CanvasNodeData["metadata"]>) {
    const safePatch = patch || {};
    const isPanorama = isPanoramaNodeType(node.type);
    const next = { ...node, metadata: { ...node.metadata, ...safePatch, ...(isPanorama ? { size: PANORAMA_IMAGE_SIZE } : {}) } };
    const spec = isPanorama ? NODE_DEFAULT_SIZE[CanvasNodeType.Panorama] : node.type === CanvasNodeType.Video ? NODE_DEFAULT_SIZE[CanvasNodeType.Video] : NODE_DEFAULT_SIZE[CanvasNodeType.Image];
    const size = !isPanorama && typeof safePatch.size === "string" && !node.metadata?.content ? nodeSizeFromRatio(safePatch.size, spec.width, spec.height) : null;
    return size && (isCanvasImageNodeType(node.type) || node.type === CanvasNodeType.Video) ? { ...next, ...size, position: { x: node.position.x + node.width / 2 - size.width / 2, y: node.position.y + node.height / 2 - size.height / 2 } } : next;
}

export function getConnectionTargetAnchor(node: CanvasNodeData, current: ConnectionHandle) {
    return {
        x: current.handleType === "source" ? node.position.x : node.position.x + node.width,
        y: node.position.y + node.height / 2,
    };
}

export function normalizeConnection(firstNodeId: string, secondNodeId: string, nodes: CanvasNodeData[], firstHandleType: "source" | "target") {
    const first = nodes.find((node) => node.id === firstNodeId);
    const second = nodes.find((node) => node.id === secondNodeId);
    if (!first || !second || first.id === second.id) return null;
    if (first.type === CanvasNodeType.Group || second.type === CanvasNodeType.Group) return null;
    if (second.type === CanvasNodeType.Director) {
        if (!isCanvasImageNodeType(first.type)) return null;
        return firstHandleType === "target" ? { fromNodeId: second.id, toNodeId: first.id } : { fromNodeId: first.id, toNodeId: second.id };
    }
    if (first.type === CanvasNodeType.Director) {
        if (!isCanvasImageNodeType(second.type)) return null;
        return firstHandleType === "target" ? { fromNodeId: second.id, toNodeId: first.id } : { fromNodeId: first.id, toNodeId: second.id };
    }
    if (first.type === CanvasNodeType.Config && second.type === CanvasNodeType.Config) return null;
    if (second.type === CanvasNodeType.Config) return { fromNodeId: first.id, toNodeId: second.id };
    if (first.type === CanvasNodeType.Config && firstHandleType === "target") return { fromNodeId: second.id, toNodeId: first.id };
    if (first.type === CanvasNodeType.Config) return { fromNodeId: first.id, toNodeId: second.id };
    return { fromNodeId: first.id, toNodeId: second.id };
}

export function getInputSummary(inputs: NodeGenerationInput[]) {
    return {
        textCount: inputs.filter((input) => input.type === "text").length,
        imageCount: inputs.filter((input) => input.type === "image").length,
        videoCount: inputs.filter((input) => input.type === "video").length,
        audioCount: inputs.filter((input) => input.type === "audio").length,
    };
}

export function applyCanvasVideoTaskUpdate(nodes: CanvasNodeData[], nodeId: string, task: VideoResponse, config: AiConfig, startedAt: number, fallbackSize: { width: number; height: number }) {
    return nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const progress = typeof task.progress === "number" ? Math.max(0, Math.min(100, task.progress)) : node.metadata?.progress || 0;
        const url = task.video_url || task.url || "";
        const completed = canvasVideoTaskCompleted(task);
        const failed = canvasVideoTaskFailed(task) || (completed && !url);
        const taskStartedAt = parseCanvasVideoTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || startedAt;
        const metadata: CanvasNodeMetadata = {
            ...node.metadata,
            status: failed ? NODE_STATUS_ERROR : completed ? NODE_STATUS_SUCCESS : NODE_STATUS_LOADING,
            errorDetails: failed ? task.error?.message || (completed ? "视频生成完成但没有返回视频地址" : "视频生成失败") : undefined,
            model: task.model || config.model,
            size: task.size || node.metadata?.size || config.size,
            seconds: task.seconds || node.metadata?.seconds || config.videoSeconds,
            vquality: node.metadata?.vquality || config.vquality,
            mode: node.metadata?.mode || config.videoMode,
            negativePrompt: node.metadata?.negativePrompt || config.videoNegativePrompt,
            generateAudio: node.metadata?.generateAudio || config.videoGenerateAudio,
            characterOrientation: node.metadata?.characterOrientation || config.videoCharacterOrientation,
            watermark: node.metadata?.watermark || config.videoWatermark,
            startedAt: taskStartedAt,
            durationMs: Date.now() - taskStartedAt,
            progress,
            videoTaskId: task.task_id || task.id || node.metadata?.videoTaskId,
            videoTaskVideoId: task.video_id || node.metadata?.videoTaskVideoId,
        };
        if (!completed || !url) return { ...node, metadata };
        const taskSize = parseCanvasVideoTaskSize(task.size, fallbackSize);
        const videoSize = fitNodeSize(taskSize.width, taskSize.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
        return {
            ...node,
            width: videoSize.width,
            height: videoSize.height,
            position: { x: node.position.x + node.width / 2 - videoSize.width / 2, y: node.position.y + node.height / 2 - videoSize.height / 2 },
            metadata: {
                ...metadata,
                content: url,
                storageKey: "",
                status: NODE_STATUS_SUCCESS,
                naturalWidth: taskSize.width,
                naturalHeight: taskSize.height,
                bytes: 0,
                mimeType: "video/mp4",
                progress: 100,
            },
        };
    });
}

export function applyCanvasImageTaskUpdate(nodes: CanvasNodeData[], nodeId: string, task: CanvasImageTask, startedAt: number, fallbackSize: { width: number; height: number }) {
    return nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const progress = typeof task.progress === "number" ? Math.max(0, Math.min(100, task.progress)) : node.metadata?.progress || 0;
        const url = task.image_url || task.url || "";
        const completed = canvasTaskCompleted(task.status) || Boolean(url);
        const failed = canvasTaskFailed(task.status) || (completed && !url);
        const taskStartedAt = parseCanvasTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || startedAt;
        const metadata: CanvasNodeMetadata = {
            ...node.metadata,
            status: failed ? NODE_STATUS_ERROR : completed ? NODE_STATUS_SUCCESS : NODE_STATUS_LOADING,
            errorDetails: failed ? task.error?.message || "图片生成失败" : undefined,
            startedAt: taskStartedAt,
            durationMs: Date.now() - taskStartedAt,
            progress,
            imageTaskId: task.id || node.metadata?.imageTaskId,
        };
        if (!completed || !url) return { ...node, metadata };
        const isPanorama = isPanoramaNodeType(node.type);
        const requestedSize = nodeSizeFromRatio(node.metadata?.size || "", fallbackSize.width, fallbackSize.height);
        const naturalWidth = task.width || requestedSize?.width || fallbackSize.width || node.width;
        const naturalHeight = task.height || requestedSize?.height || fallbackSize.height || node.height;
        const imageSize = isPanorama ? PANORAMA_NODE_SIZE : fitNodeSize(naturalWidth, naturalHeight, NODE_DEFAULT_SIZE[CanvasNodeType.Image].width, NODE_DEFAULT_SIZE[CanvasNodeType.Image].height);
        return {
            ...node,
            width: imageSize.width,
            height: imageSize.height,
            position: { x: node.position.x + node.width / 2 - imageSize.width / 2, y: node.position.y + node.height / 2 - imageSize.height / 2 },
            metadata: {
                ...metadata,
                content: url,
                storageKey: task.storageKey || "",
                status: NODE_STATUS_SUCCESS,
                naturalWidth,
                naturalHeight,
                bytes: task.bytes || 0,
                mimeType: task.mimeType || "image/png",
                progress: 100,
                imageTaskResultId: task.id,
                panoramaProjection: isPanorama ? ("equirectangular" as const) : undefined,
            },
        };
    });
}

export function applyCanvasAudioTaskUpdate(nodes: CanvasNodeData[], nodeId: string, task: CanvasAudioTask, startedAt: number) {
    return nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const progress = typeof task.progress === "number" ? Math.max(0, Math.min(100, task.progress)) : node.metadata?.progress || 0;
        const url = task.audio_url || task.url || "";
        const completed = canvasTaskCompleted(task.status) || Boolean(url);
        const failed = canvasTaskFailed(task.status) || (completed && !url);
        const taskStartedAt = parseCanvasTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || startedAt;
        const metadata: CanvasNodeMetadata = {
            ...node.metadata,
            status: failed ? NODE_STATUS_ERROR : completed ? NODE_STATUS_SUCCESS : NODE_STATUS_LOADING,
            errorDetails: failed ? task.error?.message || "音频生成失败" : undefined,
            startedAt: taskStartedAt,
            durationMs: Date.now() - taskStartedAt,
            progress,
            audioTaskId: task.id || node.metadata?.audioTaskId,
        };
        if (!completed || !url) return { ...node, metadata };
        return {
            ...node,
            metadata: {
                ...metadata,
                content: url,
                storageKey: task.storageKey || "",
                status: NODE_STATUS_SUCCESS,
                bytes: task.bytes || 0,
                mimeType: task.mimeType || "audio/mpeg",
                progress: 100,
                audioTaskResultId: task.id,
            },
        };
    });
}

export function canvasVideoTaskFromMetadata(metadata?: CanvasNodeMetadata): VideoResponse {
    return {
        id: canvasVideoTaskId(metadata),
        task_id: metadata?.videoTaskId,
        video_id: metadata?.videoTaskVideoId,
        model: metadata?.model,
        status: metadata?.status,
        progress: metadata?.progress,
    };
}

export function canvasVideoTaskId(metadata?: CanvasNodeMetadata) {
    return metadata?.videoTaskVideoId || metadata?.videoTaskId || "";
}

export function canvasVideoTaskCompleted(task: VideoResponse) {
    return Boolean(task.video_url || task.url) || ["completed", "complete", "done", "succeeded", "success"].includes((task.status || "").toLowerCase());
}

export function canvasVideoTaskFailed(task: VideoResponse) {
    return ["failed", "fail", "error", "cancelled", "canceled"].includes((task.status || "").toLowerCase());
}

export function parseCanvasVideoTaskSize(value: unknown, fallback: { width: number; height: number }) {
    const match = typeof value === "string" ? value.match(/^(\d+)x(\d+)$/) : null;
    return { width: match ? Number(match[1]) : fallback.width, height: match ? Number(match[2]) : fallback.height };
}

export function parseCanvasVideoTaskTime(value: unknown) {
    return parseCanvasTaskTime(value);
}

export function parseCanvasTaskTime(value: unknown) {
    if (typeof value === "number") return value > 100000000000 ? value : value * 1000;
    if (typeof value !== "string" || !value.trim()) return 0;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric > 100000000000 ? numeric : numeric * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function buildGenerationConfig(config: AiConfig, node: CanvasNodeData | undefined, mode: CanvasNodeGenerationMode): AiConfig {
    const defaultModel = mode === "image" ? config.imageModel : mode === "video" ? config.videoModel : mode === "audio" ? config.audioModel : config.textModel;
    const channelId = node?.metadata?.channelId || "";
    const imageChannelId = mode === "image" ? channelId || config.imageChannelId : config.imageChannelId;
    const videoChannelId = mode === "video" ? channelId || config.videoChannelId : config.videoChannelId;
    const textChannelId = mode === "text" ? channelId || config.textChannelId : config.textChannelId;
    const audioChannelId = mode === "audio" ? channelId || config.audioChannelId : config.audioChannelId;
    const activeChannelId = mode === "image" ? imageChannelId : mode === "video" ? videoChannelId : mode === "text" ? textChannelId : mode === "audio" ? audioChannelId || config.activeChannelId : config.activeChannelId;
    return {
        ...config,
        model: node?.metadata?.model || defaultModel || (mode === "audio" ? defaultConfig.audioModel : config.model || defaultConfig.model),
        activeChannelId,
        imageChannelId,
        videoChannelId,
        textChannelId,
        audioChannelId,
        quality: node?.metadata?.quality || config.quality || defaultConfig.quality,
        size: isPanoramaNodeType(node?.type) ? PANORAMA_IMAGE_SIZE : node?.metadata?.size || (mode === "video" ? "1280x720" : config.size || defaultConfig.size),
        videoSeconds: node?.metadata?.seconds || config.videoSeconds || defaultConfig.videoSeconds,
        vquality: node?.metadata?.vquality || config.vquality || defaultConfig.vquality,
        videoMode: node?.metadata?.mode || config.videoMode || defaultConfig.videoMode,
        videoNegativePrompt: node?.metadata?.negativePrompt || config.videoNegativePrompt || defaultConfig.videoNegativePrompt,
        videoMultiShot: node?.metadata?.multiShot || config.videoMultiShot || defaultConfig.videoMultiShot,
        videoShotType: node?.metadata?.shotType || config.videoShotType || defaultConfig.videoShotType,
        videoGenerateAudio: node?.metadata?.generateAudio || config.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoCharacterOrientation: node?.metadata?.characterOrientation || config.videoCharacterOrientation || defaultConfig.videoCharacterOrientation,
        videoWatermark: node?.metadata?.watermark || config.videoWatermark || defaultConfig.videoWatermark,
        audioVoice: node?.metadata?.audioVoice || config.audioVoice || defaultConfig.audioVoice,
        audioFormat: node?.metadata?.audioFormat || config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node?.metadata?.audioSpeed || config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node?.metadata?.audioInstructions || config.audioInstructions || defaultConfig.audioInstructions,
        count: String(node?.metadata?.count || (mode === "image" ? config.canvasImageCount || config.count : config.count) || defaultConfig.count),
    };
}

export function resetInterruptedGeneration(nodes: CanvasNodeData[]) {
    return nodes.map((node) => (node.metadata?.status === "loading" && !canvasRecoverableTaskId(node) ? { ...node, metadata: { ...node.metadata, status: "error" as const, errorDetails: "页面刷新后生成已中断，请重新生成。" } } : node));
}

export function canvasRecoverableTaskId(node: CanvasNodeData) {
    if (node.type === CanvasNodeType.Video) return canvasVideoTaskId(node.metadata);
    if (isCanvasImageNodeType(node.type)) return node.metadata?.imageTaskId || "";
    if (node.type === CanvasNodeType.Audio) return node.metadata?.audioTaskId || "";
    return "";
}

export function canvasTaskCompleted(status?: string) {
    return ["completed", "complete", "done", "succeeded", "success"].includes((status || "").toLowerCase());
}

export function canvasTaskFailed(status?: string) {
    return ["failed", "fail", "error", "cancelled", "canceled"].includes((status || "").toLowerCase());
}

export function findRetrySourceNode(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const queue = connections.filter((connection) => connection.toNodeId === nodeId).map((connection) => connection.fromNodeId);
    const visited = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.find((item) => item.id === id);
        if (node?.type === CanvasNodeType.Config) return node;
        connections.filter((connection) => connection.toNodeId === id).forEach((connection) => queue.push(connection.fromNodeId));
    }
    return null;
}

export function sourceNodeReferenceImages(node: CanvasNodeData | null) {
    if (!node || !isCanvasImageNodeType(node.type) || !node.metadata?.content) return [];
    return [
        {
            id: node.id,
            name: `${node.title || node.id}.png`,
            type: node.metadata.mimeType || "image/png",
            dataUrl: node.metadata.content,
            storageKey: node.metadata.storageKey,
        },
    ];
}

export function isAudioFile(file: File) {
    return file.type.startsWith("audio/") || /\.(mp3|wav)$/i.test(file.name);
}

export function isHiddenBatchChild(node: CanvasNodeData, nodes: CanvasNodeData[], collapsingBatchIds?: Set<string>) {
    const rootId = node.metadata?.batchRootId;
    if (!rootId) return false;
    const root = nodes.find((item) => item.id === rootId);
    if (root && collapsingBatchIds?.has(rootId)) return false;
    return Boolean(root && !root.metadata?.imageBatchExpanded);
}

export function isHiddenBatchConnectionEndpoint(node: CanvasNodeData, nodes: CanvasNodeData[]) {
    const rootId = node.metadata?.batchRootId;
    if (!rootId) return false;
    const root = nodes.find((item) => item.id === rootId);
    return Boolean(root && !root.metadata?.imageBatchExpanded);
}

export function buildAngleLabel(params: CanvasImageAngleParams) {
    const horizontal = params.horizontalAngle === 0 ? "正面视角" : params.horizontalAngle > 0 ? `向右旋转 ${params.horizontalAngle} 度` : `向左旋转 ${Math.abs(params.horizontalAngle)} 度`;
    const pitch = params.pitchAngle === 0 ? "水平视角" : params.pitchAngle > 0 ? `俯视 ${params.pitchAngle} 度` : `仰视 ${Math.abs(params.pitchAngle)} 度`;
    return `AI 多角度：${horizontal}，${pitch}，镜头距离 ${params.cameraDistance.toFixed(1)}，${params.wideAngle ? "广角" : "标准"}镜头`;
}

export function buildAnglePrompt(params: CanvasImageAngleParams) {
    return `基于参考图重新生成同一主体的新视角，保持主体、颜色、材质和画面风格一致，不要只做透视变形。${buildAngleLabel(params)}。`;
}
