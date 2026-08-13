"use client";

import { useState, type ReactNode } from "react";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { usePromptFavorites } from "@/hooks/use-prompt-favorites";

type Props = {
    prompt: string;
    children: ReactNode;
};

export function CanvasPromptFavContextMenu({ prompt, children }: Props) {
    const theme = canvasThemes[useThemeStore((s) => s.theme)];
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const { savePrompt, toggleFavorite, favorites } = usePromptFavorites();

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!prompt.trim()) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
    };

    const handleSave = () => {
        savePrompt(prompt);
        setMenu(null);
    };

    const existing = favorites.find((p) => p.text === prompt.trim());

    return (
        <div onContextMenu={handleContextMenu} style={{ display: "contents" }}>
            {children}
            {menu ? (
                <>
                    <div className="fixed inset-0 z-[190]" onClick={() => setMenu(null)} />
                    <div
                        className="fixed z-[195] min-w-[160px] overflow-hidden rounded-lg border py-1 shadow-xl backdrop-blur"
                        style={{ left: menu.x, top: menu.y, background: theme.toolbar.panel, borderColor: theme.toolbar.border }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition hover:opacity-80"
                            style={{ color: theme.node.text }}
                            onClick={handleSave}
                        >
                            {existing ? "⭐ 已收藏" : "☆ 收藏此提示词"}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}
