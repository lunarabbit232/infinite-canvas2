import { apiDelete, apiGet, apiPost } from "@/services/api/request";

export type KnowledgeEntry = {
    id: string;
    category: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
};

export const fetchKnowledgeEntries = (token: string, category?: string) => {
    const params = category ? `?category=${encodeURIComponent(category)}` : "";
    return apiGet<KnowledgeEntry[]>(`/api/admin/knowledge${params}`, undefined, token);
};

export const saveKnowledgeEntry = (token: string, data: Partial<KnowledgeEntry>) => {
    return apiPost<KnowledgeEntry>("/api/admin/knowledge", data, token);
};

export const deleteKnowledgeEntry = (token: string, id: string) => {
    return apiDelete<boolean>(`/api/admin/knowledge/${encodeURIComponent(id)}`, token);
};
