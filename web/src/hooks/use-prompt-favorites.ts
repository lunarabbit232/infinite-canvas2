// 提示词收藏 — localforage 持久化
// 分为「收藏」和「最近使用」两个列表

import { useCallback, useEffect, useState } from "react";
import localforage from "localforage";

export type SavedPromptType = "image" | "text" | "video" | "director";

export type SavedPrompt = {
    id: string;
    text: string;
    type: SavedPromptType;
    createdAt: number;
    usedAt: number;
    useCount: number;
    favorited: boolean;
    category: string;
};

const STORE = localforage.createInstance({ name: "infinite-canvas", storeName: "saved_prompts" });
const MAX_RECENT = 20;
const MAX_FAVORITES = 50;

async function loadAll(): Promise<SavedPrompt[]> {
    try {
        const raw = await STORE.getItem<SavedPrompt[]>("list");
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

async function saveAll(items: SavedPrompt[]) {
    await STORE.setItem("list", items);
}

export function usePromptFavorites() {
    const [items, setItems] = useState<SavedPrompt[]>([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        loadAll().then((list) => { setItems(list); setReady(true); });
    }, []);

    const favorites = items.filter((p) => p.favorited).sort((a, b) => b.usedAt - a.usedAt);
    const recent = items.filter((p) => !p.favorited).sort((a, b) => b.usedAt - a.usedAt).slice(0, 8);

    const savePrompt = useCallback(async (text: string, type: SavedPromptType = "text") => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const now = Date.now();
        setItems((prev) => {
            const existing = prev.find((p) => p.text === trimmed);
            let updated: SavedPrompt[];
            if (existing) {
                updated = prev.map((p) => p.text === trimmed ? { ...p, usedAt: now, useCount: p.useCount + 1 } : p);
            } else {
                const entry: SavedPrompt = { id: Math.random().toString(36).slice(2), text: trimmed, type, createdAt: now, usedAt: now, useCount: 1, favorited: false, category: "" };
                updated = [entry, ...prev].slice(0, MAX_RECENT + MAX_FAVORITES);
            }
            saveAll(updated);
            return updated;
        });
    }, []);

    const toggleFavorite = useCallback(async (id: string) => {
        setItems((prev) => {
            const updated = prev.map((p) => (p.id === id ? { ...p, favorited: !p.favorited, usedAt: Date.now() } : p));
            saveAll(updated);
            return updated;
        });
    }, []);

    const removePrompt = useCallback(async (id: string) => {
        setItems((prev) => {
            const updated = prev.filter((p) => p.id !== id);
            saveAll(updated);
            return updated;
        });
    }, []);

    const setCategory = useCallback(async (id: string, category: string) => {
        setItems((prev) => {
            const updated = prev.map((p) => (p.id === id ? { ...p, category } : p));
            saveAll(updated);
            return updated;
        });
    }, []);

    const categories = [...new Set(items.filter((p) => p.category).map((p) => p.category))].sort();
    const types = [...new Set(items.map((p) => p.type))];

    return { ready, favorites, recent, categories, types, savePrompt, toggleFavorite, removePrompt, setCategory };
}
