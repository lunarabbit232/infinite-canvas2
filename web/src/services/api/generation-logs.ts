import { apiDelete, apiGet, apiPost } from "@/services/api/request";

export async function fetchVideoGenerationLogs<T>(token: string) {
    return apiGet<T[]>("/api/v1/generation-logs/videos", undefined, token);
}

export async function saveVideoGenerationLogs<T>(token: string, logs: T[]) {
    return apiPost<T[]>("/api/v1/generation-logs/videos", { logs }, token);
}

export async function deleteVideoGenerationLog(token: string, id: string) {
    return apiDelete<{ deleted: boolean }>(`/api/v1/generation-logs/videos/${encodeURIComponent(id)}`, token);
}

export async function deleteVideoGenerationLogs(token: string, ids: string[]) {
    return apiPost<{ deleted: boolean }>("/api/v1/generation-logs/videos/delete", { ids }, token);
}

export async function fetchImageGenerationLogs<T>(token: string) {
    return apiGet<T[]>("/api/v1/generation-logs/images", undefined, token);
}

export async function saveImageGenerationLogs<T>(token: string, logs: T[]) {
    return apiPost<T[]>("/api/v1/generation-logs/images", { logs }, token);
}

export async function deleteImageGenerationLogs(token: string, ids: string[]) {
    return apiPost<{ deleted: boolean }>("/api/v1/generation-logs/images/delete", { ids }, token);
}


