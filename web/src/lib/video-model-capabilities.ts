export function modelKey(modelName: string) {
    return modelName.trim().toLowerCase().replace(/[._/]+/g, "-");
}

function matchAny(model: string, patterns: string[]): boolean {
    return patterns.some((p) => model.includes(p));
}

const FRAME_REFERENCE_EXACT = new Set([
    "bytedance-seedance-2",
    "bytedance-seedance-2-fast",
    "bytedance-seedance-2-mini",
    "wan-2-7-image-to-video",
    "bytedance-v1-lite-image-to-video",
    "hailuo-02-image-to-video-standard",
    "hailuo-02-image-to-video-pro",
    "kling-v2-1-pro",
    "kling-v2-5-turbo-image-to-video-pro",
    "happyhorse-1-1",
]);

const FRAME_REFERENCE_PARTIAL = [
    "doubao-seedance-2-0",
    "doubao-seedance-1-5",
    "doubao-seedance-1-0",
    "minimax-hailuo-02",
    "skyreels-v4",
    "pixverse-v6",
    "viduq3",
    "vidu-q3",
];

const AUDIO_GENERATION_EXACT = new Set([
    "kling-2-6-text-to-video",
    "kling-2-6-image-to-video",
    "kling-text-to-video",
    "kling-image-to-video",
    "bytedance-seedance-2",
    "bytedance-seedance-2-fast",
    "bytedance-seedance-2-mini",
    "wan-2-6-flash-image-to-video",
    "wan-2-6-flash-video-to-video",
    "wan2-6",
    "wan2-6-i2v-flash",
]);

const AUDIO_GENERATION_PARTIAL = [
    "bytedance-seedance-1-5",
    "doubao-seedance-2-0",
    "doubao-seedance-1-5",
    "kling-v2-6",
    "kling-2-6",
    "pixverse-v6",
    "viduq3-pro",
    "vidu-q3-pro",
    "viduq3-turbo",
];

export function supportsVideoFrameReferences(modelName: string): boolean {
    const model = modelKey(modelName);
    if (FRAME_REFERENCE_EXACT.has(model)) return true;
    if (matchAny(model, FRAME_REFERENCE_PARTIAL)) return true;
    if (model.includes("veo3-1") && model.includes("official")) return true;
    return false;
}

export function supportsVideoAudioGeneration(modelName: string): boolean {
    const model = modelKey(modelName);
    if (model.includes("motion-control")) return false;
    if (AUDIO_GENERATION_EXACT.has(model)) return true;
    if (matchAny(model, AUDIO_GENERATION_PARTIAL)) return true;
    if (model.includes("veo") && model.includes("official")) return true;
    if ((model.includes("kling-v3") || model.includes("kling-3-0")) && !model.includes("turbo")) return true;
    return false;
}
