"use client";

import { useState, useCallback, useMemo } from "react";
import { BookmarkPlus, Clapperboard, ImageIcon, MessageSquare, Tag, Video, X, Star } from "lucide-react";
import { Button, Tooltip, Select } from "antd";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { usePromptFavorites, type SavedPrompt, type SavedPromptType } from "@/hooks/use-prompt-favorites";

const typeIcons: Record<SavedPromptType, React.ReactNode> = {
    image: <ImageIcon className="size-3" />,
    text: <MessageSquare className="size-3" />,
    video: <Video className="size-3" />,
    director: <Clapperboard className="size-3" />,
};

const typeLabels: Record<SavedPromptType, string> = {
    image: "图片",
    text: "文本",
    video: "视频",
    director: "导演台",
};

type Props = { onSelect: (prompt: string) => void; currentPrompt?: string };

export function CanvasPromptQuickPanel({ onSelect, currentPrompt = "" }: Props) {
    const theme = canvasThemes[useThemeStore((s) => s.theme)];
    const [open, setOpen] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string>("");
    const [filterType, setFilterType] = useState<SavedPromptType | "">("");
    const { ready, favorites, recent, categories, types, savePrompt, toggleFavorite, removePrompt, setCategory } = usePromptFavorites();

    const handleOpen = useCallback(() => setOpen(true), []);
    const handleSelect = useCallback((text: string) => { onSelect(text); setOpen(false); }, [onSelect]);

    const filterBy = (items: SavedPrompt[]) => {
        let result = items;
        if (filterCategory) result = result.filter((p) => p.category === filterCategory);
        if (filterType) result = result.filter((p) => p.type === filterType);
        return result;
    };

    const favs = filterBy(favorites);
    const recents = filterBy(recent);

    const inputStyle = {
        className: "!h-7 !rounded-lg !text-xs",
        style: { background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text },
    };

    return (
        <div className="relative shrink-0" data-canvas-no-zoom onMouseDown={(e) => e.stopPropagation()}>
            <Tooltip title="收藏提示词">
                <Button
                    type="text"
                    className="!h-9 !shrink-0 !rounded-full !px-3 !text-xs"
                    style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text, border: "1px solid " + theme.node.stroke }}
                    icon={<BookmarkPlus className="size-3.5" />}
                    onClick={(e) => { e.stopPropagation(); handleOpen(); }}
                >
                    收藏
                </Button>
            </Tooltip>

            {open ? (
                <>
                    <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
                    <div
                        className="fixed left-1/2 top-1/2 z-[210] w-[420px] max-h-[70vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border p-5"
                        style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text, boxShadow: "0 18px 54px rgba(28,25,23,.18)" }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <span className="text-lg font-semibold">快捷提示词</span>
                            <Button size="small" disabled={!currentPrompt.trim()} onClick={() => savePrompt(currentPrompt, "text")}>收藏当前</Button>
                        </div>

                        <div className="mb-3 flex items-center gap-2">
                            {types.length > 1 ? (
                                <Select
                                    size="small"
                                    className="!w-24"
                                    placeholder="类型筛选"
                                    allowClear
                                    value={filterType || undefined}
                                    onChange={(v) => setFilterType((v || "") as SavedPromptType | "")}
                                    options={types.map((t) => ({ value: t, label: typeLabels[t] }))}
                                />
                            ) : null}
                            {categories.length > 0 ? (
                                <Select
                                    size="small"
                                    className="!w-28"
                                    popupMatchSelectWidth={false}
                                    placeholder="分类筛选"
                                    allowClear
                                    value={filterCategory || undefined}
                                    onChange={(v) => setFilterCategory(v || "")}
                                    options={categories.map((c) => ({ value: c, label: c }))}
                                />
                            ) : null}
                        </div>

                        {favs.length > 0 ? (
                            <Group
                                icon={<Star className="size-3.5" fill="#f59e0b" />}
                                title={`收藏 (${favs.length})`}
                                items={favs}
                                categories={categories}
                                theme={theme}
                                onSelect={handleSelect}
                                onToggleFav={toggleFavorite}
                                onRemove={removePrompt}
                                onSetCategory={setCategory}
                            />
                        ) : null}

                        <Group
                            icon={<span className="opacity-40">🕐</span>}
                            title="最近使用"
                            items={recents}
                            categories={categories}
                            theme={theme}
                            onSelect={handleSelect}
                            onToggleFav={toggleFavorite}
                            onRemove={removePrompt}
                            onSetCategory={setCategory}
                        />

                        {!favs.length && !recents.length ? (
                            <div className="py-8 text-center text-sm opacity-50">
                                还没有收藏或使用过的提示词<br />
                                <span className="text-xs">提示词库 · 模板 · 快捷提示词 三个按钮均可快速填入</span>
                            </div>
                        ) : null}
                    </div>
                </>
            ) : null}
        </div>
    );
}

function Group({ icon, title, items, categories, theme, onSelect, onToggleFav, onRemove, onSetCategory }: {
    icon: React.ReactNode; title: string;
    items: SavedPrompt[];
    categories: string[];
    theme: import("@/lib/canvas-theme").CanvasTheme;
    onSelect: (text: string) => void;
    onToggleFav: (id: string) => void;
    onRemove: (id: string) => void;
    onSetCategory: (id: string, category: string) => void;
}) {
    if (!items.length) return null;
    return (
        <div className="mb-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium opacity-50">{icon}<span>{title}</span></div>
            <div className="grid gap-1">
                {items.map((item) => (
                    <div key={item.id} className="group flex items-center gap-1 rounded-lg border px-3 py-2 text-left text-sm"
                        style={{ borderColor: theme.node.stroke, background: theme.node.fill }}>
                        <span className="shrink-0 opacity-35" title={typeLabels[item.type]}>{typeIcons[item.type]}</span>
                        <button type="button" className="min-w-0 flex-1 truncate text-left" style={{ color: theme.node.text }}
                            onClick={() => onSelect(item.text)} title={item.text}>
                            {item.text}
                        </button>
                        <Tooltip title={item.category || "未分类"}>
                            <Select
                                size="small"
                                className="!w-20 shrink-0 opacity-0 group-hover:opacity-100"
                                popupMatchSelectWidth={false}
                                placeholder="分类"
                                value={item.category || undefined}
                                onChange={(v) => onSetCategory(item.id, v || "")}
                                options={categories.map((c) => ({ value: c, label: c }))}
                                dropdownRender={(menu) => (
                                    <>
                                        {menu}
                                        <div className="border-t px-2 py-1" style={{ borderColor: theme.node.stroke }}>
                                            <input
                                                className="w-full bg-transparent text-xs outline-none"
                                                style={{ color: theme.node.text }}
                                                placeholder="+ 新建分类"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        const input = e.currentTarget.value.trim();
                                                        if (input) { onSetCategory(item.id, input); e.currentTarget.value = ""; }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </>
                                )}
                            />
                        </Tooltip>
                        <button type="button" className="shrink-0 rounded p-1 opacity-40 hover:opacity-100"
                            style={{ color: item.favorited ? "#f59e0b" : theme.node.muted }}
                            onClick={() => onToggleFav(item.id)}
                            title={item.favorited ? "取消收藏" : "收藏"}>
                            <Star className="size-3" fill={item.favorited ? "currentColor" : "none"} />
                        </button>
                        <button type="button" className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-40 hover:!opacity-100"
                            style={{ color: theme.node.muted }} onClick={() => onRemove(item.id)} title="删除">
                            <X className="size-3" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
