export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Panorama = "panorama",
    Text = "text",
    Config = "config",
    Video = "video",
    Audio = "audio",
    Director = "director",
    Group = "group",
    Character = "character",
}

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "audio";
export type CanvasImageGenerationType = "generation" | "edit";

export type CameraControlOptions = {
    enabled: boolean;
    camera: string;
    lens: string;
    focalLength: number;
    aperture: number;
};

export type CanvasNodeMetadata = {
    content?: string;
    groupId?: string;
    composerContent?: string;
    prompt?: string;
    status?: CanvasNodeStatus;
    errorDetails?: string;
    fontSize?: number;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    channelId?: string;
    size?: string;
    quality?: string;
    count?: number;
    seconds?: string;
    vquality?: string;
    mode?: string;
    negativePrompt?: string;
    generateAudio?: string;
    characterOrientation?: string;
    watermark?: string;
    audioVoice?: string;
    audioFormat?: string;
    audioSpeed?: string;
    audioInstructions?: string;
    references?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    isBatchRoot?: boolean;
    batchRootId?: string;
    batchChildIds?: string[];
    batchUsesReferenceImages?: boolean;
    primaryImageId?: string;
    imageBatchExpanded?: boolean;
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    durationMs?: number;
    startedAt?: number;
    progress?: number;
    imageTaskId?: string;
    imageTaskResultId?: string;
    audioTaskId?: string;
    audioTaskResultId?: string;
    videoTaskId?: string;
    videoTaskVideoId?: string;
    firstFrameNodeId?: string;
    lastFrameNodeId?: string;
    multiShot?: string;
    shotType?: string;
    klingImageNodeIds?: string[];
    klingMultiPrompt?: { textNodeId?: string; duration?: string }[];
    klingElementList?: { name?: string; description?: string; nodeIds?: string[] }[];
    cameraControl?: CameraControlOptions;
    panoramaSourcePrompt?: string;
    panoramaFinalPrompt?: string;
    panoramaProjection?: "equirectangular";
    directorProject?: unknown;
    characterIds?: string[];
    characterId?: string;
    characterName?: string;
    characterPromptTemplate?: string;
    characterReferenceUrls?: string[];
    coverUrl?: string;
    nodeMaxWidth?: number;
    nodeMaxHeight?: number;
};

export type CanvasDirectorPanorama = {
    edgeId: string;
    sourceNodeId: string;
    imageUrl: string;
    fileName: string;
    projectionMode: "equirectangular" | "backdrop";
};

export type CanvasDirectorCapture = {
    dataUrl: string;
    fileName: string;
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeType;
    title: string;
    position: Position;
    width: number;
    height: number;
    metadata?: CanvasNodeMetadata;
};

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
};

export type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeType;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
    source?: "asset" | "library";
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant";
    mode: "ask" | "image";
    text: string;
    isLoading?: boolean;
    references?: CanvasAssistantReference[];
    images?: CanvasAssistantImage[];
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

export type ContextMenuState =
    | {
          type: "node";
          x: number;
          y: number;
          nodeId: string;
      }
    | {
          type: "connection";
          x: number;
          y: number;
          connectionId: string;
      };

export type PendingConnectionCreate = {
    connection: ConnectionHandle;
    position: Position;
};

