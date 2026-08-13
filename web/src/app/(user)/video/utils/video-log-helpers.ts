import axios from "axios";
import localforage from "localforage";
import { nanoid } from "nanoid";

import { normalizeVideoResolutionValue, normalizeVideoSizeValue } from "@/components/video-settings-panel";
import { boolConfig, isSeedanceVideoConfig, normalizeSeedanceRatio } from "@/lib/seedance-video";
import { modelKey } from "@/lib/video-model-capabilities";
import { VideoRequestError, type VideoResponse } from "@/services/api/video";
import { resolveMediaUrl } from "@/services/file-storage";
import { resolveImageUrl } from "@/services/image-storage";
import { normalizeLocalChannels, type AiConfig, type VideoElementItem, type VideoElementReference } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

import type { GeneratedVideo, GenerationLog, GenerationLogConfig, GenerationResult } from "../types";

export const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "video_generation_logs" });

export function createResultFromSnapshot(id: string, snapshot: { text: string; config: AiConfig; references: ReferenceImage[]; firstFrame?: ReferenceImage | null; lastFrame?: ReferenceImage | null; videoReferences: ReferenceVideo[]; audioReferences: ReferenceAudio[]; taskCount?: number }, model: string, status: GenerationResult["status"], extra: Partial<GenerationResult> = {}): GenerationResult {
    return {
        id,
        status,
        createdAt: Date.now(),
        prompt: snapshot.text,
        model,
        config: buildDisplayConfig(snapshot.config, model),
        references: snapshot.references,
        firstFrame: snapshot.firstFrame || null,
        lastFrame: snapshot.lastFrame || null,
        videoReferences: snapshot.videoReferences,
        audioReferences: snapshot.audioReferences,
        taskCount: snapshot.taskCount,
        ...extra,
    };
}

export function createResultFromLog(log: GenerationLog, status: GenerationResult["status"]): GenerationResult {
    return {
        id: log.video?.id || log.id,
        status,
        taskLogId: log.id,
        createdAt: log.createdAt,
        prompt: log.prompt,
        model: log.model,
        config: log.config,
        references: log.references || [],
        firstFrame: log.firstFrame || null,
        lastFrame: log.lastFrame || null,
        videoReferences: log.videoReferences || [],
        audioReferences: log.audioReferences || [],
        taskCount: log.taskCount,
        durationMs: log.durationMs,
        progress: log.task?.progress,
        task: log.task,
        video: log.video,
        error: log.error,
        errorDetail: log.errorDetail,
        lastPolledAt: log.lastPolledAt,
    };
}

export function buildDisplayConfig(config: AiConfig, model: string): GenerationLogConfig {
    return {
        channelMode: config.channelMode,
        activeChannelId: config.activeChannelId,
        videoChannelId: config.videoChannelId,
        model: config.model,
        videoModel: config.videoModel || model,
        size: config.size,
        vquality: normalizeResolution(config.vquality),
        videoSeconds: config.videoSeconds,
        videoMode: config.videoMode,
        videoNegativePrompt: config.videoNegativePrompt,
        videoMultiShot: config.videoMultiShot,
        videoShotType: config.videoShotType,
        videoMultiPrompt: normalizeKlingMultiPrompts(config.videoMultiPrompt),
        videoElementList: normalizeKlingElementList(config.videoElementList),
        videoGenerateAudio: config.videoGenerateAudio,
        videoWatermark: config.videoWatermark,
        videoCharacterOrientation: normalizeCharacterOrientation(config.videoCharacterOrientation),
    };
}

export async function copyPrompt(text: string, success: (content: string) => void) {
    await navigator.clipboard.writeText(text);
    success("提示词已复制");
}

export function formatLogTime(value: number) {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export async function replaceStoredVideoHistory(logs: GenerationLog[]) {
    if (typeof window === "undefined") return;
    await persistStoredVideoLogs(logs);
    const keepIds = new Set(logs.map((log) => log.id));
    const storedKeys = await logStore.keys();
    await Promise.all(storedKeys.filter((key) => !keepIds.has(key)).map((key) => logStore.removeItem(key)));
}

export async function persistStoredVideoLogs(logs: GenerationLog[]) {
    if (typeof window === "undefined" || !logs.length) return;
    await Promise.all(
        logs.map(async (log) => {
            const serialized = serializeLog(log);
            const current = await logStore.getItem<GenerationLog>(log.id);
            if (current && JSON.stringify(current) === JSON.stringify(serialized)) return;
            await logStore.setItem(log.id, serialized);
        }),
    );
}

export async function mergeVideoLogs(remoteLogs: GenerationLog[], localLogs: GenerationLog[]) {
    const normalizedRemote = (await normalizeLogsSafely(remoteLogs)).filter(shouldSyncVideoLog);
    const normalizedLocal = await normalizeLogsSafely(localLogs);
    const remoteKeys = new Set(normalizedRemote.flatMap(videoLogIdentityKeys));
    const preservedLocal = normalizedLocal.filter((log) => shouldPreserveLocalLogDuringRemoteMerge(log, remoteKeys));
    return dedupeVideoLogs([...normalizedRemote, ...preservedLocal]);
}

export function shouldPreserveLocalLogDuringRemoteMerge(log: GenerationLog, remoteKeys: Set<string>) {
    if (!isLocalClientVideoLog(log) && !(log.status === "生成中" && !log.video)) return false;
    const keys = videoLogIdentityKeys(log);
    return !keys.length || !keys.some((key) => remoteKeys.has(key));
}

export function shouldSyncVideoLog(log: GenerationLog) {
    return !isLocalClientVideoLog(log);
}

export function dedupeVideoLogs(logs: GenerationLog[]) {
    const merged: GenerationLog[] = [];
    for (const log of logs) {
        const index = merged.findIndex((item) => videoLogsShareIdentity(item, log));
        if (index < 0) {
            merged.push(log);
        } else {
            merged[index] = mergeDuplicateVideoLog(merged[index], log);
        }
    }
    return sortVideoLogs(merged);
}

export function videoLogsShareIdentity(a: GenerationLog, b: GenerationLog) {
    if (a.id && b.id && a.id === b.id) return true;
    const aKeys = videoLogIdentityKeys(a);
    if (!aKeys.length) return false;
    const bKeys = new Set(videoLogIdentityKeys(b));
    return aKeys.some((key) => bKeys.has(key));
}

export function mergeDuplicateVideoLog(existing: GenerationLog, incoming: GenerationLog) {
    const preferred = shouldPreferVideoLog(incoming, existing) ? incoming : existing;
    const fallback = preferred === incoming ? existing : incoming;
    return {
        ...fallback,
        ...preferred,
        prompt: preferred.prompt || fallback.prompt,
        title: preferred.title || fallback.title,
        references: preferred.references?.length ? preferred.references : fallback.references,
        firstFrame: preferred.firstFrame || fallback.firstFrame,
        lastFrame: preferred.lastFrame || fallback.lastFrame,
        videoReferences: preferred.videoReferences?.length ? preferred.videoReferences : fallback.videoReferences,
        audioReferences: preferred.audioReferences?.length ? preferred.audioReferences : fallback.audioReferences,
        task: preferred.task && !isLocalClientVideoTask(preferred.task) ? preferred.task : fallback.task,
        video: preferred.video || fallback.video,
        error: preferred.error || fallback.error,
        errorDetail: preferred.errorDetail || fallback.errorDetail,
        durationMs: Math.max(preferred.durationMs || 0, fallback.durationMs || 0),
        lastPolledAt: Math.max(preferred.lastPolledAt || 0, fallback.lastPolledAt || 0) || undefined,
    };
}

export function shouldPreferVideoLog(next: GenerationLog, current: GenerationLog) {
    const nextScore = videoLogScore(next);
    const currentScore = videoLogScore(current);
    if (nextScore !== currentScore) return nextScore > currentScore;
    return (next.createdAt || 0) >= (current.createdAt || 0);
}

export function mergeBackendVideoTasks(localLogs: GenerationLog[], tasks: VideoResponse[], fallbackConfig: AiConfig) {
    const byKey = new Map<string, GenerationLog>();
    for (const log of localLogs) {
        for (const key of videoLogBackendMergeKeys(log)) byKey.set(key, log);
    }
    const merged = [...localLogs];
    for (const task of tasks) {
        const incoming = backendTaskToLog(task, fallbackConfig);
        const existing = videoTaskIdentityKeys(task).map((key) => byKey.get(key)).find(Boolean);
        const nextLog = mergeBackendTaskIntoLog(existing, incoming, task);
        if (existing) {
            const index = merged.findIndex((item) => item.id === existing.id);
            if (index >= 0) merged[index] = nextLog;
        } else {
            merged.push(nextLog);
        }
        for (const key of videoLogIdentityKeys(nextLog)) byKey.set(key, nextLog);
    }
    return sortVideoLogs(merged);
}

export function videoLogBackendMergeKeys(log: GenerationLog) {
    const keys = videoLogIdentityKeys(log);
    if (isLocalClientVideoLog(log)) {
        [log.task?.id, log.task?.task_id].forEach((id) => {
            if (isClientVideoTaskId(id)) keys.push(id);
        });
    }
    return Array.from(new Set(keys.filter((key): key is string => Boolean(key))));
}

export function backendTaskToLog(task: VideoResponse, fallbackConfig: AiConfig): GenerationLog {
    const request = parseBackendVideoRequest(task.request_body);
    const model = task.model || request.model || fallbackConfig.videoModel || fallbackConfig.model || "";
    const taskChannelId = videoTaskChannelId(task);
    const config = buildVideoConfig({ ...fallbackConfig, model, videoModel: model, activeChannelId: taskChannelId || fallbackConfig.activeChannelId, videoChannelId: taskChannelId || fallbackConfig.videoChannelId, size: request.size || fallbackConfig.size, vquality: request.resolution || fallbackConfig.vquality, videoSeconds: request.seconds || fallbackConfig.videoSeconds, videoMode: request.mode || fallbackConfig.videoMode, videoNegativePrompt: request.negativePrompt || fallbackConfig.videoNegativePrompt, videoCharacterOrientation: request.characterOrientation || fallbackConfig.videoCharacterOrientation, videoMultiShot: request.multiShot || fallbackConfig.videoMultiShot, videoShotType: request.shotType || fallbackConfig.videoShotType, videoMultiPrompt: request.multiPrompt.length ? request.multiPrompt : fallbackConfig.videoMultiPrompt, videoElementList: request.elementList.length ? request.elementList : fallbackConfig.videoElementList }, model);
    const createdAt = parseTaskTimestamp(task.createdAt ?? task.created_at) || Date.now();
    const status = isFailedVideoTask(task) ? "失败" : isCompletedVideoTask(task) ? "成功" : "生成中";
    const durationMs = Math.max(0, Date.now() - createdAt);
    const video = status === "成功" && (task.video_url || task.url) ? videoFromTaskResponse(task, durationMs) : undefined;
    return {
        id: `backend-${videoTaskIdentityKeys(task)[0] || nanoid()}`,
        createdAt,
        title: (request.prompt || model || "视频任务").slice(0, 12) || "视频任务",
        prompt: request.prompt || "",
        time: new Date(createdAt).toLocaleString("zh-CN", { hour12: false }),
        model,
        config,
        references: [],
        firstFrame: null,
        lastFrame: null,
        videoReferences: [],
        audioReferences: [],
        durationMs,
        size: task.size || request.size || config.size,
        resolution: request.resolution || config.vquality,
        seconds: task.seconds || request.seconds || config.videoSeconds,
        status,
        task,
        video,
        error: status === "失败" ? task.error?.message || "视频生成失败" : undefined,
        errorDetail: status === "失败" ? errorDetail(new VideoRequestError(task.error?.message || "视频生成失败", task)) : undefined,
        lastPolledAt: Date.now(),
    };
}

export function mergeBackendTaskIntoLog(existing: GenerationLog | undefined, incoming: GenerationLog, task: VideoResponse): GenerationLog {
    if (!existing) return incoming;
    const durationMs = Math.max(existing.durationMs || 0, incoming.durationMs || 0);
    const baseConfig = { ...existing.config, videoChannelId: incoming.config.videoChannelId || existing.config.videoChannelId, activeChannelId: incoming.config.activeChannelId || existing.config.activeChannelId };
    const base = { ...existing, task, config: baseConfig, durationMs, lastPolledAt: Date.now() };
    if (existing.status === "成功" || existing.video) {
        return { ...base, status: "成功", video: existing.video || incoming.video, error: undefined, errorDetail: undefined };
    }
    if (incoming.status === "失败") {
        return { ...base, status: "失败", error: incoming.error, errorDetail: incoming.errorDetail };
    }
    if (incoming.status === "成功" && incoming.video) {
        return { ...base, status: "成功", video: existing.video || incoming.video, error: undefined, errorDetail: undefined };
    }
    return { ...base, status: "生成中", error: undefined, errorDetail: undefined };
}

export function parseBackendVideoRequest(value?: string) {
    const parsed = parseJsonRecord(value);
    const fields = parseRecord(parsed.fields);
    const pick = (...keys: string[]) => {
        for (const key of keys) {
            const source = fields && key in fields ? fields[key] : parsed[key];
            const value = fieldString(source);
            if (value) return value;
        }
        return "";
    };
    return {
        prompt: pick("prompt"),
        model: pick("model"),
        size: pick("size", "aspect_ratio"),
        resolution: normalizeResolution(pick("resolution_name", "vquality", "quality")),
        seconds: pick("seconds", "duration", "videoSeconds"),
        mode: pick("mode", "videoMode"),
        negativePrompt: pick("negative_prompt", "videoNegativePrompt"),
        characterOrientation: pick("character_orientation", "videoCharacterOrientation"),
        multiShot: pick("multi_shot", "multi_shots", "videoMultiShot"),
        shotType: pick("shot_type", "videoShotType"),
        multiPrompt: parseRequestMultiPrompt(fields?.multi_prompt ?? parsed.multi_prompt),
        elementList: parseRequestElementList(fields?.element_list ?? fields?.kling_elements ?? parsed.element_list ?? parsed.kling_elements),
    };
}

export function parseJsonRecord(value?: string): Record<string, unknown> {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        return parseRecord(parsed) || {};
    } catch {
        return {};
    }
}

export function parseRecord(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function fieldString(value: unknown) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return fieldString(value[0]);
    return "";
}

export function parseTaskTimestamp(value: unknown) {
    if (typeof value === "number") return value > 1e12 ? value : value * 1000;
    if (typeof value === "string" && value.trim()) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric > 1e12 ? numeric : numeric * 1000;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

export function isClientVideoTaskId(id?: string | null): id is string {
    return typeof id === "string" && id.startsWith("client_video_task_");
}

export function normalizeVideoIdentityKey(key?: string | null) {
    const value = typeof key === "string" ? key.trim() : "";
    return value && !isClientVideoTaskId(value) ? value : "";
}

export function videoTaskIdentityKeys(task?: VideoResponse | null) {
    const allowClientTaskId = hasBackendVideoTaskBinding(task);
    const normalizeTaskKey = (key?: string | null) => {
        const value = typeof key === "string" ? key.trim() : "";
        return value && (allowClientTaskId || !isClientVideoTaskId(value)) ? value : "";
    };
    return Array.from(new Set([normalizeTaskKey(task?.id), normalizeTaskKey(task?.task_id), normalizeTaskKey(task?.video_id)].filter((key): key is string => Boolean(key))));
}

export function hasBackendVideoTaskBinding(task?: VideoResponse | null) {
    if (!task) return false;
    const record = task as Record<string, unknown>;
    const taskId = typeof task.task_id === "string" ? task.task_id.trim() : "";
    const videoId = typeof task.video_id === "string" ? task.video_id.trim() : "";
    return Boolean(
        (taskId && !isClientVideoTaskId(taskId)) ||
        (videoId && !isClientVideoTaskId(videoId)) ||
        task.video_url ||
        task.url ||
        task.request_body ||
        record.response_body ||
        record.responseBody ||
        record.last_response ||
        record.lastResponse
    );
}

export function isLocalClientVideoTask(task?: VideoResponse | null) {
    return Boolean(task && [task.id, task.task_id].some(isClientVideoTaskId) && !hasBackendVideoTaskBinding(task));
}

export function isLocalClientVideoLog(log: GenerationLog) {
    return isLocalClientVideoTask(log.task);
}

export function videoLogIdentityKeys(log: GenerationLog) {
    return Array.from(new Set([...videoTaskIdentityKeys(log.task), normalizeVideoIdentityKey(log.video?.id)].filter((key): key is string => Boolean(key))));
}

export function videoResultIdentityKeys(result: GenerationResult) {
    return Array.from(new Set([...videoTaskIdentityKeys(result.task), normalizeVideoIdentityKey(result.video?.id)].filter((key): key is string => Boolean(key))));
}

export function videoLogDeleteKeys(log: GenerationLog) {
    return Array.from(new Set([log.id, log.task?.id, log.task?.task_id, log.task?.video_id, log.video?.id].filter((key): key is string => Boolean(typeof key === "string" && key.trim())).map((key) => key.trim())));
}

export function videoLogScore(log: GenerationLog) {
    return (log.status === "成功" ? 4 : 0) + (log.video ? 4 : 0) + (log.video?.storageKey ? 2 : 0) + (log.task && !isLocalClientVideoTask(log.task) ? 2 : 0) + (log.errorDetail ? 1 : 0);
}

export function referenceUsedByGeneration(reference: ReferenceImage, logs: GenerationLog[], results: GenerationResult[]) {
    if (!reference.storageKey) return false;
    return logs.some((log) => [log.firstFrame, log.lastFrame, ...log.references].some((item) => item?.storageKey === reference.storageKey)) || results.some((result) => [result.firstFrame, result.lastFrame, ...result.references].some((item) => item?.storageKey === reference.storageKey));
}

export function mediaReferenceUsedByGeneration(storageKey: string, logs: GenerationLog[], results: GenerationResult[]) {
    return logs.some((log) => [...log.videoReferences, ...log.audioReferences].some((item) => item.storageKey === storageKey)) || results.some((result) => [...result.videoReferences, ...result.audioReferences].some((item) => item.storageKey === storageKey));
}

export function generationLogStorageKeys(log: GenerationLog) {
    return {
        media: [log.video?.storageKey, ...log.videoReferences.map((item) => item.storageKey), ...log.audioReferences.map((item) => item.storageKey)].filter((key): key is string => Boolean(key)),
        images: [log.firstFrame?.storageKey, log.lastFrame?.storageKey, ...log.references.map((image) => image.storageKey)].filter((key): key is string => Boolean(key)),
    };
}

export function disposableLogStorageKeys(deletedLogs: GenerationLog[], remainingLogs: GenerationLog[], currentReferences: ReferenceImage[], currentMediaReferences: Array<ReferenceVideo | ReferenceAudio>, results: GenerationResult[]) {
    const deleted = deletedLogs.reduce(
        (keys, log) => {
            const next = generationLogStorageKeys(log);
            next.media.forEach((key) => keys.media.add(key));
            next.images.forEach((key) => keys.images.add(key));
            return keys;
        },
        { media: new Set<string>(), images: new Set<string>() },
    );
    const retained = remainingLogs.reduce(
        (keys, log) => {
            const next = generationLogStorageKeys(log);
            next.media.forEach((key) => keys.media.add(key));
            next.images.forEach((key) => keys.images.add(key));
            return keys;
        },
        { media: new Set<string>(), images: new Set<string>() },
    );
    currentReferences.forEach((reference) => {
        if (reference.storageKey) retained.images.add(reference.storageKey);
    });
    currentMediaReferences.forEach((reference) => {
        if (reference.storageKey) retained.media.add(reference.storageKey);
    });
    results.forEach((result) => {
        if (result.video?.storageKey) retained.media.add(result.video.storageKey);
        [...result.videoReferences, ...result.audioReferences].forEach((reference) => {
            if (reference.storageKey) retained.media.add(reference.storageKey);
        });
        [result.firstFrame, result.lastFrame, ...result.references].forEach((reference) => {
            if (reference?.storageKey) retained.images.add(reference.storageKey);
        });
    });
    return { media: [...deleted.media].filter((key) => !retained.media.has(key)), images: [...deleted.images].filter((key) => !retained.images.has(key)) };
}

export function updateResult(results: GenerationResult[], id: string, next: Partial<GenerationResult>) {
    return results.map((item) => (item.id === id ? { ...item, ...next } : item));
}

export function updateResultByLogId(results: GenerationResult[], logId: string, next: Partial<GenerationResult>) {
    return results.map((item) => (item.taskLogId === logId || item.id === logId ? { ...item, ...next } : item));
}

export function mergePendingLogResults(results: GenerationResult[], logs: GenerationLog[]) {
    const updatedResults = results.map((result) => {
        const log = findMatchingPendingLogForResult(result, logs);
        if (!log) return result;
        return { ...result, taskLogId: log.id, task: log.task, progress: log.task?.progress ?? result.progress, durationMs: log.durationMs || result.durationMs, lastPolledAt: log.lastPolledAt || result.lastPolledAt };
    });
    const existingLogIds = new Set(updatedResults.flatMap((item) => [item.taskLogId, item.id]).filter((id): id is string => Boolean(id)));
    const existingTaskKeys = new Set(updatedResults.flatMap(videoResultIdentityKeys));
    const pendingResults = logs.filter((log) => !existingLogIds.has(log.id) && !videoLogIdentityKeys(log).some((key) => existingTaskKeys.has(key))).map((log) => createResultFromLog(log, "pending"));
    return pendingResults.length ? sortVideoResults([...pendingResults, ...updatedResults]) : sortVideoResults(updatedResults);
}

export function findMatchingPendingLogForResult(result: GenerationResult, logs: GenerationLog[]) {
    const resultKeys = new Set(videoResultIdentityKeys(result));
    return logs.find((log) => log.id === result.taskLogId || log.id === result.id || videoLogIdentityKeys(log).some((key) => resultKeys.has(key)));
}

export function sortVideoResults(results: GenerationResult[]) {
    return [...results].sort((a, b) => b.createdAt - a.createdAt);
}

export function sortVideoLogs(logs: GenerationLog[]) {
    return [...logs].sort((a, b) => b.createdAt - a.createdAt);
}

export function videoFromTaskResponse(task: VideoResponse, durationMs: number): GeneratedVideo {
    const size = parseTaskVideoSize((task as Record<string, unknown>).size);
    return {
        id: task.id || task.video_id || task.task_id || nanoid(),
        url: task.video_url || task.url || "",
        storageKey: "",
        durationMs,
        width: size.width,
        height: size.height,
        bytes: 0,
        mimeType: "video/mp4",
    };
}

export function parseTaskVideoSize(value: unknown) {
    const match = typeof value === "string" ? value.match(/^(\d+)x(\d+)$/) : null;
    return { width: match ? Number(match[1]) : 1280, height: match ? Number(match[2]) : 720 };
}

export function isCompletedVideoTask(task: VideoResponse) {
    return Boolean(task.video_url || task.url) || ["completed", "complete", "done", "succeeded", "success"].includes((task.status || "").toLowerCase());
}

export function isFailedVideoTask(task: VideoResponse) {
    return ["failed", "fail", "error", "cancelled", "canceled"].includes((task.status || "").toLowerCase());
}

export function isTransientVideoPollError(error: unknown) {
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    return !error.response || status === 500 || status === 502 || status === 503 || status === 504;
}

export function isRecoverableBackendVideoTask(task: VideoResponse) {
    return !isCompletedVideoTask(task) && !isFailedVideoTask(task);
}

export function isCloudVideo(video: GeneratedVideo) {
    return Boolean(video.storageKey);
}

export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "生成失败";
}

export function errorDetail(error: unknown) {
    if (error instanceof VideoRequestError && error.detail) return error.detail;
    if (error instanceof Error) return error.stack || error.message;
    try {
        return JSON.stringify(error, null, 2);
    } catch {
        return String(error || "生成失败");
    }
}

export async function readStoredLogs() {
    if (typeof window === "undefined") return [];
    try {
        const logs: GenerationLog[] = [];
        await logStore.iterate<GenerationLog, void>((value) => {
            logs.push(value);
        });
        return (await normalizeLogsSafely(logs)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
        return [];
    }
}

export async function normalizeLogsSafely(logs: Array<Partial<GenerationLog>>) {
    const normalized = await Promise.all(
        logs.map(async (log) => {
            try {
                return await normalizeLog(log);
            } catch {
                return null;
            }
        }),
    );
    return normalized.filter((log): log is GenerationLog => Boolean(log));
}

export async function safeResolveMediaUrl(storageKey: string, fallback: string) {
    try {
        return await resolveMediaUrl(storageKey, fallback);
    } catch {
        return fallback;
    }
}

export async function safeResolveImageUrl(storageKey: string | undefined, fallback: string) {
    try {
        return await resolveImageUrl(storageKey, fallback);
    } catch {
        return fallback;
    }
}

export async function normalizeLog(log: Partial<GenerationLog>): Promise<GenerationLog> {
    const video = log.video?.storageKey ? { ...log.video, url: await safeResolveMediaUrl(log.video.storageKey, log.video.url) } : log.video;
    const videoReferences = await Promise.all(
        (log.videoReferences || []).map(async (item) => ({
            ...item,
            url: item.storageKey ? await safeResolveMediaUrl(item.storageKey, item.url) : item.url,
        })),
    );
    const audioReferences = await Promise.all(
        (log.audioReferences || []).map(async (item) => ({
            ...item,
            url: item.storageKey ? await safeResolveMediaUrl(item.storageKey, item.url) : item.url,
        })),
    );
    const references = await Promise.all(
        (log.references || []).map(async (item) => ({
            ...item,
            dataUrl: await safeResolveImageUrl(item.storageKey, item.dataUrl),
        })),
    );
    const firstFrame = log.firstFrame ? { ...log.firstFrame, dataUrl: await safeResolveImageUrl(log.firstFrame.storageKey, log.firstFrame.dataUrl) } : null;
    const lastFrame = log.lastFrame ? { ...log.lastFrame, dataUrl: await safeResolveImageUrl(log.lastFrame.storageKey, log.lastFrame.dataUrl) } : null;
    const config = normalizeLogConfig(log);
    return {
        id: log.id || nanoid(),
        createdAt: log.createdAt || Date.now(),
        title: log.title || log.model || "未命名",
        prompt: log.prompt || "",
        time: log.time || new Date().toLocaleString("zh-CN", { hour12: false }),
        model: log.model || config.videoModel || "",
        config,
        references,
        firstFrame,
        lastFrame,
        videoReferences,
        audioReferences,
        taskCount: log.taskCount,
        durationMs: log.durationMs || 0,
        size: log.size || config.size || "",
        resolution: normalizeResolution(log.resolution || config.vquality || ""),
        seconds: log.seconds || config.videoSeconds || "",
        status: log.status || "成功",
        task: log.task,
        video,
        error: log.error,
        errorDetail: log.errorDetail,
        lastPolledAt: log.lastPolledAt,
    };
}

export function serializeLog(log: GenerationLog): GenerationLog {
    return {
        ...log,
        references: log.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl })),
        firstFrame: log.firstFrame?.storageKey ? { ...log.firstFrame, dataUrl: "" } : log.firstFrame,
        lastFrame: log.lastFrame?.storageKey ? { ...log.lastFrame, dataUrl: "" } : log.lastFrame,
        videoReferences: log.videoReferences.map((item) => (item.storageKey ? { ...item, url: "" } : item)),
        audioReferences: log.audioReferences.map((item) => (item.storageKey ? { ...item, url: "" } : item)),
        config: { ...log.config, videoElementList: serializeKlingElementList(log.config.videoElementList) },
        video: log.video?.storageKey ? { ...log.video, url: "" } : log.video,
    };
}

export function isSupportedAudioFile(file: File) {
    return file.type === "audio/mpeg" || file.type === "audio/mp3" || file.type === "audio/wav" || file.type === "audio/x-wav" || /\.(mp3|wav)$/i.test(file.name);
}

export function filterAudioReferencesByDuration(existing: ReferenceAudio[], next: ReferenceAudio[], warn: (content: string) => void) {
    let total = existing.reduce((sum, item) => sum + (item.durationMs || 0), 0);
    const accepted: ReferenceAudio[] = [];
    let skipped = false;
    for (const item of next) {
        if (item.durationMs && (item.durationMs < 2000 || item.durationMs > 15000)) {
            skipped = true;
            continue;
        }
        if (item.durationMs && total + item.durationMs > 15000) {
            skipped = true;
            continue;
        }
        total += item.durationMs || 0;
        accepted.push(item);
    }
    if (skipped) warn("已忽略不符合时长要求的参考音频：单个 2-15 秒，总时长不超过 15 秒");
    return accepted;
}

export function moveListItem<T>(items: T[], index: number, offset: number) {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return next;
}



export function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    const taskChannelId = videoTaskChannelId(log.task);
    return {
        channelMode: log.config?.channelMode || "local",
        activeChannelId: taskChannelId || log.config?.activeChannelId || log.config?.videoChannelId || "",
        videoChannelId: taskChannelId || log.config?.videoChannelId || log.config?.activeChannelId || "",
        model: log.config?.model || log.model || "",
        videoModel: log.config?.videoModel || log.model || "",
        size: log.config?.size || log.size || "",
        vquality: normalizeResolution(log.config?.vquality || log.resolution || ""),
        videoSeconds: log.config?.videoSeconds || log.seconds || "",
        videoMode: log.config?.videoMode || "std",
        videoNegativePrompt: log.config?.videoNegativePrompt || "",
        videoMultiShot: log.config?.videoMultiShot || "false",
        videoShotType: log.config?.videoShotType || "intelligence",
        videoMultiPrompt: normalizeKlingMultiPrompts(log.config?.videoMultiPrompt),
        videoElementList: normalizeKlingElementList(log.config?.videoElementList),
        videoGenerateAudio: log.config?.videoGenerateAudio || "false",
        videoWatermark: log.config?.videoWatermark || "false",
        videoCharacterOrientation: normalizeCharacterOrientation(log.config?.videoCharacterOrientation),
    };
}

export function buildLog({ prompt, model, config, references, firstFrame, lastFrame, videoReferences, audioReferences, taskCount, durationMs, status, task, video, error, errorDetail, lastPolledAt }: { prompt: string; model: string; config: AiConfig; references: ReferenceImage[]; firstFrame?: ReferenceImage | null; lastFrame?: ReferenceImage | null; videoReferences: ReferenceVideo[]; audioReferences: ReferenceAudio[]; taskCount?: number; durationMs: number; status: GenerationLog["status"]; task?: VideoResponse; video?: GeneratedVideo; error?: string; errorDetail?: string; lastPolledAt?: number }): GenerationLog {
    const logConfig = {
        channelMode: config.channelMode,
        activeChannelId: config.activeChannelId,
        videoChannelId: config.videoChannelId,
        model: config.model,
        videoModel: config.videoModel,
        size: config.size,
        vquality: normalizeResolution(config.vquality),
        videoSeconds: config.videoSeconds,
        videoMode: config.videoMode,
        videoNegativePrompt: config.videoNegativePrompt,
        videoMultiShot: config.videoMultiShot,
        videoShotType: config.videoShotType,
        videoMultiPrompt: normalizeKlingMultiPrompts(config.videoMultiPrompt),
        videoElementList: config.videoElementList,
        videoGenerateAudio: config.videoGenerateAudio,
        videoWatermark: config.videoWatermark,
        videoCharacterOrientation: normalizeCharacterOrientation(config.videoCharacterOrientation),
    };
    return {
        id: nanoid(),
        createdAt: Date.now(),
        title: prompt.slice(0, 12) || "未命名",
        prompt,
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        model,
        config: logConfig,
        references,
        firstFrame: firstFrame || null,
        lastFrame: lastFrame || null,
        videoReferences,
        audioReferences,
        taskCount,
        durationMs,
        size: logConfig.size,
        resolution: logConfig.vquality,
        seconds: logConfig.videoSeconds,
        status,
        task,
        video,
        error,
        errorDetail,
        lastPolledAt,
    };
}

export function buildVideoConfig(config: AiConfig, model: string): AiConfig {
    const seedance = isSeedanceVideoConfig({ ...config, model });
    const klingV26 = isAPIMartKlingV26Config(config, model);
    const apimartKlingV3 = isAPIMartKlingV3Config(config, model);
    const kieKlingV3 = isKIEKlingV3Config(config, model);
    const klingV3 = apimartKlingV3 || kieKlingV3;
    const kling = klingV26 || klingV3;
    const videoChannelId = resolveVideoChannelId(config, model, config.videoChannelId, config.activeChannelId);
    const videoMode = klingV3 && config.videoMode === "4k" ? "4k" : config.videoMode === "pro" ? "pro" : "std";
    return {
        ...config,
        model,
        videoModel: model,
        videoChannelId,
        activeChannelId: videoChannelId,
        size: kling ? normalizeKlingV26Ratio(config.size) : seedance ? normalizeSeedanceRatio(config.size) : normalizeVideoSize(config.size),
        videoSeconds: klingV3 ? normalizeKlingV3Seconds(config.videoSeconds) : klingV26 ? normalizeKlingV26Seconds(config.videoSeconds) : normalizeVideoSeconds(config.videoSeconds),
        videoMode,
        videoNegativePrompt: kieKlingV3 ? "" : config.videoNegativePrompt || "",
        videoMultiShot: klingV3 ? String(boolConfig(config.videoMultiShot, false)) : "false",
        videoShotType: apimartKlingV3 ? normalizeKlingShotType(config.videoShotType) : "intelligence",
        videoMultiPrompt: klingV3 ? normalizeKlingMultiPrompts(config.videoMultiPrompt) : defaultKlingMultiPrompts(),
        videoElementList: klingV3 ? normalizeKlingElementList(config.videoElementList) : defaultKlingElementList(),
        vquality: normalizeResolution(config.vquality),
        videoGenerateAudio: String(boolConfig(config.videoGenerateAudio, false) && (!klingV26 || videoMode === "pro")),
        videoWatermark: String(boolConfig(config.videoWatermark, false)),
        videoCharacterOrientation: normalizeCharacterOrientation(config.videoCharacterOrientation),
    };
}

export function videoTaskChannelId(task?: VideoResponse | null) {
    return task?.userChannelId || task?.channelId || "";
}

export function resolveVideoChannelId(config: AiConfig, model: string, ...preferredIds: Array<string | undefined>) {
    const channels = config.channelMode === "remote"
        ? config.publicChannels.map((channel) => ({ id: channel.id || "", models: channel.models || [] }))
        : normalizeLocalChannels(config).map((channel) => ({ id: channel.id, models: channel.models }));
    for (const id of preferredIds) {
        const channelId = (id || "").trim();
        if (channelId && channels.some((channel) => channel.id === channelId && channel.models.includes(model))) return channelId;
    }
    return channels.find((channel) => channel.models.includes(model))?.id || "";
}

export function isAPIMartKlingV26Config(config: AiConfig, model: string) {
    return isAPIMartKlingModelConfig(config, model, "kling-v2-6");
}

export function isAPIMartKlingV3Config(config: AiConfig, model: string) {
    return isAPIMartKlingModelConfig(config, model, "kling-v3");
}

export function isKIEKlingV3Config(config: AiConfig, model: string) {
    return isKIEKlingModelConfig(config, model, "kling-3-0-video");
}

export function isKlingV3Config(config: AiConfig, model: string) {
    return isAPIMartKlingV3Config(config, model) || isKIEKlingV3Config(config, model);
}

export function isAPIMartKlingMotionControlConfig(config: AiConfig, model: string) {
    return isAPIMartKlingModelConfig(config, model, "kling-v2-6-motion-control");
}

export function isKIEKlingMotionControlConfig(config: AiConfig, model: string) {
    return isKIEKlingModelConfig(config, model, "kling-2-6-motion-control") || isKIEKlingModelConfig(config, model, "kling-3-0-motion-control");
}

export function resolveKlingWorkbenchConfig(config: AiConfig, model: string): { provider: "apimart" | "kie"; variant: "v26" | "v3" } | null {
    if (isAPIMartKlingV26Config(config, model)) return { provider: "apimart", variant: "v26" };
    if (isAPIMartKlingV3Config(config, model)) return { provider: "apimart", variant: "v3" };
    if (isKIEKlingV3Config(config, model)) return { provider: "kie", variant: "v3" };
    return null;
}

export function isAPIMartKlingModelConfig(config: AiConfig, model: string, key: string) {
    return modelKey(model) === key && videoChannelText(config, model).includes("apimart");
}

export function isKIEKlingModelConfig(config: AiConfig, model: string, key: string) {
    return modelKey(model) === key && videoChannelText(config, model).includes("kie");
}

export function videoChannelText(config: AiConfig, model: string) {
    const channelId = resolveVideoChannelId(config, model, config.videoChannelId, config.activeChannelId);
    const channels = config.channelMode === "remote" ? config.publicChannels : normalizeLocalChannels(config);
    const channel = channels.find((item) => (item.id || "") === channelId && (item.models || []).includes(model)) || channels.find((item) => (item.models || []).includes(model)) || channels.find((item) => (item.id || "") === channelId);
    const record = channel as { id?: string; name?: string; baseUrl?: string; remark?: string } | undefined;
    return [record?.id, record?.name, record?.baseUrl, record?.remark].filter(Boolean).join(" ").toLowerCase();
}

export const characterOrientationOptions = [{ value: "image", label: "图片" }, { value: "video", label: "视频" }];

export function normalizeCharacterOrientation(value: string | undefined) {
    return value === "image" ? "image" : "video";
}

export function klingBottomSizeValue(value: string) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["9:16", "720x1280", "1080x1920"].includes(normalized)) return "9:16";
    if (["1024x1024", "1080x1080"].includes(normalized)) return "1:1";
    return "16:9";
}

export function normalizeKlingV26Ratio(value: string) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["9:16", "720x1280", "1080x1920"].includes(normalized)) return "9:16";
    if (["1:1", "1024x1024", "1080x1080"].includes(normalized)) return "1:1";
    return "16:9";
}

export function defaultKlingElementList(): VideoElementItem[] {
    return [{ name: "", description: "", references: [] }];
}

export function normalizeKlingElementList(value: VideoElementItem[] | undefined): VideoElementItem[] {
    if (!Array.isArray(value) || !value.length) return defaultKlingElementList();
    return value.slice(0, 3).map((item) => ({ name: item?.name || "", description: item?.description || "", references: Array.isArray(item?.references) ? item.references.slice(0, 4) : [] }));
}

export function activeKlingElements(value: VideoElementItem[] | undefined) {
    return normalizeKlingElementList(value).filter((item) => item.references.length > 0);
}

export function validateKlingElementList(value: VideoElementItem[] | undefined) {
    for (const item of activeKlingElements(value)) {
        if (!item.name.trim()) return "请填写元素名称";
        if (!item.description.trim()) return "请填写元素描述";
        if (item.references.length < 2 || item.references.length > 4) return "元素资源数量需要 2-4 个";
    }
    return "";
}

export function parseRequestElementList(value: unknown): VideoElementItem[] {
    const source = typeof value === "string" ? safeParseArray(value) : value;
    if (!Array.isArray(source)) return [];
    return source.map((item) => {
        const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const urls = Array.isArray(record.element_input_urls) ? record.element_input_urls : [];
        const audioUrls = Array.isArray(record.element_input_audio_urls) ? record.element_input_audio_urls : [];
        return {
            name: fieldString(record.name),
            description: fieldString(record.description),
            references: [...urls.map((url, index) => ({ id: nanoid(), kind: elementReferenceKind(String(url)), name: `element-${index + 1}`, type: "", url: String(url) })), ...audioUrls.map((url, index) => ({ id: nanoid(), kind: "audio" as const, name: `element-audio-${index + 1}`, type: "", url: String(url) }))],
        };
    });
}

export function serializeKlingElementList(value: VideoElementItem[] | undefined): VideoElementItem[] {
    return normalizeKlingElementList(value).map((item) => ({
        ...item,
        references: item.references.map((reference) => reference.storageKey ? { ...reference, dataUrl: "", url: reference.kind === "image" ? "" : reference.url || "" } : reference),
    }));
}

export function elementReferenceKind(value: string): VideoElementReference["kind"] {
    const lower = value.toLowerCase();
    if (/\.(mp4|mov|webm)(\?|$)/.test(lower) || lower.startsWith("data:video/")) return "video";
    if (/\.(mp3|wav|m4a)(\?|$)/.test(lower) || lower.startsWith("data:audio/")) return "audio";
    return "image";
}

export function safeParseArray(value: string) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function defaultKlingMultiPrompts() {
    return [{ prompt: "", duration: "1" }];
}

export function normalizeKlingShotType(value: string) {
    return value === "customize" ? "customize" : "intelligence";
}

export function normalizeKlingMultiPrompts(value: AiConfig["videoMultiPrompt"] | undefined) {
    if (!Array.isArray(value) || !value.length) return defaultKlingMultiPrompts();
    return value.map((item) => ({ prompt: item?.prompt || "", duration: normalizeKlingMultiPromptDuration(item?.duration) }));
}

export function normalizeKlingMultiPromptDuration(value: string | undefined) {
    const duration = Math.floor(Number(value) || 1);
    return String(Math.max(1, Math.min(15, duration)));
}

export function parseRequestMultiPrompt(value: unknown) {
    const source = Array.isArray(value) ? value[0] : value;
    if (!source) return [];
    if (Array.isArray(source)) return normalizeKlingMultiPrompts(source as AiConfig["videoMultiPrompt"]);
    if (typeof source === "string") {
        try {
            const parsed = JSON.parse(source);
            return Array.isArray(parsed) ? normalizeKlingMultiPrompts(parsed as AiConfig["videoMultiPrompt"]) : [];
        } catch {
            return [];
        }
    }
    return [];
}
export function normalizeKlingV26Seconds(value: string) {
    return String(value).trim() === "10" ? "10" : "5";
}

export function normalizeKlingV3Seconds(value: string) {
    const seconds = Math.floor(Number(value) || 3);
    return String(Math.max(3, Math.min(15, seconds)));
}

export function normalizeVideoSeconds(value: string) {
    if (String(value).trim() === "-1") return "-1";
    const seconds = Math.floor(Number(value) || 6);
    return String(Math.max(1, Math.min(30, seconds)));
}

export function normalizeVideoSize(value: string) {
    return normalizeVideoSizeValue(value);
}

export function normalizeResolution(value: string) {
    return normalizeVideoResolutionValue(value);
}

export function normalizeVideoCount(value: string | number) {
    const count = Math.floor(Number(value) || 1);
    return Math.max(1, Math.min(6, count));
}

export function buildResumeVideoConfig(config: AiConfig, log: GenerationLog): AiConfig {
    return buildVideoConfig({ ...config, ...log.config, model: log.model, videoModel: log.model }, log.model);
}

export function videoLogTaskId(log: GenerationLog) {
    return (log.task?.id || log.task?.task_id || log.task?.video_id || "") as string;
}

