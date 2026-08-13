import { apiGet, apiPost, compactApiParams } from "@/services/api/request";

export type AssetTag = {
    name: string;
    color?: string;
    parent?: string;
};

export type AssetLibraryItem = {
    id: string;
    title: string;
    type: "text" | "image" | "video" | "audio";
    coverUrl: string;
    tags: AssetTag[];
    category: string;
    description: string;
    content: string;
    url: string;
    usage: string;
    style: string;
    source: string;
    fileSize?: number;
    mimeType?: string;
    durationMs?: number;
    width?: number;
    height?: number;
    createdAt: string;
    updatedAt: string;
};

export type AssetLibraryResponse = {
    items: AssetLibraryItem[];
    tags: string[];
    total: number;
};

export type AssetLibraryQuery = {
    keyword?: string;
    type?: string;
    usage?: string;
    style?: string;
    tag?: string[];
    page?: number;
    pageSize?: number;
};

export type BatchImportResult = {
    succeeded: number;
    failed: number;
    items: AssetLibraryItem[];
    errors?: string[];
};

export async function fetchAssetLibrary(query: AssetLibraryQuery = {}) {
    return apiGet<AssetLibraryResponse>("/api/assets", compactApiParams(query));
}

export async function batchImportAssets(items: Partial<AssetLibraryItem>[]) {
    return apiPost<BatchImportResult>("/api/assets/batch", items);
}

export type SemanticSearchResult = {
    items: AssetLibraryItem[];
    total: number;
    query: string;
};

export async function searchSemanticAssets(query: string, topK: number = 20) {
    return apiPost<SemanticSearchResult>("/api/assets/search/semantic", { query, topK });
}

export async function interrogateImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("image", file);
    const resp = await fetch("/api/assets/interrogate", { method: "POST", body: formData });
    const json = await resp.json();
    if (json.code !== 0) throw new Error(json.msg || "反推失败");
    return json.data.prompt;
}

// 素材-提示词绑定
export type AssetPromptBind = {
    id: string;
    assetId: string;
    promptId: string;
    type: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    promptTitle: string;
    promptText: string;
    promptTags: string[];
    category: string;
};

export async function fetchAssetPrompts(assetId: string) {
    return apiGet<AssetPromptBind[]>("/api/assets/prompts", { assetId });
}

export async function bindPromptToAsset(assetId: string, promptId: string, type: string = "positive") {
    return apiPost<AssetPromptBind>("/api/assets/prompts/bind", { assetId, promptId, type });
}

export async function unbindPromptFromAsset(id: string) {
    return apiPost("/api/assets/prompts/unbind", { id });
}
