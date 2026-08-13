"use client";
import axios from "axios";

import { AlertCircle, ArrowLeft, ArrowRight, BookOpen, CheckSquare, ChevronDown, ChevronUp, ClipboardPaste, CloudUpload, Copy, Download, FolderPlus, GripVertical, History, LoaderCircle, Maximize2, Music2, PanelBottom, PanelLeft, Plus, RotateCcw, SlidersHorizontal, Sparkles, StopCircle, Trash2, Upload, UserRound, VideoIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { App, Button, Checkbox, Empty, Input, Modal, Select, Switch, Tag, Tooltip, Typography } from "antd";
import { useSearchParams } from "next/navigation";
import localforage from "localforage";
import { nanoid } from "nanoid";
import { saveAs } from "file-saver";

import { AssetPickerModal, type InsertAssetPayload } from "@/app/(user)/canvas/components/asset-picker-modal";
import { CharacterPickerModal } from "@/app/(user)/canvas/components/character-picker-modal";
import { ModelPicker } from "@/components/model-picker";
import { KlingV26WorkbenchPanel } from "@/app/(user)/video/components/kling-v26-workbench-panel";
import { SortableReferenceImageItem } from "@/app/(user)/video/components/sortable-reference-item";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { VideoSettingsPanel, normalizeVideoResolutionValue, normalizeVideoSizeValue } from "@/components/video-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { boolConfig, isSeedanceVideoConfig, normalizeSeedanceRatio, seedanceReferenceLabel, seedanceVideoReferenceError, seedanceVideoReferenceHint, SEEDANCE_REFERENCE_LIMITS } from "@/lib/seedance-video";
import { modelKey, supportsVideoAudioGeneration, supportsVideoFrameReferences } from "@/lib/video-model-capabilities";
import { deleteStoredMedia, downloadRemoteMedia, getVideoThumbnail, resolveMediaUrl, uploadMediaFile, uploadRemoteMediaToServer } from "@/services/file-storage";
import { deleteStoredImages, resolveImageUrl, uploadImage } from "@/services/image-storage";
import { deleteVideoGenerationLogs, fetchVideoGenerationLogs, saveVideoGenerationLogs } from "@/services/api/generation-logs";
import { cancelVideoGenerationTask, createVideoGenerationTask, deleteVideoGenerationTask, listVideoGenerationTasks, pollVideoGenerationTaskStatus, VIDEO_POLL_INTERVAL_MS, VideoRequestError, type VideoResponse } from "@/services/api/video";
import { fetchTTSVoices, synthesizeTTS, type TTSVoice } from "@/services/api/tts";
import { useCanvasStore } from "@/app/(user)/canvas/stores/use-canvas-store";
import { isCanvasImageNodeType } from "@/app/(user)/canvas/utils/canvas-panorama";
import { useAssetStore } from "@/stores/use-asset-store";
import { normalizeLocalChannels, useConfigStore, useEffectiveConfig, type AiConfig, type VideoElementItem, type VideoElementReference } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

import type { AssetPickerTarget, GeneratedVideo, GenerationLog, GenerationLogConfig, GenerationResult, UpdateAiConfig, WorkbenchLayout } from "./types";
import { buildLog, buildResumeVideoConfig, buildVideoConfig, characterOrientationOptions, copyPrompt, createResultFromLog, defaultKlingElementList, disposableLogStorageKeys, errorDetail, errorMessage, filterAudioReferencesByDuration, formatLogTime, isAPIMartKlingMotionControlConfig, isAPIMartKlingV26Config, isCloudVideo, isCompletedVideoTask, isFailedVideoTask, isKIEKlingMotionControlConfig, isKlingV3Config, isLocalClientVideoLog, isLocalClientVideoTask, isRecoverableBackendVideoTask, isSupportedAudioFile, isTransientVideoPollError, klingBottomSizeValue, logStore, mediaReferenceUsedByGeneration, mergeBackendVideoTasks, mergePendingLogResults, mergeVideoLogs, moveListItem, normalizeCharacterOrientation, normalizeKlingElementList, normalizeKlingMultiPrompts, normalizeKlingV26Seconds, normalizeVideoCount, normalizeVideoSeconds, persistStoredVideoLogs, readStoredLogs, referenceUsedByGeneration, replaceStoredVideoHistory, resolveKlingWorkbenchConfig, resolveVideoChannelId, serializeLog, shouldSyncVideoLog, sortVideoLogs, sortVideoResults, updateResult, updateResultByLogId, validateKlingElementList, videoFromTaskResponse, videoLogDeleteKeys, videoLogIdentityKeys, videoLogTaskId, videoResultIdentityKeys, videoTaskChannelId, videoTaskIdentityKeys } from "./utils/video-log-helpers";

const WORKBENCH_LAYOUT_KEY = "infinite-canvas:video-workbench-layout";
const quickResolutionOptions = [
    { value: "480", label: "480p" },
    { value: "720", label: "720p" },
    { value: "1080", label: "1080p" },
];
const quickSizeOptions = [
    { value: "1280x720", label: "1280x720" },
    { value: "720x1280", label: "720x1280" },
    { value: "1024x1024", label: "1024x1024" },
    { value: "1792x1024", label: "1792x1024" },
    { value: "1024x1792", label: "1024x1792" },
    { value: "auto", label: "auto" },
];

export default function VideoPage() {
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const elementFileInputRef = useRef<HTMLInputElement>(null);
    const firstFrameInputRef = useRef<HTMLInputElement>(null);
    const lastFrameInputRef = useRef<HTMLInputElement>(null);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const token = useUserStore((state) => state.token);
    const isUserReady = useUserStore((state) => state.isReady);
    const [prompt, setPrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [firstFrame, setFirstFrame] = useState<ReferenceImage | null>(null);
    const [lastFrame, setLastFrame] = useState<ReferenceImage | null>(null);
    const [videoReferences, setVideoReferences] = useState<ReferenceVideo[]>([]);
    const [audioReferences, setAudioReferences] = useState<ReferenceAudio[]>([]);
    const [characterIds, setCharacterIds] = useState<string[]>([]);
    const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
    const [results, setResults] = useState<GenerationResult[]>([]);
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [running, setRunning] = useState(false);
    const [workbenchLayout, setWorkbenchLayoutState] = useState<WorkbenchLayout>("side");
    const [bottomSettingsCollapsed, setBottomSettingsCollapsed] = useState(true);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget>("general");
    const [elementPickerIndex, setElementPickerIndex] = useState(0);
    const [elementUploadIndex, setElementUploadIndex] = useState(0);
    const [now, setNow] = useState(Date.now());
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [taskCount, setTaskCount] = useState(1);
    const [syncingVideoIds, setSyncingVideoIds] = useState<string[]>([]);
    const pollingLogIdsRef = useRef(new Set<string>());
    const logsRef = useRef<GenerationLog[]>([]);
    const effectiveConfigRef = useRef(effectiveConfig);
    const searchParams = useSearchParams();
    const sourceCanvas = searchParams.get("sourceCanvas");
    const sourceNode = searchParams.get("sourceNode");
    const canvasHydrated = useCanvasStore((state) => state.hydrated);
    const canvasProjects = useCanvasStore((state) => state.projects);
    const canvasImageImportedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!sourceCanvas || !sourceNode || !canvasHydrated) return;
        const importKey = `${sourceCanvas}/${sourceNode}`;
        if (canvasImageImportedRef.current === importKey) return;
        canvasImageImportedRef.current = importKey;
        const project = canvasProjects.find((p) => p.id === sourceCanvas);
        if (!project) return;
        const node = project.nodes.find((n) => n.id === sourceNode);
        if (!node || !isCanvasImageNodeType(node.type) || !node.metadata?.content) return;
        (async () => {
            try {
                const imageUrl = node.metadata!.storageKey
                    ? await resolveImageUrl(node.metadata!.storageKey)
                    : node.metadata!.content!;
                const ref: ReferenceImage = {
                    id: nanoid(),
                    name: `${node.title || "画布图片"}.png`,
                    type: node.metadata!.mimeType || "image/png",
                    dataUrl: imageUrl,
                    storageKey: node.metadata!.storageKey,
                };
                setReferences((prev) => [...prev, ref]);
                message.success("已从画布导入参考图");
            } catch {
                message.error("无法加载画布图片");
            }
        })();
    }, [sourceCanvas, sourceNode, canvasHydrated, canvasProjects]);

    const model = effectiveConfig.videoModel || effectiveConfig.model;
    const canGenerate = Boolean(prompt.trim());
    const pendingCount = results.filter((item) => item.status === "pending").length;
    const klingWorkbench = resolveKlingWorkbenchConfig(effectiveConfig, model);
    const klingWorkbenchVariant = klingWorkbench?.variant || "";
    const klingWorkbenchProvider = klingWorkbench?.provider || "apimart";
    const isKlingWorkbench = Boolean(klingWorkbench);
    const pendingLogCount = logs.filter((log) => log.status === "生成中" && log.task && !log.video).length;
    const usesBackendVideoTasks = (value: AiConfig) => value.channelMode === "remote" || (value.channelMode === "local" && Boolean(token));

    const restorePendingLogResults = (sourceLogs: GenerationLog[]) => {
        const pendingLogs = sourceLogs.filter((log) => log.status === "生成中" && log.task && !log.video);
        if (!pendingLogs.length) return;
        setResults((value) => mergePendingLogResults(value, pendingLogs));
    };

    const pollPendingLogsOnce = (sourceLogs: GenerationLog[]) => {
        const pendingLogs = sourceLogs.filter((log) => log.status === "生成中" && log.task && !log.video);
        if (!pendingLogs.length) return;
        pendingLogs.forEach((log) => {
            if (pollingLogIdsRef.current.has(log.id)) return;
            const resumeConfig = buildResumeVideoConfig(effectiveConfigRef.current, log);
            const taskId = videoLogTaskId(log);
            if (!taskId || !isAiConfigReady(resumeConfig, log.model)) return;
            if (isLocalClientVideoLog(log) && !usesBackendVideoTasks(resumeConfig)) return;
            void pollPendingLogOnce(log, resumeConfig);
        });
    };

    useEffect(() => {
        if (!pendingCount && !pendingLogCount) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [pendingCount, pendingLogCount]);

    useEffect(() => {
        if (!pendingLogCount) return;
        const timer = window.setInterval(() => {
            pollPendingLogsOnce(logsRef.current);
        }, VIDEO_POLL_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [pendingLogCount, pollPendingLogsOnce]);

    const refreshLogs = useCallback(async () => {
        const nextLogs = await readStoredLogs();
        setLogs(nextLogs);
        return nextLogs;
    }, []);

    const syncBackendVideoTasks = useCallback(async (baseLogs?: GenerationLog[]) => {
        const config = effectiveConfigRef.current;
        if (!token || !usesBackendVideoTasks(config)) return baseLogs || logsRef.current;
        try {
            const tasks = await listVideoGenerationTasks(config);
            const recoverableTasks = tasks.filter(isRecoverableBackendVideoTask);
            if (!recoverableTasks.length) return baseLogs || logsRef.current;
            const currentLogs = baseLogs || (await readStoredLogs());
            const mergedLogs = mergeBackendVideoTasks(currentLogs, recoverableTasks, config);
            const taskKeys = new Set(recoverableTasks.flatMap(videoTaskIdentityKeys));
            const recoveredLogs = mergedLogs.filter((log) => videoLogIdentityKeys(log).some((key) => taskKeys.has(key)));
            await persistStoredVideoLogs(recoveredLogs);
            setLogs(mergedLogs);
            setResults((value) => mergePendingLogResults(value, mergedLogs.filter((log) => log.status === "生成中" && log.task && !log.video)));
            return mergedLogs;
        } catch {
            return baseLogs || logsRef.current;
        }
    }, [token]);

    useEffect(() => {
        void refreshLogs().then((items) => syncBackendVideoTasks(items));
        try {
            const storedLayout = window.localStorage?.getItem(WORKBENCH_LAYOUT_KEY);
            if (storedLayout === "side" || storedLayout === "bottom" || storedLayout === "fullscreen") setWorkbenchLayoutState(storedLayout);
        } catch {
            // Keep the default layout when localStorage is unavailable.
        }
    }, [refreshLogs, syncBackendVideoTasks]);

    useEffect(() => {
        logsRef.current = logs;
    }, [logs]);

    useEffect(() => {
        effectiveConfigRef.current = effectiveConfig;
    }, [effectiveConfig]);

    useEffect(() => {
        restorePendingLogResults(logs);
    }, [logs]);

    useEffect(() => {
        if (!isUserReady || !token) return;
        void loadAccountVideoHistory(token).then((items) => syncBackendVideoTasks(items || logsRef.current));
    }, [isUserReady, token, syncBackendVideoTasks]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && workbenchLayout === "fullscreen") {
                setWorkbenchLayout("side");
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [workbenchLayout]);

    const setWorkbenchLayout = (layout: WorkbenchLayout) => {
        setWorkbenchLayoutState(layout);
        try {
            window.localStorage?.setItem(WORKBENCH_LAYOUT_KEY, layout);
        } catch {
            // Keep the in-memory layout when localStorage is unavailable.
        }
    };

    const pastePromptFromClipboard = async () => {
        try {
            const text = (await navigator.clipboard.readText()).trim();
            if (!text) {
                message.error("剪切板里没有可读取的文本");
                return;
            }
            setPrompt(text);
            message.success("已读取剪切板文本");
        } catch {
            message.error("剪切板里没有可读取的文本");
        }
    };

    const openAssetPicker = (target: AssetPickerTarget = "general") => {
        setAssetPickerTarget(target);
        setAssetPickerOpen(true);
    };

    const openElementAssetPicker = (index: number) => {
        setElementPickerIndex(index);
        openAssetPicker("element");
    };

    const uploadElementReferences = (index: number) => {
        setElementUploadIndex(index);
        elementFileInputRef.current?.click();
    };

    const updateElementList = (items: VideoElementItem[]) => {
        updateConfig("videoElementList", normalizeKlingElementList(items));
    };

    const updateElementReferences = (elementIndex: number, updater: (references: VideoElementReference[]) => VideoElementReference[]) => {
        const list = normalizeKlingElementList(effectiveConfig.videoElementList);
        updateElementList(list.map((item, index) => index === elementIndex ? { ...item, references: updater(item.references).slice(0, 4) } : item));
    };

    const addElementReferences = async (elementIndex: number, files?: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        const list = normalizeKlingElementList(effectiveConfig.videoElementList);
        const current = list[elementIndex];
        if (!current) return;
        const usable = selectedFiles.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/") || isSupportedAudioFile(file)).slice(0, Math.max(0, 4 - current.references.length));
        const unsupported = selectedFiles.length - usable.length;
        if (unsupported > 0) message.warning("已忽略超出数量或不支持的元素资源");
        const hideLoading = usable.length ? message.loading("正在上传元素资源...", 0) : null;
        try {
            const next = await Promise.all(usable.map(uploadElementReferenceFile));
            const filtered = next.filter((item): item is VideoElementReference => Boolean(item));
            updateElementReferences(elementIndex, (value) => [...value, ...filtered]);
            if (filtered.length) message.success(`已上传 ${filtered.length} 个元素资源`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "元素资源上传失败");
        } finally {
            hideLoading?.();
        }
    };

    const addElementReferencesFromClipboard = async (elementIndex: number) => {
        try {
            const list = normalizeKlingElementList(effectiveConfig.videoElementList);
            const current = list[elementIndex];
            if (!current) return;
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error("剪贴板里没有可读取的图片");
                return;
            }
            const next = await Promise.all(blobs.slice(0, Math.max(0, 4 - current.references.length)).map(async (blob, index) => {
                const image = await uploadImage(blob);
                return { id: nanoid(), kind: "image" as const, name: `clipboard-element-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
            }));
            updateElementReferences(elementIndex, (value) => [...value, ...next]);
            message.success(`已读取 ${next.length} 个元素图片`);
        } catch {
            message.error("剪贴板里没有可读取的图片");
        }
    };

    const removeElementReference = (elementIndex: number, id: string) => {
        updateElementReferences(elementIndex, (value) => value.filter((item) => item.id !== id));
    };

    const moveElementReference = (elementIndex: number, index: number, offset: number) => {
        updateElementReferences(elementIndex, (value) => moveListItem(value, index, offset));
    };

    const addReferences = async (files?: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        const referenceImageLimit = isKlingWorkbench ? 2 : SEEDANCE_REFERENCE_LIMITS.images;
        const unsupported = isKlingWorkbench ? selectedFiles.filter((file) => !file.type.startsWith("image/")) : selectedFiles.filter((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/") && !isSupportedAudioFile(file));
        if (unsupported.length) message.warning(isKlingWorkbench ? "当前 Kling 仅支持参考图" : "已忽略不支持的参考素材，请使用图片、mp4/mov 视频或 mp3/wav 音频");
        const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/") && file.size <= SEEDANCE_REFERENCE_LIMITS.imageMaxBytes).slice(0, Math.max(0, referenceImageLimit - references.length));
        const videoFiles = isKlingWorkbench ? [] : selectedFiles.filter((file) => file.type.startsWith("video/") && file.size <= SEEDANCE_REFERENCE_LIMITS.videoMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.videos - videoReferences.length);
        const audioFiles = isKlingWorkbench ? [] : selectedFiles.filter((file) => isSupportedAudioFile(file) && file.size <= SEEDANCE_REFERENCE_LIMITS.audioMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.audios - audioReferences.length);
        if (selectedFiles.some((file) => file.type.startsWith("image/") && file.size > SEEDANCE_REFERENCE_LIMITS.imageMaxBytes)) message.warning("已忽略超过 30MB 的参考图");
        if (selectedFiles.some((file) => file.type.startsWith("video/") && file.size > SEEDANCE_REFERENCE_LIMITS.videoMaxBytes)) message.warning("已忽略超过 50MB 的参考视频");
        if (selectedFiles.some((file) => isSupportedAudioFile(file) && file.size > SEEDANCE_REFERENCE_LIMITS.audioMaxBytes)) message.warning("已忽略超过 15MB 的参考音频");
        const hideLoading = imageFiles.length ? message.loading("正在上传参考图...", 0) : null;
        try {
            const nextReferences = await Promise.all(
                imageFiles.map(async (file) => {
                    const image = await uploadImage(file);
                    return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            const nextVideoReferences = await Promise.all(
                videoFiles.map(async (file) => {
                    const video = await uploadMediaFile(file, "video-reference");
                    return { id: nanoid(), name: file.name, type: video.mimeType, url: video.url, storageKey: video.storageKey, bytes: video.bytes, width: video.width, height: video.height, durationMs: video.durationMs };
                }),
            );
            const nextAudioReferences = filterAudioReferencesByDuration(
                audioReferences,
                await Promise.all(
                    audioFiles.map(async (file) => {
                        const audio = await uploadMediaFile(file, "audio-reference");
                        return { id: nanoid(), name: file.name, type: audio.mimeType, url: audio.url, storageKey: audio.storageKey, durationMs: audio.durationMs };
                    }),
                ),
                message.warning,
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, referenceImageLimit));
            setVideoReferences((value) => [...value, ...nextVideoReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
            setAudioReferences((value) => [...value, ...nextAudioReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.audios));
            if (nextReferences.length) message.success(`已上传 ${nextReferences.length} 张参考图`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "参考素材上传失败");
        } finally {
            hideLoading?.();
        }
    };

    const uploadFrameReference = async (slot: "first" | "last", files?: FileList | null) => {
        const file = Array.from(files || []).find((item) => item.type.startsWith("image/"));
        if (!file) {
            message.error("请选择首尾帧图片");
            return;
        }
        if (file.size > SEEDANCE_REFERENCE_LIMITS.imageMaxBytes) {
            message.warning("已忽略超过 30MB 的首尾帧图片");
            return;
        }
        const hideLoading = message.loading(slot === "first" ? "正在上传首帧..." : "正在上传尾帧...", 0);
        try {
            const image = await uploadImage(file);
            const next = { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
            slot === "first" ? setFirstFrame(next) : setLastFrame(next);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "首尾帧上传失败");
        } finally {
            hideLoading();
        }
    };

    const uploadElementReferenceFile = async (file: File): Promise<VideoElementReference | null> => {
        if (file.type.startsWith("image/")) {
            if (file.size > SEEDANCE_REFERENCE_LIMITS.imageMaxBytes) return null;
            const image = await uploadImage(file);
            return { id: nanoid(), kind: "image", name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
        }
        if (file.type.startsWith("video/")) {
            if (file.size > SEEDANCE_REFERENCE_LIMITS.videoMaxBytes) return null;
            const video = await uploadMediaFile(file, "video-reference");
            if (video.durationMs && (video.durationMs < 3000 || video.durationMs > 8000)) {
                message.warning("已忽略不符合时长要求的元素视频：3-8 秒");
                return null;
            }
            return { id: nanoid(), kind: "video", name: file.name, type: video.mimeType, url: video.url, storageKey: video.storageKey, bytes: video.bytes, width: video.width, height: video.height, durationMs: video.durationMs };
        }
        if (isSupportedAudioFile(file)) {
            if (file.size > SEEDANCE_REFERENCE_LIMITS.audioMaxBytes) return null;
            const audio = await uploadMediaFile(file, "audio-reference");
            if (audio.durationMs && (audio.durationMs < 5000 || audio.durationMs > 30000)) {
                message.warning("已忽略不符合时长要求的元素音频：5-30 秒");
                return null;
            }
            return { id: nanoid(), kind: "audio", name: file.name, type: audio.mimeType, url: audio.url, storageKey: audio.storageKey, durationMs: audio.durationMs };
        }
        return null;
    };

    const addReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error("剪切板里没有可读取的图片");
                return;
            }
            const nextReferences = await Promise.all(
                blobs.slice(0, Math.max(0, (isKlingWorkbench ? 2 : SEEDANCE_REFERENCE_LIMITS.images) - references.length)).map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, isKlingWorkbench ? 2 : SEEDANCE_REFERENCE_LIMITS.images));
            message.success(`已读取 ${nextReferences.length} 张参考图`);
        } catch {
            message.error("剪切板里没有可读取的图片");
        }
    };

    const setFrameFromClipboard = async (slot: "first" | "last") => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            const blob = blobs[0];
            if (!blob) {
                message.error("剪切板里没有可读取的图片");
                return;
            }
            if (blob.size > SEEDANCE_REFERENCE_LIMITS.imageMaxBytes) {
                message.warning("已忽略超过 30MB 的首尾帧图片");
                return;
            }
            const hideLoading = message.loading(slot === "first" ? "正在读取首帧..." : "正在读取尾帧...", 0);
            try {
                const image = await uploadImage(blob);
                const next = { id: nanoid(), name: slot === "first" ? "clipboard-first-frame.png" : "clipboard-last-frame.png", type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                slot === "first" ? setFirstFrame(next) : setLastFrame(next);
                message.success(slot === "first" ? "已读取首帧" : "已读取尾帧");
            } finally {
                hideLoading();
            }
        } catch {
            message.error("剪切板里没有可读取的图片");
        }
    };

    const addVideoReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("video/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error("剪切板里没有可读取的视频");
                return;
            }
            const usable = blobs.filter((blob) => blob.size <= SEEDANCE_REFERENCE_LIMITS.videoMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.videos - videoReferences.length);
            if (blobs.some((blob) => blob.size > SEEDANCE_REFERENCE_LIMITS.videoMaxBytes)) message.warning("已忽略超过 50MB 的参考视频");
            const nextVideoReferences = await Promise.all(
                usable.map(async (blob, index) => {
                    const video = await uploadMediaFile(blob, "video-reference");
                    return { id: nanoid(), name: `clipboard-video-${index + 1}.mp4`, type: video.mimeType, url: video.url, storageKey: video.storageKey, bytes: video.bytes, width: video.width, height: video.height, durationMs: video.durationMs };
                }),
            );
            setVideoReferences((value) => [...value, ...nextVideoReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
            message.success(`已读取 ${nextVideoReferences.length} 个参考视频`);
        } catch {
            message.error("剪切板里没有可读取的视频");
        }
    };

    const addAudioReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("audio/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error("剪切板里没有可读取的音频");
                return;
            }
            const usable = blobs.filter((blob) => blob.size <= SEEDANCE_REFERENCE_LIMITS.audioMaxBytes).slice(0, SEEDANCE_REFERENCE_LIMITS.audios - audioReferences.length);
            if (blobs.some((blob) => blob.size > SEEDANCE_REFERENCE_LIMITS.audioMaxBytes)) message.warning("已忽略超过 15MB 的参考音频");
            const nextAudioReferences = filterAudioReferencesByDuration(
                audioReferences,
                await Promise.all(
                    usable.map(async (blob, index) => {
                        const audio = await uploadMediaFile(blob, "audio-reference");
                        return { id: nanoid(), name: `clipboard-audio-${index + 1}.mp3`, type: audio.mimeType, url: audio.url, storageKey: audio.storageKey, durationMs: audio.durationMs };
                    }),
                ),
                message.warning,
            );
            setAudioReferences((value) => [...value, ...nextAudioReferences].slice(0, SEEDANCE_REFERENCE_LIMITS.audios));
            message.success(`已读取 ${nextAudioReferences.length} 个参考音频`);
        } catch {
            message.error("剪切板里没有可读取的音频");
        }
    };

    const removeReference = async (id: string) => {
        const reference = references.find((item) => item.id === id);
        setReferences((value) => value.filter((ref) => ref.id !== id));
        if (!reference?.storageKey || referenceUsedByGeneration(reference, logs, results)) return;
        try {
            await deleteStoredImages([reference.storageKey]);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "参考图文件删除失败");
        }
    };

    const removeFrameReference = async (slot: "first" | "last") => {
        const reference = slot === "first" ? firstFrame : lastFrame;
        slot === "first" ? setFirstFrame(null) : setLastFrame(null);
        if (!reference?.storageKey || referenceUsedByGeneration(reference, logs, results)) return;
        try {
            await deleteStoredImages([reference.storageKey]);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "首尾帧文件删除失败");
        }
    };

    const removeVideoReference = async (id: string) => {
        const reference = videoReferences.find((item) => item.id === id);
        setVideoReferences((value) => value.filter((ref) => ref.id !== id));
        if (!reference?.storageKey || mediaReferenceUsedByGeneration(reference.storageKey, logs, results)) return;
        try {
            await deleteStoredMedia([reference.storageKey]);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "参考视频文件删除失败");
        }
    };

    const removeAudioReference = async (id: string) => {
        const reference = audioReferences.find((item) => item.id === id);
        setAudioReferences((value) => value.filter((ref) => ref.id !== id));
        if (!reference?.storageKey || mediaReferenceUsedByGeneration(reference.storageKey, logs, results)) return;
        try {
            await deleteStoredMedia([reference.storageKey]);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "参考音频文件删除失败");
        }
    };

    const generate = async () => {
        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;
        setPrompt("");
        await submitGenerationSnapshot(snapshot);
    };

    const buildRequestSnapshot = ({ promptText = prompt, negativePromptText, referenceItems = references, firstFrameItem = firstFrame, lastFrameItem = lastFrame, videoReferenceItems = videoReferences, audioReferenceItems = audioReferences, taskCountValue = taskCount, configValue = effectiveConfig, modelValue = model }: { promptText?: string; negativePromptText?: string; referenceItems?: ReferenceImage[]; firstFrameItem?: ReferenceImage | null; lastFrameItem?: ReferenceImage | null; videoReferenceItems?: ReferenceVideo[]; audioReferenceItems?: ReferenceAudio[]; taskCountValue?: number; configValue?: AiConfig; modelValue?: string } = {}) => {
        const text = promptText.trim();
        const currentNegativePrompt = (negativePromptText ?? configValue.videoNegativePrompt ?? negativePrompt).trim();
        const klingV26 = isAPIMartKlingV26Config(configValue, modelValue);
        const klingV3 = isKlingV3Config(configValue, modelValue);
        const kling = klingV26 || klingV3;
        if (!text) {
            message.error("请输入视频提示词");
            return null;
        }
        if (!isAiConfigReady(configValue, modelValue)) {
            message.warning("请先完成配置");
            openConfigDialog(true);
            return null;
        }
        if (kling && referenceItems.length > 2) {
            message.error("Kling 参考图最多 2 张");
            return null;
        }
        if (klingV26 && boolConfig(configValue.videoGenerateAudio, false)) {
            if (configValue.videoMode !== "pro") {
                message.error("Kling v2.6 音频生成需要 pro 模式");
                return null;
            }
            if (referenceItems.length > 1) {
                message.error("Kling v2.6 开启音频时最多 1 张参考图");
                return null;
            }
        }
        if (klingV3) {
            const elementError = validateKlingElementList(configValue.videoElementList);
            if (elementError) {
                message.error(elementError);
                return null;
            }
        }
        if (!kling) {
            const videoReferenceError = seedanceVideoReferenceError(videoReferenceItems);
            if (videoReferenceError) {
                message.error(`${videoReferenceError}。${seedanceVideoReferenceHint}`);
                return null;
            }
        }
        const frameReferencesEnabled = !kling && supportsVideoFrameReferences(modelValue);
        return { text, model: modelValue, config: buildVideoConfig({ ...configValue, videoNegativePrompt: currentNegativePrompt }, modelValue), references: [...referenceItems].slice(0, kling ? 2 : referenceItems.length), firstFrame: frameReferencesEnabled ? firstFrameItem : null, lastFrame: frameReferencesEnabled ? lastFrameItem : null, videoReferences: kling ? [] : [...videoReferenceItems], audioReferences: kling ? [] : [...audioReferenceItems], taskCount: normalizeVideoCount(taskCountValue), characterIds: [...characterIds] };
    };

    const submitGenerationSnapshot = async (snapshot: { text: string; model: string; config: AiConfig; references: ReferenceImage[]; firstFrame?: ReferenceImage | null; lastFrame?: ReferenceImage | null; videoReferences: ReferenceVideo[]; audioReferences: ReferenceAudio[]; taskCount: number; characterIds?: string[] }) => {
        setRunning(true);
        setPreviewLog(null);
        setNow(Date.now());
        const pendingLogs = Array.from({ length: snapshot.taskCount }, () => {
            const clientTaskId = `client_video_task_${nanoid()}`;
            const task: VideoResponse = { id: clientTaskId, task_id: clientTaskId, model: snapshot.model, status: "queued", progress: 0, created_at: Date.now(), size: snapshot.config.size, seconds: snapshot.config.videoSeconds };
            return buildLog({ prompt: snapshot.text, model: snapshot.model, config: snapshot.config, references: snapshot.references, firstFrame: snapshot.firstFrame, lastFrame: snapshot.lastFrame, videoReferences: snapshot.videoReferences, audioReferences: snapshot.audioReferences, durationMs: 0, status: "生成中", task, taskCount: snapshot.taskCount, lastPolledAt: Date.now() });
        });
        await Promise.all(pendingLogs.map((log) => logStore.setItem(log.id, serializeLog(log))));
        setLogs((value) => sortVideoLogs([...pendingLogs, ...value]));
        setResults((value) => sortVideoResults([...pendingLogs.map((log) => createResultFromLog(log, "pending")), ...value]));
        try {
            const settled = await Promise.allSettled(pendingLogs.map((log) => runVideoTask(log, snapshot)));
            const nextLogs = settled
                .map((item) => (item.status === "fulfilled" ? item.value : null))
                .filter((item): item is NonNullable<typeof item> => Boolean(item));
            const storedLogs = await readStoredLogs();
            setLogs(storedLogs);
            const createdCount = nextLogs.filter((item) => item.status === "生成中").length;
            const failedCount = nextLogs.filter((item) => item.status === "失败").length;
            createdCount ? message.success(`已创建 ${createdCount} 个视频任务`) : message.error("视频任务创建失败");
            if (failedCount) message.warning(`${failedCount} 个视频任务创建失败`);
        } finally {
            setRunning(false);
        }
    };

    const runVideoTask = async (pendingLog: GenerationLog, snapshot: { text: string; model: string; config: AiConfig; references: ReferenceImage[]; firstFrame?: ReferenceImage | null; lastFrame?: ReferenceImage | null; videoReferences: ReferenceVideo[]; audioReferences: ReferenceAudio[]; taskCount: number; characterIds?: string[] }) => {
        try {
            const created = await createVideoGenerationTask(snapshot.config, snapshot.text, { references: snapshot.references, firstFrame: snapshot.firstFrame, lastFrame: snapshot.lastFrame, videoReferences: snapshot.videoReferences, audioReferences: snapshot.audioReferences }, (progress) => {
                setResults((value) => updateResultByLogId(value, pendingLog.id, { progress }));
            }, { clientTaskId: pendingLog.task?.id, source: "video-workbench", characterIds: snapshot.characterIds || [] });
            const nextLog = { ...pendingLog, task: created.task, lastPolledAt: Date.now() };
            await saveGenerationLog(nextLog);
            setResults((value) => updateResultByLogId(value, pendingLog.id, { progress: created.task.progress, task: created.task, taskLogId: nextLog.id, lastPolledAt: nextLog.lastPolledAt }));
            return nextLog;
        } catch (error) {
            const durationMs = Date.now() - pendingLog.createdAt;
            const nextLog = { ...pendingLog, status: "失败" as const, durationMs, lastPolledAt: Date.now(), error: errorMessage(error), errorDetail: errorDetail(error) };
            await saveGenerationLog(nextLog);
            await persistVideoLog(nextLog);
            setResults((value) => updateResultByLogId(value, pendingLog.id, { status: "failed", taskLogId: nextLog.id, error: nextLog.error, errorDetail: nextLog.errorDetail, durationMs }));
            return nextLog;
        }
    };

    const cancelResult = (result: GenerationResult) => {
        const config = { ...effectiveConfig, ...result.config, model: result.model, videoModel: result.model };
        cancelVideoGenerationTask(config, result.task).catch(() => {});
        pollingLogIdsRef.current.delete(result.id);
        if (result.taskLogId) pollingLogIdsRef.current.delete(result.taskLogId);
        setResults((value) =>
            value.map((item) =>
                item.id === result.id ? { ...item, status: "failed" as const, error: "任务已取消", durationMs: Date.now() - item.createdAt } : item,
            ),
        );
        const log = logsRef.current.find((l) => l.id === result.taskLogId);
        if (log && log.status === "生成中") {
            const nextLog = { ...log, status: "失败" as const, error: "任务已取消", durationMs: Date.now() - log.createdAt, lastPolledAt: Date.now() };
            void saveGenerationLog(nextLog);
            void persistVideoLog(nextLog);
        }
    };

    const retryResult = (result: GenerationResult) => {
        const retryChannelId = videoTaskChannelId(result.task);
        const snapshot = buildRequestSnapshot({ promptText: result.prompt, negativePromptText: result.config.videoNegativePrompt || "", referenceItems: result.references, firstFrameItem: result.firstFrame, lastFrameItem: result.lastFrame, videoReferenceItems: result.videoReferences, audioReferenceItems: result.audioReferences, taskCountValue: 1, configValue: { ...effectiveConfig, ...result.config, ...(retryChannelId ? { videoChannelId: retryChannelId, activeChannelId: retryChannelId } : {}), model: result.model, videoModel: result.model }, modelValue: result.model });
        if (!snapshot) return;
        setResults((value) => value.filter((item) => item.id !== result.id));
        void submitGenerationSnapshot(snapshot);
    };

    const previewGenerationResult = (result: GenerationResult) => {
        setPreviewLog(null);
        setResults((value) => value.filter((item) => item.id !== result.id));
        setPrompt(result.prompt);
        setNegativePrompt(result.config.videoNegativePrompt || "");
        setReferences(result.references || []);
        setFirstFrame(result.firstFrame || null);
        setLastFrame(result.lastFrame || null);
        setVideoReferences(result.videoReferences || []);
        setAudioReferences(result.audioReferences || []);
        const nextModel = result.config.videoModel || result.model;
        const nextChannelId = resolveVideoChannelId(effectiveConfig, nextModel, videoTaskChannelId(result.task), result.config.videoChannelId, result.config.activeChannelId);
        if (nextModel) updateConfig("videoModel", nextModel);
        if (nextChannelId) {
            updateConfig("videoChannelId", nextChannelId);
            updateConfig("activeChannelId", nextChannelId);
        }
        if (result.config.size) updateConfig("size", result.config.size);
        if (result.config.vquality) updateConfig("vquality", result.config.vquality);
        if (result.config.videoSeconds) updateConfig("videoSeconds", result.config.videoSeconds);
        if (result.config.videoMode) updateConfig("videoMode", result.config.videoMode);
        updateConfig("videoMultiShot", result.config.videoMultiShot || "false");
        updateConfig("videoShotType", result.config.videoShotType || "intelligence");
        updateConfig("videoMultiPrompt", normalizeKlingMultiPrompts(result.config.videoMultiPrompt));
        updateConfig("videoElementList", normalizeKlingElementList(result.config.videoElementList));
        updateConfig("videoNegativePrompt", result.config.videoNegativePrompt || "");
        if (result.config.videoGenerateAudio) updateConfig("videoGenerateAudio", result.config.videoGenerateAudio);
        if (result.config.videoWatermark) updateConfig("videoWatermark", result.config.videoWatermark);
        updateConfig("videoCharacterOrientation", normalizeCharacterOrientation(result.config.videoCharacterOrientation));
    };

    const downloadVideo = async (video: GeneratedVideo) => {
        const hideLoading = message.loading("正在下载视频...", 0);
        try {
            saveAs(await downloadRemoteMedia(video.url), "video.mp4");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "视频下载失败");
        } finally {
            hideLoading();
        }
    };

    const syncVideo = async (video: GeneratedVideo, index = 0) => {
        if (isCloudVideo(video)) return video;
        setSyncingVideoIds((ids) => Array.from(new Set([...ids, video.id])));
        const hideLoading = message.loading("正在同步视频到云端存储...", 0);
        try {
            const uploaded = await uploadRemoteMediaToServer(video.url, `video-${index + 1}.mp4`);
            message.success("视频已同步到云端存储");
            return { ...video, url: uploaded.url, storageKey: uploaded.storageKey, width: uploaded.width || video.width, height: uploaded.height || video.height, bytes: uploaded.bytes || video.bytes, mimeType: uploaded.mimeType || video.mimeType };
        } catch (error) {
            message.error(error instanceof Error ? error.message : "视频同步失败");
            return null;
        } finally {
            hideLoading();
            setSyncingVideoIds((ids) => ids.filter((id) => id !== video.id));
        }
    };

    const syncResultVideo = async (resultId: string, video: GeneratedVideo, index: number) => {
        const synced = await syncVideo(video, index);
        if (!synced) return;
        setResults((value) => updateResult(value, resultId, { video: synced }));
    };

    const syncLogVideo = async (log: GenerationLog, video: GeneratedVideo, index: number) => {
        const synced = await syncVideo(video, index);
        if (!synced) return;
        const nextLog = { ...log, video: synced };
        await logStore.setItem(log.id, serializeLog(nextLog));
        const nextLogs = logs.map((item) => (item.id === log.id ? nextLog : item));
        setLogs(nextLogs);
        await persistVideoLog(nextLog);
        if (previewLog?.id === log.id) setPreviewLog(nextLog);
    };

    const saveResultToAssets = (video: GeneratedVideo) => {
        addAsset({
            kind: "video",
            title: "生成视频",
            coverUrl: "",
            tags: [],
            source: "视频创作台",
            data: { url: video.url, storageKey: video.storageKey, width: video.width, height: video.height, bytes: video.bytes, mimeType: video.mimeType },
            metadata: { source: "video-page", prompt },
        });
        message.success("已加入我的素材");
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        const referenceImageLimit = isKlingWorkbench ? 2 : SEEDANCE_REFERENCE_LIMITS.images;
        const insertImage = async () => {
            if (payload.kind !== "image") {
                message.warning("请选择图片素材");
                return;
            }
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: payload.mimeType || "image/*", dataUrl: payload.dataUrl, storageKey: payload.storageKey }].slice(0, referenceImageLimit));
        };
        const insertFrame = (slot: "first" | "last") => {
            if (payload.kind !== "image") {
                message.warning("请选择图片素材");
                return;
            }
            const next = { id: nanoid(), name: payload.title, type: payload.mimeType || "image/*", dataUrl: payload.dataUrl, storageKey: payload.storageKey };
            slot === "first" ? setFirstFrame(next) : setLastFrame(next);
        };
        const insertVideo = () => {
            if (isKlingWorkbench) {
                message.warning("当前 Kling v2.6 不支持参考视频");
                return;
            }
            if (payload.kind !== "video") {
                message.warning("请选择视频素材");
                return;
            }
            setVideoReferences((value) => [...value, { id: nanoid(), name: payload.title, type: payload.mimeType || "video/mp4", url: payload.url, storageKey: payload.storageKey, width: payload.width, height: payload.height, bytes: payload.bytes }].slice(0, SEEDANCE_REFERENCE_LIMITS.videos));
        };
        const insertAudio = () => {
            if (isKlingWorkbench) {
                message.warning("当前 Kling v2.6 不支持参考音频");
                return;
            }
            if (payload.kind !== "audio") {
                message.warning("请选择音频素材");
                return;
            }
            const next = filterAudioReferencesByDuration(audioReferences, [{ id: nanoid(), name: payload.title, type: payload.mimeType || "audio/mpeg", url: payload.url, storageKey: payload.storageKey, durationMs: payload.durationMs }], message.warning);
            setAudioReferences((value) => [...value, ...next].slice(0, SEEDANCE_REFERENCE_LIMITS.audios));
        };

        if (assetPickerTarget === "element") {
            const next = elementReferenceFromAsset(payload);
            if (!next) {
                message.warning("请选择图片、视频或音频素材");
            } else {
                updateElementReferences(elementPickerIndex, (value) => [...value, next]);
            }
        } else if (assetPickerTarget === "firstFrame") {
            insertFrame("first");
        } else if (assetPickerTarget === "lastFrame") {
            insertFrame("last");
        } else if (assetPickerTarget === "image") {
            await insertImage();
        } else if (assetPickerTarget === "video") {
            insertVideo();
        } else if (assetPickerTarget === "audio") {
            insertAudio();
        } else if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            await insertImage();
        } else if (payload.kind === "video") {
            insertVideo();
        } else if (payload.kind === "audio") {
            insertAudio();
        }
        setAssetPickerOpen(false);
    };

    const elementReferenceFromAsset = (payload: InsertAssetPayload): VideoElementReference | null => {
        if (payload.kind === "image") return { id: nanoid(), kind: "image", name: payload.title, type: payload.mimeType || "image/*", dataUrl: payload.dataUrl, storageKey: payload.storageKey, bytes: payload.bytes, width: payload.width, height: payload.height };
        if (payload.kind === "video") return { id: nanoid(), kind: "video", name: payload.title, type: payload.mimeType || "video/mp4", url: payload.url, storageKey: payload.storageKey, bytes: payload.bytes, width: payload.width, height: payload.height };
        if (payload.kind === "audio") return { id: nanoid(), kind: "audio", name: payload.title, type: payload.mimeType || "audio/mpeg", url: payload.url, storageKey: payload.storageKey, durationMs: payload.durationMs };
        return null;
    };

    const createSession = () => {
        setPrompt("");
        setNegativePrompt("");
        setReferences([]);
        setFirstFrame(null);
        setLastFrame(null);
        setVideoReferences([]);
        setAudioReferences([]);
        updateConfig("videoElementList", defaultKlingElementList());
        setResults([]);
        setSelectedLogIds([]);
        setPreviewLog(null);
    };

    const deleteSelectedLogs = () => {
        const selectedLogs = logs.filter((log) => selectedLogIds.includes(log.id));
        const deleteKeys = new Set(selectedLogs.flatMap(videoLogDeleteKeys));
        const deletedLogs = logs.filter((log) => selectedLogIds.includes(log.id) || videoLogDeleteKeys(log).some((key) => deleteKeys.has(key)));
        const nextLogs = logs.filter((log) => !deletedLogs.some((deleted) => deleted.id === log.id));
        const keys = disposableLogStorageKeys(deletedLogs, nextLogs, [firstFrame, lastFrame, ...references].filter((item): item is ReferenceImage => Boolean(item)), [...videoReferences, ...audioReferences], results);
        setLogs(nextLogs);
        logsRef.current = nextLogs;
        setResults((value) => value.filter((item) => !selectedLogIds.includes(item.id) && !selectedLogIds.includes(item.taskLogId || "") && !videoResultIdentityKeys(item).some((key) => deleteKeys.has(key))));
        void Promise.all([deleteBackendVideoTasks(deletedLogs), deleteAccountVideoLogs(deletedLogs), deleteStoredMedia(keys.media), deleteStoredImages(keys.images), ...deletedLogs.map((log) => logStore.removeItem(log.id))]).catch(() => undefined);
        if (previewLog && deletedLogs.some((log) => log.id === previewLog.id)) {
            setPreviewLog(null);
            setResults([]);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
    };

    const deleteBackendVideoTasks = async (items: GenerationLog[]) => {
        const config = effectiveConfigRef.current;
        if (!token || !usesBackendVideoTasks(config)) return;
        await Promise.all(items.filter((item) => item.task && !isLocalClientVideoTask(item.task)).map((item) => deleteVideoGenerationTask(config, item.task).catch(() => undefined)));
    };

    const deleteAccountVideoLogs = async (items: GenerationLog[]) => {
        if (!token) return;
        const ids = Array.from(new Set(items.flatMap(videoLogDeleteKeys)));
        if (!ids.length) return;
        await deleteVideoGenerationLogs(token, ids).catch(() => undefined);
    };

    const loadAccountVideoHistory = async (currentToken: string) => {
        try {
            const localLogs = await readStoredLogs();
            const remoteLogs = await fetchVideoGenerationLogs<GenerationLog>(currentToken);
            const mergedLogs = await mergeVideoLogs(remoteLogs, localLogs);
            await replaceStoredVideoHistory(mergedLogs);
            setLogs(mergedLogs);
            return mergedLogs;
        } catch {
            // Keep local video history available when account sync fails.
            return undefined;
        }
    };

    const persistVideoLog = async (log: GenerationLog) => {
        if (!token || !shouldSyncVideoLog(log)) return;
        await saveVideoGenerationLogs(token, [serializeLog(log)]).catch(() => undefined);
    };

    const saveGenerationLog = async (log: GenerationLog) => {
        await logStore.setItem(log.id, serializeLog(log));
        setLogs((value) => sortVideoLogs([log, ...value.filter((item) => item.id !== log.id)]));
    };

    const finalizeGenerationLog = async (log: GenerationLog) => {
        await saveGenerationLog(log);
        const nextLogs = await readStoredLogs();
        setLogs(nextLogs);
        await persistVideoLog(log);
    };

    const pollPendingLogOnce = async (log: GenerationLog, resumeConfig: AiConfig) => {
        pollingLogIdsRef.current.add(log.id);
        const startedAt = log.createdAt || Date.now();
        try {
            const task = await pollVideoGenerationTaskStatus(resumeConfig, log.task!);
            const durationMs = Date.now() - startedAt;
            const baseLog = { ...log, task, durationMs, lastPolledAt: Date.now() };
            if (isFailedVideoTask(task)) {
                const nextLog = { ...baseLog, status: "失败" as const, error: task.error?.message || "视频生成失败", errorDetail: errorDetail(new VideoRequestError(task.error?.message || "视频生成失败", task)) };
                await finalizeGenerationLog(nextLog);
                setResults((value) => updateResultByLogId(value, log.id, { status: "failed", task, error: nextLog.error, errorDetail: nextLog.errorDetail, durationMs: nextLog.durationMs, lastPolledAt: nextLog.lastPolledAt }));
                return;
            }
            if (isCompletedVideoTask(task)) {
                if (!task.video_url && !task.url) {
                    const nextLog = { ...baseLog, status: "失败" as const, error: "视频生成完成但没有返回视频地址", errorDetail: errorDetail(new VideoRequestError("视频生成完成但没有返回视频地址", task)) };
                    await finalizeGenerationLog(nextLog);
                    setResults((value) => updateResultByLogId(value, log.id, { status: "failed", task, error: nextLog.error, errorDetail: nextLog.errorDetail, durationMs: nextLog.durationMs, lastPolledAt: nextLog.lastPolledAt }));
                    return;
                }
                const video = videoFromTaskResponse(task, durationMs);
                const nextLog = { ...baseLog, status: "成功" as const, video, error: undefined, errorDetail: undefined };
                await finalizeGenerationLog(nextLog);
                setResults((value) => value.filter((item) => item.taskLogId !== log.id && item.id !== log.id));
                return;
            }
            await saveGenerationLog(baseLog);
            setResults((value) => updateResultByLogId(value, log.id, { task, progress: task.progress, durationMs, lastPolledAt: baseLog.lastPolledAt }));
        } catch (error) {
            const nextLog = { ...log, durationMs: Date.now() - startedAt, lastPolledAt: Date.now(), error: errorMessage(error), errorDetail: errorDetail(error) };
            if (isTransientVideoPollError(error)) {
                await saveGenerationLog({ ...nextLog, status: "生成中" });
                setResults((value) => updateResultByLogId(value, log.id, { error: nextLog.error, errorDetail: nextLog.errorDetail, durationMs: nextLog.durationMs, lastPolledAt: nextLog.lastPolledAt }));
                return;
            }
            await finalizeGenerationLog({ ...nextLog, status: "失败" });
            setResults((value) => updateResultByLogId(value, log.id, { status: "failed", error: nextLog.error, errorDetail: nextLog.errorDetail, durationMs: nextLog.durationMs, lastPolledAt: nextLog.lastPolledAt }));
        } finally {
            pollingLogIdsRef.current.delete(log.id);
        }
    };

    const previewGenerationLog = (log: GenerationLog) => {
        setPreviewLog(log);
        setPrompt(log.prompt);
        setNegativePrompt(log.config.videoNegativePrompt || "");
        setReferences(log.references || []);
        setFirstFrame(log.firstFrame || null);
        setLastFrame(log.lastFrame || null);
        setVideoReferences(log.videoReferences || []);
        setAudioReferences(log.audioReferences || []);
        const nextModel = log.config.videoModel || log.model;
        const nextChannelId = resolveVideoChannelId(effectiveConfig, nextModel, videoTaskChannelId(log.task), log.config.videoChannelId, log.config.activeChannelId);
        if (nextModel) updateConfig("videoModel", nextModel);
        if (nextChannelId) {
            updateConfig("videoChannelId", nextChannelId);
            updateConfig("activeChannelId", nextChannelId);
        }
        if (log.config.size) updateConfig("size", log.config.size);
        if (log.config.vquality) updateConfig("vquality", log.config.vquality);
        if (log.config.videoSeconds) updateConfig("videoSeconds", log.config.videoSeconds);
        if (log.config.videoMode) updateConfig("videoMode", log.config.videoMode);
        updateConfig("videoMultiShot", log.config.videoMultiShot || "false");
        updateConfig("videoShotType", log.config.videoShotType || "intelligence");
        updateConfig("videoMultiPrompt", normalizeKlingMultiPrompts(log.config.videoMultiPrompt));
        updateConfig("videoNegativePrompt", log.config.videoNegativePrompt || "");
        if (log.config.videoGenerateAudio) updateConfig("videoGenerateAudio", log.config.videoGenerateAudio);
        if (log.config.videoWatermark) updateConfig("videoWatermark", log.config.videoWatermark);
        updateConfig("videoCharacterOrientation", normalizeCharacterOrientation(log.config.videoCharacterOrientation));
    };

    const retryGenerationLog = (log: GenerationLog) => {
        const retryChannelId = videoTaskChannelId(log.task);
        const snapshot = buildRequestSnapshot({ promptText: log.prompt, negativePromptText: log.config.videoNegativePrompt || "", referenceItems: log.references || [], firstFrameItem: log.firstFrame || null, lastFrameItem: log.lastFrame || null, videoReferenceItems: log.videoReferences || [], audioReferenceItems: log.audioReferences || [], taskCountValue: 1, configValue: { ...effectiveConfig, ...log.config, ...(retryChannelId ? { videoChannelId: retryChannelId, activeChannelId: retryChannelId } : {}), model: log.model, videoModel: log.model }, modelValue: log.model });
        if (!snapshot) return;
        void submitGenerationSnapshot(snapshot);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
            {sourceCanvas ? <div className="shrink-0 bg-violet-50 px-4 py-1.5 text-xs text-violet-600 dark:bg-violet-950 dark:text-violet-300">← 从画布跳转而来，图片已导入为参考图</div> : null}
            <div className="flex shrink-0 items-center gap-2 px-3 py-1.5">
                <Tooltip title="绑定角色，生成时自动注入角色外貌描述和参考图">
                    <Button size="small" className="!rounded-full" onClick={() => setCharacterPickerOpen(true)}><UserRound className="size-3.5 mr-1" />角色{characterIds.length > 0 ? `(${characterIds.length})` : ""}</Button>
                </Tooltip>
                {characterIds.length > 0 && <span className="text-xs text-stone-500">已绑定 {characterIds.length} 个角色，生成时自动注入</span>}
            </div>
            <main className={`${workbenchLayout === "side" ? "grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)]" : "relative flex flex-col"} min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:overflow-hidden`}>
                {workbenchLayout === "side" ? (
                    <>
                        {isKlingWorkbench ? (
                            <KlingV26WorkbenchPanel
                                isKlingV3={klingWorkbenchVariant === "v3"}
                                klingProvider={klingWorkbenchProvider}
                                currentLayout={workbenchLayout}
                                prompt={prompt}
                                negativePrompt={negativePrompt}
                                references={references}
                                config={effectiveConfig}
                                model={model}
                                canGenerate={canGenerate}
                                running={running}
                                pendingCount={pendingCount}
                                taskCount={taskCount}
                                onTaskCountChange={setTaskCount}
                                updateConfig={updateConfig}
                                openConfigDialog={openConfigDialog}
                                onLayoutChange={setWorkbenchLayout}
                                onPromptChange={setPrompt}
                                onNegativePromptChange={(value) => { setNegativePrompt(value); updateConfig("videoNegativePrompt", value); }}
                                onOpenPromptLibrary={() => setPromptDialogOpen(true)}
                                onOpenAssetPicker={openAssetPicker}
                                onPastePrompt={() => void pastePromptFromClipboard()}
                                onClearPrompt={() => setPrompt("")}
                                onPasteReferences={() => void addReferencesFromClipboard()}
                                onUploadReferences={() => fileInputRef.current?.click()}
                                onRemoveReference={(id) => void removeReference(id)}
                                onMoveReference={(index, offset) => setReferences((value) => moveListItem(value, index, offset))}
                                onPasteElementReferences={(index) => void addElementReferencesFromClipboard(index)}
                                onUploadElementReferences={uploadElementReferences}
                                onOpenElementAssetPicker={openElementAssetPicker}
                                onRemoveElementReference={removeElementReference}
                                onMoveElementReference={moveElementReference}
                                onGenerate={() => void generate()}
                            />
                        ) : (
                        <WorkbenchPanel
                            layout="side"
                            currentLayout={workbenchLayout}
                            prompt={prompt}
                            references={references}
                            firstFrame={firstFrame}
                            lastFrame={lastFrame}
                            videoReferences={videoReferences}
                            audioReferences={audioReferences}
                            config={effectiveConfig}
                            model={model}
                            canGenerate={canGenerate}
                            running={running}
                            pendingCount={pendingCount}
                            taskCount={taskCount}
                            onTaskCountChange={setTaskCount}
                            updateConfig={updateConfig}
                            openConfigDialog={openConfigDialog}
                            onLayoutChange={setWorkbenchLayout}
                            onPromptChange={setPrompt}
                            onOpenPromptLibrary={() => setPromptDialogOpen(true)}
                            onOpenAssetPicker={openAssetPicker}
                            onPastePrompt={() => void pastePromptFromClipboard()}
                            onClearPrompt={() => setPrompt("")}
                            onPasteReferences={() => void addReferencesFromClipboard()}
                            onPasteFrame={(slot) => void setFrameFromClipboard(slot)}
                            onPasteVideoReferences={() => void addVideoReferencesFromClipboard()}
                            onPasteAudioReferences={() => void addAudioReferencesFromClipboard()}
                            onUploadReferences={() => fileInputRef.current?.click()}
                            onUploadFrame={(slot) => (slot === "first" ? firstFrameInputRef.current?.click() : lastFrameInputRef.current?.click())}
                            onRemoveFrame={(slot) => void removeFrameReference(slot)}
                            onRemoveReference={(id) => void removeReference(id)}
                            onMoveReference={(index, offset) => setReferences((value) => moveListItem(value, index, offset))}
                            onRemoveVideoReference={(id) => void removeVideoReference(id)}
                            onMoveVideoReference={(index, offset) => setVideoReferences((value) => moveListItem(value, index, offset))}
                            onRemoveAudioReference={(id) => void removeAudioReference(id)}
                            onMoveAudioReference={(index, offset) => setAudioReferences((value) => moveListItem(value, index, offset))}
                            onGenerate={() => void generate()}
                        />
                        )}
                        <ResultsPanel
                            results={results}
                            logs={logs}
                            pendingCount={pendingCount}
                            now={now}
                            selectedLogIds={selectedLogIds}
                            activeLogId={previewLog?.id}
                            onSelectedLogIdsChange={setSelectedLogIds}
                            onCreateSession={createSession}
                            onDeleteSelected={() => setDeleteConfirmOpen(true)}
                            onDeleteLog={(log) => {
                                setSelectedLogIds([log.id]);
                                setDeleteConfirmOpen(true);
                            }}
                            onPreviewLog={previewGenerationLog}
                            onRetryLog={retryGenerationLog}
                            onPreviewResult={previewGenerationResult}
                            onRetryResult={retryResult}
                            onCopyPrompt={(value) => void copyPrompt(value, (content) => message.success(content))}
                            onDownload={downloadVideo}
                            onSyncResult={syncResultVideo}
                            onSyncLog={syncLogVideo}
                            onSaveAsset={saveResultToAssets}
                            onCancel={cancelResult}
                            syncingVideoIds={syncingVideoIds}
                        />
                    </>
                ) : (
                    <>
                        <ResultsPanel
                            className="min-h-[360px] flex-1 pb-40 lg:pb-44"
                            results={results}
                            logs={logs}
                            pendingCount={pendingCount}
                            now={now}
                            selectedLogIds={selectedLogIds}
                            activeLogId={previewLog?.id}
                            onSelectedLogIdsChange={setSelectedLogIds}
                            onCreateSession={createSession}
                            onDeleteSelected={() => setDeleteConfirmOpen(true)}
                            onDeleteLog={(log) => {
                                setSelectedLogIds([log.id]);
                                setDeleteConfirmOpen(true);
                            }}
                            onPreviewLog={previewGenerationLog}
                            onRetryLog={retryGenerationLog}
                            onPreviewResult={previewGenerationResult}
                            onRetryResult={retryResult}
                            onCopyPrompt={(value) => void copyPrompt(value, (content) => message.success(content))}
                            onDownload={downloadVideo}
                            onSyncResult={syncResultVideo}
                            onSyncLog={syncLogVideo}
                            onSaveAsset={saveResultToAssets}
                            onCancel={cancelResult}
                            syncingVideoIds={syncingVideoIds}
                        />
                        <WorkbenchPanel
                            layout="bottom"
                            currentLayout={workbenchLayout}
                            prompt={prompt}
                            negativePrompt={negativePrompt}
                            references={references}
                            firstFrame={firstFrame}
                            lastFrame={lastFrame}
                            videoReferences={videoReferences}
                            audioReferences={audioReferences}
                            config={effectiveConfig}
                            model={model}
                            canGenerate={canGenerate}
                            running={running}
                            pendingCount={pendingCount}
                            taskCount={taskCount}
                            onTaskCountChange={setTaskCount}
                            updateConfig={updateConfig}
                            openConfigDialog={openConfigDialog}
                            onLayoutChange={setWorkbenchLayout}
                            onPromptChange={setPrompt}
                            onNegativePromptChange={(value) => { setNegativePrompt(value); updateConfig("videoNegativePrompt", value); }}
                            onOpenPromptLibrary={() => setPromptDialogOpen(true)}
                            onOpenAssetPicker={openAssetPicker}
                            onPastePrompt={() => void pastePromptFromClipboard()}
                            onClearPrompt={() => setPrompt("")}
                            onPasteReferences={() => void addReferencesFromClipboard()}
                            onPasteFrame={(slot) => void setFrameFromClipboard(slot)}
                            onPasteVideoReferences={() => void addVideoReferencesFromClipboard()}
                            onPasteAudioReferences={() => void addAudioReferencesFromClipboard()}
                            onUploadReferences={() => fileInputRef.current?.click()}
                            onUploadFrame={(slot) => (slot === "first" ? firstFrameInputRef.current?.click() : lastFrameInputRef.current?.click())}
                            onRemoveFrame={(slot) => void removeFrameReference(slot)}
                            onRemoveReference={(id) => void removeReference(id)}
                            onMoveReference={(index, offset) => setReferences((value) => moveListItem(value, index, offset))}
                            onRemoveVideoReference={(id) => void removeVideoReference(id)}
                            onMoveVideoReference={(index, offset) => setVideoReferences((value) => moveListItem(value, index, offset))}
                            onRemoveAudioReference={(id) => void removeAudioReference(id)}
                            onMoveAudioReference={(index, offset) => setAudioReferences((value) => moveListItem(value, index, offset))}
                            onGenerate={() => void generate()}
                            bottomSettingsCollapsed={bottomSettingsCollapsed}
                            setBottomSettingsCollapsed={setBottomSettingsCollapsed}
                        />
                    </>
                )}
            </main>
            <input
                ref={fileInputRef}
                type="file"
                accept={isKlingWorkbench ? "image/*" : "image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"}
                multiple
                className="hidden"
                onChange={(event) => {
                    void addReferences(event.target.files);
                    event.target.value = "";
                }}
            />
            <input
                ref={elementFileInputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"
                multiple
                className="hidden"
                onChange={(event) => {
                    void addElementReferences(elementUploadIndex, event.target.files);
                    event.target.value = "";
                }}
            />
            <input
                ref={firstFrameInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                    void uploadFrameReference("first", event.target.files);
                    event.target.value = "";
                }}
            />
            <input
                ref={lastFrameInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                    void uploadFrameReference("last", event.target.files);
                    event.target.value = "";
                }}
            />
            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />
            <AssetPickerModal open={assetPickerOpen} defaultTab="my-assets" onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />
            <Modal title="删除生成记录" open={deleteConfirmOpen} onCancel={() => setDeleteConfirmOpen(false)} onOk={deleteSelectedLogs} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除选中的 {selectedLogIds.length} 条生成记录吗？
            </Modal>
            {workbenchLayout === "fullscreen" ? (
                <div className="fixed inset-0 z-[140] flex flex-col overflow-hidden bg-stone-50 dark:bg-stone-950">
                    <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
                        <h1 className="text-lg font-semibold text-stone-950 dark:text-stone-100">视频创作台</h1>
                        <Button size="small" icon={<ArrowLeft className="size-4" />} onClick={() => setWorkbenchLayout("side")}>退出全屏</Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        {isKlingWorkbench ? (
                            <KlingV26WorkbenchPanel
                                isKlingV3={klingWorkbenchVariant === "v3"}
                                klingProvider={klingWorkbenchProvider}
                                currentLayout="side"
                                prompt={prompt}
                                negativePrompt={negativePrompt}
                                references={references}
                                config={effectiveConfig}
                                model={model}
                                canGenerate={canGenerate}
                                running={running}
                                pendingCount={pendingCount}
                                taskCount={taskCount}
                                onTaskCountChange={setTaskCount}
                                updateConfig={updateConfig}
                                openConfigDialog={openConfigDialog}
                                onLayoutChange={setWorkbenchLayout}
                                onPromptChange={setPrompt}
                                onNegativePromptChange={(value) => { setNegativePrompt(value); updateConfig("videoNegativePrompt", value); }}
                                onOpenPromptLibrary={() => setPromptDialogOpen(true)}
                                onOpenAssetPicker={openAssetPicker}
                                onPastePrompt={() => void pastePromptFromClipboard()}
                                onClearPrompt={() => setPrompt("")}
                                onPasteReferences={() => void addReferencesFromClipboard()}
                                onUploadReferences={() => fileInputRef.current?.click()}
                                onRemoveReference={(id) => void removeReference(id)}
                                onMoveReference={(index, offset) => setReferences((value) => moveListItem(value, index, offset))}
                                onPasteElementReferences={(index) => void addElementReferencesFromClipboard(index)}
                                onUploadElementReferences={uploadElementReferences}
                                onOpenElementAssetPicker={openElementAssetPicker}
                                onRemoveElementReference={removeElementReference}
                                onMoveElementReference={moveElementReference}
                                onGenerate={() => void generate()}
                            />
                        ) : (
                            <WorkbenchPanel
                                layout="side"
                                currentLayout="side"
                                prompt={prompt}
                                negativePrompt={negativePrompt}
                                references={references}
                                firstFrame={firstFrame}
                                lastFrame={lastFrame}
                                videoReferences={videoReferences}
                                audioReferences={audioReferences}
                                config={effectiveConfig}
                                model={model}
                                canGenerate={canGenerate}
                                running={running}
                                pendingCount={pendingCount}
                                taskCount={taskCount}
                                onTaskCountChange={setTaskCount}
                                updateConfig={updateConfig}
                                openConfigDialog={openConfigDialog}
                                onLayoutChange={setWorkbenchLayout}
                                onPromptChange={setPrompt}
                                onNegativePromptChange={(value) => { setNegativePrompt(value); updateConfig("videoNegativePrompt", value); }}
                                onOpenPromptLibrary={() => setPromptDialogOpen(true)}
                                onOpenAssetPicker={openAssetPicker}
                                onPastePrompt={() => void pastePromptFromClipboard()}
                                onClearPrompt={() => setPrompt("")}
                                onPasteReferences={() => void addReferencesFromClipboard()}
                                onPasteFrame={(slot) => void setFrameFromClipboard(slot)}
                                onPasteVideoReferences={() => void addVideoReferencesFromClipboard()}
                                onPasteAudioReferences={() => void addAudioReferencesFromClipboard()}
                                onUploadReferences={() => fileInputRef.current?.click()}
                                onUploadFrame={(slot) => (slot === "first" ? firstFrameInputRef.current?.click() : lastFrameInputRef.current?.click())}
                                onRemoveFrame={(slot) => void removeFrameReference(slot)}
                                onRemoveReference={(id) => void removeReference(id)}
                                onMoveReference={(index, offset) => setReferences((value) => moveListItem(value, index, offset))}
                                onRemoveVideoReference={(id) => void removeVideoReference(id)}
                                onMoveVideoReference={(index, offset) => setVideoReferences((value) => moveListItem(value, index, offset))}
                                onRemoveAudioReference={(id) => void removeAudioReference(id)}
                                onMoveAudioReference={(index, offset) => setAudioReferences((value) => moveListItem(value, index, offset))}
                                onGenerate={() => void generate()}
                            />
                        )}
                    </div>
                </div>
            ) : null}
            <CharacterPickerModal open={characterPickerOpen} onClose={() => setCharacterPickerOpen(false)} onSelect={(char) => { setCharacterIds((ids) => ids.includes(char.id) ? ids : [...ids, char.id]); setCharacterPickerOpen(false); }} selectedIds={characterIds} />
        </div>
    );
}

function WorkbenchPanel({
    layout,
    currentLayout,
    prompt,
    negativePrompt = "",
    references,
    firstFrame,
    lastFrame,
    videoReferences,
    audioReferences,
    config,
    model,
    canGenerate,
    running,
    pendingCount,
    taskCount,
    onTaskCountChange,
    updateConfig,
    openConfigDialog,
    onLayoutChange,
    onPromptChange,
    onNegativePromptChange,
    onOpenPromptLibrary,
    onOpenAssetPicker,
    onPastePrompt,
    onClearPrompt,
    onPasteReferences,
    onPasteFrame,
    onPasteVideoReferences,
    onPasteAudioReferences,
    onUploadReferences,
    onUploadFrame,
    onRemoveFrame,
    onRemoveReference,
    onMoveReference,
    onRemoveVideoReference,
    onMoveVideoReference,
    onRemoveAudioReference,
    onMoveAudioReference,
    onGenerate,
    bottomSettingsCollapsed = true,
    setBottomSettingsCollapsed,
}: {
    layout: WorkbenchLayout;
    currentLayout: WorkbenchLayout;
    prompt: string;
    negativePrompt?: string;
    references: ReferenceImage[];
    firstFrame: ReferenceImage | null;
    lastFrame: ReferenceImage | null;
    videoReferences: ReferenceVideo[];
    audioReferences: ReferenceAudio[];
    config: AiConfig;
    model: string;
    canGenerate: boolean;
    running: boolean;
    pendingCount: number;
    taskCount: number;
    onTaskCountChange: (value: number) => void;
    updateConfig: UpdateAiConfig;
    openConfigDialog: (shouldPromptContinue?: boolean) => void;
    onLayoutChange: (layout: WorkbenchLayout) => void;
    onPromptChange: (value: string) => void;
    onNegativePromptChange?: (value: string) => void;
    onOpenPromptLibrary: () => void;
    onOpenAssetPicker: (target?: AssetPickerTarget) => void;
    onPastePrompt: () => void;
    onClearPrompt: () => void;
    onPasteReferences: () => void;
    onPasteFrame: (slot: "first" | "last") => void;
    onPasteVideoReferences: () => void;
    onPasteAudioReferences: () => void;
    onUploadReferences: () => void;
    onUploadFrame: (slot: "first" | "last") => void;
    onRemoveFrame: (slot: "first" | "last") => void;
    onRemoveReference: (id: string) => void;
    onMoveReference: (index: number, offset: number) => void;
    onRemoveVideoReference: (id: string) => void;
    onMoveVideoReference: (index: number, offset: number) => void;
    onRemoveAudioReference: (id: string) => void;
    onMoveAudioReference: (index: number, offset: number) => void;
    onGenerate: () => void;
    bottomSettingsCollapsed?: boolean;
    setBottomSettingsCollapsed?: (value: boolean) => void;
}) {
    const frameReferencesEnabled = supportsVideoFrameReferences(model);
    const audioGenerationEnabled = supportsVideoAudioGeneration(model);
    const generateAudio = boolConfig(config.videoGenerateAudio, false);
    const klingBottomConfig = resolveKlingWorkbenchConfig(config, model);
    const klingBottomVariant = klingBottomConfig?.variant || "";
    const klingBottomProvider = klingBottomConfig?.provider || "apimart";
    const klingBottom = Boolean(klingBottomConfig);
    const showAudioSwitch = klingBottom || audioGenerationEnabled;
    const motionControl = isAPIMartKlingMotionControlConfig(config, model) || isKIEKlingMotionControlConfig(config, model);
    const bottomSettingsGridClass = motionControl
        ? showAudioSwitch ? "lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr_0.7fr_auto_auto]" : "lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.8fr_0.7fr_auto_auto]"
        : showAudioSwitch ? "lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.8fr_0.7fr_auto_auto]" : "lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr_0.7fr_auto_auto]";
    const initializedKlingV3BottomSecondsRef = useRef(false);

    useEffect(() => {
        if (klingBottomVariant !== "v3" || initializedKlingV3BottomSecondsRef.current) return;
        initializedKlingV3BottomSecondsRef.current = true;
        if (String(config.videoSeconds || "").trim() === "6") updateConfig("videoSeconds", "3");
    }, [config.videoSeconds, klingBottomVariant, updateConfig]);

    if (layout === "bottom") {
        return (
            <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-5 sm:bottom-7 sm:px-10 lg:px-16">
                <div className="pointer-events-auto w-full max-w-5xl rounded-[24px] bg-white/65 p-4 shadow-[0_32px_100px_rgba(15,23,42,.22),0_10px_34px_rgba(15,23,42,.10)] ring-1 ring-white/50 backdrop-blur-2xl dark:bg-stone-950/60 dark:ring-white/10 dark:shadow-[0_34px_110px_rgba(0,0,0,.58)]">
                    <div className="flex flex-col gap-3">
                        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                            <Input.TextArea
                                value={prompt}
                                onChange={(event) => onPromptChange(event.target.value)}
                                placeholder="描述镜头运动、主体动作、场景氛围和画面风格"
                                autoSize={{ minRows: 2, maxRows: 4 }}
                                className="rounded-2xl"
                                onPressEnter={(event) => {
                                    if (!event.shiftKey && canGenerate) onGenerate();
                                }}
                            />
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                <Button title="清空输入" icon={<Trash2 className="size-4" />} onClick={onClearPrompt} />
                                <Button title="提示词库" icon={<BookOpen className="size-4" />} onClick={onOpenPromptLibrary} />
                                <Button title="我的素材" icon={<FolderPlus className="size-4" />} onClick={() => onOpenAssetPicker()} />
                                <Button title="参数配置" className={`lg:hidden ${!bottomSettingsCollapsed ? "!border-sky-500/30 !bg-sky-500/10 !text-sky-500" : ""}`} icon={<SlidersHorizontal className="size-4" />} onClick={() => setBottomSettingsCollapsed?.(!bottomSettingsCollapsed)} />
                                <Button title="切换到侧边工作台" icon={<PanelLeft className="size-4" />} onClick={() => onLayoutChange("side")} />
                                <Button type="primary" className="h-9 rounded-xl px-4 font-medium lg:!hidden" icon={<Sparkles className="size-4" />} disabled={!canGenerate} onClick={onGenerate}>
                                    {pendingCount ? `${pendingCount} 生成中` : "开始创作"}
                                </Button>
                            </div>
                        </div>
                        {klingBottom && klingBottomProvider !== "kie" ? (
                            <Input.TextArea
                                value={negativePrompt}
                                onChange={(event) => onNegativePromptChange?.(event.target.value)}
                                placeholder="负面提示词"
                                autoSize={{ minRows: 1, maxRows: 3 }}
                                className="rounded-2xl"
                            />
                        ) : null}
                        <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${bottomSettingsGridClass} ${bottomSettingsCollapsed ? "hidden lg:grid" : "grid"}`}>
                            <label className="grid gap-1 text-xs text-stone-500 dark:text-stone-400">
                                模型
                                <ModelPicker config={config} value={model} channelId={config.videoChannelId} onChange={(value, channelId) => { updateConfig("videoModel", value); if (channelId) updateConfig("videoChannelId", channelId); }} capability="video" className="canvas-compact-control !h-11 !rounded-xl" onMissingConfig={() => openConfigDialog(false)} fullWidth />
                            </label>
                            {klingBottom ? (
                                <KlingV26BottomSettings config={config} updateConfig={updateConfig} generateAudio={generateAudio} isKlingV3={klingBottomVariant === "v3"} />
                            ) : (
                                <>
                                    <QuickSelect label="清晰度" value={normalizeVideoResolutionValue(config.vquality)} options={quickResolutionOptions} onChange={(value) => updateConfig("vquality", value)} />
                                    <QuickSelect label="尺寸" value={normalizeVideoSizeValue(config.size)} options={quickSizeOptions} onChange={(value) => updateConfig("size", value)} />
                                    <QuickNumber label="秒数" value={normalizeVideoSeconds(config.videoSeconds)} min={1} max={30} onChange={(value) => updateConfig("videoSeconds", value)} />
                                    {audioGenerationEnabled ? <QuickSwitch label="生成音频" checked={generateAudio} onChange={(checked) => updateConfig("videoGenerateAudio", String(checked))} /> : null}
                                    {motionControl ? <QuickSelect label="角色朝向参考" value={normalizeCharacterOrientation(config.videoCharacterOrientation)} options={characterOrientationOptions} onChange={(value) => updateConfig("videoCharacterOrientation", value)} /> : null}
                                </>
                            )}
                            <QuickNumber label="任务" value={String(taskCount)} min={1} max={6} onChange={(value) => onTaskCountChange(normalizeVideoCount(value))} />
                            <ReferenceQuickActions imageCount={references.length} videoCount={videoReferences.length} audioCount={audioReferences.length} onPasteReferences={onPasteReferences} onUploadReferences={onUploadReferences} />
                            <Button type="primary" className="hidden h-11 min-w-28 items-center justify-center gap-1.5 rounded-xl lg:flex" icon={<Sparkles className="size-4" />} disabled={!canGenerate} onClick={onGenerate}>
                                {pendingCount ? `${pendingCount} 生成中` : "开始创作"}
                            </Button>
                        </div>
                        {firstFrame || lastFrame || references.length || videoReferences.length || audioReferences.length ? (
                            <div className="grid gap-2">
                                {firstFrame || lastFrame ? <FrameReferenceStrip firstFrame={firstFrame} lastFrame={lastFrame} compact onUploadFrame={onUploadFrame} onRemoveFrame={onRemoveFrame} /> : null}
                                {references.length ? <ReferenceImageStrip references={references} compact onRemoveReference={onRemoveReference} onMoveReference={onMoveReference} /> : null}
                                {videoReferences.length ? <ReferenceVideoStrip references={videoReferences} compact onRemoveReference={onRemoveVideoReference} onMoveReference={onMoveVideoReference} /> : null}
                                {audioReferences.length ? <ReferenceAudioStrip references={audioReferences} compact onRemoveReference={onRemoveAudioReference} onMoveReference={onMoveAudioReference} /> : null}
                            </div>
                        ) : null}
                        <div className="pt-2">
                            <TTSPanel />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-stone-200 bg-card shadow-sm dark:border-stone-800 lg:min-h-0">
            <div className="shrink-0 p-4 pb-3">
                <WorkbenchHeader currentLayout={currentLayout} onLayoutChange={onLayoutChange} />
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
                <WorkbenchSection title="提示词">
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                            <Button size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={onPastePrompt}>读取剪贴板</Button>
                            <Button size="small" icon={<Trash2 className="size-3.5" />} onClick={onClearPrompt}>清空</Button>
                            <Button size="small" icon={<BookOpen className="size-3.5" />} onClick={onOpenPromptLibrary}>提示词库</Button>
                            <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onOpenAssetPicker()}>我的素材</Button>
                        </div>
                        <Input.TextArea value={prompt} onChange={(event) => onPromptChange(event.target.value)} rows={6} placeholder="描述镜头运动、主体动作、场景氛围和画面风格" />
                    </div>
                </WorkbenchSection>
                {frameReferencesEnabled ? (
                    <WorkbenchSection title="首尾帧" count={[firstFrame, lastFrame].filter(Boolean).length}>
                        <FrameReferenceStrip firstFrame={firstFrame} lastFrame={lastFrame} onPasteFrame={onPasteFrame} onUploadFrame={onUploadFrame} onOpenAssetPicker={onOpenAssetPicker} onRemoveFrame={onRemoveFrame} />
                    </WorkbenchSection>
                ) : null}
                <WorkbenchSection title="参考图" count={references.length}>
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                            <Button size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={onPasteReferences}>剪切板</Button>
                            <Button size="small" icon={<Upload className="size-3.5" />} onClick={onUploadReferences}>上传</Button>
                            <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onOpenAssetPicker("image")}>从素材库选择</Button>
                        </div>
                        <ReferenceImageStrip references={references} onRemoveReference={onRemoveReference} onMoveReference={onMoveReference} />
                    </div>
                </WorkbenchSection>
                <WorkbenchSection title="参考视频" count={videoReferences.length}>
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                            <Button size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={onPasteVideoReferences}>剪贴板</Button>
                            <Button size="small" icon={<Upload className="size-3.5" />} onClick={onUploadReferences}>上传</Button>
                            <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onOpenAssetPicker("video")}>从素材库选择</Button>
                        </div>
                        <ReferenceVideoStrip references={videoReferences} onRemoveReference={onRemoveVideoReference} onMoveReference={onMoveVideoReference} />
                    </div>
                </WorkbenchSection>
                <WorkbenchSection title="参考音频" count={audioReferences.length}>
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                            <Button size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={onPasteAudioReferences}>剪贴板</Button>
                            <Button size="small" icon={<Upload className="size-3.5" />} onClick={onUploadReferences}>上传</Button>
                            <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onOpenAssetPicker("audio")}>从素材库选择</Button>
                        </div>
                        <ReferenceAudioStrip references={audioReferences} onRemoveReference={onRemoveAudioReference} onMoveReference={onMoveAudioReference} />
                    </div>
                </WorkbenchSection>
                <WorkbenchSection title="AI 配音">
                    <TTSPanel />
                </WorkbenchSection>
                {motionControl ? <CharacterOrientationSetting value={config.videoCharacterOrientation} onChange={(value) => updateConfig("videoCharacterOrientation", value)} /> : null}
                <GenerationSettings config={config} model={model} updateConfig={updateConfig} openConfigDialog={openConfigDialog} />
                <WorkbenchSection title="任务数量">
                    <TaskCountControl value={taskCount} onChange={onTaskCountChange} />
                </WorkbenchSection>
            </div>
            <div className="shrink-0 border-t border-stone-200 p-4 dark:border-stone-800">
                <Button type="primary" size="large" block icon={<Sparkles className="size-4" />} disabled={!canGenerate} onClick={onGenerate}>
                    {pendingCount ? `生成中（${pendingCount}）` : "开始生成"}
                </Button>
            </div>
        </div>
    );
}

function WorkbenchHeader({ currentLayout, onLayoutChange }: { currentLayout: WorkbenchLayout; onLayoutChange: (layout: WorkbenchLayout) => void }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-stone-950 dark:text-stone-100">视频创作台</h1>
            <div className="flex shrink-0 rounded-lg border border-stone-200 bg-stone-50 p-1 dark:border-stone-800 dark:bg-stone-900">
                <Button size="small" type={currentLayout === "side" ? "primary" : "text"} icon={<PanelLeft className="size-3.5" />} onClick={() => onLayoutChange("side")}>侧边</Button>
                <Button size="small" type={currentLayout === "bottom" ? "primary" : "text"} icon={<PanelBottom className="size-3.5" />} onClick={() => onLayoutChange("bottom")}>底部</Button>
                <Button size="small" type={currentLayout === "fullscreen" ? "primary" : "text"} icon={<Maximize2 className="size-3.5" />} onClick={() => onLayoutChange("fullscreen")}>全屏</Button>
            </div>
        </div>
    );
}

function WorkbenchSection({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-sm font-medium">{title}</span>
                {typeof count === "number" ? <Tag className="m-0 text-xs">{count}</Tag> : null}
            </div>
            <div className="space-y-2 border-t border-stone-200 p-3 dark:border-stone-800">{children}</div>
        </section>
    );
}

function FrameReferenceStrip({ firstFrame, lastFrame, compact = false, onPasteFrame, onUploadFrame, onOpenAssetPicker, onRemoveFrame }: { firstFrame: ReferenceImage | null; lastFrame: ReferenceImage | null; compact?: boolean; onPasteFrame?: (slot: "first" | "last") => void; onUploadFrame: (slot: "first" | "last") => void; onOpenAssetPicker?: (target?: AssetPickerTarget) => void; onRemoveFrame: (slot: "first" | "last") => void }) {
    if (!compact) {
        return (
            <div className="space-y-2">
                <FrameReferenceRow label="首帧" slot="first" reference={firstFrame} onPasteFrame={onPasteFrame} onUploadFrame={onUploadFrame} onOpenAssetPicker={onOpenAssetPicker} onRemoveFrame={onRemoveFrame} />
                <FrameReferenceRow label="尾帧" slot="last" reference={lastFrame} onPasteFrame={onPasteFrame} onUploadFrame={onUploadFrame} onOpenAssetPicker={onOpenAssetPicker} onRemoveFrame={onRemoveFrame} />
            </div>
        );
    }
    return (
        <div className={`grid grid-cols-2 gap-2 rounded-lg border border-dashed border-stone-300 p-2 dark:border-stone-700 ${compact ? "min-h-14" : "min-h-24"}`}>
            <FrameReferenceSlot label="首帧" reference={firstFrame} compact={compact} onUpload={() => onUploadFrame("first")} onRemove={() => onRemoveFrame("first")} />
            <FrameReferenceSlot label="尾帧" reference={lastFrame} compact={compact} onUpload={() => onUploadFrame("last")} onRemove={() => onRemoveFrame("last")} />
        </div>
    );
}

function FrameReferenceRow({ label, slot, reference, onPasteFrame, onUploadFrame, onOpenAssetPicker, onRemoveFrame }: { label: string; slot: "first" | "last"; reference: ReferenceImage | null; onPasteFrame?: (slot: "first" | "last") => void; onUploadFrame: (slot: "first" | "last") => void; onOpenAssetPicker?: (target?: AssetPickerTarget) => void; onRemoveFrame: (slot: "first" | "last") => void }) {
    return (
        <div className="space-y-2 rounded-lg border border-dashed border-stone-300 p-2 dark:border-stone-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-300">{label}</span>
                <div className="flex flex-wrap gap-1">
                    <Button size="small" icon={<ClipboardPaste className="size-3.5" />} onClick={() => onPasteFrame?.(slot)}>读取剪贴板</Button>
                    <Button size="small" icon={<Upload className="size-3.5" />} onClick={() => onUploadFrame(slot)}>上传</Button>
                    <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onOpenAssetPicker?.(slot === "first" ? "firstFrame" : "lastFrame")}>从素材库选择</Button>
                </div>
            </div>
            <FrameReferenceSlot label={label} reference={reference} compact={false} onUpload={() => onUploadFrame(slot)} onRemove={() => onRemoveFrame(slot)} />
        </div>
    );
}

function FrameReferenceSlot({ label, reference, compact, onUpload, onRemove }: { label: string; reference: ReferenceImage | null; compact: boolean; onUpload: () => void; onRemove: () => void }) {
    return (
        <div className={`group relative flex min-w-0 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50 text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-900 ${compact ? "h-12" : "h-20"}`}>
            {reference ? (
                <>
                    <img src={reference.dataUrl} alt={reference.name} className="size-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{label}</span>
                    <span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">{reference.name}</span>
                    <button type="button" className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex" onClick={onRemove} aria-label={`移除${label}`}>
                        <Trash2 className="size-3.5" />
                    </button>
                </>
            ) : (
                <button type="button" className="flex size-full items-center justify-center gap-1" onClick={onUpload}>
                    <Upload className="size-3.5" />
                    上传{label}
                </button>
            )}
        </div>
    );
}

function ReferenceImageStrip({ references, compact = false, onRemoveReference, onMoveReference }: { references: ReferenceImage[]; compact?: boolean; onRemoveReference: (id: string) => void; onMoveReference: (index: number, offset: number) => void }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const handleDragEnd = (event: import("@dnd-kit/core").DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = references.findIndex((r) => r.id === active.id);
        const newIndex = references.findIndex((r) => r.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        onMoveReference(oldIndex, newIndex - oldIndex);
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={references.map((r) => r.id)} strategy={horizontalListSortingStrategy}>
                <div className={`hover-scrollbar hover-scrollbar-hint flex w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 overscroll-x-contain dark:border-stone-700 ${compact ? "min-h-14" : "min-h-24 pb-3"}`}>
                    {references.map((item, index) => (
                        <SortableReferenceImageItem
                            key={item.id}
                            item={item}
                            index={index}
                            total={references.length}
                            compact={compact}
                            onRemove={onRemoveReference}
                        />
                    ))}
                    {!references.length ? <div className="flex min-w-full items-center justify-center text-sm text-stone-500">暂无参考图，最多 9 张</div> : null}
                </div>
            </SortableContext>
        </DndContext>
    );
}

function ReferenceVideoStrip({ references, compact = false, onRemoveReference, onMoveReference }: { references: ReferenceVideo[]; compact?: boolean; onRemoveReference: (id: string) => void; onMoveReference: (index: number, offset: number) => void }) {
    return (
        <div className={`hover-scrollbar hover-scrollbar-hint flex w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 overscroll-x-contain dark:border-stone-700 ${compact ? "min-h-14" : "min-h-24 pb-3"}`}>
            {references.map((item, index) => (
                <div key={item.id} className={`${compact ? "h-12 w-20" : "h-20 w-32"} group relative shrink-0 overflow-hidden rounded-md border border-stone-200 bg-black dark:border-stone-800`}>
                    <video src={item.url} className="size-full object-cover" muted preload="metadata" />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{seedanceReferenceLabel("video", index)}</span>
                    <ReferenceOrderButtons index={index} total={references.length} onMove={(offset) => onMoveReference(index, offset)} />
                    <button type="button" className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex" onClick={() => onRemoveReference(item.id)} aria-label="移除参考视频">
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            ))}
            {!references.length ? <div className="flex min-w-full items-center justify-center text-sm text-stone-500">暂无参考视频，最多 3 个</div> : null}
        </div>
    );
}

function ReferenceAudioStrip({ references, compact = false, onRemoveReference, onMoveReference }: { references: ReferenceAudio[]; compact?: boolean; onRemoveReference: (id: string) => void; onMoveReference: (index: number, offset: number) => void }) {
    return (
        <div className={`hover-scrollbar hover-scrollbar-hint flex w-full min-w-0 max-w-full gap-2 overflow-x-scroll overflow-y-hidden rounded-lg border border-dashed border-stone-300 p-2 overscroll-x-contain dark:border-stone-700 ${compact ? "min-h-14" : "min-h-24 pb-3"}`}>
            {references.map((item, index) => (
                <div key={item.id} className={`${compact ? "h-12 w-40" : "h-20 w-48"} group relative flex shrink-0 flex-col justify-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2 dark:border-stone-800 dark:bg-stone-900`}>
                    <div className="flex min-w-0 items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <Music2 className="size-4 shrink-0" />
                        <span className="shrink-0 rounded bg-stone-200 px-1 text-[10px] text-stone-700 dark:bg-stone-800 dark:text-stone-200">{seedanceReferenceLabel("audio", index)}</span>
                        <span className="truncate">{item.name}</span>
                    </div>
                    {!compact ? <audio src={item.url} controls className="h-8 w-full" preload="metadata" /> : null}
                    <ReferenceOrderButtons index={index} total={references.length} onMove={(offset) => onMoveReference(index, offset)} />
                    <button type="button" className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex" onClick={() => onRemoveReference(item.id)} aria-label="移除参考音频">
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            ))}
            {!references.length ? <div className="flex min-w-full items-center justify-center text-center text-sm text-stone-500">暂无参考音频，最多 3 个，mp3/wav，单个 15MB 内</div> : null}
        </div>
    );
}

function ReferenceQuickActions({ imageCount, videoCount, audioCount, onPasteReferences, onUploadReferences }: { imageCount: number; videoCount: number; audioCount: number; onPasteReferences: () => void; onUploadReferences: () => void }) {
    return (
        <div className="flex h-11 items-center gap-1 rounded-xl border border-stone-200 bg-background px-2 dark:border-stone-800">
            {imageCount || videoCount || audioCount ? <span className="min-w-7 text-xs text-stone-500">{imageCount + videoCount + audioCount} 个</span> : null}
            <Button title="读取剪切板" size="small" type="text" icon={<ClipboardPaste className="size-3.5" />} onClick={onPasteReferences} />
            <Button title="上传参考素材" size="small" type="text" icon={<Upload className="size-3.5" />} onClick={onUploadReferences} />
        </div>
    );
}

function TaskCountControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
    return (
        <label className="flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-background px-3 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
            <span className="shrink-0">任务</span>
            <input className="h-7 w-16 rounded-lg border border-stone-200 bg-background px-2 text-sm text-stone-900 outline-none dark:border-stone-800 dark:text-stone-100" type="number" min={1} max={6} value={value} onChange={(event) => onChange(normalizeVideoCount(event.target.value))} />
        </label>
    );
}

function CharacterOrientationSetting({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const current = normalizeCharacterOrientation(value);
    return (
        <WorkbenchSection title="角色朝向参考">
            <div className="grid grid-cols-2 gap-2.5">
                {characterOrientationOptions.map((item) => (
                    <button key={item.value} type="button" className={optionPillClass(current === item.value)} onClick={() => onChange(item.value)}>
                        {item.label}
                    </button>
                ))}
            </div>
        </WorkbenchSection>
    );
}

function optionPillClass(active: boolean) {
    return [
        "h-9 rounded-full border bg-transparent px-2 text-sm font-medium transition hover:opacity-80",
        active ? "border-stone-950 text-stone-950 dark:border-stone-100 dark:text-stone-100" : "border-stone-200 text-stone-700 dark:border-stone-800 dark:text-stone-200",
    ].join(" ");
}

function QuickSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
    return (
        <label className="grid gap-1 text-xs text-stone-500 dark:text-stone-400">
            {label}
            <select className="h-11 min-w-0 rounded-xl border border-stone-200 bg-background px-3 text-sm text-stone-900 outline-none dark:border-stone-800 dark:text-stone-100" value={value} onChange={(event) => onChange(event.target.value)}>
                {options.map((item) => (
                    <option key={item.value} value={item.value}>
                        {item.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function QuickNumber({ label, value, min, max, onChange, clampOnChange = true }: { label: string; value: string; min: number; max: number; onChange: (value: string) => void; clampOnChange?: boolean }) {
    return (
        <label className="grid gap-1 text-xs text-stone-500 dark:text-stone-400">
            {label}
            <input className="h-11 min-w-0 rounded-xl border border-stone-200 bg-background px-3 text-sm text-stone-900 outline-none dark:border-stone-800 dark:text-stone-100" type="number" min={min} max={max} value={value} onChange={(event) => onChange(clampOnChange ? clampQuickNumberValue(event.target.value, min, max) : event.target.value)} onBlur={(event) => onChange(clampQuickNumberValue(event.target.value, min, max))} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
        </label>
    );
}

function clampQuickNumberValue(value: string, min: number, max: number) {
    const number = Math.floor(Number(value) || min);
    return String(Math.max(min, Math.min(max, number)));
}

function KlingV26BottomSettings({ config, updateConfig, generateAudio, isKlingV3 }: { config: AiConfig; updateConfig: UpdateAiConfig; generateAudio: boolean; isKlingV3: boolean }) {
    const mode = isKlingV3 && config.videoMode === "4k" ? "4k" : config.videoMode === "pro" ? "pro" : "std";
    const modeOptions = isKlingV3 ? [{ value: "std", label: "720P" }, { value: "pro", label: "1080P" }, { value: "4k", label: "4K" }] : [{ value: "std", label: "标准(720P 无声)" }, { value: "pro", label: "专业(1080P 音频)" }];
    return (
        <>
            <QuickSelect label="模式选择" value={mode} options={modeOptions} onChange={(value) => updateConfig("videoMode", value)} />
            <QuickSelect label="尺寸" value={klingBottomSizeValue(config.size)} options={[{ value: "16:9", label: "16:9" }, { value: "9:16", label: "9:16" }, { value: "1:1", label: "1:1" }]} onChange={(value) => updateConfig("size", value === "1:1" ? "1024x1024" : value)} />
            <QuickNumber label="秒数" value={isKlingV3 ? String(config.videoSeconds ?? "") : normalizeKlingV26Seconds(config.videoSeconds)} min={isKlingV3 ? 3 : 5} max={isKlingV3 ? 15 : 10} onChange={(value) => updateConfig("videoSeconds", isKlingV3 ? value : normalizeKlingV26Seconds(value))} clampOnChange={!isKlingV3} />
            <QuickSwitch label="生成音频" checked={generateAudio} onChange={(checked) => updateConfig("videoGenerateAudio", String(checked))} />
        </>
    );
}


function QuickSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="grid gap-1 text-xs text-stone-500 dark:text-stone-400">
            {label}
            <span className="flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-background px-3 dark:border-stone-800">
                <Switch size="small" checked={checked} onChange={onChange} />
            </span>
        </label>
    );
}

function GenerationSettings({ config, model, updateConfig, openConfigDialog }: { config: AiConfig; model: string; updateConfig: UpdateAiConfig; openConfigDialog: (shouldPromptContinue?: boolean) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <div className="space-y-3">
            <WorkbenchSection title="模型">
                <ModelPicker config={config} value={model} channelId={config.videoChannelId} onChange={(value, channelId) => { updateConfig("videoModel", value); if (channelId) updateConfig("videoChannelId", channelId); }} capability="video" fullWidth onMissingConfig={() => openConfigDialog(false)} />
            </WorkbenchSection>
            <VideoSettingsPanel config={config} modelName={model} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} className="space-y-3" />
        </div>
    );
}

function ResultsPanel({
    className = "",
    results,
    logs,
    pendingCount,
    now,
    selectedLogIds,
    activeLogId,
    onSelectedLogIdsChange,
    onCreateSession,
    onDeleteSelected,
    onDeleteLog,
    onPreviewLog,
    onRetryLog,
    onPreviewResult,
    onRetryResult,
    onCopyPrompt,
    onDownload,
    onSyncResult,
    onSyncLog,
    onSaveAsset,
    onCancel,
    syncingVideoIds,
}: {
    className?: string;
    results: GenerationResult[];
    logs: GenerationLog[];
    pendingCount: number;
    now: number;
    selectedLogIds: string[];
    activeLogId?: string;
    onSelectedLogIdsChange: (ids: string[]) => void;
    onCreateSession: () => void;
    onDeleteSelected: () => void;
    onDeleteLog: (log: GenerationLog) => void;
    onPreviewLog: (log: GenerationLog) => void;
    onRetryLog: (log: GenerationLog) => void;
    onPreviewResult: (result: GenerationResult) => void;
    onRetryResult: (result: GenerationResult) => void;
    onCopyPrompt: (text: string) => void | Promise<void>;
    onDownload: (video: GeneratedVideo) => void;
    onSyncResult: (resultId: string, video: GeneratedVideo, index: number) => void;
    onSyncLog: (log: GenerationLog, video: GeneratedVideo, index: number) => void;
    onSaveAsset: (video: GeneratedVideo) => void;
    onCancel: (result: GenerationResult) => void;
    syncingVideoIds: string[];
}) {
    const visibleResults = results.filter((result) => result.status !== "failed" || pendingCount > 0);
    const liveResultKeys = new Set(visibleResults.flatMap(videoResultIdentityKeys));
    const liveLogIds = new Set(visibleResults.flatMap((result) => [result.taskLogId, result.id]).filter((id): id is string => Boolean(id)));
    const visibleLogs = logs.filter((log) => !liveLogIds.has(log.id) && !videoLogIdentityKeys(log).some((key) => liveResultKeys.has(key)));
    const totalCount = visibleResults.length + visibleLogs.length;
    const allSelected = Boolean(visibleLogs.length) && visibleLogs.every((log) => selectedLogIds.includes(log.id));
    const toggleVisibleLogs = () => onSelectedLogIdsChange(allSelected ? selectedLogIds.filter((id) => !visibleLogs.some((log) => log.id === id)) : Array.from(new Set([...selectedLogIds, ...visibleLogs.map((log) => log.id)])));

    return (
        <section className={`thin-scrollbar rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800 lg:min-h-0 lg:overflow-y-auto lg:p-5 ${className}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <HistoryIcon />
                    <h2 className="truncate text-xl font-semibold">全部成果</h2>
                    <Tag className="m-0">{totalCount}</Tag>
                    {pendingCount ? <Tag className="m-0 px-2 py-1">{pendingCount} 个生成中</Tag> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button size="small" icon={<Plus className="size-3.5" />} onClick={onCreateSession}>新建</Button>
                    <Button size="small" icon={<CheckSquare className="size-3.5" />} disabled={!visibleLogs.length} onClick={toggleVisibleLogs}>{allSelected ? "取消" : "全选"}</Button>
                    <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedLogIds.length} onClick={onDeleteSelected}>删除</Button>
                </div>
            </div>
            {totalCount ? (
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {visibleResults.map((result, index) => (result.status === "success" && result.video ? <ResultVideoCard key={result.id} result={result} video={result.video} index={index} syncing={syncingVideoIds.includes(result.video.id)} onCopyPrompt={onCopyPrompt} onDownload={onDownload} onSync={(video) => onSyncResult(result.id, video, index)} onSaveAsset={onSaveAsset} /> : result.status === "failed" ? <FailedVideoCard key={result.id} result={result} error={result.error || "生成失败"} onCopyPrompt={onCopyPrompt} onPreview={() => onPreviewResult(result)} onRetry={() => onRetryResult(result)} /> : <PendingVideoCard key={result.id} result={result} now={now} onCopyPrompt={onCopyPrompt} onCancel={onCancel} />))}
                    {visibleLogs.map((log, index) => (
                        <HistoryLogCard key={log.id} log={log} index={index} selected={selectedLogIds.includes(log.id)} active={activeLogId === log.id} syncing={Boolean(log.video && syncingVideoIds.includes(log.video.id))} onSelectedChange={(checked) => onSelectedLogIdsChange(checked ? [...selectedLogIds, log.id] : selectedLogIds.filter((id) => id !== log.id))} onDelete={() => onDeleteLog(log)} onPreview={() => onPreviewLog(log)} onRetry={() => onRetryLog(log)} onCopyPrompt={onCopyPrompt} onDownload={onDownload} onSync={(video) => onSyncLog(log, video, index)} onSaveAsset={onSaveAsset} />
                    ))}
                </div>
            ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 text-center dark:border-stone-700 lg:min-h-[560px]">
                    <VideoIcon className="mb-4 size-11 text-stone-400" />
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有生成视频" />
                </div>
            )}
        </section>
    );
}

function HistoryIcon() {
    return <History className="size-4 shrink-0 text-stone-400" />;
}

function ResultVideoCard({ result, video, index, syncing, onCopyPrompt, onDownload, onSync, onSaveAsset }: { result: GenerationResult; video: GeneratedVideo; index: number; syncing: boolean; onCopyPrompt: (text: string) => void | Promise<void>; onDownload: (video: GeneratedVideo) => void; onSync: (video: GeneratedVideo) => void; onSaveAsset: (video: GeneratedVideo) => void }) {
    const [poster, setPoster] = useState("");
    const posterSetRef = useRef(false);
    useEffect(() => {
        if (posterSetRef.current || !video.url) return;
        posterSetRef.current = true;
        getVideoThumbnail(video.url).then((u) => { if (u) setPoster(u); }).catch(() => {});
    }, [video.url]);
    return (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <div className="relative aspect-video bg-black">
                <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">
                    <VideoSourceTag video={video} />
                    <Tag className="m-0 text-[10px]" color="blue">成功</Tag>
                </div>
                <ReferenceThumbnailOverlay references={result.references} className="left-1.5 top-1.5" />
                <video src={video.url} controls className="size-full object-contain" poster={poster || undefined} />
            </div>
            <TaskInfo item={result} onCopyPrompt={onCopyPrompt} />
            <VideoMetaBar video={video} index={index} syncing={syncing} onDownload={onDownload} onSync={onSync} onSaveAsset={onSaveAsset} />
        </div>
    );
}

function PendingVideoCard({ result, now, onCopyPrompt, onCancel }: { result: GenerationResult; now: number; onCopyPrompt: (text: string) => void | Promise<void>; onCancel?: (result: GenerationResult) => void }) {
    const progress = typeof result.progress === "number" ? Math.max(0, Math.min(100, Math.floor(result.progress))) : null;
    const durationMs = Math.max(0, now - result.createdAt);
    return (
        <div className="overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <div className="relative aspect-video">
                <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle, rgba(120,113,108,0.35) 1.4px, transparent 1.6px)", backgroundSize: "16px 16px" }} />
                {onCancel ? (
                    <button
                        type="button"
                        className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-full bg-white/80 text-stone-500 shadow-sm transition hover:bg-red-100 hover:text-red-500"
                        title="取消任务"
                        onClick={(e) => { e.stopPropagation(); onCancel(result); }}
                    >
                        <StopCircle className="size-4" />
                    </button>
                ) : null}
                <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle, rgba(120,113,108,0.35) 1.4px, transparent 1.6px)", backgroundSize: "16px 16px" }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                    <LoaderCircle className="size-6 animate-spin" />
                    {progress !== null ? <span className="animate-pulse font-semibold text-sky-500">正在创作 {progress}%</span> : <span>生成中</span>}
                    <span className="rounded-full bg-white/80 px-2 py-1 text-xs text-stone-600 shadow-sm dark:bg-stone-950/70 dark:text-stone-300">{formatDuration(durationMs)}</span>
                </div>
                {progress !== null ? (
                    <div className="absolute inset-x-4 bottom-4 z-10 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px] font-medium text-stone-500 dark:text-stone-400">
                            <span>当前创作进度</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                            <div className="h-full rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)] transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                ) : null}
            </div>
            <TaskInfo item={{ ...result, durationMs }} onCopyPrompt={onCopyPrompt} />
        </div>
    );
}

function FailedVideoCard({ result, error, onCopyPrompt, onPreview, onRetry }: { result: GenerationResult; error: string; onCopyPrompt: (text: string) => void | Promise<void>; onPreview: () => void; onRetry: () => void }) {
    const [detailOpen, setDetailOpen] = useState(false);
    const detail = result.errorDetail || error;
    return (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <div className="relative flex aspect-video flex-col items-center justify-center gap-3 p-5 text-center">
                <ReferenceThumbnailOverlay references={result.references} className="left-1.5 top-1.5" />
                <AlertCircle className="size-7 text-red-500" />
                <div className="text-sm font-medium text-red-600 dark:text-red-300">生成失败</div>
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
            <TaskInfo item={result} error={error} onCopyPrompt={onCopyPrompt} />
            <div className="flex justify-between gap-2 border-t border-red-200 p-3 dark:border-red-950">
                <Button size="small" onClick={onPreview}>载入</Button>
                <div className="flex gap-2">
                    <Button size="small" onClick={() => setDetailOpen(true)}>详情</Button>
                    <Button size="small" danger onClick={onRetry}>重试</Button>
                </div>
            </div>
            <Modal title="失败详情" open={detailOpen} width={760} onCancel={() => setDetailOpen(false)} footer={null}>
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-stone-950 p-3 text-xs text-stone-100">{detail}</pre>
            </Modal>
        </div>
    );
}

function HistoryLogCard({ log, index, selected, active, syncing, onSelectedChange, onDelete, onPreview, onRetry, onCopyPrompt, onDownload, onSync, onSaveAsset }: { log: GenerationLog; index: number; selected: boolean; active: boolean; syncing: boolean; onSelectedChange: (checked: boolean) => void; onDelete: () => void; onPreview: () => void; onRetry: () => void; onCopyPrompt: (text: string) => void | Promise<void>; onDownload: (video: GeneratedVideo) => void; onSync: (video: GeneratedVideo) => void; onSaveAsset: (video: GeneratedVideo) => void }) {
    const [expanded, setExpanded] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    return (
        <div className={`overflow-hidden rounded-lg border bg-background dark:bg-stone-950 ${active ? "border-stone-900 dark:border-stone-100" : "border-stone-200 dark:border-stone-800"}`}>
            <div className="relative aspect-video bg-stone-100 dark:bg-stone-900">
                <div className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded-md bg-white/85 px-1.5 py-1 shadow-sm dark:bg-stone-950/80">
                    <Checkbox checked={selected} onChange={(event) => onSelectedChange(event.target.checked)} />
                    <Button size="small" type="text" danger title="删除" className="!h-6 !w-6 !p-0" icon={<Trash2 className="size-3.5" />} onClick={onDelete} />
                </div>
                <div className="absolute right-1.5 top-1.5 z-10 flex gap-1">
                    {log.video ? <VideoSourceTag video={log.video} /> : null}
                    <Tag className="m-0 text-[10px]" color={log.status === "成功" ? "blue" : log.status === "生成中" ? "processing" : "red"}>{log.status}</Tag>
                </div>
                {log.video ? <video src={log.video.url} controls className="size-full bg-black object-contain" /> : <div className="flex size-full flex-col items-center justify-center gap-2 p-5 text-center text-sm text-red-500"><AlertCircle className="size-7" /><span>{log.error || "没有可显示的视频"}</span></div>}
                <ReferenceThumbnailOverlay references={log.references} className="bottom-1.5 right-1.5" />
            </div>
            <div className="space-y-2 border-t border-stone-200 p-2.5 text-xs dark:border-stone-800">
                <div className={`${expanded ? "" : "line-clamp-2"} whitespace-pre-wrap text-stone-700 dark:text-stone-200`}>{log.prompt}</div>
                <div className="flex items-center justify-end gap-1">
                    <Button size="small" type="text" icon={<Copy className="size-3.5" />} onClick={() => void onCopyPrompt(log.prompt)}>复制</Button>
                    <Button size="small" type="text" icon={expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />} onClick={() => setExpanded((value) => !value)}>{expanded ? "收起" : "展开"}</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                    <Tag className="m-0 text-[10px]">{formatLogTime(log.createdAt)}</Tag>
                    <Tag className="m-0 text-[10px]">{log.model}</Tag>
                    <Tag className="m-0 text-[10px]">{log.size}</Tag>
                    <Tag className="m-0 text-[10px]">{log.resolution}p</Tag>
                    <Tag className="m-0 text-[10px]">{log.seconds}s</Tag>
                    <Tag className="m-0 text-[10px]">数量 {log.taskCount || 1}</Tag>
                    <Tag className="m-0 text-[10px]">{formatDuration(log.durationMs)}</Tag>
                </div>
                {log.error ? <div className="flex items-start justify-between gap-2 rounded-md bg-red-100 px-2 py-1 text-red-600 dark:bg-red-950/40 dark:text-red-300"><span className="line-clamp-2 min-w-0">{log.error}</span><Button size="small" type="text" className="!h-auto !p-0 text-xs" onClick={() => setDetailOpen(true)}>详情</Button></div> : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-t border-stone-200 px-2.5 py-2 dark:border-stone-800">
                <div className="flex flex-wrap gap-1">
                    <Button size="small" onClick={onPreview}>载入</Button>
                    <Button size="small" icon={<RotateCcw className="size-3.5" />} onClick={onRetry}>重试</Button>
                </div>
                {log.video ? <div className="flex shrink-0 gap-1"><Button size="small" title="同步到云端存储" icon={<CloudUpload className="size-3.5" />} loading={syncing} disabled={isCloudVideo(log.video)} onClick={() => onSync(log.video!)} /><Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onSaveAsset(log.video!)} /><Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(log.video!)} /></div> : null}
            </div>
            <Modal title="失败详情" open={detailOpen} width={760} onCancel={() => setDetailOpen(false)} footer={null}>
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-stone-950 p-3 text-xs text-stone-100">{log.errorDetail || log.error || "没有详情"}</pre>
            </Modal>
        </div>
    );
}

function VideoMetaBar({ video, syncing, onDownload, onSync, onSaveAsset }: { video: GeneratedVideo; index: number; syncing: boolean; onDownload: (video: GeneratedVideo) => void; onSync: (video: GeneratedVideo) => void; onSaveAsset: (video: GeneratedVideo) => void }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-t border-stone-200 px-2.5 py-2 dark:border-stone-800">
            <div className="flex min-w-0 flex-wrap gap-x-1.5 gap-y-1 text-[10px] text-stone-500 dark:text-stone-400">
                <span>{video.width}x{video.height}</span>
                {video.bytes ? <span>{formatBytes(video.bytes)}</span> : <span>远端地址</span>}
                <span>{formatDuration(video.durationMs)}</span>
            </div>
            <div className="flex shrink-0 gap-1">
                <Button size="small" title="同步到云端存储" icon={<CloudUpload className="size-3.5" />} loading={syncing} disabled={isCloudVideo(video)} onClick={() => onSync(video)} />
                <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onSaveAsset(video)} />
                <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(video)} />
            </div>
        </div>
    );
}

function VideoSourceTag({ video }: { video: GeneratedVideo }) {
    return <Tag className="m-0 text-[10px]" color={video.storageKey ? "default" : "gold"}>{video.storageKey ? "本地缓存" : "AI 临时URL"}</Tag>;
}

function TaskInfo({ item, error, onCopyPrompt }: { item: GenerationResult; error?: string; onCopyPrompt: (text: string) => void | Promise<void> }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="space-y-2 border-t border-stone-200 px-3 py-2.5 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
            <div className="rounded-md bg-stone-50 p-2 dark:bg-stone-900">
                <div className={`${expanded ? "" : "line-clamp-2"} whitespace-pre-wrap text-stone-700 dark:text-stone-200`}>{item.prompt}</div>
                <div className="mt-2 flex justify-end gap-1">
                    <Button size="small" type="text" icon={<Copy className="size-3.5" />} onClick={() => void onCopyPrompt(item.prompt)}>复制</Button>
                    <Button size="small" type="text" icon={expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />} onClick={() => setExpanded((value) => !value)}>{expanded ? "收起" : "展开"}</Button>
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
                <Tag className="m-0">{formatLogTime(item.createdAt)}</Tag>
                <Tag className="m-0">{item.model}</Tag>
                <Tag className="m-0">{item.config.size || "auto"}</Tag>
                <Tag className="m-0">{item.config.vquality || "720"}p</Tag>
                <Tag className="m-0">{item.config.videoSeconds || "6"}s</Tag>
                <Tag className="m-0">数量 {item.taskCount || 1}</Tag>
                {item.durationMs ? <Tag className="m-0">{formatDuration(item.durationMs)}</Tag> : null}
            </div>
            {error ? <div className="rounded-md bg-red-100 px-2 py-1.5 text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}
        </div>
    );
}

function ReferenceThumbnailOverlay({ references, className = "" }: { references?: ReferenceImage[]; className?: string }) {
    const visibleReferences = (references || []).filter((item) => Boolean(item.dataUrl)).slice(0, 3);
    if (!visibleReferences.length) return null;
    return (
        <div className={`absolute z-10 flex items-center gap-1 rounded-md bg-black/55 p-1 shadow-sm backdrop-blur ${className}`}>
            {visibleReferences.map((item) => (
                <img key={item.id} src={item.dataUrl} alt={item.name} className="size-7 rounded border border-white/60 object-cover" />
            ))}
            {(references || []).length > visibleReferences.length ? <span className="px-1 text-[10px] text-white">+{(references || []).length - visibleReferences.length}</span> : null}
        </div>
    );
}

function ReferenceOrderButtons({ index, total, onMove }: { index: number; total: number; onMove: (offset: number) => void }) {
    if (total <= 1) return null;
    return (
        <div className="absolute inset-x-1 bottom-1 flex justify-between">
            <Button size="small" className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm" icon={<ArrowLeft className="size-3" />} disabled={index <= 0} onClick={() => onMove(-1)} />
            <Button size="small" className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm" icon={<ArrowRight className="size-3" />} disabled={index >= total - 1} onClick={() => onMove(1)} />
        </div>
    );
}
function TTSPanel() {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const [narration, setNarration] = useState("");
    const [voice, setVoice] = useState("zh-CN-XiaoxiaoNeural");
    const [voices, setVoices] = useState<TTSVoice[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (token) fetchTTSVoices(token).then(setVoices).catch(() => {});
    }, [token]);

    const handleGenerate = async () => {
        if (!narration.trim()) { message.error("请输入旁白文本"); return; }
        if (!token) { message.warning("请先登录"); return; }
        setLoading(true);
        try {
            await synthesizeTTS(narration, voice, token);
            message.success("配音已生成并下载");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "配音生成失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-2">
            <Input.TextArea value={narration} rows={2} placeholder="输入视频旁白文本，AI 自动配音..." onChange={(e) => setNarration(e.target.value)} />
            <div className="flex items-center gap-2">
                <Select size="small" className="flex-1" value={voice} onChange={setVoice}
                    options={voices.length ? voices.map((v) => ({ value: v.id, label: v.name })) : [{ value: "zh-CN-XiaoxiaoNeural", label: "晓晓（女，温柔）" }]} />
                <Button size="small" type="primary" icon={<Sparkles className="size-3.5" />} loading={loading} onClick={handleGenerate}>
                    生成配音
                </Button>
            </div>
        </div>
    );
}
