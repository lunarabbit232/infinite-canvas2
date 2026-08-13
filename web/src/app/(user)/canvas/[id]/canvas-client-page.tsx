"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent as ReactChangeEvent, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FolderOpen, Globe2, Home, ImageIcon, Images, Layers3, List, Menu, MessageSquare, Music2, PanelLeftClose, PanelLeftOpen, Plus, Redo2, Save, Settings2, Trash2, Undo2, Upload, UserRound, Video } from "lucide-react";
import { saveAs } from "file-saver";

import { deleteCanvasProjects, deleteCanvasTasks } from "@/services/api/canvas-tasks";
import { createCanvasImageTask, pollCanvasImageTaskStatus, requestImageQuestion, type CanvasImageTask } from "@/services/api/image";
import { createCanvasAudioTask, pollCanvasAudioTaskStatus, type CanvasAudioTask } from "@/services/api/audio";
import { cancelVideoGenerationTask, createVideoGenerationTask, pollVideoGenerationTaskStatus, VIDEO_POLL_INTERVAL_MS, type VideoResponse } from "@/services/api/video";
import { defaultConfig, type AiConfig, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { collectImageStorageKeys, deleteStoredImages, resolveImageUrl, uploadImage, uploadRemoteImageToServer, type UploadedImage } from "@/services/image-storage";
import { resolveMediaUrl, uploadMediaFile, uploadRemoteMediaToServer, type UploadedFile } from "@/services/file-storage";
import { nanoid } from "nanoid";
import { getDataUrlByteSize, readImageMeta } from "@/lib/image-utils";
import { canvasThemes, type CanvasBackgroundMode } from "@/lib/canvas-theme";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { isKIEKlingV3Config } from "@/components/video-settings-panel";
import { useAssetStore } from "@/stores/use-asset-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { cropDataUrl, splitDataUrl, upscaleDataUrl } from "../utils/canvas-image-data";
import { fitNodeSize, nodeSizeFromRatio } from "../utils/canvas-node-size";
import { PANORAMA_IMAGE_SIZE, PANORAMA_NODE_SIZE, buildPanoramaPrompt, isCanvasImageNodeType, isPanoramaNodeType } from "../utils/canvas-panorama";
import { autoLayoutNodes } from "../utils/canvas-auto-layout";
import { applyCameraPrompt } from "../utils/canvas-camera";
import { GROUP_PADDING, findContainingGroupId, findGroupDropTarget, getNodeBounds, snapNodesIntoGroup } from "../utils/canvas-group";
import { App, Button, Dropdown, Modal } from "antd";
import { supportsVideoFrameReferences } from "@/lib/video-model-capabilities";
import { NODE_DEFAULT_SIZE, getNodeSpec } from "../constants";
import { ActiveConnectionPath, ConnectionPath } from "../components/canvas-connections";
import { CanvasConfigComposer } from "../components/canvas-config-composer";
import { CanvasConfigNodePanel } from "../components/canvas-config-node-panel";
import { CanvasDirector } from "../components/canvas-director";
import { DirectorAgentModal } from "@/components/workflows/director-agent-modal";
import { CanvasDirectorNodePanel } from "../components/canvas-director-node-panel";
import { CanvasAssistantPanel } from "../components/canvas-assistant-panel";
import { CanvasNodeContextMenu } from "../components/canvas-context-menu";
import { CanvasNodeAngleDialog, type CanvasImageAngleParams } from "../components/canvas-node-angle-dialog";
import { CanvasNodeCropDialog, type CanvasImageCropRect } from "../components/canvas-node-crop-dialog";
import { CanvasNodeMaskEditDialog, type CanvasImageMaskEditPayload } from "../components/canvas-node-mask-edit-dialog";
import { CanvasNodeSplitDialog, type CanvasImageSplitParams } from "../components/canvas-node-split-dialog";
import { CanvasNodeUpscaleDialog, type CanvasImageUpscaleParams } from "../components/canvas-node-upscale-dialog";
import { buildNodeChatMessages, buildNodeGenerationContext, buildNodeGenerationInputs, hydrateNodeGenerationContext, type NodeGenerationContext, type NodeGenerationInput } from "../components/canvas-node-generation";
import { CanvasNodeHoverToolbar, CanvasNodeInfoModal } from "../components/canvas-node-hover-toolbar";
import { CanvasVideoClipDialog } from "../components/canvas-video-clip-dialog";
import { FaceSimilarityCompare } from "@/components/face-similarity-compare";
import { InfiniteCanvas } from "../components/infinite-canvas";
import { Minimap } from "../components/canvas-mini-map";
import { CanvasNode } from "../components/canvas-node";
import { CanvasNodePromptPanel, type CanvasNodeGenerationMode, type CanvasVideoFrameOption } from "../components/canvas-node-prompt-panel";
import type { CanvasVideoResourceOption } from "../components/canvas-video-settings-popover";
import { CanvasVideoTaskQueue } from "../components/canvas-video-task-queue";
import { CanvasToolbar } from "../components/canvas-toolbar";
import { AssetPickerModal, type AssetPickerTab, type InsertAssetPayload } from "../components/asset-picker-modal";
import { CanvasZoomControls } from "../components/canvas-zoom-controls";
import { CanvasTemplateModal, saveCanvasAsTemplate } from "../components/canvas-template-modal";
import { CharacterPickerModal } from "../components/character-picker-modal";
import { CANVAS_ASSET_DRAG_TYPE, CanvasSidePanel } from "../components/canvas-side-panel";
import { DEFAULT_CANVAS_SIDE_PANEL, useCanvasStore } from "../stores/use-canvas-store";
import { buildCanvasResourceReferences, buildNodeMentionReferences } from "../utils/canvas-resource-references";
import {
    applyCanvasAudioTaskUpdate,
    applyCanvasImageTaskUpdate,
    applyCanvasVideoTaskUpdate,
    buildAngleLabel,
    buildAnglePrompt,
    buildGenerationConfig,
    canvasVideoTaskFromMetadata,
    canvasVideoTaskId,
    findRetrySourceNode,
    getInputSummary,
    isAudioFile,
    isHiddenBatchChild,
    isHiddenBatchConnectionEndpoint,
    NODE_STATUS_ERROR,
    NODE_STATUS_LOADING,
    NODE_STATUS_SUCCESS,
    parseCanvasTaskTime,
    resetInterruptedGeneration,
    sourceNodeReferenceImages,
    VIDEO_NODE_MAX_HEIGHT,
    VIDEO_NODE_MAX_WIDTH,
    applyNodeConfigPatch,
    audioExtension,
    audioMetadata,
    buildAudioGenerationMetadata,
    buildImageGenerationMetadata,
    generationReferenceUrls,
    getConnectionTargetAnchor,
    getGenerationCount,
    hydrateAssistantImages,
    hydrateCanvasImages,
    imageExtension,
    imageMetadata,
    normalizeConnection,
    resolveMetadataReferences,
    videoMetadata,
    withCanvasVideoAdvancedConfig,
} from "../utils/canvas-task-helpers";
import {
    CanvasNodeType,
    type CanvasAssistantImage,
    type CanvasAssistantSession,
    type CanvasConnection,
    type CanvasDirectorCapture,
    type CanvasDirectorPanorama,
    type CanvasImageGenerationType,
    type CanvasNodeData,
    type CanvasNodeMetadata,
    type ConnectionHandle,
    type PendingConnectionCreate,
    type ContextMenuState,
    type Position,
    type SelectionBox,
    type ViewportTransform,
} from "../types";
import type { ReferenceImage } from "@/types/image";
import { FullscreenPreview } from "./components/fullscreen-preview";
import { CanvasRefreshShell, ConnectionCreateMenu, NodeCreateMenu } from "./components/canvas-menus";
import { CanvasTopBar } from "./components/canvas-top-bar";
import type { ReferenceAudio } from "@/types/media";

const CanvasPanoramaViewer = dynamic(() => import("../components/canvas-panorama-viewer"), { ssr: false, loading: () => null });

type CanvasClipboard = {
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
};

type ConnectionDropTarget = {
    nodeId: string | null;
    isNearNode: boolean;
};

type PendingPanoramaImport = {
    image: UploadedImage;
    title: string;
    position: Position;
};

type CanvasHistoryEntry = Pick<CanvasClipboard, "nodes" | "connections"> & {
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
};

const CONNECTION_HANDLE_HIT_RADIUS = 40;
const CONNECTION_NODE_HIT_PADDING = 32;
const IMAGE_PROMPT_REVERSE_PRESET = `请根据参考图片反推一段适合用于 AI 生图的提示词。

要求：
1. 只输出提示词正文，不要解释。
2. 覆盖主体、构图、风格、光线、色彩、材质、镜头和氛围。
3. 尽量写成可直接用于生图模型的完整提示词。`;

function createCanvasNode(type: CanvasNodeType, position: Position, metadata?: CanvasNodeMetadata): CanvasNodeData {
    const spec = getNodeSpec(type);
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
        id,
        type,
        title: spec.title,
        position: {
            x: position.x - spec.width / 2,
            y: position.y - spec.height / 2,
        },
        width: spec.width,
        height: spec.height,
        metadata: { ...spec.metadata, ...metadata },
    };
}

export default function CanvasPage() {
    const params = useParams<{ id: string }>();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <CanvasRefreshShell />;

    return <InfiniteCanvasPage key={params.id} projectId={params.id} />;
}

function InfiniteCanvasPage({ projectId }: { projectId: string }) {
    const { message } = App.useApp();
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const assetInsertPositionRef = useRef<Position | null>(null);
    const draggedAssetPayloadRef = useRef<InsertAssetPayload | null>(null);
    const uploadTargetRef = useRef<{ nodeId?: string; position?: Position } | null>(null);
    const clipboardRef = useRef<CanvasClipboard | null>(null);
    const historyRef = useRef<{ past: CanvasHistoryEntry[]; future: CanvasHistoryEntry[] }>({ past: [], future: [] });
    const lastHistoryRef = useRef<CanvasHistoryEntry | null>(null);
    const historyCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sidePanelSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const focusAnimationRef = useRef<number | null>(null);
    const applyingHistoryRef = useRef(false);
    const historyPausedRef = useRef(false);
    const didInitialCenterRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const uploadingVideoNodeIdsRef = useRef(new Set<string>());
    const uploadingImageNodeIdsRef = useRef(new Set<string>());
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [aiConfigReminderDismissed, setAiConfigReminderDismissed] = useState(false);
    const nodeDraggingRef = useRef(false);
    const dragRef = useRef<{
        isDraggingNode: boolean;
        hasMoved: boolean;
        startX: number;
        startY: number;
        initialSelectedNodes: { id: string; x: number; y: number }[];
        clickedGroupId: string | null;
    }>({
        isDraggingNode: false,
        hasMoved: false,
        clickedGroupId: null,
        startX: 0,
        startY: 0,
        initialSelectedNodes: [],
    });

    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const cleanupAssetImages = useAssetStore((state) => state.cleanupImages);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const createProject = useCanvasStore((state) => state.createProject);
    const openProject = useCanvasStore((state) => state.openProject);
    const updateProject = useCanvasStore((state) => state.updateProject);
    const renameProject = useCanvasStore((state) => state.renameProject);
    const deleteProjects = useCanvasStore((state) => state.deleteProjects);
    const currentProject = useCanvasStore((state) => state.projects.find((project) => project.id === projectId));
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
    const [connections, setConnections] = useState<CanvasConnection[]>([]);
    const [chatSessions, setChatSessions] = useState<CanvasAssistantSession[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, k: 1 });
    const [size, setSize] = useState({ width: 1200, height: 720 });
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [connectingParams, setConnectingParams] = useState<ConnectionHandle | null>(null);
    const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<string | null>(null);
    const [pendingConnectionCreate, setPendingConnectionCreate] = useState<PendingConnectionCreate | null>(null);
    const [mouseWorld, setMouseWorld] = useState<Position>({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [nodeCreatePosition, setNodeCreatePosition] = useState<Position | null>(null);
    const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
    const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
    const [backgroundMode, setBackgroundMode] = useState<CanvasBackgroundMode>("lines");
    const [showImageInfo, setShowImageInfo] = useState(false);
    const [sidePanel, setSidePanel] = useState(() => DEFAULT_CANVAS_SIDE_PANEL);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [assetPickerTab, setAssetPickerTab] = useState<AssetPickerTab>("my-assets");
    const [pendingPanoramaImport, setPendingPanoramaImport] = useState<PendingPanoramaImport | null>(null);
    const [projectLoaded, setProjectLoaded] = useState(false);
    const [toolbarNodeId, setToolbarNodeId] = useState<string | null>(null);
    const [nodeImageSettingsOpen, setNodeImageSettingsOpen] = useState(false);
    const [dialogNodeId, setDialogNodeId] = useState<string | null>(null);
    const [openDirectorNodeId, setOpenDirectorNodeId] = useState<string | null>(null);
    const [directorAgentOpen, setDirectorAgentOpen] = useState(false);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editRequestNonce, setEditRequestNonce] = useState(0);
    const [infoNodeId, setInfoNodeId] = useState<string | null>(null);
    const [cropNodeId, setCropNodeId] = useState<string | null>(null);
    const [maskEditNodeId, setMaskEditNodeId] = useState<string | null>(null);
    const [maskEditModel, setMaskEditModel] = useState("");
    const [maskEditChannelId, setMaskEditChannelId] = useState("");
    const [splitNodeId, setSplitNodeId] = useState<string | null>(null);
    const [upscaleNodeId, setUpscaleNodeId] = useState<string | null>(null);
    const [superResolveNodeId, setSuperResolveNodeId] = useState<string | null>(null);
    const [characterPickerNodeId, setCharacterPickerNodeId] = useState<string | null>(null);
    const [angleNodeId, setAngleNodeId] = useState<string | null>(null);
    const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
    const [faceCompareNodeId, setFaceCompareNodeId] = useState<string | null>(null);
    const [clipVideoUrl, setClipVideoUrl] = useState("");
    const [clipDialogOpen, setClipDialogOpen] = useState(false);
    const [assistantCollapsed, setAssistantCollapsed] = useState(true);
    const [assistantMounted, setAssistantMounted] = useState(false);
    const [titleEditing, setTitleEditing] = useState(false);
    const [titleDraft, setTitleDraft] = useState("");
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const [collapsingBatchIds, setCollapsingBatchIds] = useState<Set<string>>(new Set());
    const [openingBatchIds, setOpeningBatchIds] = useState<Set<string>>(new Set());
    const [isNodeDragging, setIsNodeDragging] = useState(false);
    const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
    const [canvasNow, setCanvasNow] = useState(Date.now());

    const nodesRef = useRef(nodes);
    const connectionsRef = useRef(connections);
    const selectedNodeIdsRef = useRef(selectedNodeIds);
    const viewportRef = useRef(viewport);
    const connectingParamsRef = useRef(connectingParams);
    const connectionTargetNodeIdRef = useRef(connectionTargetNodeId);
    const selectionBoxRef = useRef(selectionBox);
    const pendingConnectionCreateRef = useRef(pendingConnectionCreate);
    const pollingVideoNodeIdsRef = useRef(new Set<string>());
    const pollingImageNodeIdsRef = useRef(new Set<string>());
    const pollingAudioNodeIdsRef = useRef(new Set<string>());
    const hasLoadingTimedNodes = nodes.some((node) => node.metadata?.status === NODE_STATUS_LOADING && !node.metadata.content && (node.type === CanvasNodeType.Video || isCanvasImageNodeType(node.type) || node.type === CanvasNodeType.Audio));

    const createHistoryEntry = useCallback(
        (): CanvasHistoryEntry => ({
            nodes: nodesRef.current,
            connections: connectionsRef.current,
            chatSessions,
            activeChatId,
            backgroundMode,
            showImageInfo,
        }),
        [activeChatId, backgroundMode, chatSessions, showImageInfo],
    );

    const cleanupCanvasFiles = useCallback(
        (extra?: unknown) => {
            cleanupAssetImages({ extra, history: historyRef.current, lastHistory: lastHistoryRef.current });
        },
        [cleanupAssetImages],
    );

    const getBatchGroupNodes = useCallback((activeNode: CanvasNodeData | null) => {
        if (!activeNode) return [];
        const rootId = activeNode.metadata?.batchRootId || (activeNode.metadata?.isBatchRoot ? activeNode.id : null);
        if (!rootId) return [activeNode];
        return nodes.filter(
            (n) =>
                n.metadata?.batchRootId === rootId &&
                isCanvasImageNodeType(n.type) &&
                n.metadata?.content
        );
    }, [nodes]);

    useEffect(() => {
        if (!previewNodeId) return;
        const handlePreviewKeyDown = (event: KeyboardEvent) => {
            const pn = previewNodeId ? nodesRef.current.find((n) => n.id === previewNodeId) : null;
            if (!pn) return;
            const group = getBatchGroupNodes(pn);
            if (group.length <= 1) {
                if (event.key === "Escape") { event.preventDefault(); setPreviewNodeId(null); }
                return;
            }
            const idx = group.findIndex((n) => n.id === previewNodeId);
            if (event.key === "ArrowLeft") { event.preventDefault(); if (idx > 0) setPreviewNodeId(group[idx - 1].id); }
            else if (event.key === "ArrowRight") { event.preventDefault(); if (idx < group.length - 1) setPreviewNodeId(group[idx + 1].id); }
            else if (event.key === "Escape") { event.preventDefault(); setPreviewNodeId(null); }
        };
        window.addEventListener("keydown", handlePreviewKeyDown);
        return () => window.removeEventListener("keydown", handlePreviewKeyDown);
    }, [previewNodeId, getBatchGroupNodes]);

    useEffect(() => {
        if (!hydrated) return;
        setProjectLoaded(false);
        const project = openProject(projectId);
        if (!project) {
            router.replace("/canvas");
            return;
        }

        const restore = async () => {
            const restoredNodes = await hydrateCanvasImages(resetInterruptedGeneration(project.nodes));
            const restoredSessions = await hydrateAssistantImages(project.chatSessions || []);
            setNodes(restoredNodes);
            setConnections(project.connections);
            setChatSessions(restoredSessions);
            setActiveChatId(project.activeChatId || null);
            setBackgroundMode(project.backgroundMode);
            setShowImageInfo(project.showImageInfo || false);
            setViewport(project.viewport);
            setSidePanel(project.sidePanel || DEFAULT_CANVAS_SIDE_PANEL);
            historyRef.current = { past: [], future: [] };
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
            lastHistoryRef.current = {
                nodes: restoredNodes,
                connections: project.connections,
                chatSessions: restoredSessions,
                activeChatId: project.activeChatId || null,
                backgroundMode: project.backgroundMode,
                showImageInfo: project.showImageInfo || false,
            };
            setHistoryState({ canUndo: false, canRedo: false });
            setProjectLoaded(true);
        };
        void restore();
    }, [hydrated, openProject, projectId, router]);

    useEffect(() => {
        if (!projectLoaded) return;
        const template = sessionStorage.getItem("canvas-workflow-template") as "image" | "video" | null;
        if (!template) return;
        sessionStorage.removeItem("canvas-workflow-template");
        if (nodesRef.current.length === 0) {
            const tid = setTimeout(() => {
                createWorkflowTemplate(template);
            }, 100);
            return () => clearTimeout(tid);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectLoaded]);

    useEffect(() => {
        if (!projectLoaded || applyingHistoryRef.current || historyPausedRef.current) return;
        const next = createHistoryEntry();
        const previous = lastHistoryRef.current;
        if (previous?.nodes === next.nodes && previous.connections === next.connections && previous.chatSessions === next.chatSessions && previous.activeChatId === next.activeChatId && previous.backgroundMode === next.backgroundMode && previous.showImageInfo === next.showImageInfo) return;

        if (historyCommitTimerRef.current) clearTimeout(historyCommitTimerRef.current);
        historyCommitTimerRef.current = setTimeout(() => {
            const current = createHistoryEntry();
            const last = lastHistoryRef.current;
            if (!last) return;
            historyRef.current.past = [...historyRef.current.past.slice(-49), last];
            historyRef.current.future = [];
            setHistoryState({ canUndo: true, canRedo: false });
            lastHistoryRef.current = current;
            historyCommitTimerRef.current = null;
        }, 180);

        return () => {
            if (historyCommitTimerRef.current) {
                clearTimeout(historyCommitTimerRef.current);
                historyCommitTimerRef.current = null;
            }
        };
    }, [activeChatId, backgroundMode, chatSessions, connections, createHistoryEntry, nodes, projectLoaded, showImageInfo]);

    useEffect(() => {
        if (!projectLoaded || historyPausedRef.current) return;
        updateProject(projectId, { nodes, connections, chatSessions, activeChatId, backgroundMode, showImageInfo });
    }, [activeChatId, backgroundMode, chatSessions, connections, nodes, projectId, projectLoaded, showImageInfo, updateProject]);

    useEffect(() => {
        if (!projectLoaded) return;
        const pollCanvasTasks = () => {
            const videoTargets = nodesRef.current.filter((node) => node.type === CanvasNodeType.Video && node.metadata?.status === NODE_STATUS_LOADING && !node.metadata.content && canvasVideoTaskId(node.metadata));
            videoTargets.forEach((node) => {
                if (pollingVideoNodeIdsRef.current.has(node.id)) return;
                const taskId = canvasVideoTaskId(node.metadata);
                const generationConfig = buildGenerationConfig(effectiveConfig, node, "video");
                if (!taskId || !isAiConfigReady(generationConfig, generationConfig.model)) return;
                pollingVideoNodeIdsRef.current.add(node.id);
                void pollVideoGenerationTaskStatus(generationConfig, canvasVideoTaskFromMetadata(node.metadata))
                    .then((task) => {
                        setNodes((prev) => applyCanvasVideoTaskUpdate(prev, node.id, task, generationConfig, node.metadata?.startedAt || Date.now(), { width: node.width, height: node.height }));
                    })
                    .catch(() => undefined)
                    .finally(() => {
                        pollingVideoNodeIdsRef.current.delete(node.id);
                    });
            });
            const imageTargets = nodesRef.current.filter((node) => isCanvasImageNodeType(node.type) && node.metadata?.status === NODE_STATUS_LOADING && !node.metadata.content && node.metadata.imageTaskId);
            imageTargets.forEach((node) => {
                if (pollingImageNodeIdsRef.current.has(node.id) || !node.metadata?.imageTaskId) return;
                pollingImageNodeIdsRef.current.add(node.id);
                void pollCanvasImageTaskStatus(node.metadata.imageTaskId)
                    .then((task) => {
                        setNodes((prev) => applyCanvasImageTaskUpdate(prev, node.id, task, node.metadata?.startedAt || Date.now(), { width: node.width, height: node.height }));
                    })
                    .catch(() => undefined)
                    .finally(() => {
                        pollingImageNodeIdsRef.current.delete(node.id);
                    });
            });
            const audioTargets = nodesRef.current.filter((node) => node.type === CanvasNodeType.Audio && node.metadata?.status === NODE_STATUS_LOADING && !node.metadata.content && node.metadata.audioTaskId);
            audioTargets.forEach((node) => {
                if (pollingAudioNodeIdsRef.current.has(node.id) || !node.metadata?.audioTaskId) return;
                pollingAudioNodeIdsRef.current.add(node.id);
                void pollCanvasAudioTaskStatus(node.metadata.audioTaskId)
                    .then((task) => {
                        setNodes((prev) => applyCanvasAudioTaskUpdate(prev, node.id, task, node.metadata?.startedAt || Date.now()));
                    })
                    .catch(() => undefined)
                    .finally(() => {
                        pollingAudioNodeIdsRef.current.delete(node.id);
                    });
            });
        };
        pollCanvasTasks();
        const timer = window.setInterval(pollCanvasTasks, VIDEO_POLL_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [effectiveConfig, isAiConfigReady, projectLoaded]);

    useEffect(() => {
        if (!hasLoadingTimedNodes) return;
        setCanvasNow(Date.now());
        const timer = window.setInterval(() => setCanvasNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [hasLoadingTimedNodes]);

    useEffect(() => {
        const handler = (event: Event) => { setFaceCompareNodeId((event as CustomEvent).detail.nodeId); };
        window.addEventListener("canvas:face-compare", handler);
        return () => window.removeEventListener("canvas:face-compare", handler);
    }, []);

    useEffect(() => {
        const handleVideoEnded = (event: Event) => {
            const video = event.target as HTMLVideoElement;
            const nodeId = video.dataset.canvasNodeId;
            if (!nodeId) return;
            const conn = connectionsRef.current.find((c) => c.fromNodeId === nodeId);
            if (!conn) return;
            const nextNode = nodesRef.current.find((n) => n.id === conn.toNodeId);
            if (nextNode?.type !== CanvasNodeType.Video || !nextNode.metadata?.content) return;
            const els = document.querySelectorAll(`[data-canvas-node-id="${nextNode.id}"]`);
            els.forEach((el) => {
                if (el instanceof HTMLVideoElement) {
                    el.play().catch(() => {});
                }
            });
        };
        document.addEventListener("ended", handleVideoEnded, true);
        return () => document.removeEventListener("ended", handleVideoEnded, true);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const mod = event.metaKey || event.ctrlKey;
            if (mod && event.key === "b") {
                event.preventDefault();
                setSidePanel((current) => ({ ...current, open: !current.open }));
                return;
            }
            if (event.key === "Escape") {
                setContextMenu(null);
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        if (!dialogNodeId) setNodeImageSettingsOpen(false);
    }, [dialogNodeId]);

    useEffect(() => {
        if (!projectLoaded) return;
        if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        viewportSaveTimerRef.current = setTimeout(() => {
            updateProject(projectId, { viewport: viewportRef.current });
            viewportSaveTimerRef.current = null;
        }, 500);
        return () => {
            if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
        };
    }, [projectId, projectLoaded, updateProject, viewport]);

    useEffect(() => {
        if (!projectLoaded) return;
        if (sidePanelSaveTimerRef.current) clearTimeout(sidePanelSaveTimerRef.current);
        sidePanelSaveTimerRef.current = setTimeout(() => {
            updateProject(projectId, { sidePanel });
            sidePanelSaveTimerRef.current = null;
        }, 500);
        return () => {
            if (sidePanelSaveTimerRef.current) clearTimeout(sidePanelSaveTimerRef.current);
        };
    }, [projectId, projectLoaded, sidePanel, updateProject]);

    useLayoutEffect(() => {
        nodesRef.current = nodes;
        connectionsRef.current = connections;
        selectedNodeIdsRef.current = selectedNodeIds;
        viewportRef.current = viewport;
        connectingParamsRef.current = connectingParams;
        connectionTargetNodeIdRef.current = connectionTargetNodeId;
        pendingConnectionCreateRef.current = pendingConnectionCreate;
    }, [nodes, connections, selectedNodeIds, viewport, connectingParams, connectionTargetNodeId, pendingConnectionCreate]);

    useLayoutEffect(() => {
        selectionBoxRef.current = selectionBox;
    }, [selectionBox]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateSize = () => {
            const rect = el.getBoundingClientRect();
            setSize({ width: rect.width, height: rect.height });
            if (!didInitialCenterRef.current) {
                didInitialCenterRef.current = true;
                setViewport({ x: rect.width / 2, y: rect.height / 2, k: 1 });
            }
        };

        updateSize();
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(el);
        return () => resizeObserver.disconnect();
    }, []);

    const screenToCanvas = useCallback((clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const currentViewport = viewportRef.current;
        const localX = clientX - (rect?.left || 0);
        const localY = clientY - (rect?.top || 0);

        return {
            x: (localX - currentViewport.x) / currentViewport.k,
            y: (localY - currentViewport.y) / currentViewport.k,
        };
    }, []);

    const getCanvasCenter = useCallback(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        return screenToCanvas((rect?.left || 0) + (rect?.width || size.width) / 2 + Math.random() * 360 - 180, (rect?.top || 0) + (rect?.height || size.height) / 2 + Math.random() * 240 - 120);
    }, [screenToCanvas, size.height, size.width]);

    const setConnecting = useCallback((next: ConnectionHandle | null) => {
        connectingParamsRef.current = next;
        setConnectingParams(next);
        if (!next) {
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
        }
    }, []);

    const keepNodeToolbar = useCallback(
        (nodeId: string) => {
            if (nodeDraggingRef.current || nodeImageSettingsOpen || !selectedNodeIdsRef.current.has(nodeId)) return;
            setToolbarNodeId(nodeId);
        },
        [nodeImageSettingsOpen],
    );

    const hideNodeToolbar = useCallback(() => { }, []);

    const connectNodes = useCallback(
        (current: ConnectionHandle, targetNodeId: string) => {
            if (current.nodeId === targetNodeId) return;

            const connection = normalizeConnection(current.nodeId, targetNodeId, nodesRef.current, current.handleType);
            if (!connection) {
                message.warning("配置节点之间不能连接");
                return;
            }
            const { fromNodeId, toNodeId } = connection;
            const exists = connectionsRef.current.some((conn) => conn.fromNodeId === fromNodeId && conn.toNodeId === toNodeId);
            if (!exists) {
                setConnections((prev) => [...prev, { id: `conn-${Date.now()}`, fromNodeId, toNodeId }]);
            }
            setContextMenu(null);
        },
        [message],
    );

    const createConnectedNode = useCallback(
        (type: CanvasNodeType, pending: PendingConnectionCreate) => {
            const metadata = type === CanvasNodeType.Config ? { model: effectiveConfig.imageModel || effectiveConfig.model, size: effectiveConfig.size, count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count) } : undefined;
            const newNode = createCanvasNode(type, pending.position, metadata);
            const connection = normalizeConnection(pending.connection.nodeId, newNode.id, [...nodesRef.current, newNode], pending.connection.handleType);
            if (!connection) {
                message.warning("配置节点之间不能连接");
                return;
            }
            setNodes((prev) => [...prev, newNode]);
            setConnections((prev) => [...prev, { id: nanoid(), ...connection }]);
            setSelectedNodeIds(new Set([newNode.id]));
            setSelectedConnectionId(null);
            if (type !== CanvasNodeType.Text && type !== CanvasNodeType.Audio && type !== CanvasNodeType.Director && type !== CanvasNodeType.Character) setDialogNodeId(newNode.id);
            if (type === CanvasNodeType.Character) setCharacterPickerNodeId(newNode.id);
            setPendingConnectionCreate(null);
            setConnecting(null);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, message, setConnecting],
    );

    const cancelPendingConnectionCreate = useCallback(() => {
        setPendingConnectionCreate(null);
        setConnecting(null);
    }, [setConnecting]);

    const getConnectionDropTarget = useCallback(
        (clientX: number, clientY: number, current: ConnectionHandle): ConnectionDropTarget => {
            const world = screenToCanvas(clientX, clientY);
            const scale = Math.max(viewportRef.current.k, 0.05);
            const padding = CONNECTION_NODE_HIT_PADDING / scale;
            const handleRadius = CONNECTION_HANDLE_HIT_RADIUS / scale;
            let isNearNode = false;
            let bestNodeId: string | null = null;
            let bestPriority = Number.POSITIVE_INFINITY;

            [...nodesRef.current]
                .filter((node) => !isHiddenBatchChild(node, nodesRef.current))
                .reverse()
                .forEach((node) => {
                    const anchor = getConnectionTargetAnchor(node, current);
                    const dx = world.x - anchor.x;
                    const dy = world.y - anchor.y;
                    const hitsHandle = dx * dx + dy * dy <= handleRadius * handleRadius;
                    const hitsInside = world.x >= node.position.x && world.x <= node.position.x + node.width && world.y >= node.position.y && world.y <= node.position.y + node.height;
                    const hitsExpanded = world.x >= node.position.x - padding && world.x <= node.position.x + node.width + padding && world.y >= node.position.y - padding && world.y <= node.position.y + node.height + padding;

                    if (!hitsHandle && !hitsInside && !hitsExpanded) return;
                    isNearNode = true;
                    if (node.id === current.nodeId || !normalizeConnection(current.nodeId, node.id, nodesRef.current, current.handleType)) return;

                    const priority = hitsInside ? 0 : hitsHandle ? 1 : 2;
                    if (priority < bestPriority) {
                        bestNodeId = node.id;
                        bestPriority = priority;
                    }
                });

            return { nodeId: bestNodeId, isNearNode };
        },
        [screenToCanvas],
    );

    const visibleNodes = useMemo(() => {
        const padding = 280;
        const rect = containerRef.current?.getBoundingClientRect();
        const width = rect?.width || size.width;
        const height = rect?.height || size.height;
        const viewLeft = -viewport.x / viewport.k - padding;
        const viewTop = -viewport.y / viewport.k - padding;
        const viewRight = viewLeft + width / viewport.k + padding * 2;
        const viewBottom = viewTop + height / viewport.k + padding * 2;

        return nodes.filter((node) => !isHiddenBatchChild(node, nodes, collapsingBatchIds) && node.position.x + node.width > viewLeft && node.position.x < viewRight && node.position.y + node.height > viewTop && node.position.y < viewBottom);
    }, [collapsingBatchIds, nodes, size.height, size.width, viewport.k, viewport.x, viewport.y]);

    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    const toolbarNode = toolbarNodeId ? nodeById.get(toolbarNodeId) || null : null;
    const infoNode = infoNodeId ? nodeById.get(infoNodeId) || null : null;
    const cropNode = cropNodeId ? nodeById.get(cropNodeId) || null : null;
    const maskEditNode = maskEditNodeId ? nodeById.get(maskEditNodeId) || null : null;
    const maskEditConfig = maskEditNode ? buildGenerationConfig(effectiveConfig, maskEditNode, "image") : null;
    const currentMaskEditModel = maskEditModel || maskEditConfig?.model || "";
    const currentMaskEditChannelId = maskEditChannelId || maskEditConfig?.imageChannelId || "";
    const splitNode = splitNodeId ? nodeById.get(splitNodeId) || null : null;
    const upscaleNode = upscaleNodeId ? nodeById.get(upscaleNodeId) || null : null;
    const superResolveNode = superResolveNodeId ? nodeById.get(superResolveNodeId) || null : null;
    const characterPickerNode = characterPickerNodeId ? nodeById.get(characterPickerNodeId) || null : null;
    const angleNode = angleNodeId ? nodeById.get(angleNodeId) || null : null;
    const previewNode = previewNodeId ? nodeById.get(previewNodeId) || null : null;
    const openDirectorNode = openDirectorNodeId ? nodeById.get(openDirectorNodeId) || null : null;
    const hasMultipleSelectedNodes = selectedNodeIds.size > 1;
    const activeNodeId = hasMultipleSelectedNodes ? null : hoveredNodeId || (selectedNodeIds.size === 1 ? Array.from(selectedNodeIds)[0] : null);
    const batchChildCountById = useMemo(() => {
        const map = new Map<string, number>();
        nodes.forEach((node) => {
            if (node.metadata?.isBatchRoot) map.set(node.id, node.metadata.batchChildIds?.length || 0);
        });
        return map;
    }, [nodes]);
    const groupChildCountById = useMemo(() => {
        const map = new Map<string, number>();
        nodes.forEach((node) => {
            const groupId = node.metadata?.groupId;
            if (groupId) map.set(groupId, (map.get(groupId) || 0) + 1);
        });
        return map;
    }, [nodes]);
    const batchMotionById = useMemo(() => {
        const map = new Map<string, { x: number; y: number; index: number }>();
        nodes.forEach((node) => {
            const rootId = node.metadata?.batchRootId;
            if (!rootId) return;
            const root = nodeById.get(rootId);
            const index = root?.metadata?.batchChildIds?.indexOf(node.id) ?? 0;
            const stackX = root ? root.position.x + 34 + index * 14 : node.position.x;
            const stackY = root ? root.position.y + 14 + index * 8 : node.position.y;
            map.set(node.id, { x: stackX - node.position.x, y: stackY - node.position.y, index: Math.max(index, 0) });
        });
        return map;
    }, [nodeById, nodes]);
    const relatedHighlight = useMemo(() => {
        const nodeIds = new Set<string>();
        const connectionIds = new Set<string>();

        if (!activeNodeId) return { nodeIds, connectionIds };

        nodeIds.add(activeNodeId);
        connections.forEach((connection) => {
            if (connection.fromNodeId !== activeNodeId && connection.toNodeId !== activeNodeId) return;
            connectionIds.add(connection.id);
            nodeIds.add(connection.fromNodeId);
            nodeIds.add(connection.toNodeId);
        });

        return { nodeIds, connectionIds };
    }, [activeNodeId, connections]);

    const configInputsById = useMemo(() => {
        const map = new Map<string, NodeGenerationInput[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Config) return;
            map.set(node.id, buildNodeGenerationInputs(node.id, nodes, connections));
        });
        return map;
    }, [connections, nodes]);
    const directorPanoramasByNodeId = useMemo(() => {
        const map = new Map<string, CanvasDirectorPanorama[]>();
        nodes.forEach((node) => {
            if (node.type === CanvasNodeType.Director) map.set(node.id, []);
        });
        connections.forEach((connection) => {
            const target = nodeById.get(connection.toNodeId);
            const source = nodeById.get(connection.fromNodeId);
            if (target?.type !== CanvasNodeType.Director || !isCanvasImageNodeType(source?.type) || !source?.metadata?.content) return;
            map.get(target.id)?.push({
                edgeId: connection.id,
                sourceNodeId: source.id,
                imageUrl: source.metadata.content,
                fileName: source.title || "画布图片.png",
                projectionMode: source.metadata.panoramaProjection === "equirectangular" ? "equirectangular" : "backdrop",
            });
        });
        return map;
    }, [connections, nodeById, nodes]);
    const resourceContextNodeId = dialogNodeId || activeNodeId;
    const canvasResourceReferences = useMemo(() => buildCanvasResourceReferences(nodes, connections, resourceContextNodeId), [connections, nodes, resourceContextNodeId]);
    const resourceReferenceByNodeId = useMemo(() => new Map(canvasResourceReferences.map((reference) => [reference.nodeId, reference])), [canvasResourceReferences]);
    const mentionReferencesByNodeId = useMemo(() => {
        const map = new Map<string, ReturnType<typeof buildNodeMentionReferences>>();
        nodes.forEach((node) => map.set(node.id, buildNodeMentionReferences(node, nodes, connections)));
        return map;
    }, [connections, nodes]);
    const videoFrameOptionsByNodeId = useMemo(() => {
        const map = new Map<string, CanvasVideoFrameOption[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Video && node.type !== CanvasNodeType.Config) return;
            const options = connections.flatMap((connection) => {
                if (connection.toNodeId !== node.id) return [];
                const imageNode = nodeById.get(connection.fromNodeId);
                return isCanvasImageNodeType(imageNode?.type) && imageNode?.metadata?.content ? [{ nodeId: imageNode.id, label: imageNode.title || "图片节点", previewUrl: imageNode.metadata.content }] : [];
            });
            map.set(node.id, options);
        });
        return map;
    }, [connections, nodeById, nodes]);
    const videoResourceOptionsByNodeId = useMemo(() => {
        const map = new Map<string, CanvasVideoResourceOption[]>();
        nodes.forEach((node) => {
            if (node.type !== CanvasNodeType.Video && node.type !== CanvasNodeType.Config) return;
            const options: CanvasVideoResourceOption[] = connections.flatMap<CanvasVideoResourceOption>((connection) => {
                if (connection.toNodeId !== node.id) return [];
                const source = nodeById.get(connection.fromNodeId);
                if (!source) return [];
                const label = source.title || source.id;
                if (source.type === CanvasNodeType.Text) {
                    const text = source.metadata?.content || source.metadata?.prompt || "";
                    return text.trim() ? [{ nodeId: source.id, kind: "text" as const, label, text }] : [];
                }
                if (isCanvasImageNodeType(source.type) && source.metadata?.content) return [{ nodeId: source.id, kind: "image" as const, label, previewUrl: source.metadata.content }];
                if (source.type === CanvasNodeType.Video && source.metadata?.content) return [{ nodeId: source.id, kind: "video" as const, label, previewUrl: source.metadata.content }];
                if (source.type === CanvasNodeType.Audio && source.metadata?.content) return [{ nodeId: source.id, kind: "audio" as const, label }];
                return [];
            });
            map.set(node.id, options);
        });
        return map;
    }, [connections, nodeById, nodes]);
    const createNode = useCallback(
        (type: CanvasNodeType, position?: Position, textContent?: string) => {
            const targetPosition = position || getCanvasCenter();
            const configMetadata =
                type === CanvasNodeType.Config
                    ? {
                        model: effectiveConfig.imageModel || effectiveConfig.model,
                        size: effectiveConfig.size,
                        count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count),
                    }
                    : undefined;
            const newNode = createCanvasNode(
                type,
                targetPosition,
                type === CanvasNodeType.Text && textContent !== undefined
                    ? { content: textContent, status: NODE_STATUS_SUCCESS }
                    : configMetadata,
            );
            if (type === CanvasNodeType.Text && textContent !== undefined) newNode.title = textContent.slice(0, 32) || "Assistant Text";
            setNodes((prev) => [...prev, newNode]);
            setSelectedNodeIds(new Set([newNode.id]));
            setSelectedConnectionId(null);
            if (type !== CanvasNodeType.Text && type !== CanvasNodeType.Audio && type !== CanvasNodeType.Director && type !== CanvasNodeType.Character) setDialogNodeId(newNode.id);
            if (type === CanvasNodeType.Character) setCharacterPickerNodeId(newNode.id);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, getCanvasCenter],
    );

    const createWorkflowTemplate = useCallback(
        (variant: "image" | "video") => {
            const center = getCanvasCenter();
            const gap = 96;
            const textSpec = getNodeSpec(CanvasNodeType.Text);
            const configSpec = getNodeSpec(CanvasNodeType.Config);
            const imageSpec = getNodeSpec(CanvasNodeType.Image);
            const totalWidth = variant === "video"
                ? textSpec.width + gap + configSpec.width + gap + imageSpec.width + gap + getNodeSpec(CanvasNodeType.Video).width
                : textSpec.width + gap + configSpec.width + gap + imageSpec.width;
            const startX = center.x - totalWidth / 2;
            const y = center.y - textSpec.height / 2;
            const configMeta = { model: effectiveConfig.imageModel || effectiveConfig.model, size: effectiveConfig.size, count: Number(effectiveConfig.canvasImageCount || effectiveConfig.count || 1) };

            const textNode = createCanvasNode(CanvasNodeType.Text, { x: startX + textSpec.width / 2, y: center.y }, { content: "请输入描述，例如：一只在花园里散步的橘猫", status: "success" });
            const cx = startX + textSpec.width + gap + configSpec.width / 2;
            const configNode = createCanvasNode(CanvasNodeType.Config, { x: cx, y: center.y }, configMeta);
            const ix = startX + textSpec.width + gap + configSpec.width + gap + imageSpec.width / 2;
            const imageNode = createCanvasNode(CanvasNodeType.Image, { x: ix, y: center.y }, { content: "", status: "idle" });
            const newNodes = [textNode, configNode, imageNode];
            const newConnections = [
                { id: nanoid(), fromNodeId: textNode.id, toNodeId: configNode.id },
                { id: nanoid(), fromNodeId: configNode.id, toNodeId: imageNode.id },
            ];

            if (variant === "video") {
                const vx = startX + textSpec.width + gap + configSpec.width + gap + imageSpec.width + gap + getNodeSpec(CanvasNodeType.Video).width / 2;
                const videoNode = createCanvasNode(CanvasNodeType.Video, { x: vx, y: center.y }, { content: "", status: "idle" });
                newNodes.push(videoNode);
                newConnections.push({ id: nanoid(), fromNodeId: imageNode.id, toNodeId: videoNode.id });
            }

            setNodes((prev) => [...prev, ...newNodes]);
            setConnections((prev) => [...prev, ...newConnections]);
            setSelectedNodeIds(new Set([textNode.id]));
            setDialogNodeId(textNode.id);
        },
        [effectiveConfig, getCanvasCenter],
    );

    const deleteCanvasTaskRecords = useCallback(
        (nodeIds?: string[]) => {
            void deleteCanvasTasks(projectId, nodeIds).catch(() => undefined);
        },
        [projectId],
    );

    const deleteNodes = useCallback(
        (ids: Set<string>) => {
            if (!ids.size) return;
            const allIds = new Set(ids);
            nodesRef.current.forEach((node) => {
                if (ids.has(node.id)) node.metadata?.batchChildIds?.forEach((childId) => allIds.add(childId));
            });
            nodesRef.current.forEach((node) => {
                if (node.metadata?.isBatchRoot && node.metadata?.batchChildIds) {
                    const allChildrenDeleted = node.metadata.batchChildIds.every((childId) => allIds.has(childId));
                    if (allChildrenDeleted) allIds.add(node.id);
                }
            });
            deleteCanvasTaskRecords([...allIds]);
            const removedNodes = nodesRef.current.filter((node) => allIds.has(node.id));
            const remainingNodes = nodesRef.current.filter((node) => !allIds.has(node.id));
            const removedKeys = collectImageStorageKeys(removedNodes);
            const usedKeys = collectImageStorageKeys({ nodes: remainingNodes, chatSessions, assets: useAssetStore.getState().assets });
            const disposableKeys = [...removedKeys].filter((key) => !usedKeys.has(key));
            if (disposableKeys.length) void deleteStoredImages(disposableKeys).catch((error) => message.error(error instanceof Error ? error.message : "图片文件删除失败"));
            setNodes((prev) => {
                const next = prev.filter((node) => !allIds.has(node.id));
                return next.map((node) => {
                    const nextNode = node.metadata?.groupId && allIds.has(node.metadata.groupId) ? { ...node, metadata: { ...node.metadata, groupId: undefined } } : node;
                    const childIds = nextNode.metadata?.batchChildIds?.filter((childId) => !allIds.has(childId));
                    if (!nextNode.metadata?.isBatchRoot || childIds?.length === nextNode.metadata.batchChildIds?.length) return nextNode;
                    const primaryImageId = childIds?.includes(nextNode.metadata.primaryImageId || "") ? nextNode.metadata.primaryImageId : childIds?.[0];
                    const primaryNode = next.find((item) => item.id === primaryImageId);
                    return {
                        ...nextNode,
                        metadata: {
                            ...nextNode.metadata,
                            batchChildIds: childIds,
                            primaryImageId,
                            content: primaryNode?.metadata?.content || nextNode.metadata.content,
                            naturalWidth: primaryNode?.metadata?.naturalWidth || nextNode.metadata.naturalWidth,
                            naturalHeight: primaryNode?.metadata?.naturalHeight || nextNode.metadata.naturalHeight,
                            panoramaProjection: primaryNode?.metadata?.panoramaProjection || nextNode.metadata.panoramaProjection,
                        },
                    };
                });
            });
            setConnections((prev) => prev.filter((conn) => !allIds.has(conn.fromNodeId) && !allIds.has(conn.toNodeId)));
            setSelectedNodeIds(new Set());
            setSelectedConnectionId(null);
            setHoveredNodeId((current) => (current && allIds.has(current) ? null : current));
            setToolbarNodeId((current) => (current && allIds.has(current) ? null : current));
            setDialogNodeId((current) => (current && allIds.has(current) ? null : current));
            setEditingNodeId((current) => (current && allIds.has(current) ? null : current));
            setInfoNodeId((current) => (current && allIds.has(current) ? null : current));
            setCropNodeId((current) => (current && allIds.has(current) ? null : current));
            setMaskEditNodeId((current) => (current && allIds.has(current) ? null : current));
            setAngleNodeId((current) => (current && allIds.has(current) ? null : current));
            setPreviewNodeId((current) => (current && allIds.has(current) ? null : current));
            setRunningNodeId((current) => (current && allIds.has(current) ? null : current));
            setContextMenu((current) => (current?.type === "node" && allIds.has(current.nodeId) ? null : current));
            cleanupCanvasFiles({ projectId, nodes: nodesRef.current.filter((node) => !allIds.has(node.id)), chatSessions });
        },
        [chatSessions, cleanupCanvasFiles, deleteCanvasTaskRecords, projectId],
    );

    const deleteConnection = useCallback((connectionId: string) => {
        setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
        setSelectedConnectionId((current) => (current === connectionId ? null : current));
        setContextMenu((current) => (current?.type === "connection" && current.connectionId === connectionId ? null : current));
    }, []);

    const deselectCanvas = useCallback(() => {
        cancelPendingConnectionCreate();
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setContextMenu(null);
        setSelectionBox(null);
        setHoveredNodeId(null);
        setToolbarNodeId(null);
        setDialogNodeId(null);
        setEditingNodeId(null);
    }, [cancelPendingConnectionCreate]);

    const clearCanvas = useCallback(() => {
        deleteCanvasTaskRecords();
        setNodes([]);
        setConnections([]);
        setInfoNodeId(null);
        setCropNodeId(null);
        setMaskEditNodeId(null);
        setAngleNodeId(null);
        setPreviewNodeId(null);
        setRunningNodeId(null);
        deselectCanvas();
        setClearConfirmOpen(false);
        cleanupCanvasFiles({ projectId, nodes: [], chatSessions: [] });
    }, [cleanupCanvasFiles, deleteCanvasTaskRecords, deselectCanvas, projectId]);

    const duplicateNode = useCallback((nodeId: string) => {
        const source = nodesRef.current.find((node) => node.id === nodeId);
        if (!source) return;

        const id = `${source.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const next: CanvasNodeData = {
            ...source,
            id,
            title: `${source.title} Copy`,
            position: { x: source.position.x + 36, y: source.position.y + 36 },
        };

        setNodes((prev) => [...prev, next]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);
    }, []);

    const createGroupFromSelection = useCallback(() => {
        const selectedIds = selectedNodeIdsRef.current;
        const selectedNodes = nodesRef.current.filter((node) => selectedIds.has(node.id));
        if (selectedNodes.length < 2 || selectedNodes.some((node) => node.type === CanvasNodeType.Group || node.metadata?.groupId)) return;

        const bounds = getNodeBounds(selectedNodes);
        const width = bounds.right - bounds.left + GROUP_PADDING * 2;
        const height = bounds.bottom - bounds.top + GROUP_PADDING * 2;
        const group = createCanvasNode(CanvasNodeType.Group, {
            x: bounds.left - GROUP_PADDING + width / 2,
            y: bounds.top - GROUP_PADDING + height / 2,
        });
        group.width = width;
        group.height = height;
        group.position = { x: bounds.left - GROUP_PADDING, y: bounds.top - GROUP_PADDING };

        setNodes((prev) => [
            ...prev.map((node) => selectedIds.has(node.id) ? { ...node, metadata: { ...node.metadata, groupId: group.id } } : node),
            group,
        ]);
        setSelectedNodeIds(new Set([group.id]));
        setSelectedConnectionId(null);
        setDialogNodeId(null);
    }, []);

    const copySelectedNodes = useCallback(() => {
        const selectedIds = selectedNodeIdsRef.current;
        if (!selectedIds.size) return;

        const copiedIds = new Set(selectedIds);
        nodesRef.current.forEach((node) => {
            if (node.type !== CanvasNodeType.Group || !selectedIds.has(node.id)) return;
            nodesRef.current.forEach((child) => {
                if (child.metadata?.groupId === node.id) copiedIds.add(child.id);
            });
        });

        const copiedNodes = nodesRef.current
            .filter((node) => copiedIds.has(node.id))
            .map((node) => ({
                ...node,
                position: { ...node.position },
                metadata: node.metadata ? { ...node.metadata } : undefined,
            }));

        if (!copiedNodes.length) return;

        clipboardRef.current = {
            nodes: copiedNodes,
            connections: connectionsRef.current.filter((connection) => copiedIds.has(connection.fromNodeId) && copiedIds.has(connection.toNodeId)).map((connection) => ({ ...connection })),
        };
    }, []);

    const pasteCopiedNodes = useCallback(() => {
        const clipboard = clipboardRef.current;
        if (!clipboard?.nodes.length) return false;

        const center = getCanvasCenter();
        const bounds = clipboard.nodes.reduce(
            (acc, node) => ({
                left: Math.min(acc.left, node.position.x),
                top: Math.min(acc.top, node.position.y),
                right: Math.max(acc.right, node.position.x + node.width),
                bottom: Math.max(acc.bottom, node.position.y + node.height),
            }),
            { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
        );
        const dx = center.x - (bounds.left + bounds.right) / 2;
        const dy = center.y - (bounds.top + bounds.bottom) / 2;
        const idMap = new Map<string, string>();
        const nextNodes = clipboard.nodes.map((node, index) => {
            const id = `${node.type}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
            idMap.set(node.id, id);
            return {
                ...node,
                id,
                title: node.title.endsWith(" Copy") ? node.title : `${node.title} Copy`,
                position: {
                    x: node.position.x + dx,
                    y: node.position.y + dy,
                },
                metadata: node.metadata ? { ...node.metadata } : undefined,
            };
        });

        const pastedNodes = nextNodes.map((node) => {
            const groupId = node.metadata?.groupId;
            const nextGroupId = groupId ? idMap.get(groupId) : undefined;
            if (!groupId || nextGroupId) return nextGroupId ? { ...node, metadata: { ...node.metadata, groupId: nextGroupId } } : node;
            return { ...node, metadata: { ...node.metadata, groupId: undefined } };
        });

        const nextConnections = clipboard.connections.flatMap((connection, index) => {
            const fromNodeId = idMap.get(connection.fromNodeId);
            const toNodeId = idMap.get(connection.toNodeId);
            if (!fromNodeId || !toNodeId) return [];
            return [
                {
                    ...connection,
                    id: `conn-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
                    fromNodeId,
                    toNodeId,
                },
            ];
        });

        setNodes((prev) => [...prev, ...pastedNodes]);
        setConnections((prev) => [...prev, ...nextConnections]);
        setSelectedNodeIds(new Set(pastedNodes.map((node) => node.id)));
        setSelectedConnectionId(null);
        setContextMenu(null);
        setDialogNodeId(pastedNodes[0]?.type === CanvasNodeType.Group ? null : pastedNodes[0]?.id || null);
        return true;
    }, [getCanvasCenter]);

    const resetViewport = useCallback(() => {
        setViewport({ x: size.width / 2, y: size.height / 2, k: 1 });
        setContextMenu(null);
    }, [size.height, size.width]);

    const setZoomScale = useCallback(
        (scale: number) => {
            const nextScale = Math.min(Math.max(scale, 0.05), 5);
            setViewport((prev) => ({
                x: size.width / 2 - ((size.width / 2 - prev.x) / prev.k) * nextScale,
                y: size.height / 2 - ((size.height / 2 - prev.y) / prev.k) * nextScale,
                k: nextScale,
            }));
            setContextMenu(null);
        },
        [size.height, size.width],
    );

    const applyHistory = useCallback((entry: CanvasHistoryEntry) => {
        if (historyCommitTimerRef.current) {
            clearTimeout(historyCommitTimerRef.current);
            historyCommitTimerRef.current = null;
        }
        applyingHistoryRef.current = true;
        setNodes(entry.nodes);
        setConnections(entry.connections);
        setChatSessions(entry.chatSessions);
        setActiveChatId(entry.activeChatId);
        setBackgroundMode(entry.backgroundMode);
        setShowImageInfo(entry.showImageInfo);
        setSelectedNodeIds(new Set());
        setSelectedConnectionId(null);
        setContextMenu(null);
        setTimeout(() => {
            lastHistoryRef.current = entry;
            applyingHistoryRef.current = false;
            setHistoryState({ canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 });
        });
    }, []);

    const undoCanvas = useCallback(() => {
        const previous = historyRef.current.past.pop();
        const current = lastHistoryRef.current;
        if (!previous || !current) return;
        historyRef.current.future.push(current);
        applyHistory(previous);
    }, [applyHistory]);

    const redoCanvas = useCallback(() => {
        const next = historyRef.current.future.pop();
        const current = lastHistoryRef.current;
        if (!next || !current) return;
        historyRef.current.past.push(current);
        applyHistory(next);
    }, [applyHistory]);

    const createAndOpenProject = useCallback(() => {
        const id = createProject(`无限画布 ${useCanvasStore.getState().projects.length + 1}`);
        router.push(`/canvas/${id}`);
    }, [createProject, router]);

    const deleteCurrentProject = useCallback(() => {
        void deleteCanvasProjects([projectId]).catch(() => undefined);
        deleteCanvasTaskRecords();
        deleteProjects([projectId]);
        cleanupAssetImages();
        router.push("/canvas");
    }, [cleanupAssetImages, deleteCanvasTaskRecords, deleteProjects, projectId, router]);

    const handleCanvasMouseDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            setContextMenu(null);
            setNodeCreatePosition(null);
            if (pendingConnectionCreateRef.current) cancelPendingConnectionCreate();
            if (event.button !== 0) return;

            if (!event.ctrlKey && !event.metaKey) {
                setSelectionBox(null);
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
                return;
            }

            const world = screenToCanvas(event.clientX, event.clientY);
            const nextSelectionBox = {
                startWorldX: world.x,
                startWorldY: world.y,
                currentWorldX: world.x,
                currentWorldY: world.y,
                additive: event.shiftKey,
                initialSelectedNodeIds: event.shiftKey ? Array.from(selectedNodeIdsRef.current) : [],
            };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            if (!event.shiftKey) {
                setSelectedNodeIds(new Set());
            }

            setSelectedConnectionId(null);
        },
        [cancelPendingConnectionCreate, screenToCanvas],
    );

    const handleNodeMouseDown = useCallback((event: ReactMouseEvent, nodeId: string) => {
        event.stopPropagation();
        setContextMenu(null);
        setHoveredNodeId(null);
        setToolbarNodeId(null);
        setSelectedConnectionId(null);
        if (nodesRef.current.find((node) => node.id === nodeId)?.type === CanvasNodeType.Group) setDialogNodeId(null);

        const currentSelected = selectedNodeIdsRef.current;
        const currentNodes = nodesRef.current;
        const nextSelected = new Set(currentSelected);

        if (event.shiftKey || event.metaKey || event.ctrlKey) {
            if (nextSelected.has(nodeId)) {
                nextSelected.delete(nodeId);
            } else {
                nextSelected.add(nodeId);
            }
        } else if (!nextSelected.has(nodeId)) {
            nextSelected.clear();
            nextSelected.add(nodeId);
        }

        setSelectedNodeIds(nextSelected);
        setToolbarNodeId(nextSelected.size === 1 && nextSelected.has(nodeId) ? nodeId : null);
        const dragIds = new Set(nextSelected);
        currentNodes.forEach((node) => {
            if (!nextSelected.has(node.id)) return;
            node.metadata?.batchChildIds?.forEach((childId) => dragIds.add(childId));
            if (node.type === CanvasNodeType.Group) {
                currentNodes.forEach((child) => {
                    if (child.metadata?.groupId === node.id) dragIds.add(child.id);
                });
            }
        });
        dragRef.current = {
            isDraggingNode: true,
            hasMoved: false,
            clickedGroupId: currentNodes.find((node) => node.id === nodeId)?.type === CanvasNodeType.Group ? nodeId : null,
            startX: event.clientX,
            startY: event.clientY,
            initialSelectedNodes: currentNodes.filter((node) => dragIds.has(node.id)).map((node) => ({ id: node.id, x: node.position.x, y: node.position.y })),
        };
        historyPausedRef.current = true;
        nodeDraggingRef.current = true;
        setIsNodeDragging(true);
    }, []);

    const finishNodeDrag = useCallback((clientX?: number, clientY?: number) => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (!dragRef.current.isDraggingNode) {
            setDropTargetGroupId(null);
            return;
        }

        const wasClick = !dragRef.current.hasMoved && dragRef.current.initialSelectedNodes.length === 1;
        const clickedNodeId = dragRef.current.clickedGroupId || dragRef.current.initialSelectedNodes[0]?.id;
        const currentViewport = viewportRef.current;
        const dx = clientX == null ? 0 : (clientX - dragRef.current.startX) / currentViewport.k;
        const dy = clientY == null ? 0 : (clientY - dragRef.current.startY) / currentViewport.k;
        const initialPositions = dragRef.current.initialSelectedNodes;

        historyPausedRef.current = false;
        nodeDraggingRef.current = false;
        setIsNodeDragging(false);
        if (dragRef.current.hasMoved && clientX != null && clientY != null) {
            const movedIds = new Set(initialPositions.map((item) => item.id));
            setNodes((prev) => {
                const moved = prev.map((node) => {
                    const initial = initialPositions.find((item) => item.id === node.id);
                    return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                });
                const targetGroup = findGroupDropTarget(movedIds, moved);
                if (targetGroup) return snapNodesIntoGroup(movedIds, moved, targetGroup);
                return moved.map((node) => {
                    if (!movedIds.has(node.id) || node.type === CanvasNodeType.Group) return node;
                    const groupId = findContainingGroupId(node, moved);
                    return node.metadata?.groupId === groupId ? node : { ...node, metadata: { ...node.metadata, groupId } };
                });
            });
        }

        dragRef.current.isDraggingNode = false;
        dragRef.current.hasMoved = false;
        dragRef.current.clickedGroupId = null;
        dragRef.current.initialSelectedNodes = [];
        setDropTargetGroupId(null);
        if (wasClick && clickedNodeId) {
            const clickedNode = nodesRef.current.find((node) => node.id === clickedNodeId);
            if (clickedNode?.type === CanvasNodeType.Group) {
                setDialogNodeId(null);
            } else if (clickedNode?.type === CanvasNodeType.Text) {
                setDialogNodeId((current) => (current === clickedNodeId ? current : null));
            } else {
                setDialogNodeId(clickedNodeId);
            }
        }
    }, []);

    const handleGlobalMouseMove = useCallback(
        (event: MouseEvent) => {
            const currentViewport = viewportRef.current;

            if (dragRef.current.isDraggingNode) {
                const dx = (event.clientX - dragRef.current.startX) / currentViewport.k;
                const dy = (event.clientY - dragRef.current.startY) / currentViewport.k;
                const initialPositions = dragRef.current.initialSelectedNodes;
                if (Math.abs(event.clientX - dragRef.current.startX) > 3 || Math.abs(event.clientY - dragRef.current.startY) > 3) {
                    dragRef.current.hasMoved = true;
                }

                const movedIds = new Set(initialPositions.map((item) => item.id));
                const previewNodes = nodesRef.current.map((node) => {
                    const initial = initialPositions.find((item) => item.id === node.id);
                    return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                });
                setDropTargetGroupId(findGroupDropTarget(movedIds, previewNodes)?.id || null);

                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                    setNodes((prev) =>
                        prev.map((node) => {
                            const initial = initialPositions.find((item) => item.id === node.id);
                            return initial ? { ...node, position: { x: initial.x + dx, y: initial.y + dy } } : node;
                        }),
                    );
                    rafRef.current = null;
                });
                return;
            }

            if (connectingParamsRef.current && !pendingConnectionCreateRef.current) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, connectingParamsRef.current);
                connectionTargetNodeIdRef.current = dropTarget.nodeId;
                setConnectionTargetNodeId(dropTarget.nodeId);
                setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            }
        },
        [finishNodeDrag, getConnectionDropTarget, screenToCanvas],
    );

    const handleGlobalPointerMove = useCallback(
        (event: PointerEvent) => {
            const currentSelection = selectionBoxRef.current;
            if (!currentSelection) return;

            if (event.buttons === 0) {
                selectionBoxRef.current = null;
                setSelectionBox(null);
                return;
            }

            const world = screenToCanvas(event.clientX, event.clientY);
            const rectX = Math.min(currentSelection.startWorldX, world.x);
            const rectY = Math.min(currentSelection.startWorldY, world.y);
            const rectW = Math.abs(world.x - currentSelection.startWorldX);
            const rectH = Math.abs(world.y - currentSelection.startWorldY);
            const nextSelected = new Set<string>(currentSelection.additive ? currentSelection.initialSelectedNodeIds : []);

            nodesRef.current
                .filter((node) => !isHiddenBatchChild(node, nodesRef.current))
                .forEach((node) => {
                    const intersects = rectX < node.position.x + node.width && rectX + rectW > node.position.x && rectY < node.position.y + node.height && rectY + rectH > node.position.y;

                    if (intersects) nextSelected.add(node.id);
                });

            const nextSelectionBox = { ...currentSelection, currentWorldX: world.x, currentWorldY: world.y };
            selectionBoxRef.current = nextSelectionBox;
            setSelectionBox(nextSelectionBox);
            setSelectedNodeIds(nextSelected);
        },
        [screenToCanvas],
    );

    const handleGlobalMouseUp = useCallback(
        (event: MouseEvent) => {
            finishNodeDrag(event.clientX, event.clientY);

            selectionBoxRef.current = null;
            setSelectionBox(null);

            if (pendingConnectionCreateRef.current) return;

            const currentConnection = connectingParamsRef.current;
            if (currentConnection) {
                const dropTarget = getConnectionDropTarget(event.clientX, event.clientY, currentConnection);
                if (dropTarget.nodeId) {
                    connectNodes(currentConnection, dropTarget.nodeId);
                    setConnecting(null);
                } else if (dropTarget.isNearNode) {
                    setConnecting(null);
                } else {
                    setMouseWorld(screenToCanvas(event.clientX, event.clientY));
                    setPendingConnectionCreate({ connection: currentConnection, position: screenToCanvas(event.clientX, event.clientY) });
                }
            }
        },
        [connectNodes, finishNodeDrag, getConnectionDropTarget, screenToCanvas, setConnecting],
    );

    useEffect(() => {
        const handlePointerUp = (event: PointerEvent) => finishNodeDrag(event.clientX, event.clientY);
        const cancelNodeDrag = () => finishNodeDrag();
        window.addEventListener("mousemove", handleGlobalMouseMove);
        window.addEventListener("mouseup", handleGlobalMouseUp);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", cancelNodeDrag);
        window.addEventListener("blur", cancelNodeDrag);
        window.addEventListener("pointermove", handleGlobalPointerMove);
        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            window.removeEventListener("mouseup", handleGlobalMouseUp);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", cancelNodeDrag);
            window.removeEventListener("blur", cancelNodeDrag);
            window.removeEventListener("pointermove", handleGlobalPointerMove);
        };
    }, [finishNodeDrag, handleGlobalMouseMove, handleGlobalMouseUp, handleGlobalPointerMove]);

    const appendImportedImageNode = useCallback((image: UploadedImage, title: string, position: Position, type: CanvasNodeType.Image | CanvasNodeType.Panorama) => {
        const isPanorama = type === CanvasNodeType.Panorama;
        const size = isPanorama ? PANORAMA_NODE_SIZE : fitNodeSize(image.width, image.height);
        const id = type + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
        const newNode: CanvasNodeData = {
            id,
            type,
            title,
            position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
            width: size.width,
            height: size.height,
            metadata: isPanorama ? { ...imageMetadata(image), size: PANORAMA_IMAGE_SIZE, panoramaProjection: "equirectangular" } : imageMetadata(image),
        };
        setNodes((prev) => [...prev, newNode]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnectionId(null);
        setDialogNodeId(id);
    }, []);

    const createImageFileNode = useCallback(async (file: File, position: Position, choosePanoramaImport = false) => {
        const hideLoading = message.loading("正在上传图片...", 0);
        try {
            const image = await uploadImage(file);
            if (choosePanoramaImport && image.width === image.height * 2) {
                setPendingPanoramaImport({ image, title: file.name, position });
                return;
            }
            appendImportedImageNode(image, file.name, position, CanvasNodeType.Image);
        } catch (error) {
            console.error("Upload image node failed:", error);
            message.error("图片上传失败");
        } finally {
            hideLoading();
        }
    }, [appendImportedImageNode, message]);

    const finishPanoramaImport = useCallback((type: CanvasNodeType.Image | CanvasNodeType.Panorama) => {
        if (!pendingPanoramaImport) return;
        setPendingPanoramaImport(null);
        appendImportedImageNode(pendingPanoramaImport.image, pendingPanoramaImport.title, pendingPanoramaImport.position, type);
    }, [appendImportedImageNode, pendingPanoramaImport]);
    const createVideoFileNode = useCallback(async (file: File, position: Position) => {
        const hideLoading = message.loading("正在上传视频...", 0);
        try {
            const video = await uploadMediaFile(file, "video");
            const size = fitNodeSize(video.width || 1280, video.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
            const id = `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setNodes((prev) => [
                ...prev,
                {
                    id,
                    type: CanvasNodeType.Video,
                    title: file.name,
                    position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
                    width: size.width,
                    height: size.height,
                    metadata: videoMetadata(video),
                },
            ]);
            setSelectedNodeIds(new Set([id]));
            setSelectedConnectionId(null);
            setDialogNodeId(id);
        } catch (error) {
            console.error("Upload video node failed:", error);
            message.error("视频上传失败");
        } finally {
            hideLoading();
        }
    }, [message]);

    const createAudioFileNode = useCallback(async (file: File, position: Position) => {
        const hideLoading = message.loading("正在上传音频...", 0);
        try {
            const audio = await uploadMediaFile(file, "audio");
            const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
            const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setNodes((prev) => [
                ...prev,
                {
                    id,
                    type: CanvasNodeType.Audio,
                    title: file.name,
                    position: { x: position.x - spec.width / 2, y: position.y - spec.height / 2 },
                    width: spec.width,
                    height: spec.height,
                    metadata: audioMetadata(audio),
                },
            ]);
            setSelectedNodeIds(new Set([id]));
            setSelectedConnectionId(null);
        } catch (error) {
            console.error("Upload audio node failed:", error);
            message.error("音频上传失败");
        } finally {
            hideLoading();
        }
    }, [message]);

    const createTextNodeFromClipboard = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return false;

            const node = {
                ...createCanvasNode(CanvasNodeType.Text, getCanvasCenter(), { content: trimmed, status: NODE_STATUS_SUCCESS }),
                title: trimmed.slice(0, 32) || "剪切板文本",
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
            setContextMenu(null);
            setDialogNodeId(node.id);
            return true;
        },
        [getCanvasCenter],
    );

    const pasteSystemClipboard = useCallback(async () => {
        if (!navigator.clipboard) return;

        const items = await navigator.clipboard.read();
        const imageItem = items.find((item) => item.types.some((type) => type.startsWith("image/")));
        if (imageItem) {
            const imageType = imageItem.types.find((type) => type.startsWith("image/"));
            if (!imageType) return;
            const blob = await imageItem.getType(imageType);
            const file = new File([blob], "clipboard-image.png", { type: imageType });
            void createImageFileNode(file, getCanvasCenter());
            message.success("已从剪切板添加图片");
            return;
        }

        const text = await navigator.clipboard.readText();
        if (createTextNodeFromClipboard(text)) message.success("已从剪切板添加文本");
    }, [createImageFileNode, createTextNodeFromClipboard, getCanvasCenter, message]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || target?.closest("[contenteditable='true'],[data-canvas-no-zoom]")) return;

            const key = event.key.toLowerCase();
            const isModifierShortcut = event.metaKey || event.ctrlKey;

            if (isModifierShortcut && !event.altKey && key === "z") {
                event.preventDefault();
                if (event.shiftKey) redoCanvas();
                else undoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "y") {
                event.preventDefault();
                redoCanvas();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "a") {
                event.preventDefault();
                setSelectedNodeIds(new Set(nodesRef.current.map((node) => node.id)));
                setSelectedConnectionId(null);
                setContextMenu(null);
                setSelectionBox(null);
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "g") {
                event.preventDefault();
                createGroupFromSelection();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "c") {
                event.preventDefault();
                copySelectedNodes();
                return;
            }

            if (isModifierShortcut && !event.altKey && key === "v") {
                event.preventDefault();
                if (!pasteCopiedNodes()) void pasteSystemClipboard();
                return;
            }

            if (event.key === "Delete" || event.key === "Backspace") {
                if (selectedNodeIdsRef.current.size) {
                    deleteNodes(new Set(selectedNodeIdsRef.current));
                } else if (selectedConnectionId) {
                    deleteConnection(selectedConnectionId);
                }
            }

            if (event.key === "Escape") {
                setSelectedNodeIds(new Set());
                setSelectedConnectionId(null);
                setContextMenu(null);
                setNodeCreatePosition(null);
                setSelectionBox(null);
                setConnecting(null);
                setHoveredNodeId(null);
                setToolbarNodeId(null);
                setDialogNodeId(null);
                setEditingNodeId(null);
                setInfoNodeId(null);
                setCropNodeId(null);
                setMaskEditNodeId(null);
                setPendingConnectionCreate(null);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [copySelectedNodes, createGroupFromSelection, deleteConnection, deleteNodes, pasteCopiedNodes, pasteSystemClipboard, redoCanvas, selectedConnectionId, setConnecting, undoCanvas]);

    const handleConnectStart = useCallback(
        (event: ReactMouseEvent, nodeId: string, handleType: "source" | "target") => {
            event.stopPropagation();
            setMouseWorld(screenToCanvas(event.clientX, event.clientY));
            setConnecting({ nodeId, handleType });
            connectionTargetNodeIdRef.current = null;
            setConnectionTargetNodeId(null);
            setSelectedConnectionId(null);
        },
        [screenToCanvas, setConnecting],
    );

    const handleNodeResize = useCallback((nodeId: string, width: number, height: number, position?: Position) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, width, height, position: position || node.position } : node)));
    }, []);

    const toggleNodeFreeResize = useCallback((nodeId: string) => {
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                const freeResize = !node.metadata?.freeResize;
                if (freeResize || !isCanvasImageNodeType(node.type)) return { ...node, metadata: { ...node.metadata, freeResize } };
                const ratio = (node.metadata?.naturalWidth || node.width) / (node.metadata?.naturalHeight || node.height || 1);
                const height = node.width / ratio;
                return { ...node, height, position: { x: node.position.x, y: node.position.y + node.height / 2 - height / 2 }, metadata: { ...node.metadata, freeResize } };
            }),
        );
    }, []);

    const handleNodeContentChange = useCallback((nodeId: string, content: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, content } } : node)));
    }, []);

    const handleNodeTitleChange = useCallback((nodeId: string, title: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, title } : node)));
    }, []);

    const toggleBatchExpanded = useCallback((nodeId: string) => {
        const isExpanded = Boolean(nodesRef.current.find((node) => node.id === nodeId)?.metadata?.imageBatchExpanded);
        if (isExpanded) {
            setCollapsingBatchIds((prev) => new Set(prev).add(nodeId));
            window.setTimeout(() => {
                setCollapsingBatchIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }, 320);
        } else {
            setOpeningBatchIds((prev) => new Set(prev).add(nodeId));
            window.setTimeout(() => {
                setOpeningBatchIds((prev) => {
                    const next = new Set(prev);
                    next.delete(nodeId);
                    return next;
                });
            }, 260);
        }
        setNodes((prev) =>
            prev.map((node) => {
                if (node.id !== nodeId) return node;
                return { ...node, metadata: { ...node.metadata, imageBatchExpanded: !node.metadata?.imageBatchExpanded } };
            }),
        );
    }, []);

    const setBatchPrimary = useCallback((child: CanvasNodeData) => {
        const rootId = child.metadata?.batchRootId;
        if (!rootId || !child.metadata?.content) return;
        setNodes((prev) =>
            prev.map((node) =>
                node.id === rootId
                    ? {
                        ...node,
                        width: child.width,
                        height: child.height,
                        metadata: {
                            ...node.metadata,
                            content: child.metadata?.content,
                            primaryImageId: child.id,
                            naturalWidth: child.metadata?.naturalWidth,
                            naturalHeight: child.metadata?.naturalHeight,
                            freeResize: child.metadata?.freeResize,
                            panoramaProjection: child.metadata?.panoramaProjection,
                        },
                    }
                    : node,
            ),
        );
    }, []);

    const openTextEditor = useCallback((node: CanvasNodeData) => {
        if (node.type !== CanvasNodeType.Text) return;
        setSelectedNodeIds(new Set([node.id]));
        setSelectedConnectionId(null);
        setDialogNodeId(node.id);
        setEditingNodeId(node.id);
        setEditRequestNonce((value) => value + 1);
    }, []);

    const handleNodePromptChange = useCallback((nodeId: string, prompt: string) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: node.type === CanvasNodeType.Panorama ? { ...node.metadata, prompt, panoramaSourcePrompt: prompt } : { ...node.metadata, prompt } } : node)));
    }, []);

    const handleConfigNodeChange = useCallback((nodeId: string, patch: Partial<CanvasNodeData["metadata"]>) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? applyNodeConfigPatch(node, patch) : node)));
    }, []);

    const handleDirectorProjectChange = useCallback(
        (project: unknown) => {
            if (!openDirectorNodeId) return;
            setNodes((prev) =>
                prev.map((node) =>
                    node.id === openDirectorNodeId && node.type === CanvasNodeType.Director
                        ? { ...node, metadata: { ...node.metadata, directorProject: project } }
                        : node,
                ),
            );
        },
        [openDirectorNodeId],
    );

    const handleDirectorPanoramaRemoved = useCallback(
        ({ edgeId, sourceNodeId }: Pick<CanvasDirectorPanorama, "edgeId" | "sourceNodeId">) => {
            if (!openDirectorNodeId) return;
            const connection = connectionsRef.current.find(
                (item) => item.id === edgeId && item.fromNodeId === sourceNodeId && item.toNodeId === openDirectorNodeId,
            );
            if (!connection) return;
            setConnections((prev) => prev.filter((item) => item.id !== connection.id));
        },
        [openDirectorNodeId],
    );

    const handleDirectorCapturesSent = useCallback(
        async (directorNodeId: string, captures: CanvasDirectorCapture[]) => {
            const director = nodesRef.current.find((node) => node.id === directorNodeId && node.type === CanvasNodeType.Director);
            if (!director || captures.length === 0) return;

            const hideLoading = message.loading(captures.length > 1 ? "正在发送 " + captures.length + " 张截图到画布..." : "正在发送截图到画布...", 0);
            try {
                const images = await Promise.all(
                    captures.map(async (capture) => {
                        const image = await uploadImage(capture.dataUrl, { localOnly: true });
                        return {
                            id: nanoid(),
                            title: capture.fileName,
                            size: fitNodeSize(image.width, image.height),
                            metadata: imageMetadata(image),
                        };
                    }),
                );
                let y = director.position.y;
                for (const connection of connectionsRef.current) {
                    if (connection.fromNodeId !== director.id) continue;
                    const outputNode = nodesRef.current.find((node) => node.id === connection.toNodeId);
                    if (outputNode?.type === CanvasNodeType.Image) {
                        y = Math.max(y, outputNode.position.y + outputNode.height + 36);
                    }
                }
                const imageNodes = images.map((image) => {
                    const node = {
                        id: image.id,
                        type: CanvasNodeType.Image,
                        title: image.title,
                        position: { x: director.position.x + director.width + 96, y },
                        width: image.size.width,
                        height: image.size.height,
                        metadata: image.metadata,
                    } satisfies CanvasNodeData;
                    y += node.height + 36;
                    return node;
                });
                setNodes((prev) => [...prev, ...imageNodes]);
                setConnections((prev) => [...prev, ...imageNodes.map((node) => ({ id: nanoid(), fromNodeId: director.id, toNodeId: node.id }))]);
                setSelectedNodeIds(new Set(imageNodes.map((node) => node.id)));
                setSelectedConnectionId(null);
                message.success(captures.length > 1 ? "已发送 " + captures.length + " 张截图到画布" : "截图已发送到画布");
            } catch (error) {
                console.error("Send director captures to canvas failed:", error);
                message.error("截图发送到画布失败");
            } finally {
                hideLoading();
            }
        },
        [message],
    );

    const downloadNodeImage = useCallback((node: CanvasNodeData) => {
        if ((!isCanvasImageNodeType(node.type) && node.type !== CanvasNodeType.Video && node.type !== CanvasNodeType.Audio) || !node.metadata?.content) return;
        saveAs(node.metadata.content, `canvas-${node.type}-${node.id}.${node.type === CanvasNodeType.Video ? "mp4" : node.type === CanvasNodeType.Audio ? audioExtension(node.metadata.mimeType) : imageExtension(node.metadata.content)}`);
    }, []);

    const uploadNodeVideoToCloud = useCallback(async (node: CanvasNodeData) => {
        if (node.type !== CanvasNodeType.Video || !node.metadata?.content || node.metadata.storageKey?.startsWith("server:") || uploadingVideoNodeIdsRef.current.has(node.id)) return;
        uploadingVideoNodeIdsRef.current.add(node.id);
        const hideLoading = message.loading("正在上传视频至云存储...", 0);
        try {
            const videoUrl = await resolveMediaUrl(node.metadata.storageKey, node.metadata.content);
            const uploaded = await uploadRemoteMediaToServer(videoUrl, "canvas-video-" + node.id + ".mp4");
            setNodes((nodes) => nodes.map((item) => (item.id === node.id ? {
                ...item,
                metadata: {
                    ...item.metadata,
                    content: uploaded.url,
                    storageKey: uploaded.storageKey,
                    bytes: uploaded.bytes,
                    mimeType: uploaded.mimeType,
                    naturalWidth: uploaded.width || item.metadata?.naturalWidth,
                    naturalHeight: uploaded.height || item.metadata?.naturalHeight,
                },
            } : item)));
            message.success("视频已上传至云存储");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "";
            if (errorMessage.includes("服务端对象存储未启用") || errorMessage.includes("用户对象存储配置不完整")) {
                message.error("未添加云存储");
            } else {
                message.error(errorMessage || "视频上传失败");
            }
        } finally {
            hideLoading();
            uploadingVideoNodeIdsRef.current.delete(node.id);
        }
    }, [message]);

    const uploadNodeImageToCloud = useCallback(async (node: CanvasNodeData) => {
        if (!isCanvasImageNodeType(node.type) || !node.metadata?.content || node.metadata.storageKey?.startsWith("server:") || uploadingImageNodeIdsRef.current.has(node.id)) return;
        uploadingImageNodeIdsRef.current.add(node.id);
        const hideLoading = message.loading("正在上传图片至云存储...", 0);
        try {
            const imageUrl = await resolveImageUrl(node.metadata.storageKey, node.metadata.content);
            const uploaded = await uploadRemoteImageToServer(imageUrl, "canvas-image-" + node.id + ".png");
            setNodes((nodes) => nodes.map((item) => (item.id === node.id ? {
                ...item,
                metadata: {
                    ...item.metadata,
                    content: uploaded.url,
                    storageKey: uploaded.storageKey,
                    bytes: uploaded.bytes,
                    mimeType: uploaded.mimeType,
                    naturalWidth: uploaded.width || item.metadata?.naturalWidth,
                    naturalHeight: uploaded.height || item.metadata?.naturalHeight,
                },
            } : item)));
            message.success("图片已上传至云存储");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "";
            if (errorMessage.includes("服务端对象存储未启用") || errorMessage.includes("用户对象存储配置不完整")) {
                message.error("未添加云存储");
            } else {
                message.error(errorMessage || "图片上传失败");
            }
        } finally {
            hideLoading();
            uploadingImageNodeIdsRef.current.delete(node.id);
        }
    }, [message]);

    const saveNodeAsset = useCallback(
        async (node: CanvasNodeData) => {
            if (node.type === CanvasNodeType.Text) {
                const content = node.metadata?.content?.trim();
                if (!content) return message.error("没有可保存的文本");
                addAsset({ kind: "text", title: node.metadata?.prompt?.slice(0, 24) || "画布文本", coverUrl: "", tags: [], source: "Canvas", data: { content }, metadata: { source: "canvas", nodeId: node.id } });
                message.success("已加入我的素材");
                return;
            }
            if (node.type === CanvasNodeType.Video) {
                if (!node.metadata?.content) return message.error("没有可保存的视频");
                addAsset({ kind: "video", title: node.metadata?.prompt?.slice(0, 24) || "画布视频", coverUrl: "", tags: [], source: "Canvas", data: { url: node.metadata.content, storageKey: node.metadata.storageKey, width: node.width, height: node.height, bytes: node.metadata.bytes || 0, mimeType: node.metadata.mimeType || "video/mp4" }, metadata: { source: "canvas", nodeId: node.id, prompt: node.metadata?.prompt } });
                message.success("已加入我的素材");
                return;
            }
            if (!node.metadata?.content) return message.error("没有可保存的图片");
            const dataUrl = node.metadata.storageKey ? "" : node.metadata.content;
            addAsset({
                kind: "image",
                title: node.metadata?.prompt?.slice(0, 24) || "画布图片",
                coverUrl: node.metadata.content,
                tags: [],
                source: "Canvas",
                data: {
                    dataUrl,
                    storageKey: node.metadata.storageKey,
                    width: node.metadata.naturalWidth || node.width,
                    height: node.metadata.naturalHeight || node.height,
                    bytes: node.metadata.bytes || getDataUrlByteSize(dataUrl),
                    mimeType: node.metadata.mimeType || "image/png",
                },
                metadata: { source: "canvas", nodeId: node.id, prompt: node.metadata?.prompt },
            });
            message.success("已加入我的素材");
        },
        [addAsset, message],
    );

    const createImageReversePromptNodes = useCallback(
        (node: CanvasNodeData) => {
            if (!isCanvasImageNodeType(node.type) || !node.metadata?.content) {
                message.warning("图片节点为空，无法反推提示词");
                return;
            }

            const gap = 96;
            const textSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Text];
            const configSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Config];
            const centerY = node.position.y + node.height / 2;
            const textNode = {
                ...createCanvasNode(
                    CanvasNodeType.Text,
                    { x: node.position.x + node.width + gap + textSpec.width / 2, y: centerY },
                    { content: IMAGE_PROMPT_REVERSE_PRESET, prompt: IMAGE_PROMPT_REVERSE_PRESET, status: NODE_STATUS_SUCCESS, fontSize: 14 },
                ),
                title: "反推提示词",
            };
            const configNode = {
                ...createCanvasNode(
                    CanvasNodeType.Config,
                    { x: textNode.position.x + textNode.width + gap + configSpec.width / 2, y: centerY },
                    {
                        generationMode: "text",
                        model: effectiveConfig.textModel || effectiveConfig.model || defaultConfig.textModel,
                        count: 1,
                        composerContent: `参考图片：@[node:${node.id}]\n任务说明：@[node:${textNode.id}]`,
                    },
                ),
                title: "反推提示词配置",
            };

            setNodes((prev) => [...prev, textNode, configNode]);
            setConnections((prev) => [
                ...prev,
                { id: nanoid(), fromNodeId: node.id, toNodeId: configNode.id },
                { id: nanoid(), fromNodeId: textNode.id, toNodeId: configNode.id },
            ]);
            setSelectedNodeIds(new Set([configNode.id]));
            setSelectedConnectionId(null);
            setDialogNodeId(configNode.id);
            setContextMenu(null);
        },
        [effectiveConfig.model, effectiveConfig.textModel, message],
    );

    const cropImageNode = useCallback(async (node: CanvasNodeData, crop: CanvasImageCropRect) => {
        if (!node.metadata?.content) return;
        const cropped = await cropDataUrl(node.metadata.content, crop);
        const image = await uploadImage(cropped);
        const width = Math.min(node.width, Math.max(220, image.width));
        const childId = nanoid();
        const child: CanvasNodeData = {
            id: childId,
            type: CanvasNodeType.Image,
            title: "Cropped Image",
            position: { x: node.position.x + node.width + 96, y: node.position.y },
            width,
            height: width * (image.height / image.width),
            metadata: {
                ...imageMetadata(image),
                prompt: node.metadata?.prompt,
            },
        };
        setNodes((prev) => [...prev, child]);
        setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
        setSelectedNodeIds(new Set([childId]));
        setDialogNodeId(childId);
        setCropNodeId(null);
    }, []);

    const splitImageNode = useCallback(
        async (node: CanvasNodeData, params: CanvasImageSplitParams) => {
            if (!node.metadata?.content) return;
            setSplitNodeId(null);
            const hideSplitLoading = message.loading("正在处理切图...", 0);
            let uploadedImages: UploadedImage[] = [];

            try {
                const pieces = await splitDataUrl(node.metadata.content, params);
                const rows = params.horizontalLines.length + 1;
                const columns = params.verticalLines.length + 1;
                const gap = 16;
                const cellWidth = node.width / columns;
                const cellHeight = node.height / rows;
                const startX = node.position.x + node.width + 96;
                const startY = node.position.y;
                const uploadResults = await Promise.allSettled(
                    pieces.map(async (piece) => ({
                        piece,
                        image: await uploadImage(piece.dataUrl),
                    })),
                );
                const uploadedPieces = uploadResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
                uploadedImages = uploadedPieces.map(({ image }) => image);
                const failedUpload = uploadResults.find((result) => result.status === "rejected");

                if (failedUpload?.status === "rejected") throw failedUpload.reason;

                const childNodes = uploadedPieces.map(({ piece, image }) => {
                    const id = nanoid();
                    return {
                        id,
                        type: CanvasNodeType.Image,
                        title: `${node.title || "图片"} ${piece.row + 1}-${piece.column + 1}`,
                        position: { x: startX + piece.column * (cellWidth + gap), y: startY + piece.row * (cellHeight + gap) },
                        width: cellWidth,
                        height: cellHeight,
                        metadata: {
                            ...imageMetadata(image),
                            prompt: node.metadata?.prompt,
                        },
                    } satisfies CanvasNodeData;
                });

                setNodes((prev) => [...prev, ...childNodes]);
                setConnections((prev) => [...prev, ...childNodes.map((child) => ({ id: nanoid(), fromNodeId: node.id, toNodeId: child.id }))]);
                setSelectedNodeIds(new Set(childNodes.map((child) => child.id)));
                setSelectedConnectionId(null);
                setDialogNodeId(null);
                uploadedImages = [];
                message.success(`已切分为 ${childNodes.length} 个子节点`);
            } catch (error) {
                let cleanupFailed = false;

                if (uploadedImages.length) {
                    try {
                        await deleteStoredImages(uploadedImages.map((image) => image.storageKey));
                    } catch {
                        cleanupFailed = true;
                    }
                }

                const errorMessage = error instanceof Error ? error.message : "切图失败";
                message.error(cleanupFailed ? `${errorMessage}；部分临时图片清理失败` : errorMessage);
            } finally {
                hideSplitLoading();
            }
        },
        [message],
    );

    const maskEditImageNode = useCallback(
        async (node: CanvasNodeData, payload: CanvasImageMaskEditPayload) => {
            if (!node.metadata?.content) return;
            const baseGenerationConfig = buildGenerationConfig(effectiveConfig, node, "image");
            const generationConfig = { ...baseGenerationConfig, model: payload.model || baseGenerationConfig.model, activeChannelId: payload.channelId || baseGenerationConfig.imageChannelId || baseGenerationConfig.activeChannelId, imageChannelId: payload.channelId || baseGenerationConfig.imageChannelId, count: "1", size: node.metadata?.size || "auto" };
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }
            const userPrompt = payload.prompt.trim();
            const prompt = `参考图中蓝色高亮覆盖区域是需要修改的位置，蓝色只是编辑标记，不要保留在最终图像中。只修改蓝色高亮区域，其他区域的构图、人物、文字、光影和风格保持不变。修改要求：${userPrompt}`;
            const childId = nanoid();
            const clientTaskId = `client_image_task_${childId}`;
            const markedReference = { id: `${node.id}-marked`, name: `${node.title || node.id}-marked.png`, type: "image/png", dataUrl: payload.markedDataUrl };
            const generationMetadata = buildImageGenerationMetadata("edit", generationConfig, 1, [markedReference]);
            const childNode: CanvasNodeData = {
                id: childId,
                type: CanvasNodeType.Image,
                title: userPrompt.slice(0, 32) || "局部编辑结果",
                position: { x: node.position.x + node.width + 96, y: node.position.y },
                width: node.width,
                height: node.height,
                metadata: { prompt, status: NODE_STATUS_LOADING, startedAt: Date.now(), progress: 0, imageTaskId: clientTaskId, ...generationMetadata },
            };
            setMaskEditNodeId(null);
            setRunningNodeId(childId);
            setNodes((prev) => [...prev, childNode]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setSelectedConnectionId(null);
            setDialogNodeId(childId);
            try {
                const task = await createCanvasImageTask(generationConfig, prompt, [markedReference], { nodeId: childId, sourceId: projectId, clientTaskId, characterIds: node.metadata?.characterIds || [] });
                setNodes((prev) => applyCanvasImageTaskUpdate(prev, childId, task, childNode.metadata?.startedAt || Date.now(), { width: node.width, height: node.height }));
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "局部修改失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, isAiConfigReady, message, openConfigDialog, projectId],
    );

    const upscaleImageNode = useCallback(async (node: CanvasNodeData, params: CanvasImageUpscaleParams) => {
        if (!node.metadata?.content) return;
        setUpscaleNodeId(null);
        const hideLoading = message.loading("正在放大图片...", 0);
        try {
            const upscaled = await upscaleDataUrl(node.metadata.content, params);
            const image = await uploadImage(upscaled);
            const size = fitNodeSize(image.width, image.height);
            const childId = nanoid();
            const child: CanvasNodeData = {
                id: childId,
                type: CanvasNodeType.Image,
                title: "Upscaled Image",
                position: { x: node.position.x + node.width + 96, y: node.position.y },
                width: size.width,
                height: size.height,
                metadata: {
                    ...imageMetadata(image),
                    prompt: node.metadata?.prompt,
                },
            };
            setNodes((prev) => [...prev, child]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setDialogNodeId(childId);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "图片放大失败");
        } finally {
            hideLoading();
        }
    }, [message]);

    const generateAngleNode = useCallback(
        async (node: CanvasNodeData, params: CanvasImageAngleParams) => {
            if (!node.metadata?.content) return;
            const generationConfig = { ...buildGenerationConfig(effectiveConfig, node, "image"), count: "1" };
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }
            const childId = nanoid();
            const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
            const title = buildAngleLabel(params);
            const prompt = buildAnglePrompt(params);
            const referenceImages = [{ id: node.id, name: `${node.title || node.id}.png`, type: node.metadata.mimeType || "image/png", dataUrl: node.metadata.content, storageKey: node.metadata.storageKey }];
            const generationMetadata = buildImageGenerationMetadata("edit", generationConfig, 1, referenceImages);
            const clientTaskId = `client_image_task_${childId}`;
            const startedAt = Date.now();
            setAngleNodeId(null);
            setRunningNodeId(childId);
            setNodes((prev) => [
                ...prev,
                {
                    id: childId,
                    type: CanvasNodeType.Image,
                    title,
                    position: { x: node.position.x + node.width + 96, y: node.position.y },
                    width: imageConfig.width,
                    height: imageConfig.height,
                    metadata: { prompt, status: NODE_STATUS_LOADING, imageTaskId: clientTaskId, startedAt, progress: 0, ...generationMetadata },
                },
            ]);
            setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: node.id, toNodeId: childId }]);
            setSelectedNodeIds(new Set([childId]));
            setDialogNodeId(childId);
            try {
                const task = await createCanvasImageTask(generationConfig, prompt, referenceImages, { nodeId: childId, sourceId: projectId, clientTaskId, characterIds: node.metadata?.characterIds || [] });
                setNodes((prev) => applyCanvasImageTaskUpdate(prev, childId, task, startedAt, { width: imageConfig.width, height: imageConfig.height }));
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                setNodes((prev) => prev.map((item) => (item.id === childId ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, message, openConfigDialog, projectId],
    );

    const handleFontSizeChange = useCallback((nodeId: string, fontSize: number) => {
        setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, fontSize } } : node)));
    }, []);

    const handleUploadRequest = useCallback((nodeId?: string, position?: Position) => {
        uploadTargetRef.current = { nodeId, position };
        imageInputRef.current?.click();
    }, []);

    const handleImageInputChange = useCallback(
        async (event: ReactChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            const target = uploadTargetRef.current;
            if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/") && !isAudioFile(file))) return;
            const targetNode = target?.nodeId ? nodesRef.current.find((node) => node.id === target.nodeId) : null;
            if (isPanoramaNodeType(targetNode?.type) && !file.type.startsWith("image/")) {
                message.warning("全景图节点仅支持上传图片作为参考");
                uploadTargetRef.current = null;
                event.target.value = "";
                return;
            }

            if (target?.nodeId) {
                const hideLoading = message.loading(isAudioFile(file) ? "正在上传音频..." : file.type.startsWith("video/") ? "正在上传视频..." : "正在上传图片...", 0);
                try {
                    if (isAudioFile(file)) {
                        const audio = await uploadMediaFile(file, "audio");
                        const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
                        setNodes((prev) => prev.map((node) => (node.id === target.nodeId ? { ...node, type: CanvasNodeType.Audio, title: file.name, position: { x: node.position.x + node.width / 2 - spec.width / 2, y: node.position.y + node.height / 2 - spec.height / 2 }, width: spec.width, height: spec.height, metadata: { ...node.metadata, ...audioMetadata(audio), errorDetails: undefined } } : node)));
                        setSelectedNodeIds(new Set([target.nodeId]));
                        setSelectedConnectionId(null);
                    } else if (file.type.startsWith("video/")) {
                        const video = await uploadMediaFile(file, "video");
                        const nextSize = fitNodeSize(video.width || 1280, video.height || 720, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
                        setNodes((prev) => prev.map((node) => (node.id === target.nodeId ? { ...node, type: CanvasNodeType.Video, title: file.name, position: { x: node.position.x + node.width / 2 - nextSize.width / 2, y: node.position.y + node.height / 2 - nextSize.height / 2 }, width: nextSize.width, height: nextSize.height, metadata: { ...node.metadata, ...videoMetadata(video), errorDetails: undefined } } : node)));
                        setSelectedNodeIds(new Set([target.nodeId]));
                        setSelectedConnectionId(null);
                        setDialogNodeId(target.nodeId);
                    } else {
                        const image = await uploadImage(file);
                        const size = fitNodeSize(image.width, image.height);
                        setNodes((prev) =>
                            prev.map((node) => {
                                if (node.id !== target.nodeId) return node;
                                const isPanorama = isPanoramaNodeType(node.type);
                                const nextSize = isPanorama ? PANORAMA_NODE_SIZE : size;
                                return {
                                    ...node,
                                    type: isPanorama ? CanvasNodeType.Panorama : CanvasNodeType.Image,
                                    title: isPanorama ? node.title : file.name,
                                    position: isPanorama ? { x: node.position.x + node.width / 2 - nextSize.width / 2, y: node.position.y + node.height / 2 - nextSize.height / 2 } : node.position,
                                    width: nextSize.width,
                                    height: nextSize.height,
                                    metadata: {
                                        ...node.metadata,
                                        ...imageMetadata(image),
                                        errorDetails: undefined,
                                        freeResize: false,
                                        isBatchRoot: undefined,
                                        batchRootId: undefined,
                                        batchChildIds: undefined,
                                        batchUsesReferenceImages: undefined,
                                        generationType: undefined,
                                        model: isPanorama ? node.metadata?.model : undefined,
                                        size: isPanorama ? PANORAMA_IMAGE_SIZE : undefined,
                                        quality: isPanorama ? node.metadata?.quality : undefined,
                                        count: isPanorama ? node.metadata?.count : undefined,
                                        references: undefined,
                                        primaryImageId: undefined,
                                        imageBatchExpanded: undefined,
                                        imageTaskId: undefined,
                                        imageTaskResultId: undefined,
                                        panoramaSourcePrompt: isPanorama ? node.metadata?.panoramaSourcePrompt : undefined,
                                        panoramaFinalPrompt: undefined,
                                        panoramaProjection: undefined,
                                    },
                                };
                            }),
                        );
                        setSelectedNodeIds(new Set([target.nodeId]));
                        setSelectedConnectionId(null);
                        setDialogNodeId(target.nodeId);
                    }
                } catch (error) {
                    console.error("Upload node file failed:", error);
                    message.error("上传失败");
                } finally {
                    hideLoading();
                }
            } else {
                const position = target?.position || screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
                void (isAudioFile(file) ? createAudioFileNode(file, position) : file.type.startsWith("video/") ? createVideoFileNode(file, position) : createImageFileNode(file, position, true));
            }

            uploadTargetRef.current = null;
            event.target.value = "";
        },
        [createAudioFileNode, createImageFileNode, createVideoFileNode, screenToCanvas, size.height, size.width],
    );

    function insertAssetAt(payload: InsertAssetPayload, position?: Position) {
        const center = position || screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
        if (payload.kind === "text") {
            createNode(CanvasNodeType.Text, position, payload.content);
            return;
        }
        if (payload.kind === "video") {
            const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Video];
            const id = `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const nextSize = fitNodeSize(payload.width || spec.width, payload.height || spec.height, VIDEO_NODE_MAX_WIDTH, VIDEO_NODE_MAX_HEIGHT);
            setNodes((prev) => [...prev, { id, type: CanvasNodeType.Video, title: payload.title, position: { x: center.x - nextSize.width / 2, y: center.y - nextSize.height / 2 }, width: nextSize.width, height: nextSize.height, metadata: { content: payload.url, storageKey: payload.storageKey, status: NODE_STATUS_SUCCESS, naturalWidth: payload.width, naturalHeight: payload.height } }]);
            setSelectedNodeIds(new Set([id]));
            setSelectedConnectionId(null);
            return;
        }
        if (payload.kind === "audio") {
            const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
            const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            setNodes((prev) => [...prev, { id, type: CanvasNodeType.Audio, title: payload.title, position: { x: center.x - spec.width / 2, y: center.y - spec.height / 2 }, width: spec.width, height: spec.height, metadata: { content: payload.url, storageKey: payload.storageKey, status: NODE_STATUS_SUCCESS, bytes: payload.bytes, mimeType: payload.mimeType || "audio/mpeg", durationMs: payload.durationMs } }]);
            setSelectedNodeIds(new Set([id]));
            setSelectedConnectionId(null);
            return;
        }
        insertAssistantImage({ id: `asset-${Date.now()}`, prompt: payload.title, dataUrl: payload.dataUrl, storageKey: payload.storageKey, source: payload.source }, position);
    }

    const handleDrop = useCallback(
        (event: ReactDragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const payload = draggedAssetPayloadRef.current;
            if (event.dataTransfer.getData(CANVAS_ASSET_DRAG_TYPE) && payload) {
                insertAssetAt(payload, screenToCanvas(event.clientX, event.clientY));
                return;
            }
            const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/") || item.type.startsWith("video/") || isAudioFile(item));
            if (!file) return;
            const pos = screenToCanvas(event.clientX, event.clientY);
            void (isAudioFile(file) ? createAudioFileNode(file, pos) : file.type.startsWith("video/") ? createVideoFileNode(file, pos) : createImageFileNode(file, pos, true));
        },
        [createAudioFileNode, createImageFileNode, createVideoFileNode, insertAssetAt, screenToCanvas],
    );

    const pasteAssistantImage = useCallback(
        (file: File) => {
            const position = screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            void createImageFileNode(file, position);
            message.success("已从剪切板添加图片");
        },
        [createImageFileNode, message, screenToCanvas, size.height, size.width],
    );

    const handleAssistantSessionsChange = useCallback((sessions: CanvasAssistantSession[], activeId: string | null) => {
        setChatSessions(sessions);
        setActiveChatId(activeId);
    }, []);

    const startTitleEditing = useCallback(() => {
        setTitleDraft(currentProject?.title || "未命名画布");
        setTitleEditing(true);
    }, [currentProject?.title]);

    const finishTitleEditing = useCallback(() => {
        const nextTitle = titleDraft.trim();
        if (nextTitle) renameProject(projectId, nextTitle);
        setTitleEditing(false);
    }, [projectId, renameProject, titleDraft]);

    const preventCanvasContextMenu = useCallback((event: ReactMouseEvent) => {
        if ((event.target as HTMLElement).closest("[data-node-id]")) return;
        event.preventDefault();
        setContextMenu(null);
    }, []);

    const handleGenerateNode = useCallback(
        async (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => {
            const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
            const generationConfig = buildGenerationConfig(effectiveConfig, sourceNode, mode);
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }

            setRunningNodeId(nodeId);
            const sourceTextContent = sourceNode?.type === CanvasNodeType.Text ? sourceNode.metadata?.content?.trim() || "" : "";
            const editingTextNode = mode === "text" && Boolean(sourceTextContent);
            const generationContext = await hydrateNodeGenerationContext(
                buildNodeGenerationContext(nodeId, nodesRef.current, connectionsRef.current, editingTextNode ? `请根据要求修改以下文本。\n\n原文：\n${sourceTextContent}\n\n修改要求：\n${prompt}` : prompt),
            );
            const effectivePrompt = generationContext.prompt.trim();
            const requestPrompt =
                mode === "video" || (mode === "image" && !isPanoramaNodeType(sourceNode?.type))
                    ? applyCameraPrompt(effectivePrompt, sourceNode?.metadata?.cameraControl)
                    : effectivePrompt;
            const markSourceStatus = !isCanvasImageNodeType(sourceNode?.type) && !editingTextNode;
            const statusPrompt = sourceNode?.type === CanvasNodeType.Config ? effectivePrompt : prompt;
            if (!effectivePrompt && (mode === "text" || mode === "audio")) {
                setRunningNodeId(null);
                return;
            }
            let pendingChildIds: string[] = [];
            const generationStartedAt = Date.now();
            if (markSourceStatus) setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, prompt: statusPrompt, status: NODE_STATUS_LOADING, startedAt: generationStartedAt, durationMs: undefined, errorDetails: undefined } } : node)));

            try {
                if (mode === "image" && isPanoramaNodeType(sourceNode?.type)) {
                    const panoramaSourcePrompt = prompt.trim();
                    const sourceReference: ReferenceImage[] = sourceNode?.metadata?.content
                        ? [{ id: sourceNode.id, name: (sourceNode.title || sourceNode.id) + ".png", type: sourceNode.metadata.mimeType || "image/png", dataUrl: sourceNode.metadata.content, storageKey: sourceNode.metadata.storageKey }]
                        : [];
                    const referenceImages = [...sourceReference, ...generationContext.referenceImages];
                    const panoramaPrompt = buildPanoramaPrompt(effectivePrompt, referenceImages.length > 0);
                    const panoramaGenerationConfig = { ...generationConfig, size: PANORAMA_IMAGE_SIZE };
                    const count = getGenerationCount(panoramaGenerationConfig.count);
                    const isEmptyPanoramaNode = !sourceNode?.metadata?.content;
                    const panoramaNodeConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Panorama];
                    const parentPosition = sourceNode?.position || { x: 0, y: 0 };
                    const gap = 96;
                    const rowGap = 36;
                    const rootId = isEmptyPanoramaNode ? nodeId : nanoid();
                    const childIds = count > 1 ? Array.from({ length: count }, () => nanoid()) : [];
                    const targetIds = count > 1 ? childIds : [rootId];
                    const targetTaskIds = Object.fromEntries(targetIds.map((id) => [id, "client_image_task_" + id]));
                    const primaryTargetId = targetIds[0];
                    pendingChildIds = isEmptyPanoramaNode ? childIds : [rootId, ...childIds];
                    const rootNode: CanvasNodeData = {
                        id: rootId,
                        type: CanvasNodeType.Panorama,
                        title: sourceNode?.title || "全景图",
                        position: {
                            x: isEmptyPanoramaNode ? parentPosition.x : parentPosition.x + panoramaNodeConfig.width + gap,
                            y: parentPosition.y + panoramaNodeConfig.height / 2 - panoramaNodeConfig.height / 2,
                        },
                        width: isEmptyPanoramaNode ? sourceNode?.width || panoramaNodeConfig.width : panoramaNodeConfig.width,
                        height: isEmptyPanoramaNode ? sourceNode?.height || panoramaNodeConfig.height : panoramaNodeConfig.height,
                        metadata: {
                            ...buildImageGenerationMetadata(referenceImages.length ? "edit" : "generation", panoramaGenerationConfig, count, referenceImages),
                            prompt: panoramaSourcePrompt,
                            characterIds: sourceNode?.metadata?.characterIds || [],
                            panoramaSourcePrompt,
                            panoramaFinalPrompt: panoramaPrompt,
                            panoramaProjection: undefined,
                            status: NODE_STATUS_LOADING,
                            startedAt: generationStartedAt,
                            progress: 0,
                            imageTaskId: primaryTargetId ? targetTaskIds[primaryTargetId] : undefined,
                            primaryImageId: count > 1 ? primaryTargetId : undefined,
                            isBatchRoot: count > 1,
                            batchChildIds: count > 1 ? childIds : undefined,
                            batchUsesReferenceImages: referenceImages.length > 0,
                            imageBatchExpanded: count > 1 ? true : undefined,
                        },
                    };
                    const childNodes: CanvasNodeData[] = childIds.map((id, index) => ({
                        id,
                        type: CanvasNodeType.Panorama,
                        title: sourceNode?.title || "全景图",
                        position: {
                            x: rootNode.position.x + rootNode.width + 120 + (index % 2) * (panoramaNodeConfig.width + 36),
                            y: rootNode.position.y + Math.floor(index / 2) * (panoramaNodeConfig.height + rowGap),
                        },
                        width: panoramaNodeConfig.width,
                        height: panoramaNodeConfig.height,
                        metadata: {
                            ...buildImageGenerationMetadata(referenceImages.length ? "edit" : "generation", panoramaGenerationConfig, count, referenceImages),
                            prompt: panoramaSourcePrompt,
                            characterIds: sourceNode?.metadata?.characterIds || [],
                            panoramaSourcePrompt,
                            panoramaFinalPrompt: panoramaPrompt,
                            panoramaProjection: undefined,
                            status: NODE_STATUS_LOADING,
                            startedAt: generationStartedAt,
                            progress: 0,
                            imageTaskId: targetTaskIds[id],
                            batchRootId: count > 1 ? rootId : undefined,
                        },
                    }));
                    const batchConnections = [...(isEmptyPanoramaNode ? [] : [{ id: nanoid(), fromNodeId: nodeId, toNodeId: rootId }]), ...childIds.map((childId) => ({ id: nanoid(), fromNodeId: rootId, toNodeId: childId }))];

                    setNodes((prev) => [
                        ...prev.map((node) =>
                            node.id === nodeId
                                ? isEmptyPanoramaNode
                                    ? {
                                        ...node,
                                        position: rootNode.position,
                                        width: rootNode.width,
                                        height: rootNode.height,
                                        title: rootNode.title,
                                        metadata: { ...node.metadata, ...rootNode.metadata, errorDetails: undefined },
                                    }
                                    : { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS, errorDetails: undefined } }
                                : node,
                        ),
                        ...(isEmptyPanoramaNode ? [] : [rootNode]),
                        ...childNodes,
                    ]);
                    setConnections((prev) => [...prev, ...batchConnections]);
                    setSelectedNodeIds(new Set([nodeId]));
                    setSelectedConnectionId(null);
                    setDialogNodeId(nodeId);

                    const taskResults = await Promise.all(
                        targetIds.map(async (targetId) => {
                            try {
                                const task = await createCanvasImageTask({ ...panoramaGenerationConfig, count: "1" }, panoramaPrompt, referenceImages, { nodeId: targetId, sourceId: projectId, clientTaskId: targetTaskIds[targetId], characterIds: sourceNode?.metadata?.characterIds || [] });
                                if (task.image_url || task.url) {
                                    setNodes((prev) => {
                                        const root = prev.find((node) => node.id === rootId);
                                        let next = applyCanvasImageTaskUpdate(prev, targetId, task, generationStartedAt, { width: panoramaNodeConfig.width, height: panoramaNodeConfig.height });
                                        if (targetId !== rootId && root?.metadata?.primaryImageId === targetId) {
                                            next = applyCanvasImageTaskUpdate(next, rootId, task, generationStartedAt, { width: panoramaNodeConfig.width, height: panoramaNodeConfig.height });
                                        }
                                        return next;
                                    });
                                    return true;
                                }
                                setNodes((prev) => {
                                    const root = prev.find((node) => node.id === rootId);
                                    return prev.map((node) => {
                                        if (node.id !== targetId && node.id !== rootId) return node;
                                        if (node.id === rootId && (targetId === rootId || !root?.metadata?.primaryImageId)) {
                                            return { ...node, metadata: { ...node.metadata, status: NODE_STATUS_LOADING, imageTaskId: task.id, imageTaskResultId: undefined, primaryImageId: targetId, startedAt: parseCanvasTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || generationStartedAt, progress: task.progress || 0, errorDetails: undefined } };
                                        }
                                        if (node.id === targetId) {
                                            return { ...node, metadata: { ...node.metadata, status: NODE_STATUS_LOADING, imageTaskId: task.id, imageTaskResultId: undefined, startedAt: parseCanvasTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || generationStartedAt, progress: task.progress || 0, errorDetails: undefined } };
                                        }
                                        return node;
                                    });
                                });
                                return true;
                            } catch (error) {
                                const errorDetails = error instanceof Error ? error.message : "全景图生成失败";
                                setNodes((prev) => prev.map((node) => (node.id === targetId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } } : node)));
                                return false;
                            }
                        }),
                    );
                    const hasSuccess = taskResults.some(Boolean);
                    const hasFailure = taskResults.some((result) => !result);
                    if (hasFailure) message.error(hasSuccess ? "部分全景图任务创建失败" : "全部全景图任务创建失败");
                    setNodes((prev) =>
                        prev.map((node) =>
                            node.id === rootId && !hasSuccess
                                ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails: "全部全景图任务创建失败" } }
                                : node,
                        ),
                    );
                    return;
                }

                if (mode === "image") {
                    const count = getGenerationCount(generationConfig.count);
                    const isConfigNode = sourceNode?.type === CanvasNodeType.Config;
                    const isImageNode = sourceNode?.type === CanvasNodeType.Image;
                    const isEmptyImageNode = isImageNode && !sourceNode?.metadata?.content;
                    const sourceReference =
                        isImageNode && sourceNode?.metadata?.content
                            ? [{ id: sourceNode.id, name: `${sourceNode.title || sourceNode.id}.png`, type: sourceNode.metadata.mimeType || "image/png", dataUrl: sourceNode.metadata.content, storageKey: sourceNode.metadata.storageKey }]
                            : [];
                    const referenceImages = sourceReference.length ? sourceReference : generationContext.referenceImages;
                    const generationType = referenceImages.length ? ("edit" as const) : ("generation" as const);
                    const generationMetadata = buildImageGenerationMetadata(generationType, generationConfig, count, referenceImages);
                    const parentConfig = NODE_DEFAULT_SIZE[isConfigNode ? CanvasNodeType.Config : isImageNode ? CanvasNodeType.Image : CanvasNodeType.Text];
                    const imageConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
                    const imageSize = nodeSizeFromRatio(generationConfig.size, imageConfig.width, imageConfig.height) || imageConfig;
                    const parentPosition = sourceNode?.position || { x: 0, y: 0 };
                    const gap = 96;
                    const rowGap = 36;
                    const rootId = isEmptyImageNode ? nodeId : nanoid();
                    const childIds = count > 1 ? Array.from({ length: count }, () => nanoid()) : [];
                    const targetIds = count > 1 ? childIds : [rootId];
                    const targetTaskIds = Object.fromEntries(targetIds.map((id) => [id, `client_image_task_${id}`]));
                    const primaryTargetId = targetIds[0];
                    pendingChildIds = isEmptyImageNode ? childIds : [rootId, ...childIds];
                    const rootNode: CanvasNodeData = {
                        id: rootId,
                        type: CanvasNodeType.Image,
                        title: effectivePrompt.slice(0, 32) || "Generated Image",
                        position: {
                            x: isEmptyImageNode ? parentPosition.x : parentPosition.x + parentConfig.width + gap,
                            y: parentPosition.y + parentConfig.height / 2 - imageSize.height / 2,
                        },
                        width: isEmptyImageNode ? sourceNode?.width || imageSize.width : imageSize.width,
                        height: isEmptyImageNode ? sourceNode?.height || imageSize.height : imageSize.height,
                        metadata: {
                            prompt: effectivePrompt,
                            cameraControl: sourceNode?.metadata?.cameraControl,
                            characterIds: sourceNode?.metadata?.characterIds || [],
                            status: NODE_STATUS_LOADING,
                            startedAt: generationStartedAt,
                            progress: 0,
                            imageTaskId: primaryTargetId ? targetTaskIds[primaryTargetId] : undefined,
                            primaryImageId: count > 1 ? primaryTargetId : undefined,
                            isBatchRoot: count > 1,
                            batchChildIds: count > 1 ? childIds : undefined,
                            batchUsesReferenceImages: referenceImages.length > 0,
                            ...generationMetadata,
                            imageBatchExpanded: count > 1 ? true : undefined,
                        },
                    };
                    const childNodes: CanvasNodeData[] = childIds.map((id, index) => ({
                        id,
                        type: CanvasNodeType.Image,
                        title: effectivePrompt.slice(0, 32) || "Generated Image",
                        position: {
                            x: rootNode.position.x + rootNode.width + 120 + (index % 2) * (imageSize.width + 36),
                            y: rootNode.position.y + Math.floor(index / 2) * (imageSize.height + rowGap),
                        },
                        width: imageSize.width,
                        height: imageSize.height,
                        metadata: { prompt: effectivePrompt, cameraControl: sourceNode?.metadata?.cameraControl, characterIds: sourceNode?.metadata?.characterIds || [], status: NODE_STATUS_LOADING, startedAt: generationStartedAt, progress: 0, imageTaskId: targetTaskIds[id], batchRootId: count > 1 ? rootId : undefined, ...generationMetadata },
                    }));
                    const batchConnections = [...(isEmptyImageNode ? [] : [{ id: nanoid(), fromNodeId: nodeId, toNodeId: rootId }]), ...childIds.map((childId) => ({ id: nanoid(), fromNodeId: rootId, toNodeId: childId }))];

                    setNodes((prev) => [
                        ...prev.map((node) =>
                            node.id === nodeId
                                ? isConfigNode
                                    ? {
                                        ...node,
                                        metadata: { ...node.metadata, prompt: effectivePrompt, status: NODE_STATUS_LOADING, startedAt: generationStartedAt, durationMs: undefined, errorDetails: undefined },
                                    }
                                    : isEmptyImageNode
                                        ? {
                                            ...node,
                                            position: rootNode.position,
                                            width: rootNode.width,
                                            height: rootNode.height,
                                            title: rootNode.title,
                                            metadata: { ...node.metadata, ...rootNode.metadata, errorDetails: undefined },
                                        }
                                        : isImageNode
                                            ? {
                                                ...node,
                                                metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS, errorDetails: undefined },
                                            }
                                            : {
                                                ...node,
                                                type: CanvasNodeType.Text,
                                                title: prompt.slice(0, 32) || "Prompt",
                                                width: parentConfig.width,
                                                height: parentConfig.height,
                                                metadata: { ...node.metadata, content: prompt, prompt, status: NODE_STATUS_SUCCESS, fontSize: 14, errorDetails: undefined },
                                            }
                                : node,
                        ),
                        ...(isEmptyImageNode ? [] : [rootNode]),
                        ...childNodes,
                    ]);
                    setConnections((prev) => [...prev, ...batchConnections]);
                    setSelectedNodeIds(new Set([nodeId]));
                    setSelectedConnectionId(null);
                    setDialogNodeId(nodeId);

                    const taskResults = await Promise.all(
                        targetIds.map(async (targetId) => {
                            try {
                                const task = await createCanvasImageTask({ ...generationConfig, count: "1" }, requestPrompt, referenceImages, { nodeId: targetId, sourceId: projectId, clientTaskId: targetTaskIds[targetId], characterIds: sourceNode?.metadata?.characterIds || [] });
                                if (task.image_url || task.url) {
                                    setNodes((prev) => {
                                        const root = prev.find((node) => node.id === rootId);
                                        let next = applyCanvasImageTaskUpdate(prev, targetId, task, generationStartedAt, { width: imageSize.width, height: imageSize.height });
                                        if (targetId !== rootId && root?.metadata?.primaryImageId === targetId) {
                                            next = applyCanvasImageTaskUpdate(next, rootId, task, generationStartedAt, { width: imageSize.width, height: imageSize.height });
                                        }
                                        return next;
                                    });
                                    return true;
                                }
                                setNodes((prev) => {
                                    const root = prev.find((node) => node.id === rootId);
                                    return prev.map((node) => {
                                        if (node.id !== targetId && node.id !== rootId) return node;
                                        if (node.id === rootId && (targetId === rootId || !root?.metadata?.primaryImageId))
                                            return {
                                                ...node,
                                                metadata: { ...node.metadata, status: NODE_STATUS_LOADING, imageTaskId: task.id, imageTaskResultId: undefined, primaryImageId: targetId, startedAt: parseCanvasTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || generationStartedAt, progress: task.progress || 0, errorDetails: undefined },
                                            };
                                        if (node.id === targetId)
                                            return {
                                                ...node,
                                                metadata: { ...node.metadata, status: NODE_STATUS_LOADING, imageTaskId: task.id, imageTaskResultId: undefined, startedAt: parseCanvasTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || generationStartedAt, progress: task.progress || 0, errorDetails: undefined },
                                            };
                                        return node;
                                    });
                                });
                                if (isConfigNode) setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS, errorDetails: undefined } } : node)));
                                return true;
                            } catch (error) {
                                const errorDetails = error instanceof Error ? error.message : "生成失败";
                                setNodes((prev) => prev.map((node) => (node.id === targetId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } } : node)));
                                return false;
                            }
                        }),
                    );
                    const hasSuccess = taskResults.some(Boolean);
                    const hasFailure = taskResults.some((result) => !result);
                    if (hasFailure) message.error(hasSuccess ? "部分图片任务创建失败" : "全部图片任务创建失败");
                    setNodes((prev) =>
                        prev.map((node) =>
                            node.id === nodeId && isConfigNode
                                ? { ...node, metadata: { ...node.metadata, status: hasSuccess ? NODE_STATUS_SUCCESS : NODE_STATUS_ERROR, errorDetails: hasSuccess ? undefined : "全部图片任务创建失败" } }
                                : node.id === rootId && !hasSuccess
                                    ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails: "全部图片任务创建失败" } }
                                    : node,
                        ),
                    );
                    return;
                }

                if (mode === "video") {
                    const videoGenerationConfig = withCanvasVideoAdvancedConfig(generationConfig, generationContext);
                    const frameReferencesEnabled = supportsVideoFrameReferences(videoGenerationConfig.model);
                    const firstFrame = frameReferencesEnabled ? generationContext.firstFrame : null;
                    const lastFrame = frameReferencesEnabled ? generationContext.lastFrame : null;
                    const videoReferenceImages = frameReferencesEnabled ? generationContext.referenceImages : [...generationContext.referenceImages, ...[generationContext.firstFrame, generationContext.lastFrame].filter((image): image is ReferenceImage => Boolean(image))];
                    const spec = nodeSizeFromRatio(videoGenerationConfig.size, NODE_DEFAULT_SIZE[CanvasNodeType.Video].width, NODE_DEFAULT_SIZE[CanvasNodeType.Video].height) || NODE_DEFAULT_SIZE[CanvasNodeType.Video];
                    const isEmptyVideoNode = sourceNode?.type === CanvasNodeType.Video && !sourceNode.metadata?.content;
                    const videoId = isEmptyVideoNode ? nodeId : nanoid();
                    const clientTaskId = `client_video_task_${videoId}`;
                    const parent = sourceNode?.position || { x: 0, y: 0 };
                    const videoNode: CanvasNodeData = {
                        id: videoId,
                        type: CanvasNodeType.Video,
                        title: effectivePrompt.slice(0, 32) || "Generated Video",
                        position: isEmptyVideoNode ? sourceNode.position : { x: parent.x + (sourceNode?.width || spec.width) + 96, y: parent.y },
                        width: isEmptyVideoNode ? sourceNode.width : spec.width,
                        height: isEmptyVideoNode ? sourceNode.height : spec.height,
                        metadata: { prompt: effectivePrompt, characterIds: sourceNode?.metadata?.characterIds || [], cameraControl: sourceNode?.metadata?.cameraControl, status: NODE_STATUS_LOADING, model: videoGenerationConfig.model, channelId: videoGenerationConfig.videoChannelId || videoGenerationConfig.activeChannelId, size: videoGenerationConfig.size, seconds: videoGenerationConfig.videoSeconds, vquality: videoGenerationConfig.vquality, mode: videoGenerationConfig.videoMode, negativePrompt: videoGenerationConfig.videoNegativePrompt, multiShot: videoGenerationConfig.videoMultiShot, shotType: videoGenerationConfig.videoShotType, generateAudio: videoGenerationConfig.videoGenerateAudio, characterOrientation: videoGenerationConfig.videoCharacterOrientation, watermark: videoGenerationConfig.videoWatermark, references: generationReferenceUrls({ ...generationContext, referenceImages: videoReferenceImages, firstFrame, lastFrame }), firstFrameNodeId: sourceNode?.metadata?.firstFrameNodeId, lastFrameNodeId: sourceNode?.metadata?.lastFrameNodeId, klingImageNodeIds: sourceNode?.metadata?.klingImageNodeIds, klingMultiPrompt: sourceNode?.metadata?.klingMultiPrompt, klingElementList: sourceNode?.metadata?.klingElementList, startedAt: generationStartedAt, progress: 0, videoTaskId: clientTaskId },
                    };
                    pendingChildIds = [videoId];
                    setNodes((prev) => (isEmptyVideoNode ? prev.map((node) => (node.id === nodeId ? { ...node, ...videoNode } : node)) : [...prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } } : node)), videoNode]));
                    if (!isEmptyVideoNode) setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: nodeId, toNodeId: videoId }]);
                    const created = await createVideoGenerationTask(videoGenerationConfig, requestPrompt, { references: videoReferenceImages, firstFrame, lastFrame, videoReferences: generationContext.referenceVideos, audioReferences: generationContext.referenceAudios }, undefined, { clientTaskId, source: "canvas", sourceId: videoId, characterIds: sourceNode?.metadata?.characterIds || [] });
                    setNodes((prev) => applyCanvasVideoTaskUpdate(prev, videoId, created.task, videoGenerationConfig, generationStartedAt, spec));
                    if (sourceNode?.type === CanvasNodeType.Config && (sourceNode.metadata?.firstFrameNodeId || sourceNode.metadata?.lastFrameNodeId)) {
                        const linkedVideoIds = new Set(
                            connectionsRef.current
                                .filter((c) => c.toNodeId === nodeId)
                                .map((c) => c.fromNodeId)
                                .filter((id) => id !== videoId && nodesRef.current.find((n) => n.id === id)?.type === CanvasNodeType.Video),
                        );
                        if (linkedVideoIds.size) {
                            const { firstFrameNodeId, lastFrameNodeId } = sourceNode.metadata!;
                            setNodes((prev) =>
                                prev.map((n) =>
                                    linkedVideoIds.has(n.id)
                                        ? { ...n, metadata: { ...n.metadata, ...(firstFrameNodeId ? { firstFrameNodeId } : {}), ...(lastFrameNodeId ? { lastFrameNodeId } : {}) } }
                                        : n,
                                ),
                            );
                        }
                    }
                    return;
                }

                if (mode === "audio") {
                    const spec = NODE_DEFAULT_SIZE[CanvasNodeType.Audio];
                    const isEmptyAudioNode = sourceNode?.type === CanvasNodeType.Audio && !sourceNode.metadata?.content;
                    const audioId = isEmptyAudioNode ? nodeId : nanoid();
                    const clientAudioTaskId = `client_audio_task_${audioId}`;
                    const parent = sourceNode?.position || { x: 0, y: 0 };
                    const audioNode: CanvasNodeData = {
                        id: audioId,
                        type: CanvasNodeType.Audio,
                        title: effectivePrompt.slice(0, 32) || "Generated Audio",
                        position: isEmptyAudioNode ? sourceNode.position : { x: parent.x + (sourceNode?.width || spec.width) + 96, y: parent.y + ((sourceNode?.height || spec.height) - spec.height) / 2 },
                        width: isEmptyAudioNode ? sourceNode.width : spec.width,
                        height: isEmptyAudioNode ? sourceNode.height : spec.height,
                        metadata: { prompt: effectivePrompt, characterIds: sourceNode?.metadata?.characterIds || [], status: NODE_STATUS_LOADING, startedAt: generationStartedAt, progress: 0, audioTaskId: clientAudioTaskId, ...buildAudioGenerationMetadata(generationConfig) },
                    };
                    pendingChildIds = [audioId];
                    setNodes((prev) => (isEmptyAudioNode ? prev.map((node) => (node.id === nodeId ? { ...node, ...audioNode } : node)) : [...prev.map((node) => (node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } } : node)), audioNode]));
                    if (!isEmptyAudioNode) setConnections((prev) => [...prev, { id: nanoid(), fromNodeId: nodeId, toNodeId: audioId }]);
                    const task = await createCanvasAudioTask(generationConfig, effectivePrompt, { nodeId: audioId, sourceId: projectId, clientTaskId: clientAudioTaskId, characterIds: sourceNode?.metadata?.characterIds || [] });
                    setNodes((prev) => prev.map((node) => (node.id === audioId ? { ...node, metadata: { ...node.metadata, audioTaskId: task.id, audioTaskResultId: undefined, startedAt: parseCanvasTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || generationStartedAt, progress: task.progress || 0, errorDetails: undefined } } : node)));
                    return;
                }

                let streamed = "";
                const isConfigNode = sourceNode?.type === CanvasNodeType.Config;
                const textCount = isConfigNode ? getGenerationCount(generationConfig.count) : 1;
                const parentConfig = NODE_DEFAULT_SIZE[isConfigNode ? CanvasNodeType.Config : CanvasNodeType.Text];
                const textConfig = NODE_DEFAULT_SIZE[CanvasNodeType.Text];
                const parentPosition = sourceNode?.position || { x: 0, y: 0 };
                const childIds = isConfigNode || editingTextNode ? Array.from({ length: textCount }, () => nanoid()) : [];
                pendingChildIds = childIds;
                if (isConfigNode || editingTextNode) {
                    const childNodes: CanvasNodeData[] = childIds.map((id, index) => ({
                        id,
                        type: CanvasNodeType.Text,
                        title: effectivePrompt.slice(0, 32) || "Generated Text",
                        position: {
                            x: parentPosition.x + parentConfig.width + 96,
                            y: parentPosition.y + parentConfig.height / 2 - textConfig.height / 2 + (index - (textCount - 1) / 2) * (textConfig.height + 36),
                        },
                        width: textConfig.width,
                        height: textConfig.height,
                        metadata: { prompt: effectivePrompt, status: NODE_STATUS_LOADING, fontSize: 14 },
                    }));
                    setNodes((prev) => [...prev.map((node) => (node.id === nodeId && isConfigNode ? { ...node, metadata: { ...node.metadata, prompt: effectivePrompt, status: NODE_STATUS_LOADING, errorDetails: undefined } } : node)), ...childNodes]);
                    setConnections((prev) => [...prev, ...childIds.map((childId) => ({ id: nanoid(), fromNodeId: nodeId, toNodeId: childId }))]);
                }

                const answers = await Promise.all(
                    (childIds.length ? childIds : [nodeId]).map((targetNodeId) => {
                        let localStreamed = "";
                        return requestImageQuestion(generationConfig, buildNodeChatMessages({ ...generationContext, prompt: effectivePrompt }), (text) => {
                            localStreamed = text;
                            streamed = text;
                            if (isConfigNode) return;
                            setNodes((prev) => prev.map((node) => (node.id === targetNodeId ? { ...node, type: CanvasNodeType.Text, metadata: { ...node.metadata, content: text, status: NODE_STATUS_LOADING } } : node)));
                        }).then((answer) => ({ nodeId: targetNodeId, content: answer || localStreamed }));
                    }),
                );
                const answerByNodeId = new Map(answers.map((item) => [item.nodeId, item.content]));
                setNodes((prev) =>
                    prev.map((node) =>
                        childIds.includes(node.id)
                            ? { ...node, metadata: { ...node.metadata, content: answerByNodeId.get(node.id) || streamed, status: NODE_STATUS_SUCCESS } }
                            : node.id === nodeId && isConfigNode
                                ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_SUCCESS } }
                                : node.id === nodeId && !editingTextNode
                                    ? { ...node, type: CanvasNodeType.Text, title: prompt.slice(0, 32) || "Generated Text", metadata: { ...node.metadata, content: answerByNodeId.get(node.id) || streamed, status: NODE_STATUS_SUCCESS } }
                                    : node,
                    ),
                );
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) =>
                    prev.map((node) => (node.id === nodeId || pendingChildIds.includes(node.id) ? (node.id === nodeId && !markSourceStatus ? node : { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails } }) : node)),
                );
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, openConfigDialog],
    );

    const handleRetryNode = useCallback(
        async (node: CanvasNodeData) => {
            const sourceNode = findRetrySourceNode(node.id, nodesRef.current, connectionsRef.current) || node;
            const isPanorama = isPanoramaNodeType(node.type);
            const batchRoot = node.metadata?.batchRootId ? nodesRef.current.find((item) => item.id === node.metadata?.batchRootId) : null;
            const savedImageMetadata = isCanvasImageNodeType(node.type) ? { ...batchRoot?.metadata, ...node.metadata } : undefined;
            const hasSavedImageMetadata = Boolean(savedImageMetadata?.generationType);
            const generationConfig =
                hasSavedImageMetadata && savedImageMetadata
                    ? {
                        ...effectiveConfig,
                        model: savedImageMetadata.model || effectiveConfig.imageModel || effectiveConfig.model,
                        imageChannelId: savedImageMetadata.channelId || effectiveConfig.imageChannelId,
                        activeChannelId: savedImageMetadata.channelId || effectiveConfig.imageChannelId,
                        quality: savedImageMetadata.quality || effectiveConfig.quality,
                        size: isPanorama ? PANORAMA_IMAGE_SIZE : savedImageMetadata.size || effectiveConfig.size,
                        count: "1",
                    }
                    : { ...buildGenerationConfig(effectiveConfig, sourceNode, node.type === CanvasNodeType.Text ? "text" : node.type === CanvasNodeType.Video ? "video" : node.type === CanvasNodeType.Audio ? "audio" : "image"), count: "1" };
            if (!isAiConfigReady(generationConfig, generationConfig.model)) {
                openConfigDialog(true);
                return;
            }

            const context = hasSavedImageMetadata ? null : await hydrateNodeGenerationContext(buildNodeGenerationContext(sourceNode.id, nodesRef.current, connectionsRef.current, sourceNode.metadata?.prompt || node.metadata?.prompt || ""));
            const prompt = (isPanorama ? savedImageMetadata?.panoramaFinalPrompt || "" : savedImageMetadata?.prompt || context?.prompt || "").trim();
            const requestPrompt = isPanorama ? prompt : applyCameraPrompt(prompt, savedImageMetadata?.cameraControl || node.metadata?.cameraControl);
            if (!prompt) {
                message.warning("找不到提示词，无法重试");
                return;
            }
            const generationType = savedImageMetadata?.generationType;
            const useReferenceImages = generationType ? generationType === "edit" : Boolean(context?.referenceImages.length);
            const retryReferenceImages =
                hasSavedImageMetadata && savedImageMetadata ? await resolveMetadataReferences(savedImageMetadata) : useReferenceImages ? (context?.referenceImages.length ? context.referenceImages : sourceNodeReferenceImages(batchRoot || sourceNode)) : [];
            if (useReferenceImages && !retryReferenceImages) {
                message.info("参考图片已丢失，将以纯文本方式继续生成");
            }
            const retryImages = retryReferenceImages || [];

            setRunningNodeId(node.id);
            const retryStartedAt = Date.now();
            const retryVideoTaskId = node.type === CanvasNodeType.Video ? `client_video_task_${node.id}` : "";
            const retryImageTaskId = isCanvasImageNodeType(node.type) ? `client_image_task_${node.id}` : "";
            const retryAudioTaskId = node.type === CanvasNodeType.Audio ? `client_audio_task_${node.id}` : "";
            setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_LOADING, errorDetails: undefined, content: undefined, storageKey: "", progress: 0, startedAt: retryStartedAt, ...(item.type === CanvasNodeType.Video ? { videoTaskId: retryVideoTaskId, videoTaskVideoId: undefined } : {}), ...(isCanvasImageNodeType(item.type) ? { imageTaskId: retryImageTaskId, imageTaskResultId: undefined } : {}), ...(item.type === CanvasNodeType.Audio ? { audioTaskId: retryAudioTaskId, audioTaskResultId: undefined } : {}) } } : item)));

            try {
                if (node.type === CanvasNodeType.Text) {
                    if (!context) return;
                    let streamed = "";
                    const answer = await requestImageQuestion(generationConfig, buildNodeChatMessages({ ...context, prompt }), (text) => {
                        streamed = text;
                        setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, type: CanvasNodeType.Text, metadata: { ...item.metadata, content: text, status: NODE_STATUS_LOADING } } : item)));
                    });
                    setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, type: CanvasNodeType.Text, metadata: { ...item.metadata, content: answer || streamed, prompt, status: NODE_STATUS_SUCCESS } } : item)));
                    return;
                }
                if (node.type === CanvasNodeType.Video) {
                    const videoGenerationConfig = context ? withCanvasVideoAdvancedConfig(generationConfig, context) : generationConfig;
                    const frameReferencesEnabled = supportsVideoFrameReferences(videoGenerationConfig.model);
                    const firstFrame = frameReferencesEnabled ? context?.firstFrame || null : null;
                    const lastFrame = frameReferencesEnabled ? context?.lastFrame || null : null;
                    const references = frameReferencesEnabled ? retryImages : [...retryImages, ...[context?.firstFrame, context?.lastFrame].filter((image): image is ReferenceImage => Boolean(image))];
                    const created = await createVideoGenerationTask(videoGenerationConfig, requestPrompt, { references, firstFrame, lastFrame, videoReferences: context?.referenceVideos || [], audioReferences: context?.referenceAudios || [] }, undefined, { clientTaskId: retryVideoTaskId, source: "canvas", sourceId: node.id, characterIds: node.metadata?.characterIds || [] });
                    setNodes((prev) => applyCanvasVideoTaskUpdate(prev, node.id, created.task, videoGenerationConfig, retryStartedAt, { width: node.width, height: node.height }));
                    return;
                }
                if (node.type === CanvasNodeType.Audio) {
                    const task = await createCanvasAudioTask(generationConfig, prompt, { nodeId: node.id, sourceId: projectId, clientTaskId: retryAudioTaskId, characterIds: node.metadata?.characterIds || [] });
                    setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, prompt, ...buildAudioGenerationMetadata(generationConfig), audioTaskId: task.id, audioTaskResultId: undefined, startedAt: parseCanvasTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || retryStartedAt, progress: task.progress || 0, errorDetails: undefined } } : item)));
                    return;
                }

                const task = await createCanvasImageTask(generationConfig, requestPrompt, useReferenceImages ? retryImages : [], { nodeId: node.id, sourceId: projectId, clientTaskId: retryImageTaskId, characterIds: node.metadata?.characterIds || [] });
                const generationMetadata = savedImageMetadata?.generationType
                    ? { generationType: savedImageMetadata.generationType, model: generationConfig.model, channelId: generationConfig.imageChannelId || generationConfig.activeChannelId, size: generationConfig.size, quality: generationConfig.quality, count: savedImageMetadata.count || 1, references: savedImageMetadata.references }
                    : buildImageGenerationMetadata(useReferenceImages ? "edit" : "generation", generationConfig, 1, retryImages);
                setNodes((prev) =>
                    prev.map((item) =>
                        item.id === node.id
                            ? {
                                ...item,
                                type: isPanoramaNodeType(item.type) ? CanvasNodeType.Panorama : CanvasNodeType.Image,
                                metadata: {
                                    ...item.metadata,
                                    ...(isPanoramaNodeType(item.type) ? { prompt: item.metadata?.panoramaSourcePrompt || item.metadata?.prompt || "", panoramaSourcePrompt: item.metadata?.panoramaSourcePrompt || item.metadata?.prompt || "", panoramaFinalPrompt: prompt, panoramaProjection: undefined } : { prompt }),
                                    ...generationMetadata,
                                    imageTaskId: task.id,
                                    imageTaskResultId: undefined,
                                    startedAt: parseCanvasTaskTime(task.started_at ?? task.startedAt ?? task.created_at ?? task.createdAt) || retryStartedAt,
                                    progress: task.progress || 0,
                                    errorDetails: undefined,
                                },
                            }
                            : item,
                    ),
                );
            } catch (error) {
                const errorDetails = error instanceof Error ? error.message : "生成失败";
                message.error(errorDetails);
                setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, metadata: { ...item.metadata, status: NODE_STATUS_ERROR, errorDetails } } : item)));
            } finally {
                setRunningNodeId(null);
            }
        },
        [effectiveConfig, message, openConfigDialog, projectId],
    );

    const generateImageFromTextNode = useCallback(
        (node: CanvasNodeData) => {
            const prompt = (node.metadata?.content || node.metadata?.prompt || "").trim();
            if (!prompt) {
                message.warning("文本节点为空，无法生图");
                return;
            }
            const sourceNode = nodesRef.current.find((item) => item.id === node.id);
            if (!sourceNode) return;
            const nodeSize = getNodeSpec(CanvasNodeType.Config);
            const configNode = createCanvasNode(
                CanvasNodeType.Config,
                {
                    x: sourceNode.position.x + sourceNode.width + 96 + nodeSize.width / 2,
                    y: sourceNode.position.y + sourceNode.height / 2,
                },
                {
                    prompt: "",
                    model: effectiveConfig.imageModel || effectiveConfig.model,
                    size: effectiveConfig.size,
                    count: getGenerationCount(effectiveConfig.canvasImageCount || effectiveConfig.count),
                },
            );
            const connection = { id: nanoid(), fromNodeId: sourceNode.id, toNodeId: configNode.id };
            const nextNodes = nodesRef.current.map((item) => (item.id === sourceNode.id ? { ...item, metadata: { ...item.metadata, content: prompt, prompt, status: NODE_STATUS_SUCCESS } } : item)).concat(configNode);
            const nextConnections = [...connectionsRef.current, connection];
            nodesRef.current = nextNodes;
            connectionsRef.current = nextConnections;
            setNodes(nextNodes);
            setConnections(nextConnections);
            setSelectedNodeIds(new Set([configNode.id]));
            setSelectedConnectionId(null);
            setDialogNodeId(configNode.id);
        },
        [effectiveConfig.canvasImageCount, effectiveConfig.count, effectiveConfig.imageModel, effectiveConfig.model, effectiveConfig.size, message],
    );

    const handleApplyDirectorShots = useCallback(
        (shots: { prompt: string; shot: number }[]) => {
            const directorNode = nodesRef.current.find((n) => n.id === openDirectorNodeId);
            const spec = getNodeSpec(CanvasNodeType.Image);
            const startX = directorNode ? directorNode.position.x + directorNode.width + 96 : getCanvasCenter().x - spec.width / 2;
            const startY = directorNode ? directorNode.position.y : getCanvasCenter().y - (shots.length * (spec.height + 24)) / 2;
            const newNodes = shots.map((shot, i) => {
                const node = createCanvasNode(CanvasNodeType.Image, {
                    x: startX + spec.width / 2,
                    y: startY + (spec.height + 24) * i + spec.height / 2,
                }, { prompt: shot.prompt, content: "", status: "idle" });
                node.title = `分镜 ${shot.shot}`;
                return node;
            });
            const newConnections = directorNode ? newNodes.map((node) => ({ id: nanoid(), fromNodeId: directorNode.id, toNodeId: node.id })) : [];
            setNodes((prev) => [...prev, ...newNodes]);
            setConnections((prev) => [...prev, ...newConnections]);
            setSelectedNodeIds(new Set(newNodes.map((n) => n.id)));
            if (newNodes.length) setDialogNodeId(newNodes[0].id);
        },
        [getCanvasCenter, openDirectorNodeId],
    );

    const handleApplyStoryboardScenes = useCallback(
        (scenes: { scene: number; location?: string; shots: { shot: number; prompt: string }[] }[]) => {
            const spec = getNodeSpec(CanvasNodeType.Image);
            const textSpec = getNodeSpec(CanvasNodeType.Text);
            const center = getCanvasCenter();
            const sceneGap = 60;
            const shotGap = 24;
            let totalHeight = 0;
            for (const scene of scenes) {
                totalHeight += textSpec.height + shotGap;
                totalHeight += scene.shots.length * (spec.height + shotGap);
                totalHeight += sceneGap;
            }
            let y = center.y - totalHeight / 2;
            const allNodes: CanvasNodeData[] = [];

            for (const scene of scenes) {
                const sceneLabel = createCanvasNode(CanvasNodeType.Text, { x: center.x, y: y + textSpec.height / 2 }, { content: `第${scene.scene}场 ${scene.location || ""}`, status: "success" });
                sceneLabel.title = `场景 ${scene.scene}`;
                allNodes.push(sceneLabel);
                y += textSpec.height + shotGap;

                for (const shot of scene.shots) {
                    const node = createCanvasNode(CanvasNodeType.Image, { x: center.x, y: y + spec.height / 2 }, { prompt: shot.prompt, content: "", status: "idle" });
                    node.title = `第${scene.scene}场 镜${shot.shot}`;
                    allNodes.push(node);
                    y += spec.height + shotGap;
                }
                y += sceneGap - shotGap;
            }

            setNodes((prev) => [...prev, ...allNodes]);
            if (allNodes.length) {
                const imageNode = allNodes.find((n) => n.type === CanvasNodeType.Image);
                if (imageNode) {
                    setSelectedNodeIds(new Set([imageNode.id]));
                }
            }
        },
        [getCanvasCenter],
    );

    const insertAssistantImage = useCallback(
        async (image: CanvasAssistantImage, position?: Position) => {
            const storedImage = { url: image.dataUrl, storageKey: image.storageKey || "", width: 1, height: 1, bytes: 0, mimeType: "image/png" };
            const meta = storedImage.width === 1 && storedImage.height === 1 ? await readImageMeta(storedImage.url) : storedImage;
            const config = fitNodeSize(meta.width, meta.height);
            const center = position || screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const node: CanvasNodeData = {
                id,
                type: CanvasNodeType.Image,
                title: image.prompt.slice(0, 32) || "Generated Image",
                position: { x: center.x - config.width / 2, y: center.y - config.height / 2 },
                width: config.width,
                height: config.height,
                metadata: { ...imageMetadata({ ...storedImage, width: meta.width, height: meta.height }), prompt: image.prompt },
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([id]));
            setSelectedConnectionId(null);
            setDialogNodeId(id);
        },
        [screenToCanvas, size.height, size.width],
    );

    const insertAssistantText = useCallback(
        (text: string, position?: Position) => {
            const center = position || screenToCanvas((containerRef.current?.getBoundingClientRect().left || 0) + size.width / 2, (containerRef.current?.getBoundingClientRect().top || 0) + size.height / 2);
            const node = {
                ...createCanvasNode(CanvasNodeType.Text, center, { content: text, status: NODE_STATUS_SUCCESS }),
                title: text.slice(0, 32) || "Assistant Text",
            };

            setNodes((prev) => [...prev, node]);
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
        },
        [screenToCanvas, size.height, size.width],
    );

    const insertAssetAtRef = useRef(insertAssetAt);
    useLayoutEffect(() => {
        insertAssetAtRef.current = insertAssetAt;
    });
    const handleAssetInsert = useCallback(
        (payload: InsertAssetPayload) => {
            const position = assetInsertPositionRef.current || undefined;
            assetInsertPositionRef.current = null;
            insertAssetAtRef.current(payload, position);
            setAssetPickerOpen(false);
        },
        [],
    );

    const focusNode = useCallback(
        (nodeId: string) => {
            const node = nodesRef.current.find((item) => item.id === nodeId);
            if (!node) return;
            const rootId = node.metadata?.batchRootId;
            if (rootId && !nodesRef.current.find((item) => item.id === rootId)?.metadata?.imageBatchExpanded) {
                toggleBatchExpanded(rootId);
            }
            const worldX = node.position.x + node.width / 2;
            const worldY = node.position.y + node.height / 2;
            const k = Math.min(Math.max(Math.min((size.width * 0.6) / node.width, (size.height * 0.6) / node.height), 0.05), 1.5);
            const target = { x: size.width / 2 - worldX * k, y: size.height / 2 - worldY * k, k };
            setSelectedNodeIds(new Set([node.id]));
            setSelectedConnectionId(null);
            setContextMenu(null);
            if (focusAnimationRef.current) cancelAnimationFrame(focusAnimationRef.current);
            const start = { ...viewportRef.current };
            const duration = 450;
            let startTime: number | null = null;
            const step = (now: number) => {
                if (!startTime) startTime = now;
                const progress = Math.min(1, (now - startTime) / duration);
                const eased = 1 - Math.pow(1 - progress, 3);
                const next = { x: start.x + (target.x - start.x) * eased, y: start.y + (target.y - start.y) * eased, k: start.k + (target.k - start.k) * eased };
                viewportRef.current = next;
                setViewport(next);
                focusAnimationRef.current = progress < 1 ? requestAnimationFrame(step) : null;
            };
            focusAnimationRef.current = requestAnimationFrame(step);
        },
        [size.height, size.width, toggleBatchExpanded],
    );

    useEffect(() => () => {
        if (focusAnimationRef.current) cancelAnimationFrame(focusAnimationRef.current);
    }, []);

    if (!projectLoaded) return <CanvasRefreshShell />;
    return (
        <main className="flex h-full min-h-0 overflow-hidden" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <CanvasSidePanel
                nodes={nodes}
                selectedNodeIds={selectedNodeIds}
                open={sidePanel.open}
                width={sidePanel.width}
                onWidthChange={(width) => setSidePanel((current) => ({ ...current, width }))}
                onFocusNode={focusNode}
                onAssetDragStart={(payload) => {
                    draggedAssetPayloadRef.current = payload;
                }}
                onAssetDragEnd={() => {
                    window.setTimeout(() => {
                        draggedAssetPayloadRef.current = null;
                    }, 0);
                }}
                onInsertAsset={handleAssetInsert}
            />
            <section className="relative min-w-0 flex-1 overflow-hidden">
                <CanvasTopBar
                    title={currentProject?.title || "未命名画布"}
                    sidePanelOpen={sidePanel.open}
                    onToggleSidePanel={() => setSidePanel((current) => ({ ...current, open: !current.open }))}
                    titleDraft={titleDraft}
                    isTitleEditing={titleEditing}
                    onTitleDraftChange={setTitleDraft}
                    onStartTitleEditing={startTitleEditing}
                    onFinishTitleEditing={finishTitleEditing}
                    onCancelTitleEditing={() => setTitleEditing(false)}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    onHome={() => router.push("/")}
                    onProjects={() => router.push("/canvas")}
                    onCreateProject={createAndOpenProject}
                    onDeleteProject={deleteCurrentProject}
                    onImportImage={() => handleUploadRequest()}
                    onUndo={undoCanvas}
                    onRedo={redoCanvas}
                    assistantCollapsed={assistantCollapsed}
                    onExpandAssistant={() => {
                        setAssistantMounted(true);
                        setAssistantCollapsed(false);
                    }}
                />

                <InfiniteCanvas
                    containerRef={containerRef}
                    viewport={viewport}
                    backgroundMode={backgroundMode}
                    onViewportChange={(next) => {
                        setViewport(next);
                        setContextMenu(null);
                    }}
                    onCanvasMouseDown={handleCanvasMouseDown}
                    onCanvasDeselect={deselectCanvas}
                    onCanvasDoubleClick={(event) => { setContextMenu(null); setNodeCreatePosition(screenToCanvas(event.clientX, event.clientY)); }}
                    onContextMenu={preventCanvasContextMenu}
                    onDrop={handleDrop}
                >
                    <svg className="absolute left-0 top-0 h-[10000px] w-[10000px] overflow-visible" style={{ pointerEvents: "none", transform: "translateZ(0)", zIndex: 6 }}>
                        {connections
                            .filter((connection) => {
                                const from = nodeById.get(connection.fromNodeId);
                                const to = nodeById.get(connection.toNodeId);
                                return Boolean(from && to && !isHiddenBatchConnectionEndpoint(from, nodes) && !isHiddenBatchConnectionEndpoint(to, nodes));
                            })
                            .map((connection) => {
                                const from = nodeById.get(connection.fromNodeId);
                                const to = nodeById.get(connection.toNodeId);
                                if (!from || !to) return null;

                                return (
                                    <ConnectionPath
                                        key={connection.id}
                                        connection={connection}
                                        from={from}
                                        to={to}
                                        active={selectedConnectionId === connection.id || relatedHighlight.connectionIds.has(connection.id)}
                                        onSelect={() => {
                                            setSelectedConnectionId(connection.id);
                                            setSelectedNodeIds(new Set());
                                            setToolbarNodeId(null);
                                            setContextMenu(null);
                                        }}
                                        onContextMenu={(event) => {
                                            setSelectedConnectionId(connection.id);
                                            setSelectedNodeIds(new Set());
                                            setToolbarNodeId(null);
                                            setContextMenu({ type: "connection", x: event.clientX, y: event.clientY, connectionId: connection.id });
                                        }}
                                    />
                                );
                            })}
                        {connectingParams ? <ActiveConnectionPath node={nodeById.get(connectingParams.nodeId)} handle={connectingParams} mouseWorld={mouseWorld} target={connectionTargetNodeId ? nodeById.get(connectionTargetNodeId) : undefined} /> : null}
                    </svg>

                    {visibleNodes.map((node) => (
                        <CanvasNode
                            key={node.id}
                            data={node}
                            scale={viewport.k}
                            isSelected={selectedNodeIds.has(node.id)}
                            isRelated={relatedHighlight.nodeIds.has(node.id)}
                            isFocusRelated={activeNodeId === node.id}
                            isConnectionTarget={connectionTargetNodeId === node.id}
                            isConnecting={Boolean(connectingParams)}
                            editRequestNonce={editingNodeId === node.id ? editRequestNonce : 0}
                            showPanel={dialogNodeId === node.id && !selectionBox}
                            batchCount={batchChildCountById.get(node.id) || 0}
                            groupChildCount={groupChildCountById.get(node.id) || 0}
                            isGroupDropTarget={dropTargetGroupId === node.id}
                            batchExpanded={Boolean(node.metadata?.imageBatchExpanded)}
                            batchClosing={Boolean(node.metadata?.batchRootId && collapsingBatchIds.has(node.metadata.batchRootId))}
                            batchOpening={openingBatchIds.has(node.id)}
                            batchRecovering={collapsingBatchIds.has(node.id)}
                            batchMotion={batchMotionById.get(node.id)}
                            showImageInfo={showImageInfo}
                            resourceLabel={resourceReferenceByNodeId.get(node.id)}
                            mentionReferences={mentionReferencesByNodeId.get(node.id) || []}
                            now={node.metadata?.status === NODE_STATUS_LOADING && !node.metadata.content && (node.type === CanvasNodeType.Video || isCanvasImageNodeType(node.type) || node.type === CanvasNodeType.Audio) ? canvasNow : undefined}
                            renderPanel={(panelNode) =>
                                panelNode.type === CanvasNodeType.Config ? (
                                    <CanvasConfigComposer
                                        value={panelNode.metadata?.composerContent ?? panelNode.metadata?.prompt ?? ""}
                                        inputs={configInputsById.get(panelNode.id) || []}
                                        onChange={(composerContent) => handleConfigNodeChange(panelNode.id, { composerContent })}
                                        onClose={() => setDialogNodeId(null)}
                                    />
                                ) : panelNode.type === CanvasNodeType.Director ? null : (
                                    <CanvasNodePromptPanel
                                        node={panelNode}
                                        isRunning={runningNodeId === panelNode.id}
                                        mentionReferences={mentionReferencesByNodeId.get(panelNode.id) || []}
                                        videoFrameOptions={videoFrameOptionsByNodeId.get(panelNode.id) || []}
                                        videoResourceOptions={videoResourceOptionsByNodeId.get(panelNode.id) || []}
                                        onPromptChange={handleNodePromptChange}
                                        onConfigChange={handleConfigNodeChange}
                                        onGenerate={handleGenerateNode}
                                        onImageSettingsOpenChange={(open) => {
                                            setNodeImageSettingsOpen(open);
                                            if (open) setToolbarNodeId(null);
                                        }}
                                    />
                                )
                            }
                            renderNodeContent={(contentNode) =>
                                contentNode.type === CanvasNodeType.Director ? (
                                    <CanvasDirectorNodePanel onOpen={() => setOpenDirectorNodeId(contentNode.id)} onAgent={() => setDirectorAgentOpen(true)} panoramaCount={connections.filter((c) => c.toNodeId === contentNode.id).length} screenshotCount={connections.filter((c) => c.fromNodeId === contentNode.id).length} />
                                ) : (
                                    <CanvasConfigNodePanel
                                        node={contentNode}
                                        isRunning={runningNodeId === contentNode.id}
                                        inputSummary={getInputSummary(configInputsById.get(contentNode.id) || [])}
                                        videoFrameOptions={videoFrameOptionsByNodeId.get(contentNode.id) || []}
                                        videoResourceOptions={videoResourceOptionsByNodeId.get(contentNode.id) || []}
                                        onConfigChange={handleConfigNodeChange}
                                        onComposerToggle={() => setDialogNodeId((current) => (current === contentNode.id ? null : contentNode.id))}
                                        onGenerate={(nodeId) => {
                                            const target = nodesRef.current.find((item) => item.id === nodeId);
                                            void handleGenerateNode(nodeId, target?.metadata?.generationMode || "image", target?.metadata?.composerContent ?? target?.metadata?.prompt ?? "");
                                        }}
                                    />
                                )
                            }
                            onMouseDown={handleNodeMouseDown}
                            onHoverStart={(nodeId) => {
                                if (nodeDraggingRef.current) return;
                                setHoveredNodeId(nodeId);
                            }}
                            onHoverEnd={(nodeId) => {
                                setHoveredNodeId((current) => (current === nodeId ? null : current));
                            }}
                            onConnectStart={handleConnectStart}
                            onResize={handleNodeResize}
                            onContentChange={handleNodeContentChange}
                            onTitleChange={handleNodeTitleChange}
                            onToggleBatch={toggleBatchExpanded}
                            onSetBatchPrimary={setBatchPrimary}
                            onRetry={(node) => void handleRetryNode(node)}
                            onGenerateImage={generateImageFromTextNode}
                            onViewImage={(node) => setPreviewNodeId(node.id)}
                            onContextMenu={(event, id) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setContextMenu({ type: "node", x: event.clientX, y: event.clientY, nodeId: id });
                            }}
                        />
                    ))}

                    {selectionBox ? (
                        <div
                            className="pointer-events-none absolute z-[100] border"
                            style={{
                                left: Math.min(selectionBox.startWorldX, selectionBox.currentWorldX),
                                top: Math.min(selectionBox.startWorldY, selectionBox.currentWorldY),
                                width: Math.abs(selectionBox.currentWorldX - selectionBox.startWorldX),
                                height: Math.abs(selectionBox.currentWorldY - selectionBox.startWorldY),
                                borderColor: theme.canvas.selectionStroke,
                                background: theme.canvas.selectionFill,
                            }}
                        />
                    ) : null}
                    {pendingConnectionCreate ? <ConnectionCreateMenu pending={pendingConnectionCreate} onCreate={(type) => createConnectedNode(type, pendingConnectionCreate)} onClose={cancelPendingConnectionCreate} /> : null}
                    {nodeCreatePosition ? (
                        <NodeCreateMenu
                            position={nodeCreatePosition}
                            onCreate={(type) => {
                                createNode(type, nodeCreatePosition);
                                setNodeCreatePosition(null);
                            }}
                            onUpload={() => {
                                handleUploadRequest(undefined, nodeCreatePosition);
                                setNodeCreatePosition(null);
                            }}
                            onOpenAssetLibrary={() => {
                                assetInsertPositionRef.current = nodeCreatePosition;
                                setNodeCreatePosition(null);
                                setAssetPickerTab("library");
                                setAssetPickerOpen(true);
                            }}
                            onClose={() => setNodeCreatePosition(null)}
                        />
                    ) : null}
                </InfiniteCanvas>

                {nodes.length === 0 ? (
                    <div className="pointer-events-none absolute inset-0 z-10 flex select-none flex-col items-center justify-center gap-4">
                        {!isAiConfigReady(effectiveConfig, effectiveConfig.model) && !aiConfigReminderDismissed ? (
                            <div
                                className="pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-2.5 shadow-lg backdrop-blur"
                                style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
                            >
                                <Settings2 className="size-4 shrink-0 text-amber-500" />
                                <span className="text-sm">尚未配置 AI 模型，生成功能暂不可用</span>
                                <Button type="primary" size="small" className="!rounded-full" onClick={() => openConfigDialog(false)}>去配置</Button>
                                <button type="button" className="grid size-6 place-items-center rounded-full opacity-40 hover:opacity-80" onClick={() => setAiConfigReminderDismissed(true)} style={{ color: theme.node.text }}>&times;</button>
                            </div>
                        ) : null}
                        <Layers3 className="size-12 opacity-15" style={{ color: theme.node.text }} />
                        <p className="text-base font-medium opacity-40" style={{ color: theme.node.text }}>画布是空的</p>
                        <p className="max-w-xs text-center text-sm" style={{ color: theme.node.faint }}>双击空白处或使用底部工具栏添加节点，用连线记录创作思路</p>
                    </div>
                ) : null}

                {openDirectorNode?.type === CanvasNodeType.Director ? (
                    <CanvasDirector
                        nodeId={openDirectorNode.id}
                        project={openDirectorNode.metadata?.directorProject}
                        panoramas={directorPanoramasByNodeId.get(openDirectorNode.id) || []}
                        theme={colorTheme}
                        onClose={() => setOpenDirectorNodeId(null)}
                        onProjectChange={handleDirectorProjectChange}
                        onPanoramaRemoved={handleDirectorPanoramaRemoved}
                        onCapturesSent={handleDirectorCapturesSent}
                    />
                ) : null}

                <CanvasNodeHoverToolbar
                    node={isNodeDragging || nodeImageSettingsOpen ? null : toolbarNode}
                    viewport={viewport}
                    onKeep={keepNodeToolbar}
                    onLeave={hideNodeToolbar}
                    onInfo={(node) => setInfoNodeId(node.id)}
                    onEditText={openTextEditor}
                    onDecreaseFont={(node) => handleFontSizeChange(node.id, Math.max(10, (node.metadata?.fontSize || 14) - 2))}
                    onIncreaseFont={(node) => handleFontSizeChange(node.id, Math.min(32, (node.metadata?.fontSize || 14) + 2))}
                    onToggleDialog={(node) => setDialogNodeId((current) => (current === node.id ? null : node.id))}
                    onGenerateImage={generateImageFromTextNode}
                    onUpload={(node) => handleUploadRequest(node.id)}
                    onDownload={downloadNodeImage}
                    onSaveAsset={(node) => void saveNodeAsset(node)}
                    onUploadVideoToCloud={(node) => void uploadNodeVideoToCloud(node)}
                    onUploadImageToCloud={(node) => void uploadNodeImageToCloud(node)}
                    onMaskEdit={(node) => {
                        const nodeConfig = buildGenerationConfig(effectiveConfig, node, "image");
                        setMaskEditModel(nodeConfig.model);
                        setMaskEditChannelId(nodeConfig.imageChannelId || nodeConfig.activeChannelId || "");
                        setMaskEditNodeId(node.id);
                    }}
                    onCrop={(node) => setCropNodeId(node.id)}
                    onSplit={(node) => setSplitNodeId(node.id)}
                    onUpscale={(node) => setUpscaleNodeId(node.id)}
                    onSuperResolve={(node) => setSuperResolveNodeId(node.id)}
                    onAngle={(node) => setAngleNodeId(node.id)}
                    onViewImage={(node) => setPreviewNodeId(node.id)}
                    onReversePrompt={createImageReversePromptNodes}
                    onRetry={(node) => void handleRetryNode(node)}
                    onToggleFreeResize={(node) => toggleNodeFreeResize(node.id)}
                    onDelete={(node) => deleteNodes(new Set([node.id]))}
                    onClipVideo={(node) => {
                        void resolveMediaUrl(node.metadata?.storageKey, node.metadata?.content)
                            .then((videoUrl) => {
                                if (!videoUrl) {
                                    message.warning("无法读取视频地址");
                                    return;
                                }
                                setClipVideoUrl(videoUrl);
                                setClipDialogOpen(true);
                            })
                            .catch(() => message.warning("无法读取视频地址"));
                    }}
                />

                <CanvasVideoTaskQueue
                    nodes={nodes}
                    now={canvasNow}
                    onJumpToNode={focusNode}
                    onCancelTask={(nodeId) => {
                        const node = nodesRef.current.find((n) => n.id === nodeId);
                        if (!node?.metadata) return;
                        const task = canvasVideoTaskFromMetadata(node.metadata);
                        const config = buildGenerationConfig(effectiveConfig, node, "video");
                        cancelVideoGenerationTask(config, task).catch(() => {});
                        pollingVideoNodeIdsRef.current.delete(nodeId);
                        setNodes((prev) =>
                            prev.map((n) =>
                                n.id === nodeId
                                    ? { ...n, metadata: { ...n.metadata, status: NODE_STATUS_ERROR, errorDetails: "任务已取消", progress: undefined } }
                                    : n,
                            ),
                        );
                    }}
                />
                <CanvasToolbar
                    selectedCount={selectedNodeIds.size}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    backgroundMode={backgroundMode}
                    showImageInfo={showImageInfo}
                    onAddImage={() => createNode(CanvasNodeType.Image)}
                    onAddVideo={() => createNode(CanvasNodeType.Video)}
                    onAddAudio={() => createNode(CanvasNodeType.Audio)}
                    onAddText={() => createNode(CanvasNodeType.Text)}
                    onAddPanorama={() => createNode(CanvasNodeType.Panorama)}
                    onAddDirector={() => createNode(CanvasNodeType.Director)}
                    onAddConfig={() => createNode(CanvasNodeType.Config)}
                    onAddCharacter={() => createNode(CanvasNodeType.Character)}
                    onUndo={undoCanvas}
                    onRedo={redoCanvas}
                    onUpload={() => handleUploadRequest()}
                    onDelete={() => deleteNodes(new Set(selectedNodeIds))}
                    onClear={() => setClearConfirmOpen(true)}
                    onDeselect={deselectCanvas}
                    onBackgroundModeChange={setBackgroundMode}
                    onShowImageInfoChange={setShowImageInfo}
                    onOpenAssetLibrary={() => {
                        setAssetPickerTab("library");
                        setAssetPickerOpen(true);
                    }}
                    onOpenMyAssets={() => {
                        setAssetPickerTab("my-assets");
                        setAssetPickerOpen(true);
                    }}
                    onAutoLayout={() => {
                        const laidOut = autoLayoutNodes(nodes, connections, "LR");
                        setNodes(laidOut);
                    }}
                />


                <button type="button" className="fixed right-4 top-36 z-40 flex items-center gap-1.5 rounded-full bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 shadow-lg transition-all hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-800 dark:hover:bg-stone-300" onClick={() => { const title = prompt("模板名称:", "我的模板"); if (title) { saveCanvasAsTemplate(title, nodes, connections).then(() => alert("模板已保存")).catch(() => alert("保存失败")); } }}><Save className="size-3.5" />保存模板</button>
                <button type="button" className="fixed right-4 top-52 z-40 flex items-center gap-1.5 rounded-full bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-200 shadow-lg transition-all hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-800 dark:hover:bg-stone-300" onClick={() => setTemplateModalOpen(true)}><FolderOpen className="size-3.5" />加载模板</button>

                {isMiniMapOpen ? <Minimap nodes={nodes} viewport={viewport} viewportSize={size} onViewportChange={setViewport} /> : null}

                <CanvasZoomControls scale={viewport.k} onScaleChange={setZoomScale} onReset={resetViewport} isMiniMapOpen={isMiniMapOpen} onToggleMiniMap={() => setIsMiniMapOpen((value) => !value)} />

                {contextMenu ? (
                    <CanvasNodeContextMenu
                        menu={contextMenu}
                        onClose={() => setContextMenu(null)}
                        onDuplicate={() => {
                            if (contextMenu.type !== "node") return;
                            duplicateNode(contextMenu.nodeId);
                            setContextMenu(null);
                        }}
                        onDelete={() => {
                            if (contextMenu.type === "node") {
                                deleteNodes(new Set([contextMenu.nodeId]));
                            } else {
                                deleteConnection(contextMenu.connectionId);
                            }
                            setContextMenu(null);
                        }}
                        onOpenInImageWorkbench={contextMenu.type === "node" ? () => {
                            router.push(`/image?sourceCanvas=${projectId}&sourceNode=${contextMenu.nodeId}`);
                            setContextMenu(null);
                        } : undefined}
                        onOpenInVideoWorkbench={contextMenu.type === "node" ? () => {
                            router.push(`/video?sourceCanvas=${projectId}&sourceNode=${contextMenu.nodeId}`);
                            setContextMenu(null);
                        } : undefined}
                    />
                ) : null}

                {pendingPanoramaImport ? (
                    <div
                        className="fixed left-1/2 top-1/2 z-[130] w-56 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border shadow-xl backdrop-blur"
                        style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="flex h-10 w-full items-center px-3 text-left text-sm transition-colors"
                            style={{ color: theme.toolbar.item }}
                            onClick={() => finishPanoramaImport(CanvasNodeType.Panorama)}
                            onMouseEnter={(event) => { event.currentTarget.style.background = theme.toolbar.itemHover; }}
                            onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
                        >
                            作为全景图导入
                        </button>
                        <div className="h-px" style={{ background: theme.toolbar.border }} />
                        <button
                            type="button"
                            className="flex h-10 w-full items-center px-3 text-left text-sm transition-colors"
                            style={{ color: theme.toolbar.item }}
                            onClick={() => finishPanoramaImport(CanvasNodeType.Image)}
                            onMouseEnter={(event) => { event.currentTarget.style.background = theme.toolbar.itemHover; }}
                            onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
                        >
                            作为普通图片导入
                        </button>
                    </div>
                ) : null}
                <input ref={imageInputRef} type="file" accept="image/*,video/*,audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav" className="hidden" onChange={handleImageInputChange} />

                <CanvasNodeInfoModal
                    node={infoNode}
                    open={Boolean(infoNode)}
                    onClose={() => setInfoNodeId(null)}
                    characterRefUrls={infoNode?.metadata?.characterReferenceUrls as string[] | undefined}
                    compareTargetUrl={
                        infoNode?.type === CanvasNodeType.Character
                            ? (() => {
                                  const imgNode = nodes.find(
                                      (n) =>
                                          n.type === CanvasNodeType.Image &&
                                          n.metadata?.content &&
                                          connections.some((c) => c.fromNodeId === n.id && c.toNodeId === infoNode.id),
                                  );
                                  return (imgNode?.metadata?.content as string | undefined) || infoNode.metadata?.coverUrl as string | undefined;
                              })()
                            : undefined
                    }
                />

                {faceCompareNodeId ? (
                    <Modal title="面部相似度" open centered footer={null} width={480} onCancel={() => setFaceCompareNodeId(null)}>
                        {(() => {
                            const charNode = nodes.find((n) => n.id === faceCompareNodeId);
                            const refs = (charNode?.metadata?.characterReferenceUrls as string[] | undefined) || [];
                            const target =
                                nodes.find(
                                    (n) =>
                                        n.type === CanvasNodeType.Image &&
                                        n.metadata?.content &&
                                        connections.some((c) => c.fromNodeId === n.id && c.toNodeId === faceCompareNodeId),
                                )?.metadata?.content ||
                                (charNode?.metadata?.coverUrl as string | undefined) ||
                                "";
                            return refs.length && target ? (
                                <div className="grid gap-2">
                                    {refs.map((url, i) => (
                                        <FaceSimilarityCompare key={i} imageA={url} imageB={target} label={`参考图${i + 1}`} />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-sm text-stone-400">未找到可比对的参考图和生成图。请先连线一个已生成的图片节点到角色节点。</div>
                            );
                        })()}
                    </Modal>
                ) : null}

                <DirectorAgentModal open={directorAgentOpen} onClose={() => setDirectorAgentOpen(false)} onApplyShots={handleApplyDirectorShots} />

                {cropNode?.metadata?.content ? <CanvasNodeCropDialog dataUrl={cropNode.metadata.content} open={Boolean(cropNode)} onClose={() => setCropNodeId(null)} onConfirm={(crop) => cropImageNode(cropNode!, crop)} /> : null}

                <CanvasVideoClipDialog
                    open={clipDialogOpen}
                    videoUrl={clipVideoUrl}
                    onClose={() => setClipDialogOpen(false)}
                    onAddToCanvas={(videoUrl) => {
                        const newNode = createCanvasNode(CanvasNodeType.Video, getCanvasCenter(), { content: videoUrl, status: NODE_STATUS_SUCCESS, mimeType: "video/mp4", storageKey: "" });
                        setNodes((prev) => [...prev, newNode]);
                        setSelectedNodeIds(new Set([newNode.id]));
                        setClipDialogOpen(false);
                        message.success("已加入画布");
                    }}
                />

                {maskEditNode?.metadata?.content && maskEditConfig ? (
                    <CanvasNodeMaskEditDialog
                        dataUrl={maskEditNode.metadata.content}
                        open={Boolean(maskEditNode)}
                        config={{ ...maskEditConfig, model: currentMaskEditModel, imageChannelId: currentMaskEditChannelId }}
                        model={currentMaskEditModel}
                        channelId={currentMaskEditChannelId}
                        onModelChange={(model, channelId) => {
                            setMaskEditModel(model);
                            setMaskEditChannelId(channelId || "");
                        }}
                        onMissingConfig={() => openConfigDialog(true)}
                        onClose={() => {
                            setMaskEditNodeId(null);
                            setMaskEditModel("");
                            setMaskEditChannelId("");
                        }}
                        onConfirm={(payload) => void maskEditImageNode(maskEditNode!, payload)}
                    />
                ) : null}

                {splitNode?.metadata?.content ? <CanvasNodeSplitDialog dataUrl={splitNode.metadata.content} open={Boolean(splitNode)} onClose={() => setSplitNodeId(null)} onConfirm={(params) => splitImageNode(splitNode!, params)} /> : null}

                {upscaleNode?.metadata?.content ? <CanvasNodeUpscaleDialog dataUrl={upscaleNode.metadata.content} open={Boolean(upscaleNode)} onClose={() => setUpscaleNodeId(null)} onConfirm={(params) => void upscaleImageNode(upscaleNode!, params)} /> : null}

                {superResolveNode?.metadata?.content ? <CanvasNodeUpscaleDialog dataUrl={superResolveNode.metadata.content} open={Boolean(superResolveNode)} onClose={() => setSuperResolveNodeId(null)} onConfirm={(params) => void upscaleImageNode(superResolveNode!, params)} /> : null}

                <CharacterPickerModal open={Boolean(characterPickerNode)} onClose={() => setCharacterPickerNodeId(null)} onSelect={(char) => {
                    if (!characterPickerNode) return;
                    setNodes((prev) => prev.map((n) => n.id === characterPickerNode.id ? { ...n, title: char.name, metadata: { ...n.metadata, characterId: char.id, characterName: char.name, characterPromptTemplate: char.promptTemplate || "", characterReferenceUrls: char.referenceUrls || [], content: char.coverUrl || "" } } : n));
                    setCharacterPickerNodeId(null);
                }} />

                {angleNode?.metadata?.content ? <CanvasNodeAngleDialog dataUrl={angleNode.metadata.content} open={Boolean(angleNode)} onClose={() => setAngleNodeId(null)} onConfirm={(params) => void generateAngleNode(angleNode!, params)} /> : null}

                {previewNode?.metadata?.content ? (() => {
                    const group = getBatchGroupNodes(previewNode);
                    const isRoot = previewNode.metadata?.isBatchRoot;
                    const activeItemNode = isRoot
                        ? (group.find((n) => n.id === previewNode.metadata?.primaryImageId) || group[0] || previewNode)
                        : previewNode;
                    const currentIndex = group.findIndex((n) => n.id === activeItemNode.id);
                    return (
                        <FullscreenPreview
                            src={activeItemNode.metadata?.content || ""}
                            alt={activeItemNode.title || "图片"}
                            isPanorama={activeItemNode.type === CanvasNodeType.Panorama}
                            onClose={() => setPreviewNodeId(null)}
                            hasPrev={currentIndex > 0}
                            hasNext={currentIndex < group.length - 1}
                            onPrev={() => setPreviewNodeId(group[currentIndex - 1].id)}
                            onNext={() => setPreviewNodeId(group[currentIndex + 1].id)}
                        />
                    );
                })() : null}

                <Modal
                    title="清空画布？"
                    open={clearConfirmOpen}
                    centered
                    onCancel={() => setClearConfirmOpen(false)}
                    footer={
                        <>
                            <Button onClick={() => setClearConfirmOpen(false)}>取消</Button>
                            <Button danger type="primary" onClick={clearCanvas}>
                                清空
                            </Button>
                        </>
                    }
                >
                    <p className="text-sm opacity-60">这会删除当前画布上的所有节点和连线。</p>
                </Modal>

                <AssetPickerModal open={assetPickerOpen} defaultTab={assetPickerTab} onInsert={handleAssetInsert} onClose={() => setAssetPickerOpen(false)} />
                <CanvasTemplateModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} onLoad={(id, data) => { try { const parsed = JSON.parse(data); setNodes(parsed.nodes || []); setConnections(parsed.edges || []); setTemplateModalOpen(false); } catch { alert("模板数据格式错误"); } }} />
            </section>
            {assistantMounted ? (
                <CanvasAssistantPanel
                    nodes={nodes}
                    selectedNodeIds={selectedNodeIds}
                    sessions={chatSessions}
                    activeSessionId={activeChatId}
                    onSelectNodeIds={setSelectedNodeIds}
                    onSessionsChange={handleAssistantSessionsChange}
                    onInsertImage={insertAssistantImage}
                    onInsertText={insertAssistantText}
                    onPasteImage={pasteAssistantImage}
                    onCollapseStart={() => setAssistantCollapsed(true)}
                    onCollapse={() => setAssistantMounted(false)}
                    onApplyStoryboard={handleApplyStoryboardScenes}
                />
            ) : null}
        </main>
    );
}
